# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Use GitHub's private
vulnerability reporting (Security > Report a vulnerability) instead, or email
the maintainer listed in `.github/CODEOWNERS`.

Expect an acknowledgement within a few working days.

## Automated checks

Every pull request runs:

- **CodeQL** static analysis on the TypeScript sources and the workflow files
- **Dependency review**, blocking new dependencies with high-severity advisories or copyleft licences
- **npm audit** against production dependencies

Dependabot opens grouped update pull requests weekly; patch and minor updates
merge automatically once CI passes, and majors wait for a human.

## Security notes for operators

- Set a long random `JWT_SECRET`. The API falls back to a development secret and
  logs a warning if it is missing, which is fine locally and unsafe in production.
- Serve both apps over HTTPS. Access tokens live in `localStorage`, so a
  plaintext connection exposes them.
- Set `CORS_ORIGIN` to the exact web origin rather than a wildcard.
- Passwords are hashed with bcrypt and never leave the API in any response.
- `ANTHROPIC_API_KEY` stays server-side; the browser never sees it.
