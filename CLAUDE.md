# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Magister MCP is an MCP (Model Context Protocol) server that provides access to Dutch school schedules from Magister.net. It uses Playwright for browser automation to authenticate and fetch schedule data via both API calls and DOM scraping as fallback.

## Commands

```bash
# Development (runs with tsx, hot-reload friendly)
npm run dev

# Build TypeScript to dist/
npm run build

# Run compiled server
npm start
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
- **Parent account support**: Detects parent accounts and uses child's ID for schedule queries
- **API fallback**: If API fails (status 5xx or auth issues), falls back to DOM scraping

### Key Implementation Details
- Uses Playwright in headless mode
- Auth tokens captured from OAuth redirect URL or browser storage
- Schedule API endpoint: `/api/personen/{userId}/afspraken?status=1&van={date}&tot={date}`
- Cached data stored in `.schedule-cache.json`

## Environment Variables

Required in `.env` (see `.env.example`):
- `MAGISTER_SCHOOL` - e.g., `schoolname.magister.net`
- `MAGISTER_USER` - username
- `MAGISTER_PASS` - password
