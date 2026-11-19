#!/usr/bin/env python3
"""Validate the portable factory contract; does not certify application tests."""
import json
from pathlib import Path
import sys


def validate(policy):
    errors=[]
    if policy.get('schema_version')!=1:errors.append('schema_version must be 1')
    if policy.get('branches')!={'integration':'dev','stable':'main'}:errors.append('branches must be dev/main')
    if policy.get('product_merge')!='human_approval':errors.append('product merges require human approval')
    if policy.get('dependabot_merge')!='qualified_tests_and_remote_ci_green':errors.append('Dependabot must require both proofs')
    local=policy.get('local_validation',{})
    if local.get('executor')!='native_factory':errors.append('use native factory, not a generic GitHub runner')
    if local.get('publish_or_deploy') is not False:errors.append('validation must not deploy')
    if local.get('qualification') not in ('pending','qualified'):errors.append('explicit qualification required')
    if not local.get('commands'):errors.append('a local validation recipe is required')
    for command in local.get('commands',[]):
        if not isinstance(command,list) or not command or not all(isinstance(x,str) for x in command):
            errors.append('commands must be argv arrays');continue
        if any(word in ' '.join(command).lower() for word in ('publish.sh','stage.sh','terraform apply','deploy-production','gh workflow run')):
            errors.append('delivery command forbidden in local validation')
    return errors


def main():
    policy=json.loads(Path('.factory/ci.json').read_text())
    errors=validate(policy)
    if errors:
        print('\n'.join(errors),file=sys.stderr);return 1
    print('Factory branch/validation contract valid. Application-test proof is separate.')
    return 0

if __name__=='__main__':raise SystemExit(main())
