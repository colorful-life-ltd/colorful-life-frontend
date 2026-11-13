"""Production-only extension of the existing S3/SSM + versioned-symlink installer.
No nginx, Docker lifecycle, backend switch, IAM or other-project mutation.
"""
import argparse,fcntl,hashlib,json,os,re,shutil,stat,subprocess,tempfile,urllib.parse,urllib.request
from pathlib import Path
import artifact,primitives,assets
ROOT=Path('/opt/colorful-life-production/storefront')
BUCKET='colorful-life-production-storefront-919693204623'
REVISION='69ccd28e0c3e2e3663f3f39564bbbd33f811b605'
ROUTES='960c0be2d745373b50eee4c5dcc68a8e6164f24f91e2f944c61b4e15deaad208'
# No approved fingerprint has been supplied. A reviewed pin is required before publication.
APPROVED_KEY_SHA256=None

def approved_fingerprint(value):
    if not isinstance(APPROVED_KEY_SHA256,str) or not artifact.DIGEST.fullmatch(APPROVED_KEY_SHA256):raise artifact.GateError('Owner-approved key fingerprint prerequisite missing')
    if value!=APPROVED_KEY_SHA256:raise artifact.GateError('Key fingerprint differs from independent owner approval')

def trusted(path,owner=0,mode=None):
    for p in [Path(path),*Path(path).parents]:
        s=p.lstat()
        if stat.S_ISLNK(s.st_mode) or s.st_uid!=owner or s.st_mode&0o022:raise artifact.GateError('Untrusted Production path')
    if mode is not None and stat.S_IMODE(path.stat().st_mode)!=mode:raise artifact.GateError('Incorrect Production permissions')

def private(path,owner):
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as f:
        s=os.fstat(f.fileno())
        if not stat.S_ISREG(s.st_mode) or s.st_uid!=owner or stat.S_IMODE(s.st_mode)!=0o600:raise artifact.GateError('Unsafe control file')
        return json.load(f)

def atomic(path,value):
    fd,name=tempfile.mkstemp(prefix='.pending-',dir=path.parent)
    try:
        with os.fdopen(fd,'w') as f:
            os.fchmod(f.fileno(),0o600);json.dump(value,f,sort_keys=True);f.flush();os.fsync(f.fileno())
        os.replace(name,path);sync(path.parent)
    finally:
        if os.path.exists(name):os.unlink(name)

def sync(path):
    fd=os.open(path,os.O_RDONLY|os.O_DIRECTORY)
    try:os.fsync(fd)
    finally:os.close(fd)

def download(url,target,digest):
    p=urllib.parse.urlsplit(url)
    if p.scheme!='https' or p.hostname!=BUCKET+'.s3.eu-west-2.amazonaws.com' or p.port not in (None,443) or p.username or p.password or p.fragment or p.path!='/storefront/'+digest+'.tar.gz':raise artifact.GateError('Production artifact URL required')
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*_):return None
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
    total=0
    with opener.open(url,timeout=30) as source,target.open('xb') as output:
        while data:=source.read(1024*1024):
            total+=len(data)
            if total>artifact.MAX_BYTES:raise artifact.GateError('Oversized archive')
            output.write(data)
        output.flush();os.fsync(output.fileno())
    if artifact.digest(target)!=digest:raise artifact.GateError('Download digest differs')

class Store(primitives.Store):
    def __init__(self,root=ROOT,owner=0):
        super().__init__(root);self.owner=owner;self.control=self.root/'.manual-control';self.state_file=self.control/'state.json';self.journal=self.control/'journal.json'
    def prepare(self):
        trusted(self.root,self.owner,0o755)
        for path,mode in [(self.control,0o700),(self.releases,0o755)]:
            path.mkdir(mode=mode,exist_ok=True);trusted(path,self.owner,mode)
    def state(self):
        if not(self.state_file.exists() or self.state_file.is_symlink()):return {'current':None,'history':[]}
        state=private(self.state_file,self.owner)
        if set(state)!={'current','history'} or not isinstance(state['history'],list) or any(not isinstance(x,str) or not artifact.DIGEST.fullmatch(x) for x in [state['current'],*state['history']]):raise artifact.GateError('Invalid release state')
        return state
    def save(self,state):atomic(self.state_file,state)
    def live(self):
        if not self.current.is_symlink():return None
        match=re.fullmatch(r'releases/([0-9a-f]{64})/site',os.readlink(self.current))
        return match.group(1) if match else None
    def point(self,target):
        if target is not None and not artifact.DIGEST.fullmatch(target):raise artifact.GateError('Invalid release identifier')
        # Retain the proven atomic rename; only the internal validated site suffix differs.
        super().point(None if target is None else target+'/site')
    def require_pointer(self,target):
        if target is None:
            if self.current.exists() or self.current.is_symlink():raise artifact.GateError('Unrecorded pointer; refusing Sandbox adoption')
        elif not self.current.is_symlink() or os.readlink(self.current)!='releases/'+target+'/site':raise artifact.GateError('Pointer/state differ')
    def verify(self,digest,assets_required=True):
        if not artifact.DIGEST.fullmatch(digest):raise artifact.GateError('Invalid release digest')
        release=self.releases/digest;trusted(release,self.owner,0o755)
        for p in [release/'archive.tar.gz',release/'record.json']:trusted(p,self.owner)
        record=json.loads((release/'record.json').read_text())
        approved_fingerprint(record.get('keyFingerprint'))
        with tempfile.TemporaryDirectory(dir=self.control) as temporary:
            actual=artifact.unpack(release/'archive.tar.gz',Path(temporary),digest)
        if actual!=record or record['sourceRevision']!=REVISION:raise artifact.GateError('Retained Production release identity differs')
        files,env=artifact.inventory(release/'site',record['keyFingerprint'])
        if files!=record['files']:raise artifact.GateError('Release files changed')
        if assets_required:assets.verify(self,record,lambda p,mode=None:trusted(p,self.owner,mode))
        return record
    def stage(self,url,digest,fingerprint,registration,fetch=download):
        approved_fingerprint(fingerprint)
        if not artifact.DIGEST.fullmatch(digest) or not artifact.DIGEST.fullmatch(fingerprint):raise artifact.GateError('Approved archive and key digests required')
        target=self.releases/digest
        if target.exists():record=self.verify(digest,False)
        else:
            with tempfile.TemporaryDirectory(prefix='.incoming-',dir=self.releases) as temporary:
                stage=Path(temporary);archive=stage/'archive.tar.gz';fetch(url,archive,digest)
                unpacked=stage/'unpacked';unpacked.mkdir();record=artifact.unpack(archive,unpacked,digest)
                if record['keyFingerprint']!=fingerprint or record['sourceRevision']!=REVISION or record['registrationEnabled']!=registration:raise artifact.GateError('Production build approval differs')
                os.replace(unpacked/'site',stage/'site');shutil.rmtree(unpacked)
                (stage/'record.json').write_text(json.dumps(record))
                for path in [*stage.rglob('*'),stage]:
                    path.chmod(0o755 if path.is_dir() else 0o644)
                    if path.is_file():
                        with path.open('rb') as f:os.fsync(f.fileno())
                    else:sync(path)
                os.rename(stage,target);sync(self.releases)
        if record['keyFingerprint']!=fingerprint or record['registrationEnabled']!=registration:raise artifact.GateError('Existing build differs from approval')
        assets.publish(self,target,record,lambda p,mode=None:trusted(p,self.owner,mode),sync)
        self.verify(digest);return record

def health(release):
    record=json.loads((release/'record.json').read_text())
    names={'index.html','storefront-environment.json'}
    names.update(re.findall(r'(?:src|href)="/(assets/[^"?]+\.(?:js|css))"',(release/'site/index.html').read_text()))
    for name in names:
        expected=record['files'].get(name)
        if not expected:raise artifact.GateError('Index references unrecorded asset')
        for resolve in [[],['--resolve','build-and-bloom.co.uk:443:127.0.0.1']]:
            data=subprocess.check_output(['curl','--disable','--noproxy','*','--fail','--silent','--max-time','10',*resolve,artifact.SITE+'/'+('' if name=='index.html' else name)],stderr=subprocess.PIPE)
            if hashlib.sha256(data).hexdigest()!=expected:return False
    return True

def transition(store,action,url='',digest='',fingerprint='',fetch=download,check=health):
    state=store.state()
    if store.journal.exists() or store.journal.is_symlink():
        if action!='rollback':raise artifact.GateError('Interrupted deployment; run manual rollback')
        journal=private(store.journal,store.owner);old=journal['before'];target=old['current']
        store.verify(target)
        actual=os.readlink(store.current) if store.current.is_symlink() else None
        if actual not in ['releases/'+target+'/site','releases/'+journal['target']+'/site']:raise artifact.GateError('Interrupted pointer differs')
        store.point(target)
        if not check(store.releases/target):raise artifact.GateError('Recovery health failed; evidence preserved')
        store.save(old);store.journal.unlink();sync(store.control);return 'RECOVERED'
    store.require_pointer(state['current'])
    if action=='prepare':
        if state['current'] is not None:raise artifact.GateError('Baseline already prepared')
        store.stage(url,digest,fingerprint,False,fetch)
        store.point(digest);store.save({'current':digest,'history':[]})
        return 'BASELINE_STAGED_NOT_PUBLICLY_VERIFIED'
    if not state['current']:raise artifact.GateError('Verified Production baseline required; never use Sandbox')
    store.verify(state['current'])
    if not check(store.releases/state['current']):raise artifact.GateError('Current Production baseline is not served and healthy')
    if action=='deploy':store.stage(url,digest,fingerprint,True,fetch);target=digest
    elif action=='rollback':
        if not state['history']:raise artifact.GateError('No previously working Production release')
        target=state['history'][0];store.verify(target)
    else:raise artifact.GateError('Unsupported action')
    atomic(store.journal,{'before':state,'target':target})
    try:
        # Existing symlink switch; no service or nginx restart.
        store.point(target)
        if not check(store.releases/target):raise artifact.GateError('Candidate health failed')
        store.save({'current':target,'history':[state['current'],*[x for x in state['history'] if x not in [state['current'],target]]]})
        store.journal.unlink();sync(store.control);return 'COMMITTED'
    except Exception:
        store.verify(state['current']);store.point(state['current'])
        if not check(store.releases/state['current']):raise artifact.GateError('Rollback health failed; journal preserved') from None
        store.save(state);store.journal.unlink();sync(store.control)
        raise artifact.GateError('Deployment failed; previous verified Production release restored') from None

def running_switches_off(pid,read_bytes=None,read_text=None):
    read_bytes=read_bytes or (lambda p:Path(p).read_bytes())
    read_text=read_text or (lambda p:Path(p).read_text())
    pending=[pid];found=False
    while pending:
        current=pending.pop()
        try:
            values=dict(v.split(b'=',1) for v in read_bytes('/proc/'+str(current)+'/environ').split(b'\0') if b'=' in v)
            if b'REGISTRATION_ENABLED' in values:
                if values[b'REGISTRATION_ENABLED']!=b'false' or values.get(b'PAYMENT_STRIPE_INITIATION_ENABLED')!=b'false':raise artifact.GateError('Running commercial switches must remain OFF')
                found=True
            pending.extend(map(int,read_text('/proc/'+str(current)+'/task/'+str(current)+'/children').split()))
        except (FileNotFoundError,ProcessLookupError):pass
    if not found:raise artifact.GateError('Running commercial switch evidence unavailable')

def preflight(route_digest,prepare=False,rollback=False):
    if prepare and rollback:raise artifact.GateError('Invalid preflight action')
    if os.geteuid()!=0 or os.environ.get('DOCKER_HOST') or os.environ.get('DOCKER_CONTEXT'):raise artifact.GateError('Local root execution required')
    if Path('/sys/devices/virtual/dmi/id/board_asset_tag').read_text().strip()!='i-02b28336518077a8f':raise artifact.GateError('Wrong host')
    if not artifact.DIGEST.fullmatch(route_digest):raise artifact.GateError('Owner-reviewed nginx digest required')
    dump=subprocess.check_output(['nginx','-T'],stderr=subprocess.PIPE)
    if hashlib.sha256(dump).hexdigest()!=route_digest or b'127.0.0.1:3001' in dump:raise artifact.GateError('Production routing approval differs')
    if hashlib.sha256(Path('/etc/nginx/colorful-life/browser-api-locations.conf').read_bytes()).hexdigest()!=ROUTES:raise artifact.GateError('Reviewed customer API restrictions differ')
    if not prepare and (dump.count(b'root /opt/colorful-life-production/storefront/current;')!=1 or dump.count(b'root /opt/colorful-life-production/storefront/asset-store;')!=1):raise artifact.GateError('Dedicated Production vhost must be separately installed')
    sys=__import__('sys');sys.path.append('/opt/colorful-life-infra/ops/ec2')
    import production_compatibility as guard
    state=Path('/var/lib/colorful-life-release');m=private(state/'current.json',0)
    config=private(Path('/var/lib/colorful-life-production/runtime-source.json'),0)
    if config.get('manifestSha256')!=hashlib.sha256((state/'current.json').read_bytes()).hexdigest():raise artifact.GateError('Backend recovery pin differs')
    for name in ['release-transition.json','runtime-recovery-pending.json']:
        if (state/name).exists() or (state/name).is_symlink():raise artifact.GateError('Backend transition is active')
    artifact.sha(m['backendCommit'])
    if not re.fullmatch(r'919693204623\.dkr\.ecr\.eu-west-2\.amazonaws\.com/colorful-life-production-api@sha256:[0-9a-f]{64}',m['apiImage']):raise artifact.GateError('Immutable Production backend required')
    if not rollback and (m['backendCommit']!='51ab89108b825e4ad17c41d7c6ab5325bb7a9f26' or m['apiImage']!='919693204623.dkr.ecr.eu-west-2.amazonaws.com/colorful-life-production-api@sha256:ffd02a031aa32ced1d541ec219b837ce9453bb0808254945c86e8fa110fe5c84'):raise artifact.GateError('Approved backend identity differs')
    if guard.read(state,0) is None:raise artifact.GateError('Compatibility guard required')
    guard.enforce(state,m,0)
    if not rollback:
        secret=json.loads(Path('/run/colorful-life/production/runtime.json').read_bytes())
        if secret.get('PRODUCTION_REGISTRATION_ENABLED')!='false' or secret.get('PRODUCTION_PAYMENT_INITIATION_ENABLED')!='false':raise artifact.GateError('Registration and payments must remain OFF')
    for service in ['api','worker']:
        row=json.loads(subprocess.check_output(['docker','inspect','colorful-life-production-'+service+'-1']))[0]
        if row['Config']['Image']!=m['apiImage'] or not row['State']['Running'] or row['State'].get('Health',{}).get('Status')!='healthy':raise artifact.GateError('Backend identity or health differs')
        if not rollback:running_switches_off(row['State']['Pid'])

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['prepare','deploy','rollback']);p.add_argument('--url',default='');p.add_argument('--digest',default='');p.add_argument('--fingerprint',default='');p.add_argument('--route-digest',required=True);a=p.parse_args()
    try:
        approved_fingerprint(APPROVED_KEY_SHA256 if a.action=='rollback' else a.fingerprint)
        preflight(a.route_digest,prepare=a.action=='prepare',rollback=a.action=='rollback');store=Store();store.prepare()
        fd=os.open(store.control/'lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
        with os.fdopen(fd,'a') as lock:
            if os.fstat(lock.fileno()).st_uid!=0 or stat.S_IMODE(os.fstat(lock.fileno()).st_mode)!=0o600:raise artifact.GateError('Unsafe deployment lock')
            fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            print(transition(store,a.action,a.url,a.digest,a.fingerprint))
    except Exception as error:raise SystemExit(str(error) if isinstance(error,artifact.GateError) else 'Production delivery failed; values withheld; inspect retained evidence') from None
