"""Offline synthetic artifact/failure tests; no AWS, host services or Live credentials."""
import hashlib,json,os,shutil,subprocess,sys,tempfile,types,unittest
from pathlib import Path
from unittest.mock import patch
import artifact,assets,build,install,template,upload
KEY='pk_live_offlineSyntheticOnly12345';FP=hashlib.sha256(KEY.encode()).hexdigest()

class Build(unittest.TestCase):
 def test_explicit_production_registration_and_minimal_environment(self):
  with patch.dict(os.environ,{'AWS_SECRET_ACCESS_KEY':'never-forward','VITE_SANDBOX_REGISTRATION_ENABLED':'true','ACTIONS_ID_TOKEN_REQUEST_TOKEN':'never-forward'}):
   env=build.environment(KEY,FP,'true')
  self.assertEqual(env['VITE_REGISTRATION_ENABLED'],'true');self.assertEqual(env['VITE_SOURCE_REVISION'],build.REVISION)
  self.assertEqual(env['VITE_TARGET_ENVIRONMENT'],'production');self.assertEqual(env['VITE_PAYMENT_MODE'],'stripe-live')
  for name in ['AWS_SECRET_ACCESS_KEY','VITE_SANDBOX_REGISTRATION_ENABLED','ACTIONS_ID_TOKEN_REQUEST_TOKEN']:self.assertNotIn(name,env)
 def test_bad_key_fingerprint_and_flag_rejected(self):
  for key,fp,flag in [('pk_test_offlineSynthetic',FP,'true'),('sk_live_offlineSynthetic',FP,'true'),(KEY,'a'*64,'true'),(KEY,FP,'TRUE')]:
   with self.subTest(key_mode=key[:7],flag=flag),self.assertRaises(artifact.GateError):build.environment(key,fp,flag)
 def test_running_switch_checks_fail_closed(self):
  install.running_switches_off(1,lambda _:b'REGISTRATION_ENABLED=false\0PAYMENT_STRIPE_INITIATION_ENABLED=false',lambda _:'')
  for raw in [b'REGISTRATION_ENABLED=true\0PAYMENT_STRIPE_INITIATION_ENABLED=false',b'REGISTRATION_ENABLED=false\0PAYMENT_STRIPE_INITIATION_ENABLED=true',b'OTHER=value']:
   with self.assertRaises(artifact.GateError):install.running_switches_off(1,lambda _:raw,lambda _:'')
 def test_source_checks_precede_build(self):
  with patch.object(artifact,'source',side_effect=artifact.GateError('unreviewed')),patch.object(artifact,'command') as commands,self.assertRaises(artifact.GateError):build.build(Path('/unused'),Path('/unused'), 'a'*40,FP,'true')
  commands.assert_not_called()

class Delivery(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.base=Path(self.temp.name)
  self.root=self.base/'production';self.root.mkdir(mode=0o755)
  # Only root-controlled /opt is admitted in Production. Fixtures are unprivileged /tmp.
  mocked=patch.object(install,'trusted');mocked.start();self.addCleanup(mocked.stop)
  pin=patch.object(install,'APPROVED_KEY_SHA256',FP);pin.start();self.addCleanup(pin.stop)
  self.store=install.Store(self.root,os.getuid());self.store.prepare()
 def archive(self,name,registration=False):
  dist=self.base/('dist-'+name);dist.mkdir();(dist/'assets').mkdir()
  (dist/'index.html').write_text('<script src="/assets/app-'+name+'12345678.js"></script>')
  (dist/'assets'/('app-'+name+'12345678.js')).write_text('const key="'+KEY+'";')
  env={'version':1,'target':'production','paymentMode':'stripe-live','siteOrigin':artifact.SITE,'apiBase':'/api','apiEnvironment':'production','publishableKeySha256':FP,'sourceRevision':build.REVISION}
  (dist/'storefront-environment.json').write_text(json.dumps(env))
  archive=self.base/(name+'.tar.gz');digest=artifact.pack(dist,archive,build.REVISION,FP,'d'*40,registration)
  return archive,digest
 def fetch(self,archive):return lambda url,target,digest:shutil.copyfile(archive,target)
 def prepare(self):
  a,d=self.archive('baseline');install.transition(self.store,'prepare','url',d,FP,self.fetch(a));return d
 def deploy(self,check=lambda _:True):
  a,d=self.archive('candidate',True)
  return d,install.transition(self.store,'deploy','url',d,FP,self.fetch(a),check)
 def test_production_baseline_and_deploy_rollback(self):
  old=self.prepare();new,result=self.deploy();self.assertEqual(result,'COMMITTED')
  self.assertEqual(self.store.live(),new)
  self.assertTrue((self.store.current/'index.html').is_file())
  self.assertEqual(self.store.current.resolve(),self.store.releases/new/'site')
  install.transition(self.store,'rollback',check=lambda _:True)
  self.assertEqual(self.store.live(),old);self.store.verify(old)
 def test_health_failure_restores_verified_production(self):
  old=self.prepare()
  with self.assertRaisesRegex(artifact.GateError,'restored'):self.deploy(lambda path:path.name==old)
  self.assertEqual(self.store.live(),old);self.assertFalse(self.store.journal.exists())
 def test_rollback_rechecks_archive_integrity(self):
  old=self.prepare();self.deploy();(self.store.releases/old/'archive.tar.gz').write_bytes(b'tampered')
  with self.assertRaises(artifact.GateError):install.transition(self.store,'rollback',check=lambda _:True)
 def test_sandbox_pointer_never_adopted(self):
  os.symlink('/opt/colorful-life/storefront/current',self.store.current)
  a,d=self.archive('other')
  with self.assertRaisesRegex(artifact.GateError,'Sandbox'):install.transition(self.store,'prepare','url',d,FP,self.fetch(a))
 def test_first_deployment_requires_baseline(self):
  a,d=self.archive('first',True)
  with self.assertRaisesRegex(artifact.GateError,'baseline required'):install.transition(self.store,'deploy','url',d,FP,self.fetch(a))
 def test_existing_baseline_must_be_working_before_change(self):
  old=self.prepare()
  with self.assertRaisesRegex(artifact.GateError,'not served'):self.deploy(lambda _:False)
  self.assertEqual(self.store.live(),old)
 def test_assets_survive_transitions_and_rollback(self):
  old=self.prepare();new,_=self.deploy();records=[self.store.verify(x) for x in [old,new]]
  install.transition(self.store,'rollback',check=lambda _:True)
  for record in records:assets.verify(self.store,record,lambda *_:None)
 def test_archive_digest_and_production_identity_rejected(self):
  a,d=self.archive('wrong',True)
  with self.assertRaises(artifact.GateError):self.store.stage('url','a'*64,FP,True,self.fetch(a))
  with self.assertRaises(artifact.GateError):self.store.stage('url',d,FP,False,self.fetch(a))
 def test_interrupted_pointer_commit_recovers_previous(self):
  old=self.prepare();a,new=self.archive('new',True);self.store.stage('url',new,FP,True,self.fetch(a))
  before=self.store.state();install.atomic(self.store.journal,{'before':before,'target':new});self.store.point(new)
  self.assertEqual(install.transition(self.store,'rollback',check=lambda _:True),'RECOVERED')
  self.assertEqual(self.store.live(),old)
 def test_failed_state_commit_rolls_back(self):
  old=self.prepare();real=self.store.save
  def save(state):
   if state['current']!=old:raise OSError('disk failure')
   real(state)
  with patch.object(self.store,'save',side_effect=save),self.assertRaisesRegex(artifact.GateError,'restored'):self.deploy()
  self.assertEqual(self.store.live(),old)
 def test_health_binds_index_manifest_and_chunks_to_public_and_local_tls(self):
  old=self.prepare();release=self.store.releases/old
  calls=[]
  def response(args,**kwargs):
   calls.append(args);url=args[-1];name=url.removeprefix(artifact.SITE+'/') or 'index.html'
   return (release/'site'/name).read_bytes()
  with patch.object(install.subprocess,'check_output',side_effect=response):self.assertTrue(install.health(release))
  self.assertEqual(len(calls),6)
  self.assertTrue(any('--resolve' in args for args in calls));self.assertTrue(any('--resolve' not in args for args in calls))
  with patch.object(install.subprocess,'check_output',return_value=b'unexpected served content'):self.assertFalse(install.health(release))
 def test_asset_store_tampering_rejects_retained_release(self):
  old=self.prepare();asset=next((self.root/'asset-store/assets').iterdir());asset.write_text('modified')
  with self.assertRaises(artifact.GateError):self.store.verify(old)
 def test_unsafe_archive_paths_rejected(self):
  import io,tarfile
  path=self.base/'unsafe.tar.gz'
  with tarfile.open(path,'w:gz') as tar:
   entry=tarfile.TarInfo('../escape.txt');entry.size=1;tar.addfile(entry,io.BytesIO(b'x'))
  with self.assertRaises(artifact.GateError):artifact.unpack(path,self.base/'unpacked',artifact.digest(path))
  self.assertFalse((self.base/'escape.txt').exists())
 def test_test_keys_in_output_rejected(self):
  self.archive('crossed');dist=self.base/'dist-crossed'
  (dist/'assets/test.js').write_text('pk_test_offlineSyntheticOnly12345')
  with self.assertRaises(artifact.GateError):artifact.inventory(dist,FP)
 def test_supplied_key_fingerprint_cannot_self_approve(self):
  a,d=self.archive('unapproved')
  with self.assertRaisesRegex(artifact.GateError,'independent owner'):self.store.stage('url',d,'a'*64,False,self.fetch(a))
  self.assertFalse((self.store.releases/d).exists())
 def test_unset_pin_blocks_staging_and_retained_verification(self):
  old=self.prepare();a,d=self.archive('no-pin')
  with patch.object(install,'APPROVED_KEY_SHA256',None):
   with self.assertRaisesRegex(artifact.GateError,'prerequisite missing'):self.store.stage('url',d,FP,False,self.fetch(a))
   with self.assertRaisesRegex(artifact.GateError,'prerequisite missing'):self.store.verify(old)
 def test_wrong_environment_bundle_is_rejected(self):
  a,d=self.archive('mode')
  dist=self.base/'dist-mode';env=json.loads((dist/'storefront-environment.json').read_text());env['target']='sandbox';(dist/'storefront-environment.json').write_text(json.dumps(env))
  with self.assertRaises(artifact.GateError):artifact.inventory(dist,FP)

class RollbackPreflight(unittest.TestCase):
 def preflight(self,rollback=False,prepare=False,advanced=False,registration=False,guard_present=True,guard_reject=False,route_changed=False,bad_health=False,bad_root=False):
  m={'backendCommit':'e'*40 if advanced else '51ab89108b825e4ad17c41d7c6ab5325bb7a9f26','apiImage':'919693204623.dkr.ecr.eu-west-2.amazonaws.com/colorful-life-production-api@sha256:'+('e'*64 if advanced else 'ffd02a031aa32ced1d541ec219b837ce9453bb0808254945c86e8fa110fe5c84')}
  raw=json.dumps(m).encode();route=b'reviewed route include'
  dump=b'root /opt/colorful-life-production/storefront/current; root /opt/colorful-life-production/storefront/asset-store;'
  if bad_root:dump=b'root /other;'
  digest=hashlib.sha256(dump).hexdigest()
  guard=types.SimpleNamespace(read=lambda *_:{} if guard_present else None,enforce=unittest.mock.Mock(side_effect=artifact.GateError('Guard rejected current image') if guard_reject else None))
  def readbytes(path):
   if path.name=='current.json':return raw
   if path.name=='browser-api-locations.conf':return b'changed' if route_changed else route
   if path.name=='runtime.json':return json.dumps({'PRODUCTION_REGISTRATION_ENABLED':'true' if registration else 'false','PRODUCTION_PAYMENT_INITIATION_ENABLED':'true' if registration else 'false'}).encode()
   raise AssertionError('Unexpected read')
  def private(path,owner):return m if path.name=='current.json' else {'manifestSha256':hashlib.sha256(raw).hexdigest()}
  def command(args,**kwargs):
   if args==['nginx','-T']:return dump
   return json.dumps([{'Config':{'Image':m['apiImage']},'State':{'Running':True,'Health':{'Status':'unhealthy' if bad_health else 'healthy'},'Pid':1}}]).encode()
  with patch.dict(sys.modules,{'production_compatibility':guard}),patch.object(install.os,'geteuid',return_value=0),patch.object(Path,'read_text',return_value='i-02b28336518077a8f'),patch.object(Path,'read_bytes',readbytes),patch.object(Path,'exists',return_value=False),patch.object(Path,'is_symlink',return_value=False),patch.object(install,'private',side_effect=private),patch.object(install,'ROUTES',hashlib.sha256(route).hexdigest()),patch.object(install.subprocess,'check_output',side_effect=command),patch.object(install,'running_switches_off') as switches:
   install.preflight(digest,prepare=prepare,rollback=rollback)
  return switches,guard
 def test_rollback_allows_new_compatible_backend_and_active_switches(self):
  switches,guard=self.preflight(rollback=True,advanced=True,registration=True)
  switches.assert_not_called();self.assertEqual(guard.enforce.call_count,1)
 def test_prepare_and_deploy_keep_exact_backend_requirement(self):
  for prepare in [False,True]:
   with self.subTest(prepare=prepare),self.assertRaisesRegex(artifact.GateError,'backend identity'):self.preflight(prepare=prepare,advanced=True)
 def test_prepare_and_deploy_keep_switches_off_requirement(self):
  for prepare in [False,True]:
   with self.subTest(prepare=prepare),self.assertRaisesRegex(artifact.GateError,'remain OFF'):self.preflight(prepare=prepare,registration=True)
 def test_rollback_still_requires_guard_routes_root_and_health(self):
  for change in [{'guard_present':False},{'guard_reject':True},{'route_changed':True},{'bad_health':True},{'bad_root':True}]:
   with self.subTest(change=change),self.assertRaises(artifact.GateError):self.preflight(rollback=True,advanced=True,registration=True,**change)

class Upload(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.archive=Path(self.tmp.name)/'archive';self.archive.write_bytes(b'content-addressed bytes');self.digest=artifact.digest(self.archive)
 def test_new_upload_success(self):
  run=unittest.mock.Mock(return_value=subprocess.CompletedProcess([],0,'',''))
  self.assertEqual(upload.upload(self.archive,self.digest,run),'Archive uploaded');self.assertEqual(run.call_count,1)
 def reuse(self,error='PreconditionFailed',content=None,download_error=False):
  calls=[]
  def run(args,**kwargs):
   calls.append(args)
   if 'put-object' in args:return subprocess.CompletedProcess(args,254,'','An error occurred ('+error+') when calling the PutObject operation: Condition failed')
   if not download_error:Path(args[-1]).write_bytes(self.archive.read_bytes() if content is None else content)
   return subprocess.CompletedProcess(args,1 if download_error else 0,'','')
  return run,calls
 def test_412_continues_only_after_actual_object_digest_match(self):
  for error in ['412','PreconditionFailed']:
   run,calls=self.reuse(error)
   self.assertEqual(upload.upload(self.archive,self.digest,run),'Existing archive independently verified')
   self.assertEqual(len(calls),2);self.assertIn('get-object',calls[1])
 def test_412_mismatch_or_failed_download_rejected(self):
  for options in [{'content':b'wrong object'},{'download_error':True}]:
   run,_=self.reuse(**options)
   with self.assertRaises(artifact.GateError):upload.upload(self.archive,self.digest,run)
 def test_other_upload_errors_do_not_download_or_continue(self):
  for error in ['AccessDenied','409','InvalidClientTokenId']:
   run,calls=self.reuse(error)
   with self.assertRaises(artifact.GateError):upload.upload(self.archive,self.digest,run)
   self.assertEqual(len(calls),1)
 def test_wrong_local_digest_rejected_before_aws(self):
  run=unittest.mock.Mock()
  with self.assertRaises(artifact.GateError):upload.upload(self.archive,'a'*64,run)
  run.assert_not_called()

class Isolation(unittest.TestCase):
 def test_sandbox_and_other_branches_cannot_assume_production_role(self):
  t=template.template();trust=t['Resources']['DeployRole']['Properties']['AssumeRolePolicyDocument']['Statement'][0]['Condition']['StringEquals']
  production=trust['token.actions.githubusercontent.com:sub']
  self.assertTrue(production.endswith(':ref:refs/heads/production-storefront-release'))
  for subject in [production.replace('production-storefront-release','main'),production.replace('production-storefront-release','other'),production.replace('1368891907','1')]:self.assertNotEqual(production,subject)
  self.assertEqual(trust['token.actions.githubusercontent.com:aud'],'sts.amazonaws.com')
 def test_permissions_are_new_target_only_and_no_root_shell_document(self):
  t=template.template();statements=t['Resources']['DeployRole']['Properties']['Policies'][0]['PolicyDocument']['Statement']
  actions={a for s in statements for a in s['Action']}
  self.assertEqual(actions,{'s3:PutObject','s3:GetObject','ssm:SendCommand','ssm:GetCommandInvocation'})
  text=json.dumps(statements);self.assertNotIn('sandbox',text.lower());self.assertNotIn('AWS-RunShellScript',text)
  self.assertNotIn('iam:',text);self.assertIn('ColorfulLife-ProductionStorefrontManual',text)
 def test_workflow_manual_disabled_default_and_source_pinned(self):
  text=(Path(__file__).parents[2]/'.github/workflows/production-storefront-manual.yml').read_text()
  self.assertIn('  workflow_dispatch:',text);self.assertNotIn('\n  push:',text)
  for value in [build.REVISION,"vars.PRODUCTION_FRONTEND_DELIVERY_ENABLED == 'true'",'inputs.authorized',"github.ref == 'refs/heads/production-storefront-release'"]:self.assertIn(value,text)
  self.assertNotIn('environment:',text);self.assertNotIn('attest',text.lower())
 def test_ssm_parameters_are_bounded_env_values_and_only_fixed_installer(self):
  doc=template.template()['Resources']['Delivery']['Properties']['Content']
  self.assertEqual(doc['parameters']['Action']['allowedValues'],['prepare','deploy','rollback'])
  for param in doc['parameters'].values():self.assertEqual(param['interpolationType'],'ENV_VAR')
  commands='\n'.join(doc['mainSteps'][0]['inputs']['runCommand'])
  self.assertNotIn('{{',commands);self.assertIn('"$SSM_Action"',commands)
  self.assertNotIn('release.py',commands);self.assertNotIn('systemctl',commands)
 def test_url_rejects_sandbox_wrong_digest_and_redirect_hosts(self):
  for url in ['https://colorful-life-sandbox-releases-919693204623.s3.eu-west-2.amazonaws.com/storefront/x.tar.gz','https://example.com/a','http://'+install.BUCKET+'.s3.eu-west-2.amazonaws.com/storefront/'+'a'*64+'.tar.gz']:
   with self.assertRaises(artifact.GateError):install.download(url,Path('/unused'),'a'*64)

if __name__=='__main__':unittest.main()
