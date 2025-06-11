import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'test-results/playwright-report' }],
    ['json', { outputFile: 'test-results/playwright-results.json' }],
    ['junit', { outputFile: 'test-results/playwright-junit.xml' }]
  ],
  
  use: {
    baseURL: process.env['E2E_BASE_URL'] || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000
  },

  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
    {
      name: 'webkit',
      use: { browserName: 'webkit' },
    },
    {
      name: 'electron',
      use: {
        browserName: 'chromium',
        launchOptions: {
          args: ['--no-sandbox']
        }
      },
    }
  ],

  webServer: process.env['CI'] ? {
    command: 'npm run build && npm run start',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env['CI'],
  } : undefined,

  outputDir: 'test-results/playwright-output',
};

export default config;