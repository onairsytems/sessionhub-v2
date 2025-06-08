/// <reference types="electron" />

declare module 'electron' {
  export * from 'electron/main';
  export * from 'electron/common';
  export * from 'electron/renderer';
}

// Ensure electron types are available globally
declare global {
  const electron: typeof import('electron');
}