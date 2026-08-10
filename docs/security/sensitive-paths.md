# Sensitive paths

Fuzit denies high-risk paths before content acquisition. Defaults cover `.env`
variants, private keys, certificate/key stores, credential files, and common
cloud configuration paths. Decisions include the rule identifier, policy
source, and reason.

Additional exact paths or directory patterns ending in `/**` may be configured.
Allowing a matched sensitive path requires an explicit unsafe acknowledgement;
an allow pattern alone never overrides the deny.
