// Central export for all mocks

export { SessionService } from './MockSessionService';
export { ProjectManager } from './MockProjectManager';
export { GitVersioningService } from './MockGitVersioningService';

// Mock for tests that need cacheService
export const cacheService = {
  clear: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  delete: jest.fn(),
  initialize: jest.fn(),
  getOrFetch: jest.fn()
};