# Repository agent instructions

## Shared factory workflow

Follow `FACTORY_CI.md` and `.factory/ci.json`: work branches target `dev`, `main` stays stable and protected. Preserve the repository-specific data and release constraints above. Run qualified application validation on the Mac; keep useful Linux delivery/security checks. A pending local recipe is never a passing test. Product merges need human approval; Dependabot merges require qualified tests and green required CI for the exact head. Validation does not deploy.
