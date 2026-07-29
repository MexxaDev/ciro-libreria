# Syntra POS — Agent Instructions

## Commands

- `npm run lint` — Run ESLint
- `npm run format` — Run Prettier
- `npm run format:check` — Check Prettier formatting
- `npm test` — Run unit tests (Node built-in test runner)

## Git Workflow

- Branch from `main` for features: `feature/description`
- Use Conventional Commits: `type(scope): description`
  Types: feat, fix, refactor, chore, docs, style, test, perf
- Always run `npm run lint` before committing

## Project Conventions

- Vanilla JS (ES6 modules) — NO frameworks
- CSS Custom Properties for theming
- Module pattern: Module → Service → Repository → IndexedDB
- New features: create module in `modules/`, register in `js/app.js`
- Always sanitize user output: `escapeHtml()` from `utils/sanitizer.js`
- Always hash passwords: use `hashPassword()` from `utils/hash.js`
