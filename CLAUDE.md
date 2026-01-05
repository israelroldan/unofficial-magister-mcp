# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**unofficial-magister-mcp** is an MCP (Model Context Protocol) server that provides access to Dutch school schedules from Magister.net. It uses Playwright for browser automation to authenticate and fetch schedule data via both API calls and DOM scraping as fallback.

## Commands

```bash
# Development (runs with tsx, hot-reload friendly)
npm run dev

# Build with tsup (ESM + types)
npm run build

# Run compiled server
npm start

# Linting and formatting
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
npm run format      # Format with Prettier
npm run type-check  # TypeScript type checking
```

## Architecture

### MCP Server (`src/index.ts`)
- Entry point, stdio transport server using `@modelcontextprotocol/sdk`
- Exposes 4 tools: `get_schedule`, `get_week_schedule`, `get_dropoff_time`, `get_pickup_time`
- Date parsing supports: "today", "tomorrow", weekday names, YYYY-MM-DD
- Lazy-initializes MagisterClient on first tool call
- Logs to `/tmp/magister-mcp.log` and stderr

### Magister Client (`src/magister.ts`)
- `MagisterClient` class handles all Magister.net interaction
- **Authentication flow**: Saves browser session to `.auth-state.json`, restores on next run to avoid re-login
- **Schedule caching**: 5-minute TTL with SWR pattern - returns stale data immediately while refreshing in background
- **Parent account support**: Detects parent accounts and uses first child's ID for schedule queries
- **API fallback**: If API fails (status 5xx or auth issues), falls back to DOM scraping

### Key Implementation Details
- Uses Playwright in headless mode
- Auth tokens captured from OAuth redirect URL or browser storage
- Schedule API endpoint: `/api/personen/{userId}/afspraken?status=1&van={date}&tot={date}`
- Cached data stored in `.schedule-cache.json`

## File Structure

```
src/
├── index.ts      # MCP server entry point, tool handlers
└── magister.ts   # Magister client (auth, API, caching)
```

## Environment Variables

Required in `.env` (see `.env.example`):
- `MAGISTER_SCHOOL` - e.g., `schoolname.magister.net`
- `MAGISTER_USER` - username
- `MAGISTER_PASS` - password

## Build System

- **tsup** for bundling (ESM output with types)
- **ESLint 9** with TypeScript support
- **Prettier** for formatting
- **Husky + lint-staged** for pre-commit hooks

## Release Process

1. Follow [Conventional Commits](https://conventionalcommits.org/) for commit messages
2. release-please manages versioning and changelog
3. Manual npm publish by maintainer
