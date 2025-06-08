// Test environment setup
import '@jest/globals';

// Mock electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(),
    getName: jest.fn(() => 'SessionHub'),
    getVersion: jest.fn(() => '1.0.0')
  },
  ipcMain: {
    handle: jest.fn(),
    on: jest.fn()
  },
  BrowserWindow: jest.fn()
}));

// Mock fs promises for tests
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  readdir: jest.fn(),
  stat: jest.fn(),
  access: jest.fn()
}));

// Global test timeout
jest.setTimeout(10000);
