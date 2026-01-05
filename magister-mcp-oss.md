# Magister MCP - OSS Publishing Plan

**Goal:** Transform magister-mcp into a publishable npm package with auto-release, proper docs, and CI/CD.

---

## Current State

| Aspect | Status |
|--------|--------|
| Core functionality | Working (login, schedule fetch) |
| Package.json | Basic |
| TypeScript config | Basic |
| Tests | None |
| CI/CD | None |
| Documentation | None |
| Release automation | None |
| Linting | None |

---

## Target State (inspired by env-vars-doctor)

### Phase 1: Package Foundation

- [ ] **Package.json overhaul**
  - Proper metadata (description, keywords, author, license, repository, homepage, bugs)
  - `publishConfig` with `access: public` and `provenance: true`
  - `files` array to include only necessary files
  - `engines` specifying Node version
  - `bin` entry for CLI usage
  - Proper `exports` for ESM

- [ ] **TypeScript/Build improvements**
  - Switch to `tsup` for bundling (ESM + types)
  - Stricter tsconfig
  - Path aliases if needed

- [ ] **Code quality**
  - Add ESLint 9 with TypeScript
  - Add Prettier
  - Add Husky + lint-staged for pre-commit hooks

### Phase 2: Documentation

- [ ] **README.md** with:
  - What it does (Magister school schedule access for Claude/MCP)
  - Features list
  - Installation instructions
  - Configuration (env vars)
  - Usage examples (Claude Code setup)
  - MCP tools reference
  - Screenshots/examples of output

- [ ] **CONTRIBUTING.md** - How to contribute

- [ ] **CLAUDE.md** - Architecture guide for AI assistants

- [ ] **LICENSE** - MIT

### Phase 3: CI/CD & Release Automation

- [ ] **GitHub Actions workflows**
  - `ci.yml` - Lint, type-check, build on PRs
  - `release.yml` - Auto-release via release-please + npm publish

- [ ] **release-please** setup
  - Conventional commits enforcement
  - Auto-changelog generation
  - NPM trusted publishing (OIDC, no secrets)

### Phase 4: Testing & Robustness

- [ ] **Testing setup**
  - Vitest configuration
  - Unit tests for date parsing, schedule formatting
  - Integration tests (mocked Playwright)
  - Coverage reporting

- [ ] **Error handling improvements**
  - Better error messages
  - Retry logic for flaky operations
  - Graceful degradation

### Phase 5: Features & Polish

- [ ] **Configuration options**
  - Support multiple children (selectable)
  - Configurable log level
  - Optional headless toggle for debugging
  - Cache session to avoid re-login

- [ ] **Additional MCP tools**
  - `get_homework` - Fetch homework/assignments
  - `get_grades` - Fetch recent grades
  - `get_absences` - Attendance info

---

## File Structure (Target)

```
magister-mcp/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── src/
│   ├── index.ts          # MCP server entry
│   ├── magister.ts       # Magister client
│   ├── tools/            # MCP tool handlers
│   │   ├── schedule.ts
│   │   ├── homework.ts
│   │   └── grades.ts
│   └── utils/
│       ├── date.ts
│       ├── format.ts
│       └── log.ts
├── tests/
│   ├── date.test.ts
│   ├── format.test.ts
│   └── magister.test.ts
├── .env.example
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── CHANGELOG.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── package.json
├── tsconfig.json
└── tsup.config.ts
```

---

## Package.json (Target)

```json
{
  "name": "magister-mcp",
  "version": "0.1.0",
  "description": "MCP server for accessing Magister school schedules via Claude",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "bin": {
    "magister-mcp": "./dist/index.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsup",
    "dev": "tsx src/index.ts",
    "lint": "eslint src",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepublishOnly": "npm run build"
  },
  "keywords": [
    "mcp",
    "magister",
    "school",
    "schedule",
    "claude",
    "anthropic",
    "model-context-protocol"
  ],
  "author": "Israel Roldan",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/israelroldan/magister-mcp"
  },
  "homepage": "https://github.com/israelroldan/magister-mcp#readme",
  "bugs": {
    "url": "https://github.com/israelroldan/magister-mcp/issues"
  },
  "engines": {
    "node": ">=20"
  },
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

---

## Implementation Order

1. **Quick wins first** - LICENSE, README basics, package.json metadata
2. **Build system** - tsup, stricter TS
3. **Code quality** - ESLint, Prettier, Husky
4. **CI/CD** - GitHub Actions
5. **Release automation** - release-please
6. **Tests** - Vitest setup
7. **Docs polish** - Full README, CONTRIBUTING, CLAUDE.md

---

## Questions to Decide

1. **Package name:** `magister-mcp` or `@israelroldan/magister-mcp`?
2. **Scope:** Just schedule, or also homework/grades?
3. **Multi-child support:** How to select which child?
4. **Session caching:** Persist auth state between runs?

---

## Notes

- The Playwright dependency is heavy (~150MB) - consider noting this in README
- Magister auth is fragile (UI changes break it) - need good error messages
- This is Netherlands-specific - document target audience clearly
