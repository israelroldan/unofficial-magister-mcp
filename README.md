# unofficial-magister-mcp

An MCP (Model Context Protocol) server for accessing Dutch school schedules from [Magister](https://www.magister.net). Enables Claude and other MCP-compatible AI assistants to query school schedules, drop-off times, and pick-up times.

> **Note:** This is an unofficial package and is not affiliated with Magister or Iddink Group.

## Why I Built This

As a parent, I found myself constantly checking the Magister app to plan our mornings and afternoons. "What time does school start tomorrow?" "When's the last class on Friday?" These questions came up daily, and I wanted my AI assistant to just... know.

This MCP server lets you ask your AI agent natural questions like:
- "What time do I need to drop off the kids tomorrow?"
- "What's the schedule for next Monday?"
- "When does school end on Wednesday?"

No more app switching. Just ask and plan.

## Features

- **Schedule queries** - Get daily or weekly school schedules
- **Drop-off/pick-up times** - Quickly find first and last class times for planning
- **Parent account support** - Works with both student and parent accounts
- **Session persistence** - Saves auth state to avoid repeated logins
- **Smart caching** - 5-minute cache with stale-while-revalidate pattern
- **API with DOM fallback** - Uses Magister API with automatic fallback to DOM scraping

## Requirements

- Node.js 20 or later
- A Magister account (student or parent)
- ~150MB disk space (Playwright browsers)

## Installation

```bash
npm install -g unofficial-magister-mcp
```

Or run directly with npx:

```bash
npx unofficial-magister-mcp
```

## Configuration

Create a `.env` file or set environment variables:

```bash
MAGISTER_SCHOOL=schoolname.magister.net
MAGISTER_USER=your-username
MAGISTER_PASS=your-password
```

## Usage with Claude Code

Add to your Claude Code MCP configuration (`~/.claude/claude_code_config.json`):

```json
{
  "mcpServers": {
    "magister": {
      "command": "npx",
      "args": ["-y", "unofficial-magister-mcp"],
      "env": {
        "MAGISTER_SCHOOL": "schoolname.magister.net",
        "MAGISTER_USER": "your-username",
        "MAGISTER_PASS": "your-password"
      }
    }
  }
}
```

## Available Tools

### `get_schedule`

Get the school schedule for a specific date.

**Parameters:**
- `date` (required): Date string - "today", "tomorrow", weekday name, or YYYY-MM-DD format

**Example response:**
```
Schedule for Sat Jan 04 2025:

08:30 - 09:20: Mathematics (Mr. de Vries) @ Room 101
09:25 - 10:15: Dutch (Ms. Jansen) @ Room 203
10:30 - 11:20: English (Mr. Smith) @ Room 105
```

### `get_week_schedule`

Get the school schedule for the next 7 days.

**Parameters:** None

### `get_dropoff_time`

Get the first class time for drop-off planning.

**Parameters:**
- `date` (required): Date string - "today", "tomorrow", weekday name, or YYYY-MM-DD format

**Example response:**
```
First class on Mon Jan 06 2025: Mathematics at 08:30 @ Room 101
```

### `get_pickup_time`

Get the last class end time for pick-up planning.

**Parameters:**
- `date` (required): Date string - "today", "tomorrow", weekday name, or YYYY-MM-DD format

**Example response:**
```
Last class on Mon Jan 06 2025: History ends at 15:45 @ Room 301
```

## How It Works

1. **Authentication**: Uses Playwright to automate Magister login, capturing OAuth tokens
2. **Session persistence**: Saves browser state to `.auth-state.json` to avoid re-login
3. **API access**: Fetches schedules via Magister's internal API
4. **Fallback**: If API fails, falls back to DOM scraping
5. **Caching**: Caches results for 5 minutes with SWR pattern

## Parent Accounts

If you log in with a parent account, the server automatically detects linked children and uses the first child's schedule. Multi-child selection is planned for a future release.

## Troubleshooting

### "Missing required environment variables"

Make sure all three environment variables are set:
- `MAGISTER_SCHOOL` - The school's Magister subdomain (e.g., `schoolname.magister.net`)
- `MAGISTER_USER` - Your username
- `MAGISTER_PASS` - Your password

### Authentication issues

1. Check the log file at `/tmp/magister-mcp.log` for details
2. Delete `.auth-state.json` to force a fresh login
3. Verify your credentials work on the Magister website

### Schedule not updating

The server caches schedules for 5 minutes. If you need fresh data, wait for the cache to expire or restart the server.

## Development

```bash
# Clone the repository
git clone https://github.com/israelroldan/unofficial-magister-mcp.git
cd unofficial-magister-mcp

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run linting
npm run lint

# Format code
npm run format
```

## License

MIT - see [LICENSE](LICENSE)

## Disclaimer

This is an unofficial tool that interacts with Magister.net through browser automation. It may break if Magister changes their website. Use at your own risk.

The author is not affiliated with Magister, Schoolmaster B.V., Iddink Group, or any of their subsidiaries. "Magister" is a trademark of Iddink Group.
