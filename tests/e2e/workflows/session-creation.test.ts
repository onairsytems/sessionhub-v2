import { test, expect } from '@playwright/test';
import { e2eSetup, E2ETestContext } from '../setup';

test.describe('Session Creation Workflow', () => {
  let testContext: E2ETestContext;

  test.beforeEach(async () => {
    testContext = await e2eSetup.setupBrowser();
    await e2eSetup.mockAPIResponses(testContext.page);
    await testContext.page.goto(testContext.baseUrl);
    await e2eSetup.waitForAppReady(testContext.page);
  });

  test.afterEach(async () => {
    await e2eSetup.teardown();
  });

  test('should create a new session from GitHub issue', async () => {
    const { page } = testContext;

    // Navigate to sessions page
    await page.click('[data-testid="nav-sessions"]');
    await page.waitForURL('**/sessions');

    // Click create session button
    await page.click('[data-testid="create-session-button"]');

    // Fill in GitHub issue URL
    await page.fill('[data-testid="github-issue-url"]', 'https://github.com/test/repo/issues/123');
    
    // Select session type
    await page.selectOption('[data-testid="session-type"]', 'feature');

    // Click import from GitHub
    await page.click('[data-testid="import-github-button"]');

    // Wait for issue to be imported
    await page.waitForSelector('[data-testid="issue-imported-success"]');

    // Verify session details populated
    expect(await page.inputValue('[data-testid="session-title"]')).toContain('Session');
    expect(await page.inputValue('[data-testid="session-objectives"]')).not.toBe('');

    // Start session
    await page.click('[data-testid="start-session-button"]');

    // Verify session started
    await page.waitForSelector('[data-testid="session-active"]');
    expect(await page.textContent('[data-testid="session-status"]')).toBe('Active');

    // Take screenshot for documentation
    await e2eSetup.takeScreenshot(page, 'session-created');
  });

  test('should handle planning and execution phases', async () => {
    const { page } = testContext;

    // Create a test session
    await page.goto(`${testContext.baseUrl}/sessions/new`);
    await page.fill('[data-testid="session-title"]', 'Test Planning Session');
    await page.fill('[data-testid="session-objectives"]', 'Test objective for E2E');
    await page.click('[data-testid="start-session-button"]');

    // Wait for planning phase
    await page.waitForSelector('[data-testid="planning-phase"]');
    
    // Verify planning actor is active
    expect(await page.textContent('[data-testid="active-actor"]')).toBe('Planning Actor');

    // Input planning request
    await page.fill('[data-testid="planning-input"]', 'Create a simple React component');
    await page.click('[data-testid="generate-plan-button"]');

    // Wait for plan generation
    await page.waitForSelector('[data-testid="plan-generated"]', { timeout: 30000 });

    // Verify plan content
    const planContent = await page.textContent('[data-testid="plan-content"]');
    expect(planContent).toContain('component');

    // Approve plan and move to execution
    await page.click('[data-testid="approve-plan-button"]');

    // Wait for execution phase
    await page.waitForSelector('[data-testid="execution-phase"]');
    
    // Verify execution actor is active
    expect(await page.textContent('[data-testid="active-actor"]')).toBe('Execution Actor');

    // Execute plan
    await page.click('[data-testid="execute-plan-button"]');

    // Wait for execution completion
    await page.waitForSelector('[data-testid="execution-complete"]', { timeout: 60000 });

    // Verify results
    const executionResults = await page.textContent('[data-testid="execution-results"]');
    expect(executionResults).toContain('Success');

    // Complete session
    await page.click('[data-testid="complete-session-button"]');
    await page.waitForSelector('[data-testid="session-completed"]');
  });

  test('should enforce Two-Actor Model boundaries', async () => {
    const { page } = testContext;

    // Start a session
    await page.goto(`${testContext.baseUrl}/sessions/new`);
    await page.fill('[data-testid="session-title"]', 'Boundary Test Session');
    await page.click('[data-testid="start-session-button"]');

    // Try to make execution actor do planning (should fail)
    await page.evaluate(() => {
      // Attempt to bypass UI and call execution actor with planning task
      (window as any).__testBypassActorBoundary = true;
    });

    await page.fill('[data-testid="planning-input"]', 'EXECUTE: console.log("test")');
    await page.click('[data-testid="generate-plan-button"]');

    // Wait for boundary violation alert
    await page.waitForSelector('[data-testid="boundary-violation-alert"]');
    
    // Verify violation was caught
    const alertText = await page.textContent('[data-testid="boundary-violation-alert"]');
    expect(alertText).toContain('Actor boundary violation detected');

    // Verify session is still in valid state
    expect(await page.textContent('[data-testid="session-status"]')).toBe('Active');
  });

  test('should handle session interruption and recovery', async () => {
    const { page } = testContext;

    // Start a session
    await page.goto(`${testContext.baseUrl}/sessions/new`);
    await page.fill('[data-testid="session-title"]', 'Recovery Test Session');
    await page.click('[data-testid="start-session-button"]');

    // Start planning
    await page.fill('[data-testid="planning-input"]', 'Create a complex feature');
    await page.click('[data-testid="generate-plan-button"]');

    // Simulate interruption (refresh page)
    await page.reload();

    // Wait for app to reload
    await e2eSetup.waitForAppReady(page);

    // Verify session recovered
    await page.waitForSelector('[data-testid="session-recovered"]');
    expect(await page.textContent('[data-testid="session-title"]')).toBe('Recovery Test Session');
    expect(await page.textContent('[data-testid="session-status"]')).toBe('Active');

    // Verify planning state recovered
    expect(await page.inputValue('[data-testid="planning-input"]')).toBe('Create a complex feature');
  });

  test('should track session metrics and performance', async () => {
    const { page } = testContext;

    // Start session with performance tracking
    await page.goto(`${testContext.baseUrl}/sessions/new`);
    await page.fill('[data-testid="session-title"]', 'Performance Test Session');
    
    const startMetrics = await e2eSetup.measurePerformance(page, 'session-start', async () => {
      await page.click('[data-testid="start-session-button"]');
      await page.waitForSelector('[data-testid="session-active"]');
    });

    expect(startMetrics.duration).toBeLessThan(3000); // Should start within 3 seconds

    // Measure planning performance
    const planMetrics = await e2eSetup.measurePerformance(page, 'generate-plan', async () => {
      await page.fill('[data-testid="planning-input"]', 'Simple task');
      await page.click('[data-testid="generate-plan-button"]');
      await page.waitForSelector('[data-testid="plan-generated"]');
    });

    expect(planMetrics.duration).toBeLessThan(10000); // Should complete within 10 seconds

    // Check session metrics display
    await page.click('[data-testid="show-metrics-button"]');
    await page.waitForSelector('[data-testid="session-metrics"]');

    const metrics = await page.textContent('[data-testid="session-metrics"]');
    expect(metrics).toContain('Duration');
    expect(metrics).toContain('API Calls');
    expect(metrics).toContain('Token Usage');
  });

  test('should export session documentation', async () => {
    const { page } = testContext;

    // Complete a session first
    await page.goto(`${testContext.baseUrl}/sessions/new`);
    await page.fill('[data-testid="session-title"]', 'Export Test Session');
    await page.fill('[data-testid="session-objectives"]', 'Test export functionality');
    await page.click('[data-testid="start-session-button"]');
    
    // Quick plan and execute
    await page.fill('[data-testid="planning-input"]', 'Simple task');
    await page.click('[data-testid="generate-plan-button"]');
    await page.waitForSelector('[data-testid="plan-generated"]');
    await page.click('[data-testid="approve-plan-button"]');
    await page.click('[data-testid="execute-plan-button"]');
    await page.waitForSelector('[data-testid="execution-complete"]');
    await page.click('[data-testid="complete-session-button"]');

    // Export session
    await page.click('[data-testid="export-session-button"]');
    
    // Verify export options
    await page.waitForSelector('[data-testid="export-dialog"]');
    expect(await page.isVisible('[data-testid="export-markdown"]')).toBe(true);
    expect(await page.isVisible('[data-testid="export-json"]')).toBe(true);
    expect(await page.isVisible('[data-testid="export-pdf"]')).toBe(true);

    // Export as markdown
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-testid="export-markdown"]')
    ]);

    // Verify download
    expect(download.suggestedFilename()).toContain('Export Test Session');
    expect(download.suggestedFilename()).toContain('.md');
  });

  test('should validate accessibility standards', async () => {
    const { page } = testContext;

    // Navigate through main workflows
    await page.goto(testContext.baseUrl);
    
    // Check homepage accessibility
    const homeResults = await e2eSetup.checkAccessibility(page);
    expect(homeResults.violations).toHaveLength(0);

    // Check sessions page
    await page.click('[data-testid="nav-sessions"]');
    await page.waitForURL('**/sessions');
    const sessionsResults = await e2eSetup.checkAccessibility(page);
    expect(sessionsResults.violations).toHaveLength(0);

    // Check session creation form
    await page.click('[data-testid="create-session-button"]');
    await page.waitForSelector('[data-testid="session-form"]');
    const formResults = await e2eSetup.checkAccessibility(page);
    expect(formResults.violations).toHaveLength(0);
  });
});