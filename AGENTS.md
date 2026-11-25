# Repository agent instructions

## Shared factory workflow

Follow `FACTORY_CI.md` and `.factory/ci.json`: work branches target `dev`, `main` stays stable and protected. Preserve the repository-specific data and release constraints above. Run qualified application validation on the Mac; keep useful Linux delivery/security checks. A pending local recipe is never a passing test. Product merges need human approval; Dependabot merges require qualified tests and green required CI for the exact head. Validation does not deploy.

## Visual work in a Factory session

Keep browser captures in the worktree under `qa/artifacts/static/`. Include the paths to desktop, mobile and reduced-motion captures in the handoff. Use the harness’s file tools to inspect them. Run repository checks as individual commands and report their exit status. If the controller owns dependency setup or a browser check, continue with independent work and identify that pending check at handoff. After handing off a candidate, wait for the controller to admit further changes.
