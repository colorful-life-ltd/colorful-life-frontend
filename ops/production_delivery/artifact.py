"""Production archive scanner reused from Infra b9a1fc00; no attestation path."""
import gzip
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import tarfile

class GateError(ValueError):
    """Safe constant diagnostic; never wrap raw configuration or subprocess output."""

SITE='https://build-and-bloom.co.uk'
SHA=re.compile(r'[a-f0-9]{40}')
DIGEST=re.compile(r'[a-f0-9]{64}')
MAX_BYTES=400*1024**2
EXTENSIONS={'.html','.js','.css','.json','.svg','.txt','.xml','.webmanifest','.png','.webp','.jpg','.jpeg','.avif','.ico','.woff','.woff2','.ttf'}
PRIVATE=re.compile(rb'\b[sr]k_(?:live|test)_[A-Za-z0-9]{8,}|\bwhsec_[A-Za-z0-9]{8,}|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:AWS_SECRET_ACCESS_KEY|AWS_SESSION_TOKEN|STRIPE_SECRET_KEY|PAYPAL_CLIENT_SECRET|DB_PASSWORD)[\"\x27]?\s*[:=]|X-Amz-(?:Credential|Signature)=|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}|(?:https?|postgres(?:ql)?)://[^\s/<>"\x27]+:[^\s/<>"\x27]+@')
PUBLIC=re.compile(rb'\bpk_(?:test|live)_[A-Za-z0-9]{8,}')

def digest(path):
    result=hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda:f.read(1024*1024),b''):result.update(block)
    return result.hexdigest()
def sha(value):
    if not isinstance(value,str) or not SHA.fullmatch(value):raise GateError('Exact source revision required')
    return value

def command(args, **kw):
    try:return subprocess.check_output(args,stderr=subprocess.PIPE,text=True,timeout=180,**kw)
    except (OSError,subprocess.SubprocessError):raise GateError('External command failed: '+Path(args[0]).name) from None

def source(checkout, revision):
    sha(revision)
    if command(['git','rev-parse','HEAD'],cwd=checkout).strip()!=revision:raise GateError('Source HEAD differs')
    if command(['git','status','--porcelain','--untracked-files=all','--ignored'],cwd=checkout).strip():raise GateError('Source must be pristine, including ignored files')
    command(['git','merge-base','--is-ancestor',revision,'refs/remotes/origin/main'],cwd=checkout)
    remote=command(['git','remote','get-url','origin'],cwd=checkout).strip()
    if remote not in ['https://github.com/colorful-life-ltd/colorful-life-frontend','https://github.com/colorful-life-ltd/colorful-life-frontend.git','git@github.com:colorful-life-ltd/colorful-life-frontend.git']:raise GateError('Wrong source repository')

def inventory(root, fingerprint):
    root=Path(root)
    if root.is_symlink() or not root.is_dir() or not DIGEST.fullmatch(fingerprint):raise GateError('Invalid dist or fingerprint')
    files={};keys=set();total=0
    for p in sorted(root.rglob('*')):
        rel=p.relative_to(root).as_posix()
        if p.relative_to(root).parts[0] in {'api','admin','auth','health','ready','metrics'}:raise GateError('Reserved application path in dist')
        if p.is_symlink() or any(x.startswith('.') for x in p.relative_to(root).parts):raise GateError('Unsafe dist path')
        if p.is_dir():continue
        if not p.is_file() or p.suffix.lower() not in EXTENSIONS:raise GateError('Unsupported dist file')
        if len(files)>=20000 or p.stat().st_size>MAX_BYTES:raise GateError('Oversized dist')
        data=p.read_bytes();total+=len(data)
        if total>MAX_BYTES or PRIVATE.search(data) or b'www.paypal.com/sdk/js' in data or b'www.sandbox.paypal.com/sdk/js' in data:raise GateError('Unsafe dist contents')
        for key in PUBLIC.findall(data):
            if not key.startswith(b'pk_live_') or hashlib.sha256(key).hexdigest()!=fingerprint:raise GateError('Public key environment/fingerprint mismatch')
            keys.add(key)
        files[rel]=hashlib.sha256(data).hexdigest()
    if len(keys)!=1 or 'index.html' not in files or 'storefront-environment.json' not in files:raise GateError('Incomplete Production artifact')
    env=json.loads((root/'storefront-environment.json').read_text())
    if set(env)!={'version','target','paymentMode','siteOrigin','apiBase','apiEnvironment','publishableKeySha256','sourceRevision'} or type(env.get('version')) is not int:raise GateError('Unexpected environment manifest schema')
    for key,value in {'version':1,'target':'production','paymentMode':'stripe-live','siteOrigin':SITE,'apiBase':'/api','apiEnvironment':'production','publishableKeySha256':fingerprint}.items():
        if env.get(key)!=value:raise GateError('Artifact environment differs')
    sha(env.get('sourceRevision'))
    return files,env

def pack(dist, output, revision, fingerprint, infra_revision, registration):
    if type(registration) is not bool:raise GateError('Explicit registration boolean required')
    files,env=inventory(dist,fingerprint)
    if env['sourceRevision']!=sha(revision):raise GateError('Build source differs')
    record={'version':1,'sourceRevision':revision,'deliveryRevision':sha(infra_revision),'keyFingerprint':fingerprint,'registrationEnabled':registration,'files':files}
    raw=json.dumps(record,sort_keys=True,separators=(',',':')).encode()
    import io
    with open(output,'xb') as f,gzip.GzipFile(filename='',mode='wb',fileobj=f,mtime=0) as gz,tarfile.open(fileobj=gz,mode='w') as t:
        for name,data in [('release.json',raw),*[(f'site/{n}',(Path(dist)/n).read_bytes()) for n in files]]:
            if name.startswith('site/') and hashlib.sha256(data).hexdigest()!=files[name[5:]]:raise GateError('Dist changed during packing')
            info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o644;t.addfile(info,io.BytesIO(data))
    return digest(output)

def unpack(archive, destination, expected_digest):
    if not DIGEST.fullmatch(expected_digest) or Path(archive).stat().st_size>MAX_BYTES or digest(archive)!=expected_digest:raise GateError('Archive digest differs')
    destination=Path(destination);names=set();total=0
    with tarfile.open(archive,'r:gz') as t:
        for member in t:
            name=member.name
            if not member.isfile() or name in names or name.startswith('/') or '\\' in name or any(p in ('.','..','') or p.startswith('.') for p in name.split('/')) or not (name=='release.json' or name.startswith('site/')):raise GateError('Unsafe archive member')
            names.add(name);total+=member.size
            if len(names)>20001 or total>MAX_BYTES:raise GateError('Oversized archive')
            path=destination/name;path.parent.mkdir(parents=True,exist_ok=True)
            with path.open('xb') as f:
                import shutil
                shutil.copyfileobj(t.extractfile(member),f);f.flush();os.fsync(f.fileno())
            path.chmod(0o644)
    record=json.loads((destination/'release.json').read_text())
    if not isinstance(record,dict) or set(record)!={'version','sourceRevision','deliveryRevision','keyFingerprint','registrationEnabled','files'} or type(record['registrationEnabled']) is not bool:raise GateError('Unexpected release schema')
    fingerprint=record['keyFingerprint'];revision=record['sourceRevision'];infra_revision=record['deliveryRevision']
    files,env=inventory(destination/'site',fingerprint)
    if record!={'version':1,'sourceRevision':sha(revision),'deliveryRevision':sha(infra_revision),'keyFingerprint':fingerprint,'registrationEnabled':record['registrationEnabled'],'files':files} or env['sourceRevision']!=revision:raise GateError('Release metadata/files differ')
    return record
