import 'dotenv/config';
import { appendFileSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { MagisterClient, ScheduleItem } from './magister.js';

const LOG_FILE = '/tmp/magister-mcp.log';
function log(...args: unknown[]) {
  const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
  const line = `${new Date().toISOString()} [MCP] ${msg}\n`;
  appendFileSync(LOG_FILE, line);
  process.stderr.write(line);
}

const MAGISTER_SCHOOL = process.env.MAGISTER_SCHOOL;
const MAGISTER_USER = process.env.MAGISTER_USER;
const MAGISTER_PASS = process.env.MAGISTER_PASS;

if (!MAGISTER_SCHOOL || !MAGISTER_USER || !MAGISTER_PASS) {
  log('Missing required environment variables:');
  log('  MAGISTER_SCHOOL - e.g., schoolname.magister.net');
  log('  MAGISTER_USER   - username');
  log('  MAGISTER_PASS   - password');
  process.exit(1);
}

let client: MagisterClient | null = null;

async function getClient(): Promise<MagisterClient> {
  if (!client) {
    log('Creating new MagisterClient...');
    client = new MagisterClient({
      school: MAGISTER_SCHOOL!,
      username: MAGISTER_USER!,
      password: MAGISTER_PASS!,
    });
    await client.init();
  }
  return client;
}

function formatSchedule(items: ScheduleItem[]): string {
  if (items.length === 0) {
    return 'No classes scheduled';
  }

  return items
    .map((item) => {
      const status = item.cancelled ? ' [CANCELLED]' : '';
      const time =
        item.startTime && item.endTime ? `${item.startTime} - ${item.endTime}` : 'Time unknown';
      const location = item.location ? ` @ ${item.location}` : '';
      const teacher = item.teacher ? ` (${item.teacher})` : '';
      return `${time}: ${item.subject}${teacher}${location}${status}`;
    })
    .join('\n');
}

function parseDate(dateStr: string): Date {
  const lower = dateStr.toLowerCase();
  const today = new Date();

  if (lower === 'today') {
    return today;
  }
  if (lower === 'tomorrow') {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  }
  if (
    lower === 'monday' ||
    lower === 'tuesday' ||
    lower === 'wednesday' ||
    lower === 'thursday' ||
    lower === 'friday' ||
    lower === 'saturday' ||
    lower === 'sunday'
  ) {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const targetDay = days.indexOf(lower);
    const currentDay = today.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    const result = new Date(today);
    result.setDate(result.getDate() + daysAhead);
    return result;
  }

  // Try to parse as date string
  return new Date(dateStr);
}

const server = new Server(
  { name: 'unofficial-magister-mcp', version: pkg.version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'get_schedule',
      description: 'Get school schedule for a specific date',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description:
              'Date to get schedule for. Can be "today", "tomorrow", a weekday name, or YYYY-MM-DD format',
          },
        },
        required: ['date'],
      },
    },
    {
      name: 'get_week_schedule',
      description: 'Get school schedule for the entire week (next 7 days)',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    {
      name: 'get_dropoff_time',
      description: 'Get the time of the first class (for drop-off planning)',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description:
              'Date to check. Can be "today", "tomorrow", a weekday name, or YYYY-MM-DD format',
          },
        },
        required: ['date'],
      },
    },
    {
      name: 'get_pickup_time',
      description: 'Get the time of the last class (for pick-up planning)',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description:
              'Date to check. Can be "today", "tomorrow", a weekday name, or YYYY-MM-DD format',
          },
        },
        required: ['date'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log(`Tool called: ${name} with args: ${JSON.stringify(args)}`);

  try {
    const magister = await getClient();

    switch (name) {
      case 'get_schedule': {
        const date = parseDate((args as { date: string }).date);
        const schedule = await magister.getSchedule(date);
        return {
          content: [
            {
              type: 'text',
              text: `Schedule for ${date.toDateString()}:\n\n${formatSchedule(schedule)}`,
            },
          ],
        };
      }

      case 'get_week_schedule': {
        const weekSchedule = await magister.getWeekSchedule();
        let result = 'Week Schedule:\n\n';
        for (const [dateStr, items] of Object.entries(weekSchedule)) {
          const date = new Date(dateStr);
          result += `=== ${date.toDateString()} ===\n${formatSchedule(items)}\n\n`;
        }
        return {
          content: [{ type: 'text', text: result }],
        };
      }

      case 'get_dropoff_time': {
        const date = parseDate((args as { date: string }).date);
        const firstClass = await magister.getFirstClass(date);
        if (firstClass) {
          return {
            content: [
              {
                type: 'text',
                text: `First class on ${date.toDateString()}: ${firstClass.subject} at ${firstClass.startTime}${firstClass.location ? ` @ ${firstClass.location}` : ''}`,
              },
            ],
          };
        } else {
          return {
            content: [{ type: 'text', text: `No classes scheduled for ${date.toDateString()}` }],
          };
        }
      }

      case 'get_pickup_time': {
        const date = parseDate((args as { date: string }).date);
        const lastClass = await magister.getLastClass(date);
        if (lastClass) {
          return {
            content: [
              {
                type: 'text',
                text: `Last class on ${date.toDateString()}: ${lastClass.subject} ends at ${lastClass.endTime}${lastClass.location ? ` @ ${lastClass.location}` : ''}`,
              },
            ],
          };
        } else {
          return {
            content: [{ type: 'text', text: `No classes scheduled for ${date.toDateString()}` }],
          };
        }
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Tool error: ${message}`);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// Cleanup on exit
process.on('SIGINT', async () => {
  if (client) await client.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  if (client) await client.close();
  process.exit(0);
});

async function main() {
  log('Starting Magister MCP server...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Magister MCP server running');
}

main().catch((e) => log(`Fatal error: ${e}`));
