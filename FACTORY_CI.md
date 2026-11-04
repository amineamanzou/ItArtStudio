# Development and validation contract

Work branches target `dev`. `main` is stable and protected; promotion from `dev` requires human approval. Do not force-push or delete either long-lived branch. Use Conventional Commits and isolated worktrees for concurrent tasks. A merge commit preserves ancestry when promoting between the two long-lived branches.

Run application tests with the native factory on the Mac, using isolated worktrees, synthetic fixtures and disposable databases. `.factory/ci.json` declares the repository-specific recipe and its qualification state. A pending recipe is not a passing test. No generic GitHub runner is installed on the Mac.

Keep useful Linux checks, container/runtime checks, vulnerability scanning, SBOMs, signatures and delivery verification in GitHub. The lightweight `Factory contract` job validates this contract only; it does not attest that application tests passed. Existing required checks remain in force until equivalent local evidence is qualified.

A local receipt must identify the repository, remote HEAD, base, recipe revision, toolchain, commands, results and artifact digests. It must be verified before it can contribute to merge admission. A local pass never overrides failed remote CI. Product PRs retain human approval. Dependabot may merge only with qualified passing tests, fresh green required CI and repository protections satisfied for the exact head.

Validation does not publish or deploy. Release commands remain explicit and separate; preserve existing platform-specific delivery controls and private-data boundaries. Dependabot configuration on the default branch targets `dev`; it must reach that branch through its configuration PR before taking effect.
