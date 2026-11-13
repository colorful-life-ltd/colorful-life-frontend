"""Render narrowly scoped resources for the existing OIDC/S3/SSM delivery pattern.
No AWS calls. Owner must separately review and apply this template.
"""
import base64,gzip,json
from pathlib import Path
ACCOUNT='919693204623';REGION='eu-west-2';INSTANCE='i-02b28336518077a8f'
BUCKET='colorful-life-production-storefront-'+ACCOUNT
ROLE='ColorfulLife-ProductionStorefrontManual';DOCUMENT='ColorfulLife-ProductionStorefrontManual'
SUBJECT='repo:colorful-life-ltd@341604205/colorful-life-frontend@1368891907:ref:refs/heads/production-storefront-release'

def template():
    files=['artifact.py','primitives.py','assets.py','install.py']
    lines=['set -eu','umask 077','tmp=$(mktemp -d /tmp/colorful-production-delivery.XXXXXX)','trap \'rm -rf "$tmp"\' EXIT']
    for name in files:
        encoded=base64.b64encode(gzip.compress(Path(__file__).with_name(name).read_bytes(),mtime=0)).decode()
        lines.append("printf '%s' '"+encoded+"' | base64 -d | gzip -d > \"$tmp/"+name+'"')
    lines.append('python3 -B "$tmp/install.py" "$SSM_Action" --url "$SSM_Url" --digest "$SSM_Digest" --fingerprint "$SSM_Fingerprint" --route-digest "$SSM_RouteDigest"')
    def param(pattern):return {'type':'String','default':'','allowedPattern':pattern,'interpolationType':'ENV_VAR'}
    document={'schemaVersion':'2.2','description':'Isolated Production frontend only; no nginx or backend mutation','parameters':{
        'Action':{'type':'String','allowedValues':['prepare','deploy','rollback'],'interpolationType':'ENV_VAR'},
        'Digest':param('^([0-9a-f]{64})?$'),'Fingerprint':param('^([0-9a-f]{64})?$'),'RouteDigest':param('^[0-9a-f]{64}$'),
        'Url':param('^(https://'+BUCKET+r'\.s3\.eu-west-2\.amazonaws\.com/storefront/[0-9a-f]{64}\.tar\.gz\?[A-Za-z0-9%&=._~+-]{1,1000}'+r'[A-Za-z0-9%&=._~+-]{0,1000}'*2+')?$')},
        'mainSteps':[{'action':'aws:runShellScript','name':'productionFrontend','inputs':{'timeoutSeconds':'900','runCommand':lines}}]}
    bucketarn='arn:aws:s3:::'+BUCKET
    return {'AWSTemplateFormatVersion':'2010-09-09','Description':'Manual Production frontend extension; Sandbox resources unchanged','Resources':{
        'Releases':{'Type':'AWS::S3::Bucket','DeletionPolicy':'Retain','UpdateReplacePolicy':'Retain','Properties':{'BucketName':BUCKET,'VersioningConfiguration':{'Status':'Enabled'},'BucketEncryption':{'ServerSideEncryptionConfiguration':[{'ServerSideEncryptionByDefault':{'SSEAlgorithm':'AES256'}}]},'OwnershipControls':{'Rules':[{'ObjectOwnership':'BucketOwnerEnforced'}]},'PublicAccessBlockConfiguration':{'BlockPublicAcls':True,'IgnorePublicAcls':True,'BlockPublicPolicy':True,'RestrictPublicBuckets':True}}},
        'TLSOnly':{'Type':'AWS::S3::BucketPolicy','Properties':{'Bucket':{'Ref':'Releases'},'PolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Deny','Principal':'*','Action':'s3:*','Resource':[bucketarn,bucketarn+'/*'],'Condition':{'Bool':{'aws:SecureTransport':'false'}}}]}}},
        'Delivery':{'Type':'AWS::SSM::Document','Properties':{'Name':DOCUMENT,'DocumentType':'Command','DocumentFormat':'JSON','UpdateMethod':'NewVersion','Content':document}},
        'DeployRole':{'Type':'AWS::IAM::Role','Properties':{'RoleName':ROLE,'MaxSessionDuration':3600,'AssumeRolePolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Federated':'arn:aws:iam::'+ACCOUNT+':oidc-provider/token.actions.githubusercontent.com'},'Action':'sts:AssumeRoleWithWebIdentity','Condition':{'StringEquals':{'token.actions.githubusercontent.com:aud':'sts.amazonaws.com','token.actions.githubusercontent.com:sub':SUBJECT}}}]},'Policies':[{'PolicyName':'ProductionFrontendOnly','PolicyDocument':{'Version':'2012-10-17','Statement':[
            {'Effect':'Allow','Action':['s3:PutObject','s3:GetObject'],'Resource':[bucketarn+'/storefront/*']},
            {'Effect':'Allow','Action':['ssm:SendCommand'],'Resource':['arn:aws:ec2:'+REGION+':'+ACCOUNT+':instance/'+INSTANCE,'arn:aws:ssm:'+REGION+':'+ACCOUNT+':document/'+DOCUMENT]},
            {'Effect':'Allow','Action':['ssm:GetCommandInvocation'],'Resource':'*'}]}}]}}}}

if __name__=='__main__':print(json.dumps(template(),indent=2))
