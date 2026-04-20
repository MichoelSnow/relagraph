# project_bootstrap.md

## Purpose
Defines the required initial setup for every new project.

This must be completed before implementing features.

---

## Required Files

- README.md
- .gitignore
- agents.md (in repo root)
- docs/core/ (with all control files)

---

## Environment Setup

- Define environment variables structure
- Create `.env.example`
- Ensure `.env` is in `.gitignore`

---

## Git Setup

- Initialize repository
- Set default branch (main)
- Make initial commit

---

## CI / Quality Gates

- Configure CI pipeline
- Include:
  - linting
  - tests
  - gitleaks
- CI must run on every PR

---

## Tooling

- Configure formatter/linter 
  - Use Ruff for Python
  - Use ESLint for JavaScript/TypeScript
- Configure package manager
  - Use pnpm instead of npm or yarn
  - Use poetry for python
- Ensure consistent code style

---

## Testing Setup

- Set up test framework
  - Use pytest for Python
- Ensure tests can run locally and in CI

---

## Security Baseline

- Verify `.env` is ignored
- No secrets committed
- HTTPS assumed for all external communication

---

## Documentation

- Keep docs minimal and structured
- Do NOT create unnecessary files

---

## Enforcement

- Do not begin feature development until bootstrap is complete
- Missing setup = incomplete project


