## What changed

<!-- One or two sentences. What does this PR do and why? -->

## How to test

<!-- Steps a reviewer can follow, or the command that proves it works. -->

```bash
npm test          # unit tests
npm run test:e2e  # RBAC + review workflow against a real database
```

## Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` and `npm run test:e2e` pass
- [ ] Role-based access rules still hold (a team member cannot read another member's report; a manager cannot edit content)
- [ ] Database changes ship with a Prisma migration (`npm run db:migrate`)
- [ ] API contract changes are reflected in `packages/shared` and `docs/API.md`
- [ ] README or docs updated if setup or behaviour changed

## Related issues

<!-- Closes #123 -->
