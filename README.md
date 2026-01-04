# Magister MCP

An MCP (Model Context Protocol) server that provides access to Dutch school schedules from Magister.net.

## Why I Built This

As a parent, I found myself constantly checking the Magister app to plan our mornings and afternoons. "What time does school start tomorrow?" "When's the last class on Friday?" These questions came up daily, and I wanted my AI assistant to just... know.

This MCP server lets you ask your AI agent natural questions like:
- "What time do I need to drop off the kids tomorrow?"
- "What's the schedule for next Monday?"
- "When does school end on Wednesday?"

No more app switching. Just ask and plan.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

3. Copy `.env.example` to `.env` and fill in your Magister credentials:
   ```
   MAGISTER_SCHOOL=schoolname.magister.net
   MAGISTER_USER=your-username
   MAGISTER_PASS=your-password
   ```

4. Build and run:
   ```bash
   npm run build
   npm start
   ```

   Or for development:
   ```bash
   npm run dev
   ```

## Using with Claude Code

After building, add this server to your Claude Code configuration:

```bash
claude mcp add magister -- node /path/to/magister-mcp/dist/index.js
```

Or manually add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "magister": {
      "command": "node",
      "args": ["/path/to/magister-mcp/dist/index.js"],
      "env": {
        "MAGISTER_SCHOOL": "schoolname.magister.net",
        "MAGISTER_USER": "your-username",
        "MAGISTER_PASS": "your-password"
      }
    }
  }
}
```

Restart Claude Code, and you can now ask questions like "What's the school schedule for tomorrow?"

## MCP Tools

| Tool | Description |
|------|-------------|
| `get_schedule` | Get schedule for a specific date ("today", "tomorrow", weekday name, or YYYY-MM-DD) |
| `get_week_schedule` | Get schedule for the next 7 days |
| `get_dropoff_time` | Get first class time for drop-off planning |
| `get_pickup_time` | Get last class time for pickup planning |

## Disclaimer

**This project is not affiliated with, endorsed by, or in any way officially connected with Magister, Schoolmaster B.V., Iddink Group, or any of their subsidiaries or affiliates.**

This is an independent, open-source project created for personal use. Use at your own risk and in accordance with Magister's terms of service.

## License

MIT
