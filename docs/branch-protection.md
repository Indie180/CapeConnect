# Branch Protection Setup (GitHub)

Configure this on `main` in GitHub:

1. Open repository settings:
   - `Settings` -> `Branches`
2. Add branch protection rule for `main`.
3. Enable:
   - `Require a pull request before merging`
   - `Require approvals` (at least 1)
   - `Dismiss stale pull request approvals when new commits are pushed`
   - `Require status checks to pass before merging`
4. Select required checks:
   - `backend`
   - `frontend-smoke`
5. Enable:
   - `Require branches to be up to date before merging`
   - `Do not allow bypassing the above settings` (if your team policy requires strict protection)
6. Save the rule.

Optional:
- Require signed commits
- Restrict who can push to matching branches
