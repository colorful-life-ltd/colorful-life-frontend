"""Conditional content-addressed upload; only exact S3 412 permits verified reuse."""
import argparse,re,subprocess,tempfile
from pathlib import Path
import artifact
from template import BUCKET,REGION

PRECONDITION=re.compile(r'^An error occurred \((?:PreconditionFailed|412)\) when calling the PutObject operation:')

def upload(archive,digest,run=subprocess.run):
    if not artifact.DIGEST.fullmatch(digest) or artifact.digest(archive)!=digest:raise artifact.GateError('Local archive digest differs')
    key='storefront/'+digest+'.tar.gz'
    result=run(['aws','--region',REGION,'s3api','put-object','--bucket',BUCKET,'--key',key,'--body',str(archive),'--if-none-match','*'],capture_output=True,text=True,timeout=900)
    if result.returncode==0:return 'Archive uploaded'
    if not PRECONDITION.match(result.stderr.strip()):raise artifact.GateError('Artifact upload failed; no reuse authorized')
    # Metadata/ETag alone do not prove SHA-256. Fetch and hash the actual object.
    with tempfile.TemporaryDirectory(prefix='production-upload-verify-') as temporary:
        existing=Path(temporary)/'existing.tar.gz'
        result=run(['aws','--region',REGION,'s3api','get-object','--bucket',BUCKET,'--key',key,str(existing)],capture_output=True,text=True,timeout=900)
        if result.returncode or not existing.is_file() or artifact.digest(existing)!=digest:raise artifact.GateError('Existing S3 artifact could not be independently verified')
    return 'Existing archive independently verified'

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--archive',type=Path,required=True);p.add_argument('--digest',required=True);a=p.parse_args()
    try:print(upload(a.archive,a.digest))
    except Exception as error:raise SystemExit(str(error) if isinstance(error,artifact.GateError) else 'Artifact upload failed; diagnostic values withheld') from None
