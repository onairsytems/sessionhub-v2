#!/usr/bin/env ts-node

/**
 * Fix TypeScript Configuration Issues
 * 
 * This script fixes common tsconfig.json issues that prevent proper compilation
 */

import * as fs from 'fs';
import * as path from 'path';

function fixTsConfig() {
  const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
  const tsconfigNodePath = path.join(process.cwd(), 'tsconfig.node.json');
  
  // Read current tsconfig
  const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
  
  // Ensure all required compiler options are set
  tsconfig.compilerOptions = tsconfig.compilerOptions || {};
  
  // Core settings for Next.js + Electron project
  const requiredOptions = {
    target: 'es5',
    lib: ['dom', 'dom.iterable', 'esnext'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    forceConsistentCasingInFileNames: true,
    noEmit: true,
    esModuleInterop: true,
    module: 'esnext',
    moduleResolution: 'node',
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: 'preserve',
    incremental: true,
    baseUrl: '.',
    paths: {
      '@/*': ['./src/*'],
      '@components/*': ['./components/*'],
      '@lib/*': ['./lib/*'],
      '@renderer/*': ['./renderer/*'],
      '@main/*': ['./main/*']
    }
  };
  
  // Merge with existing options
  tsconfig.compilerOptions = {
    ...requiredOptions,
    ...tsconfig.compilerOptions
  };
  
  // Ensure plugins are configured correctly
  if (!tsconfig.compilerOptions.plugins) {
    tsconfig.compilerOptions.plugins = [];
  }
  
  // Add Next.js plugin if not present
  const hasNextPlugin = tsconfig.compilerOptions.plugins.some(
    (p: any) => p.name === 'next'
  );
  
  if (!hasNextPlugin) {
    tsconfig.compilerOptions.plugins.push({ name: 'next' });
  }
  
  // Set include and exclude patterns
  tsconfig.include = [
    'next-env.d.ts',
    '**/*.ts',
    '**/*.tsx',
    '.next/types/**/*.ts'
  ];
  
  tsconfig.exclude = [
    'node_modules',
    'dist',
    'dist-electron',
    'out',
    '.next'
  ];
  
  // Write updated tsconfig
  fs.writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2));
  console.log('✅ Updated tsconfig.json');
  
  // Create/update tsconfig.node.json for Node.js scripts
  const tsconfigNode = {
    extends: './tsconfig.json',
    compilerOptions: {
      module: 'commonjs',
      target: 'es2020',
      lib: ['es2020'],
      allowJs: true,
      skipLibCheck: true,
      strict: false,
      forceConsistentCasingInFileNames: true,
      noEmit: false,
      esModuleInterop: true,
      moduleResolution: 'node',
      resolveJsonModule: true,
      isolatedModules: false,
      allowSyntheticDefaultImports: true,
      types: ['node']
    },
    include: [
      'scripts/**/*',
      'main/**/*',
      'src/**/*'
    ],
    exclude: [
      'node_modules',
      'dist',
      'dist-electron',
      'out',
      '.next'
    ]
  };
  
  fs.writeFileSync(tsconfigNodePath, JSON.stringify(tsconfigNode, null, 2));
  console.log('✅ Updated tsconfig.node.json');
  
  // Create/update tsconfig.electron.json for Electron main process
  const tsconfigElectronPath = path.join(process.cwd(), 'tsconfig.electron.json');
  const tsconfigElectron = {
    extends: './tsconfig.json',
    compilerOptions: {
      module: 'commonjs',
      target: 'es2020',
      outDir: './dist-electron',
      lib: ['es2020'],
      noEmit: false,
      types: ['node', 'electron']
    },
    include: [
      'main/**/*'
    ],
    exclude: [
      'node_modules',
      'renderer',
      'app',
      'components',
      '.next'
    ]
  };
  
  fs.writeFileSync(tsconfigElectronPath, JSON.stringify(tsconfigElectron, null, 2));
  console.log('✅ Updated tsconfig.electron.json');
  
  // Ensure next-env.d.ts exists
  const nextEnvPath = path.join(process.cwd(), 'next-env.d.ts');
  if (!fs.existsSync(nextEnvPath)) {
    fs.writeFileSync(
      nextEnvPath,
      `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/basic-features/typescript for more information.
`
    );
    console.log('✅ Created next-env.d.ts');
  }
}

// Main execution
try {
  fixTsConfig();
  console.log('\n✅ TypeScript configuration fixed successfully!');
} catch (error: any) {
  console.error('❌ Failed to fix TypeScript configuration:', error);
  process.exit(1);
}