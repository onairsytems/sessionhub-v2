import { test, expect } from '@playwright/test';
import { e2eSetup } from '../setup';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('homepage should have no accessibility violations', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    expect(accessibilityResults.violations).toEqual([]);
  });

  test('sessions page should be accessible', async ({ page }) => {
    await page.goto('/sessions');
    
    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    expect(accessibilityResults.violations).toEqual([]);
  });

  test('keyboard navigation should work throughout the app', async ({ page }) => {
    await page.goto('/');
    
    // Tab through main navigation
    await page.keyboard.press('Tab');
    const firstFocused = await page.evaluate(() => document.activeElement?.tagName);
    expect(firstFocused).toBeTruthy();

    // Navigate to sessions using keyboard
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    
    await page.waitForURL('**/sessions');
    expect(page.url()).toContain('/sessions');
  });

  test('forms should have proper labels and ARIA attributes', async ({ page }) => {
    await page.goto('/sessions/new');
    
    // Check form labels
    const titleInput = page.locator('input[name="title"]');
    const titleLabel = await titleInput.getAttribute('aria-label') || 
                      await page.locator('label[for="title"]').textContent();
    expect(titleLabel).toBeTruthy();

    // Check required fields have aria-required
    const requiredInputs = page.locator('input[required]');
    const count = await requiredInputs.count();
    
    for (let i = 0; i < count; i++) {
      const ariaRequired = await requiredInputs.nth(i).getAttribute('aria-required');
      expect(ariaRequired).toBe('true');
    }
  });

  test('color contrast should meet WCAG AA standards', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .options({ rules: { 'color-contrast': { enabled: true } } })
      .analyze();

    const colorContrastViolations = accessibilityResults.violations.filter(
      v => v.id === 'color-contrast'
    );
    
    expect(colorContrastViolations).toHaveLength(0);
  });

  test('images should have alt text', async ({ page }) => {
    await page.goto('/');
    
    const images = page.locator('img');
    const imageCount = await images.count();
    
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt');
      expect(alt).toBeTruthy();
      expect(alt).not.toBe(''); // Alt text should be meaningful
    }
  });

  test('page should have proper heading hierarchy', async ({ page }) => {
    await page.goto('/');
    
    const accessibilityResults = await new AxeBuilder({ page })
      .options({ 
        rules: { 
          'heading-order': { enabled: true },
          'page-has-heading-one': { enabled: true }
        } 
      })
      .analyze();

    const headingViolations = accessibilityResults.violations.filter(
      v => v.id === 'heading-order' || v.id === 'page-has-heading-one'
    );
    
    expect(headingViolations).toHaveLength(0);
  });

  test('interactive elements should be focusable', async ({ page }) => {
    await page.goto('/sessions');
    
    // Check all buttons are focusable
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    for (let i = 0; i < buttonCount; i++) {
      const tabindex = await buttons.nth(i).getAttribute('tabindex');
      if (tabindex) {
        expect(parseInt(tabindex)).toBeGreaterThanOrEqual(0);
      }
    }

    // Check all links are focusable
    const links = page.locator('a[href]');
    const linkCount = await links.count();
    
    for (let i = 0; i < linkCount; i++) {
      const tabindex = await links.nth(i).getAttribute('tabindex');
      if (tabindex) {
        expect(parseInt(tabindex)).not.toBe(-1);
      }
    }
  });

  test('modal dialogs should trap focus', async ({ page }) => {
    await page.goto('/sessions');
    await page.click('[data-testid="create-session-button"]');
    
    // Wait for modal to open
    await page.waitForSelector('[role="dialog"]');
    
    // Focus should be trapped within modal
    const focusableElements = await page.locator('[role="dialog"] *:focus-visible').count();
    
    // Tab through elements
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => {
        const el = document.activeElement;
        return el?.closest('[role="dialog"]') !== null;
      });
      expect(focusedElement).toBe(true);
    }
  });

  test('error messages should be announced to screen readers', async ({ page }) => {
    await page.goto('/sessions/new');
    
    // Submit empty form to trigger validation
    await page.click('[type="submit"]');
    
    // Check error messages have proper ARIA
    const errorMessages = page.locator('[role="alert"]');
    const errorCount = await errorMessages.count();
    
    expect(errorCount).toBeGreaterThan(0);
    
    for (let i = 0; i < errorCount; i++) {
      const ariaLive = await errorMessages.nth(i).getAttribute('aria-live');
      expect(['polite', 'assertive']).toContain(ariaLive);
    }
  });

  test('loading states should be announced', async ({ page }) => {
    await page.goto('/sessions');
    
    // Trigger a loading state
    await page.click('[data-testid="refresh-button"]');
    
    // Check for loading indicator with proper ARIA
    const loadingIndicator = page.locator('[aria-busy="true"]').or(
      page.locator('[role="progressbar"]')
    ).or(
      page.locator('[aria-label*="loading"]')
    );
    
    await expect(loadingIndicator).toBeVisible();
  });

  test('skip links should be present', async ({ page }) => {
    await page.goto('/');
    
    // Focus the skip link
    await page.keyboard.press('Tab');
    
    const skipLink = page.locator('a[href="#main"], a[href="#content"]').first();
    await expect(skipLink).toBeFocused();
    
    // Activate skip link
    await page.keyboard.press('Enter');
    
    // Main content should be focused or scrolled to
    const mainContent = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"], #main, #content');
      return main?.getBoundingClientRect().top;
    });
    
    expect(mainContent).toBeLessThanOrEqual(100);
  });

  test('tables should have proper structure', async ({ page }) => {
    await page.goto('/sessions');
    
    const tables = page.locator('table');
    const tableCount = await tables.count();
    
    for (let i = 0; i < tableCount; i++) {
      const table = tables.nth(i);
      
      // Check for caption or aria-label
      const caption = await table.locator('caption').count();
      const ariaLabel = await table.getAttribute('aria-label');
      expect(caption > 0 || ariaLabel).toBeTruthy();
      
      // Check for proper headers
      const headers = await table.locator('th').count();
      expect(headers).toBeGreaterThan(0);
      
      // Check scope attributes
      const headerCells = table.locator('th');
      const headerCount = await headerCells.count();
      
      for (let j = 0; j < headerCount; j++) {
        const scope = await headerCells.nth(j).getAttribute('scope');
        expect(['row', 'col', 'rowgroup', 'colgroup']).toContain(scope);
      }
    }
  });

  test('custom components should follow ARIA patterns', async ({ page }) => {
    await page.goto('/');
    
    // Check custom dropdown
    const dropdown = page.locator('[role="combobox"]').first();
    if (await dropdown.count() > 0) {
      const expanded = await dropdown.getAttribute('aria-expanded');
      expect(['true', 'false']).toContain(expanded);
      
      const controls = await dropdown.getAttribute('aria-controls');
      expect(controls).toBeTruthy();
    }

    // Check custom tabs
    const tablist = page.locator('[role="tablist"]').first();
    if (await tablist.count() > 0) {
      const tabs = tablist.locator('[role="tab"]');
      const tabCount = await tabs.count();
      
      for (let i = 0; i < tabCount; i++) {
        const selected = await tabs.nth(i).getAttribute('aria-selected');
        expect(['true', 'false']).toContain(selected);
        
        const controls = await tabs.nth(i).getAttribute('aria-controls');
        expect(controls).toBeTruthy();
      }
    }
  });

  test('touch targets should be large enough', async ({ page }) => {
    await page.goto('/');
    
    const interactiveElements = page.locator('button, a, input, select, textarea');
    const elementCount = await interactiveElements.count();
    
    for (let i = 0; i < Math.min(elementCount, 20); i++) {
      const element = interactiveElements.nth(i);
      const box = await element.boundingBox();
      
      if (box) {
        // WCAG 2.1 AA requires 44x44 pixels for touch targets
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test('animations should respect prefers-reduced-motion', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    
    // Check that animations are disabled
    const animatedElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const animated = [];
      
      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const hasAnimation = styles.animationDuration !== '0s' || 
                           styles.transitionDuration !== '0s';
        
        if (hasAnimation) {
          animated.push({
            tag: el.tagName,
            animation: styles.animationDuration,
            transition: styles.transitionDuration
          });
        }
      });
      
      return animated;
    });
    
    // Critical animations should be instant with reduced motion
    animatedElements.forEach(el => {
      if (el.animation !== '0s') {
        expect(parseFloat(el.animation)).toBeLessThanOrEqual(0.001);
      }
      if (el.transition !== '0s') {
        expect(parseFloat(el.transition)).toBeLessThanOrEqual(0.001);
      }
    });
  });
});