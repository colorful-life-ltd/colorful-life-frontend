"""Pinned clean Production build; no AWS credentials or arbitrary VITE settings reach npm."""
import argparse,hashlib,os,re
from pathlib import Path
import artifact
REVISION='69ccd28e0c3e2e3663f3f39564bbbd33f811b605'

def environment(key,fingerprint,registration):
    if not re.fullmatch(r'pk_live_[A-Za-z0-9]{8,}',key) or hashlib.sha256(key.encode()).hexdigest()!=fingerprint:
        raise artifact.GateError('Approved Live public key fingerprint required')
    if registration not in ['true','false']:raise artifact.GateError('Explicit registration setting required')
    result={k:os.environ[k] for k in ['PATH','HOME','TMPDIR','SYSTEMROOT'] if k in os.environ}
    result.update(CI='true',VITE_TARGET_ENVIRONMENT='production',VITE_API_ENVIRONMENT='production',VITE_API_BASE_URL='/api',VITE_SITE_URL=artifact.SITE,VITE_SOURCE_REVISION=REVISION,VITE_PAYMENT_MODE='stripe-live',VITE_REGISTRATION_ENABLED=registration,VITE_STRIPE_PUBLISHABLE_KEY=key)
    return result

def build(checkout,output,delivery_revision,fingerprint,registration):
    artifact.source(checkout,REVISION)
    env=environment(os.environ.get('PRODUCTION_STRIPE_PUBLISHABLE_KEY',''),fingerprint,registration)
    for args in [['npm','ci'],['npm','run','legal:check'],['npm','run','build']]:artifact.command(args,cwd=checkout,env=env)
    if artifact.command(['git','status','--porcelain','--untracked-files=all'],cwd=checkout).strip() or artifact.command(['git','rev-parse','HEAD'],cwd=checkout).strip()!=REVISION:raise artifact.GateError('Source changed during build')
    return artifact.pack(checkout/'dist',output,REVISION,fingerprint,delivery_revision,registration=='true')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--checkout',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--delivery-revision',required=True);p.add_argument('--fingerprint',required=True);p.add_argument('--registration',choices=['true','false'],required=True);a=p.parse_args()
    try:print(build(a.checkout,a.output,a.delivery_revision,a.fingerprint,a.registration))
    except Exception:raise SystemExit('Production build rejected; configuration values withheld') from None
