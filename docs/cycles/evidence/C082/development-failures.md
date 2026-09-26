# Development failures retained

These logs are private disposable fixtures; none exercised user data.

| Attempt | Result and correction |
|---|---|
|01|Shell quoting prevented execution; replaced inline expression with a script.|
|02|15 tests,3 failures from linked negative startup tests; trap and inspect the expected exit.|
|05|21 tests,14 failures from reused temporary directory identifiers across VM runs; use cryptographic random names.|
|07|23 failures exposed duplicate global names on one process; use one instance registration and a separate journal lock.|
|10|25 tests,1 failure because Windows child VM arguments were lost; use a child script and explicit environment.|

Logs are retained alongside this file as `focused-NN.log`. Final attempts11/12 pass25 tests. These results do not replace required Linux Mix integration. Local `which-gates.sh` could not discover requirements without jq/python3; no missing check was waived.
