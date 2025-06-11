import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';

export interface E2ETestContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  electronApp?: ChildProcess;
  baseUrl: string;
}

export class E2ETestSetup {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private electronApp: ChildProcess | null = null;

  async setupBrowser(): Promise<E2ETestContext> {
    // Launch browser
    this.browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create context with viewport
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'SessionHub E2E Test Suite',
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });

    // Create page
    const page = await this.context.newPage();

    // Set up console log capture
    page.on('console', msg => {
      if (process.env.DEBUG_E2E) {
        console.log(`[Browser Console] ${msg.type()}: ${msg.text()}`);
      }
    });

    // Set up error capture
    page.on('pageerror', error => {
      console.error(`[Browser Error]`, error);
    });

    const baseUrl = process.env.E2E_BASE_URL || 'http://localhost:3000';

    return {
      browser: this.browser,
      context: this.context,
      page,
      baseUrl
    };
  }

  async setupElectron(): Promise<E2ETestContext> {
    // Build path to electron app
    const electronPath = join(__dirname, '../../node_modules/.bin/electron');
    const appPath = join(__dirname, '../../main/background.js');

    // Launch Electron app
    this.electronApp = spawn(electronPath, [appPath], {
      env: {
        ...process.env,
        NODE_ENV: 'test',
        E2E_TEST: 'true'
      }
    });

    // Wait for app to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Connect to Electron app
    this.browser = await chromium.connectOverCDP('http://localhost:9222');
    this.context = this.browser.contexts()[0];
    const page = this.context.pages()[0];

    return {
      browser: this.browser,
      context: this.context,
      page,
      electronApp: this.electronApp,
      baseUrl: 'electron://app'
    };
  }

  async teardown(): Promise<void> {
    if (this.context) {
      await this.context.close();
    }
    if (this.browser) {
      await this.browser.close();
    }
    if (this.electronApp) {
      this.electronApp.kill();
    }
  }

  async takeScreenshot(page: Page, name: string): Promise<void> {
    const screenshotDir = join(__dirname, '../../test-results/screenshots');
    await page.screenshot({
      path: join(screenshotDir, `${name}-${Date.now()}.png`),
      fullPage: true
    });
  }

  async waitForAppReady(page: Page): Promise<void> {
    // Wait for app to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Wait for specific app indicators
    await page.waitForSelector('[data-testid="app-ready"]', {
      timeout: 30000,
      state: 'visible'
    });
  }

  async mockAPIResponses(page: Page): Promise<void> {
    // Mock Claude API responses for testing
    await page.route('**/api/claude/**', async route => {
      const url = route.request().url();
      
      if (url.includes('/chat')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            completion: 'Mocked planning response for testing',
            usage: { tokens: 100 }
          })
        });
      } else if (url.includes('/code')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            code: '// Mocked code generation',
            explanation: 'Mocked execution response',
            usage: { tokens: 150 }
          })
        });
      } else {
        await route.continue();
      }
    });

    // Mock Supabase responses
    await page.route('**/supabase/**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: [], error: null })
      });
    });
  }

  async login(page: Page, credentials?: { email: string; password: string }): Promise<void> {
    const { email, password } = credentials || {
      email: 'test@sessionhub.com',
      password: 'test123456'
    };

    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    
    // Wait for redirect after login
    await page.waitForNavigation();
  }

  async createTestProject(page: Page, projectName: string): Promise<void> {
    await page.click('[data-testid="create-project-button"]');
    await page.fill('[data-testid="project-name-input"]', projectName);
    await page.selectOption('[data-testid="project-type-select"]', 'next');
    await page.click('[data-testid="create-button"]');
    
    // Wait for project to be created
    await page.waitForSelector(`[data-testid="project-${projectName}"]`);
  }

  async measurePerformance(page: Page, actionName: string, action: () => Promise<void>): Promise<{
    duration: number;
    memory: number;
    cpu: number;
  }> {
    // Start performance measurement
    const startTime = Date.now();
    const startMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          memory: (performance as any).memory.usedJSHeapSize,
          cpu: performance.now()
        };
      }
      return { memory: 0, cpu: performance.now() };
    });

    // Execute action
    await action();

    // End performance measurement
    const endTime = Date.now();
    const endMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return {
          memory: (performance as any).memory.usedJSHeapSize,
          cpu: performance.now()
        };
      }
      return { memory: 0, cpu: performance.now() };
    });

    return {
      duration: endTime - startTime,
      memory: endMetrics.memory - startMetrics.memory,
      cpu: endMetrics.cpu - startMetrics.cpu
    };
  }

  async checkAccessibility(page: Page): Promise<any> {
    // Inject axe-core for accessibility testing
    await page.addScriptTag({
      path: require.resolve('axe-core/axe.min.js')
    });

    // Run accessibility checks
    const results = await page.evaluate(() => {
      return (window as any).axe.run();
    });

    return results;
  }
}

export const e2eSetup = new E2ETestSetup();