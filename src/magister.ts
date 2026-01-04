import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AUTH_STATE_PATH = join(__dirname, '..', '.auth-state.json');
const CACHE_PATH = join(__dirname, '..', '.schedule-cache.json');
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

const LOG_FILE = '/tmp/magister-mcp.log';

// Simple cache structure
interface CacheEntry {
  data: ScheduleItem[];
  timestamp: number;
}
interface CacheStore {
  [dateKey: string]: CacheEntry;
}

// Cache helper
class ScheduleCache {
  private cache: CacheStore = {};

  constructor() {
    this.load();
  }

  private load() {
    try {
      if (existsSync(CACHE_PATH)) {
        this.cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
        log('Cache loaded from disk');
      }
    } catch (e) {
      this.cache = {};
    }
  }

  private save() {
    try {
      writeFileSync(CACHE_PATH, JSON.stringify(this.cache, null, 2));
    } catch (e) {
      // Ignore save errors
    }
  }

  get(dateKey: string): { data: ScheduleItem[]; isStale: boolean } | null {
    const entry = this.cache[dateKey];
    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    const isStale = age > CACHE_TTL_MS;

    return { data: entry.data, isStale };
  }

  set(dateKey: string, data: ScheduleItem[]) {
    this.cache[dateKey] = { data, timestamp: Date.now() };
    this.save();
  }

  clear() {
    this.cache = {};
    this.save();
  }
}

const scheduleCache = new ScheduleCache();

function log(...args: unknown[]) {
  const msg = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ');
  const line = `${new Date().toISOString()} ${msg}\n`;
  appendFileSync(LOG_FILE, line);
  process.stderr.write(line);
}

export interface ScheduleItem {
  startTime: string;
  endTime: string;
  subject: string;
  teacher?: string;
  location?: string;
  cancelled: boolean;
  description?: string;
}

export interface MagisterConfig {
  school: string;
  username: string;
  password: string;
}

export class MagisterClient {
  private config: MagisterConfig;
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private accessToken: string | null = null;
  private userId: number | null = null;

  constructor(config: MagisterConfig) {
    this.config = config;
  }

  private getBaseUrl(): string {
    const school = this.config.school.replace(/\.magister\.net$/, '');
    return `https://${school}.magister.net`;
  }

  async init(): Promise<void> {
    log('Initializing Magister client...');
    this.browser = await chromium.launch({ headless: true });

    // Try to restore previous session from disk
    if (existsSync(AUTH_STATE_PATH)) {
      try {
        log('Found saved auth state, attempting to restore...');
        const storageState = JSON.parse(readFileSync(AUTH_STATE_PATH, 'utf-8'));
        this.context = await this.browser.newContext({ storageState });
        this.page = await this.context.newPage();

        // Restore saved userId and token
        if (storageState._magister) {
          this.userId = storageState._magister.userId;
          this.accessToken = storageState._magister.accessToken;
          log('Restored userId:', this.userId, 'token:', this.accessToken ? 'yes' : 'no');
        }

        // Verify session is still valid by trying the API
        await this.page.goto(`${this.getBaseUrl()}/magister/`);
        await this.page.waitForTimeout(2000);

        // Quick check if we're logged in
        const url = this.page.url();
        if (!url.includes('accounts.magister.net') && this.userId) {
          log('Session restored successfully!');
          return; // Session is valid, skip login
        }
        log('Saved session expired, need to re-login');
      } catch (e) {
        log('Failed to restore session:', e);
      }
    }

    // Fresh login required
    if (this.context) await this.context.close();
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    // Log all navigations for debugging
    this.page.on('framenavigated', (frame) => {
      if (frame === this.page?.mainFrame()) {
        log('Navigated to:', frame.url().slice(0, 100));
      }
    });

    await this.login();
  }

  private async login(): Promise<void> {
    if (!this.page) throw new Error('Page not initialized');

    log('Logging into Magister...');
    await this.page.goto(this.getBaseUrl());

    // Wait for redirect to accounts.magister.net and username field
    await this.page.waitForSelector('#username', { timeout: 15000 });
    log('Username field found');

    // Fill username
    await this.page.fill('#username', this.config.username);
    log('Username filled');

    // Click "Doorgaan" button (DNA-BUTTON web component)
    // Use text-based selector since it's a custom element
    await this.page.click('dna-button:has-text("Doorgaan"), button:has-text("Doorgaan"), [type="submit"]');
    log('Clicked continue button');

    // Wait for password field to appear (step 2 of login)
    await this.page.waitForSelector('#password, input[type="password"]', { timeout: 15000 });
    log('Password field found');

    // Fill password
    await this.page.fill('#password, input[type="password"]', this.config.password);
    log('Password filled');

    // Take screenshot to see current state
    await this.page.screenshot({ path: '/tmp/magister-before-login.png' });
    log('Screenshot saved to /tmp/magister-before-login.png');

    // Handle any cookie consent or overlay dialogs
    try {
      // Common cookie consent buttons
      const consentSelectors = [
        'button:has-text("Accepteren")',
        'button:has-text("Accept")',
        'button:has-text("Akkoord")',
        'button:has-text("OK")',
        '[id*="cookie"] button',
        '[class*="cookie"] button',
        '[class*="consent"] button',
      ];
      for (const selector of consentSelectors) {
        const btn = await this.page.$(selector);
        if (btn && await btn.isVisible()) {
          log('Found consent button:', selector);
          await btn.click();
          await this.page.waitForTimeout(500);
          break;
        }
      }
    } catch (e) {
      log('No consent dialog found (ok)');
    }

    // Log what buttons are visible on the page
    const buttons = await this.page.evaluate(() => {
      const btns = document.querySelectorAll('button, dna-button, [type="submit"]');
      return Array.from(btns).map(b => ({
        tag: b.tagName,
        text: b.textContent?.trim().slice(0, 30),
        visible: (b as HTMLElement).offsetParent !== null,
        classes: b.className,
      }));
    });
    log('Buttons on page:', buttons);

    // Set up listener to capture token from redirect URL before clicking
    const tokenHolder = { value: '' };
    this.page.on('framenavigated', (frame) => {
      const url = frame.url();
      if (url.includes('redirect_callback') || url.includes('access_token') || url.includes('id_token')) {
        log('Captured redirect URL:', url.slice(0, 200));
        const tokenMatch = url.match(/access_token=([^&]+)/);
        if (tokenMatch) {
          tokenHolder.value = decodeURIComponent(tokenMatch[1]);
        }
        if (!tokenHolder.value) {
          const idMatch = url.match(/id_token=([^&]+)/);
          if (idMatch) {
            tokenHolder.value = decodeURIComponent(idMatch[1]);
          }
        }
      }
    });

    // Try multiple selectors for login button
    const loginSelectors = [
      'dna-button:has-text("Inloggen")',
      'button:has-text("Inloggen")',
      'dna-button[type="submit"]',
      'button[type="submit"]',
      'input[type="submit"]',
      '.btn-primary',
      '[data-testid="login"]',
    ];

    let clicked = false;
    for (const selector of loginSelectors) {
      try {
        const btn = await this.page.$(selector);
        if (btn) {
          const isVisible = await btn.isVisible();
          log(`Login button ${selector}: found=${!!btn}, visible=${isVisible}`);
          if (isVisible) {
            await btn.click({ timeout: 5000 });
            log('Clicked login button:', selector);
            clicked = true;
            break;
          }
        }
      } catch (e) {
        log(`Failed to click ${selector}:`, e);
      }
    }

    if (!clicked) {
      // Take screenshot of failure state
      await this.page.screenshot({ path: '/tmp/magister-login-failed.png' });
      log('Could not find login button! Screenshot saved to /tmp/magister-login-failed.png');
      // Try pressing Enter as last resort
      await this.page.keyboard.press('Enter');
      log('Pressed Enter as fallback');
    }

    // Wait for navigation away from accounts.magister.net
    // Just wait for any URL on the school domain
    const schoolDomain = this.config.school.replace(/\.magister\.net$/, '') + '.magister.net';
    log('Waiting for redirect to:', schoolDomain);

    try {
      await this.page.waitForURL(url => {
        const matches = url.href.includes(schoolDomain) && !url.href.includes('accounts.magister.net');
        log('URL check:', url.href.slice(0, 80), 'matches:', matches);
        return matches;
      }, { timeout: 30000 });
    } catch (e) {
      log('waitForURL failed, current URL:', this.page.url());
      // Continue anyway - we might already be on the right page
    }

    await this.page.waitForTimeout(3000);

    // Use captured token
    if (tokenHolder.value) {
      this.accessToken = tokenHolder.value;
      log('Access token captured:', tokenHolder.value.slice(0, 50) + '...');
    } else {
      // Fallback: try to get token from page storage
      const token = await this.page.evaluate(() => {
        // Check various storage locations
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key) {
            const val = sessionStorage.getItem(key);
            if (val && val.startsWith('eyJ') && val.length > 100) {
              return val;
            }
          }
        }
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key) {
            const val = localStorage.getItem(key);
            if (val && val.startsWith('eyJ') && val.length > 100) {
              return val;
            }
          }
        }
        return null;
      });
      if (token) {
        this.accessToken = token;
        log('Token from storage:', token.slice(0, 50) + '...');
      }
    }

    // Make sure we're on the school domain before API calls
    const currentUrl = this.page.url();
    log('Current URL after login:', currentUrl);

    if (!currentUrl.includes(this.config.school.replace(/\.magister\.net$/, ''))) {
      log('Navigating to school domain...');
      await this.page.goto(`${this.getBaseUrl()}/magister/`);
      await this.page.waitForTimeout(2000);
    }

    // Fetch user ID
    await this.fetchUserId();

    log('Login successful! Token:', this.accessToken ? 'yes' : 'no', 'UserId:', this.userId);

    // Save auth state to disk for next time
    await this.saveAuthState();
  }

  private async saveAuthState(): Promise<void> {
    if (!this.context) return;
    try {
      const storageState = await this.context.storageState();
      // Add our custom data to the storage state
      (storageState as any)._magister = {
        userId: this.userId,
        accessToken: this.accessToken,
        savedAt: new Date().toISOString(),
      };
      writeFileSync(AUTH_STATE_PATH, JSON.stringify(storageState, null, 2));
      log('Auth state saved to disk');
    } catch (e) {
      log('Failed to save auth state:', e);
    }
  }

  private async fetchUserId(): Promise<void> {
    if (!this.page) return;

    try {
      const token = this.accessToken;
      const response = await this.page.evaluate(async (t) => {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        if (t) {
          headers['Authorization'] = `Bearer ${t}`;
        }

        const res = await fetch('/api/account', {
          credentials: 'include',
          headers,
        });
        if (!res.ok) return { error: res.status, statusText: res.statusText };
        return await res.json();
      }, token);

      log('Account API response:', JSON.stringify(response).slice(0, 500));

      // Check if this is a parent account with linked children
      if (response.Persoon?.Id) {
        const personId = response.Persoon.Id;
        log('Logged in as person ID:', personId);

        // Try to get linked children (for parent accounts)
        const childrenResponse = await this.page.evaluate(async (params) => {
          const { personId, token } = params;
          const headers: Record<string, string> = {
            'Accept': 'application/json',
          };
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }

          // Try different endpoints for getting children
          const endpoints = [
            `/api/personen/${personId}/kinderen`,
            `/api/leerlingen`,
            `/api/accounts/${personId}/kinderen`,
          ];

          for (const endpoint of endpoints) {
            try {
              const res = await fetch(endpoint, { credentials: 'include', headers });
              if (res.ok) {
                const data = await res.json();
                return { endpoint, data };
              }
            } catch (e) {
              // Continue to next endpoint
            }
          }
          return { error: 'No children endpoint found' };
        }, { personId, token });

        log('Children API response:', JSON.stringify(childrenResponse).slice(0, 500));

        // Parse children response
        const children = childrenResponse.data?.Items || childrenResponse.data || [];
        if (Array.isArray(children) && children.length > 0) {
          // Use the first child's ID
          const child = children[0];
          this.userId = child.Id || child.Persoon?.Id || child.LeerlingId;
          log('Using child ID:', this.userId, 'Name:', child.Naam || child.Persoon?.Naam);
        } else {
          // No children found, use the logged-in person's ID (might be a student account)
          this.userId = personId;
          log('No children found, using own ID:', this.userId);
        }
      } else {
        log('Could not get user ID from response');
      }
    } catch (e) {
      log('Failed to fetch user ID:', e);
    }
  }

  async getSchedule(date: Date): Promise<ScheduleItem[]> {
    // Format date for API (YYYY-MM-DD format)
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const dateStr = formatDate(date);

    // Check cache first (SWR pattern)
    const cached = scheduleCache.get(dateStr);
    if (cached) {
      if (!cached.isStale) {
        log(`Cache HIT for ${dateStr} (fresh)`);
        return cached.data;
      }
      log(`Cache HIT for ${dateStr} (stale, will refresh)`);
      // Return stale data immediately, but trigger refresh in background
      this.refreshScheduleInBackground(date, dateStr);
      return cached.data;
    }

    log(`Cache MISS for ${dateStr}, fetching...`);
    return this.fetchScheduleFromAPI(date, dateStr);
  }

  private async refreshScheduleInBackground(date: Date, dateStr: string): Promise<void> {
    // Don't await - let it run in background
    this.fetchScheduleFromAPI(date, dateStr).catch(e => {
      log('Background refresh failed:', e);
    });
  }

  private async fetchScheduleFromAPI(date: Date, dateStr: string): Promise<ScheduleItem[]> {
    if (!this.page) throw new Error('Client not initialized. Call init() first.');

    // Try to get userId if we don't have it
    if (!this.userId) {
      log('No userId, trying to fetch...');
      await this.fetchUserId();
      if (!this.userId) {
        throw new Error('Could not get user ID');
      }
    }

    log(`Fetching schedule for ${dateStr} (userId: ${this.userId})`);

    // Make API call with cookies (and token if available)
    const apiResult = await this.page.evaluate(async (params) => {
      const { dateStr, userId, token } = params;

      try {
        const scheduleUrl = `/api/personen/${userId}/afspraken?status=1&van=${dateStr}&tot=${dateStr}`;
        console.log('Fetching:', scheduleUrl);

        const headers: Record<string, string> = {
          'Accept': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const res = await fetch(scheduleUrl, {
          credentials: 'include',
          headers,
        });

        if (!res.ok) {
          return { error: 'Failed to get schedule', status: res.status, url: scheduleUrl };
        }

        const schedule = await res.json();
        return { success: true, schedule };
      } catch (e) {
        return { error: String(e) };
      }
    }, { dateStr, userId: this.userId, token: this.accessToken || '' });

    log('API result:', JSON.stringify(apiResult, null, 2).slice(0, 500));

    if (apiResult.error) {
      log('API error:', apiResult.error);
      return this.getScheduleFromDOM(date);
    }

    // Parse API response into ScheduleItems
    const items: ScheduleItem[] = [];
    const appointments = apiResult.schedule?.Items || apiResult.schedule || [];

    for (const appt of appointments) {
      items.push({
        startTime: appt.Start ? new Date(appt.Start).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '',
        endTime: appt.Einde ? new Date(appt.Einde).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }) : '',
        subject: appt.Omschrijving || appt.Vakken?.[0]?.Naam || 'Unknown',
        teacher: appt.Docenten?.[0]?.Naam,
        location: appt.Lokalen?.[0]?.Naam || appt.Lokatie,
        cancelled: appt.Status === 5 || appt.Uitval || appt.Vervallen || false,
        description: appt.Inhoud,
      });
    }

    // Cache the result
    scheduleCache.set(dateStr, items);
    log(`Cached ${items.length} items for ${dateStr}`);

    return items;
  }

  private async getScheduleFromDOM(date: Date): Promise<ScheduleItem[]> {
    if (!this.page) return [];

    const dateStr = date.toISOString().split('T')[0];
    log('Falling back to DOM scraping for:', dateStr);

    // Navigate to agenda page
    await this.page.goto(`${this.getBaseUrl()}/magister/#/agenda`);
    await this.page.waitForTimeout(3000);

    // Extract schedule items from DOM
    const items = await this.page.evaluate(() => {
      const results: ScheduleItem[] = [];

      // Try various selectors
      const selectors = [
        '.agenda-item',
        '.appointment',
        '[class*="appointment"]',
        '[class*="agenda-list"] > *',
        '.rooster-item',
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          elements.forEach((el) => {
            const text = el.textContent?.trim() || '';
            if (text.length > 0) {
              results.push({
                startTime: '',
                endTime: '',
                subject: text.slice(0, 100),
                cancelled: el.classList.contains('cancelled') || el.classList.contains('vervallen'),
                description: undefined,
              });
            }
          });
          break;
        }
      }

      return results;
    });

    return items;
  }

  async getTodaySchedule(): Promise<ScheduleItem[]> {
    return this.getSchedule(new Date());
  }

  async getTomorrowSchedule(): Promise<ScheduleItem[]> {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return this.getSchedule(tomorrow);
  }

  async getWeekSchedule(): Promise<Record<string, ScheduleItem[]>> {
    const result: Record<string, ScheduleItem[]> = {};
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      result[dateStr] = await this.getSchedule(date);
    }

    return result;
  }

  async getFirstClass(date: Date): Promise<ScheduleItem | null> {
    const schedule = await this.getSchedule(date);
    const activeClasses = schedule.filter(item => !item.cancelled);
    return activeClasses.length > 0 ? activeClasses[0] : null;
  }

  async getLastClass(date: Date): Promise<ScheduleItem | null> {
    const schedule = await this.getSchedule(date);
    const activeClasses = schedule.filter(item => !item.cancelled);
    return activeClasses.length > 0 ? activeClasses[activeClasses.length - 1] : null;
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }
}
