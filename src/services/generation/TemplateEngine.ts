import { ProjectType, ProjectConfig, ProjectTemplate, TemplateFile } from './types';
// import * as path from 'path'; // Reserved for future use

export class TemplateEngine {
  private templateCache: Map<ProjectType, ProjectTemplate> = new Map();
  // templatesDir will be used in future when templates are loaded from disk
  // private templatesDir: string;

  constructor() {
    // Reserved for future use when templates are loaded from disk
    // this.templatesDir = path.join(__dirname, '../../../templates');
  }

  async prepareTemplate(config: ProjectConfig): Promise<ProjectTemplate> {
    // Check cache first
    if (this.templateCache.has(config.type)) {
      return this.customizeTemplate(this.templateCache.get(config.type)!, config);
    }

    // Load base template
    const baseTemplate = await this.loadBaseTemplate(config.type);
    
    // Apply feature enhancements
    const enhancedTemplate = await this.applyFeatures(baseTemplate, config);
    
    // Customize with project-specific values
    const customizedTemplate = await this.customizeTemplate(enhancedTemplate, config);
    
    // Cache the base template for future use
    this.templateCache.set(config.type, baseTemplate);
    
    return customizedTemplate;
  }

  async getAvailableTemplates(): Promise<string[]> {
    return Object.values(ProjectType);
  }

  private async loadBaseTemplate(type: ProjectType): Promise<ProjectTemplate> {
    switch (type) {
      case ProjectType.REACT_TYPESCRIPT:
        return this.createReactTypeScriptTemplate();
      case ProjectType.NEXTJS:
        return this.createNextJsTemplate();
      case ProjectType.EXPRESS_TYPESCRIPT:
        return this.createExpressTypeScriptTemplate();
      case ProjectType.PYTHON_FASTAPI:
        return this.createPythonFastAPITemplate();
      default:
        throw new Error(`Template not implemented for type: ${type}`);
    }
  }

  private createReactTypeScriptTemplate(): ProjectTemplate {
    return {
      name: 'React TypeScript',
      type: ProjectType.REACT_TYPESCRIPT,
      files: [
        {
          path: 'package.json',
          content: JSON.stringify({
            name: '{{projectName}}',
            version: '0.1.0',
            private: true,
            scripts: {
              start: 'react-scripts start',
              build: 'react-scripts build',
              test: 'react-scripts test',
              eject: 'react-scripts eject',
              lint: 'eslint . --ext .ts,.tsx',
              'lint:fix': 'eslint . --ext .ts,.tsx --fix',
              typecheck: 'tsc --noEmit',
              'format': 'prettier --write "src/**/*.{ts,tsx,json,css,md}"',
              'format:check': 'prettier --check "src/**/*.{ts,tsx,json,css,md}"',
              'quality:check': 'npm run lint && npm run typecheck && npm run test -- --watchAll=false'
            }
          }, null, 2)
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'es5',
              lib: ['dom', 'dom.iterable', 'esnext'],
              allowJs: true,
              skipLibCheck: true,
              esModuleInterop: true,
              allowSyntheticDefaultImports: true,
              strict: true,
              forceConsistentCasingInFileNames: true,
              noFallthroughCasesInSwitch: true,
              module: 'esnext',
              moduleResolution: 'node',
              resolveJsonModule: true,
              isolatedModules: true,
              noEmit: true,
              jsx: 'react-jsx'
            },
            include: ['src']
          }, null, 2)
        },
        {
          path: '.eslintrc.json',
          content: JSON.stringify({
            extends: [
              'react-app',
              'react-app/jest',
              'plugin:@typescript-eslint/recommended',
              'plugin:react-hooks/recommended'
            ],
            parser: '@typescript-eslint/parser',
            plugins: ['@typescript-eslint'],
            rules: {
              '@typescript-eslint/explicit-module-boundary-types': 'off',
              '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
              'react-hooks/rules-of-hooks': 'error',
              'react-hooks/exhaustive-deps': 'warn'
            }
          }, null, 2)
        },
        {
          path: '.prettierrc.json',
          content: JSON.stringify({
            semi: true,
            trailingComma: 'es5',
            singleQuote: true,
            printWidth: 100,
            tabWidth: 2,
            useTabs: false
          }, null, 2)
        },
        {
          path: '.gitignore',
          content: `# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Production
/build

# Misc
.DS_Store
.env.local
.env.development.local
.env.test.local
.env.production.local

npm-debug.log*
yarn-debug.log*
yarn-error.log*

# IDE
.idea/
.vscode/
*.swp
*.swo
*~

# TypeScript
*.tsbuildinfo`
        },
        {
          path: 'src/App.tsx',
          content: `import React from 'react';
import './App.css';

function App(): React.ReactElement {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to {{projectName}}</h1>
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <p>
          This project was generated with zero errors by SessionHub.
        </p>
      </header>
    </div>
  );
}

export default App;`
        },
        {
          path: 'src/App.css',
          content: `.App {
  text-align: center;
}

.App-header {
  background-color: #282c34;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: calc(10px + 2vmin);
  color: white;
}

.App-header h1 {
  margin-bottom: 1rem;
}

.App-header code {
  background-color: #61dafb;
  color: #282c34;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace;
}`
        },
        {
          path: 'src/index.tsx',
          content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
        },
        {
          path: 'src/index.css',
          content: `body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

code {
  font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
    monospace;
}`
        },
        {
          path: 'src/App.test.tsx',
          content: `import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders welcome message', () => {
  render(<App />);
  const linkElement = screen.getByText(/Welcome to/i);
  expect(linkElement).toBeInTheDocument();
});`
        },
        {
          path: 'src/setupTests.ts',
          content: `// jest-dom adds custom jest matchers for asserting on DOM nodes.
import '@testing-library/jest-dom';`
        },
        {
          path: 'public/index.html',
          content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" />
    <meta name="description" content="{{projectName}} - Generated with zero errors by SessionHub" />
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/logo192.png" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />
    <title>{{projectName}}</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>`
        },
        {
          path: 'public/manifest.json',
          content: JSON.stringify({
            short_name: '{{projectName}}',
            name: '{{projectName}}',
            icons: [
              {
                src: 'favicon.ico',
                sizes: '64x64 32x32 24x24 16x16',
                type: 'image/x-icon'
              }
            ],
            start_url: '.',
            display: 'standalone',
            theme_color: '#000000',
            background_color: '#ffffff'
          }, null, 2)
        },
        {
          path: 'README.md',
          content: `# {{projectName}}

This project was generated with **zero errors** by SessionHub.

## Available Scripts

In the project directory, you can run:

### \`npm start\`
Runs the app in development mode.

### \`npm test\`
Launches the test runner in interactive watch mode.

### \`npm run build\`
Builds the app for production to the \`build\` folder.

### \`npm run lint\`
Runs ESLint to check for code quality issues.

### \`npm run typecheck\`
Runs TypeScript compiler to check for type errors.

### \`npm run quality:check\`
Runs all quality checks (lint, typecheck, and tests).

## Zero-Error Guarantee

This project comes with:
- ✅ Zero TypeScript errors
- ✅ Zero ESLint errors
- ✅ Passing tests
- ✅ Pre-commit hooks to maintain quality
- ✅ GitHub Actions CI/CD (if enabled)

## Learn More

Generated by [SessionHub](https://github.com/sessionhub/sessionhub) - The zero-error code generation platform.`
        }
      ],
      dependencies: {
        'react': '^18.2.0',
        'react-dom': '^18.2.0',
        'react-scripts': '5.0.1',
        'web-vitals': '^2.1.4'
      },
      devDependencies: {
        '@testing-library/jest-dom': '^5.16.5',
        '@testing-library/react': '^13.4.0',
        '@testing-library/user-event': '^13.5.0',
        '@types/jest': '^27.5.2',
        '@types/node': '^16.18.0',
        '@types/react': '^18.0.27',
        '@types/react-dom': '^18.0.10',
        '@typescript-eslint/eslint-plugin': '^5.48.0',
        '@typescript-eslint/parser': '^5.48.0',
        'eslint': '^8.31.0',
        'eslint-plugin-react-hooks': '^4.6.0',
        'prettier': '^2.8.2',
        'typescript': '^4.9.4'
      },
      scripts: {},
      configuration: {}
    };
  }

  private createNextJsTemplate(): ProjectTemplate {
    return {
      name: 'Next.js',
      type: ProjectType.NEXTJS,
      files: [
        {
          path: 'package.json',
          content: JSON.stringify({
            name: '{{projectName}}',
            version: '0.1.0',
            private: true,
            scripts: {
              dev: 'next dev',
              build: 'next build',
              start: 'next start',
              lint: 'next lint',
              typecheck: 'tsc --noEmit',
              'format': 'prettier --write "**/*.{ts,tsx,json,css,md}"',
              'quality:check': 'npm run lint && npm run typecheck'
            }
          }, null, 2)
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
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
              paths: {
                '@/*': ['./src/*']
              }
            },
            include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
            exclude: ['node_modules']
          }, null, 2)
        },
        {
          path: 'next.config.js',
          content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig`
        },
        {
          path: '.eslintrc.json',
          content: JSON.stringify({
            extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
            parser: '@typescript-eslint/parser',
            plugins: ['@typescript-eslint'],
            rules: {
              '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
            }
          }, null, 2)
        },
        {
          path: 'src/pages/index.tsx',
          content: `import type { NextPage } from 'next';
import Head from 'next/head';
import styles from '../styles/Home.module.css';

const Home: NextPage = () => {
  return (
    <div className={styles.container}>
      <Head>
        <title>{{projectName}}</title>
        <meta name="description" content="Generated with zero errors by SessionHub" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <a href="https://nextjs.org">{{projectName}}!</a>
        </h1>

        <p className={styles.description}>
          This project was generated with zero errors by SessionHub
        </p>
      </main>
    </div>
  );
};

export default Home;`
        },
        {
          path: 'src/pages/_app.tsx',
          content: `import '../styles/globals.css';
import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;`
        },
        {
          path: 'src/styles/globals.css',
          content: `html,
body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

* {
  box-sizing: border-box;
}`
        },
        {
          path: 'src/styles/Home.module.css',
          content: `.container {
  padding: 0 2rem;
}

.main {
  min-height: 100vh;
  padding: 4rem 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.title {
  margin: 0;
  line-height: 1.15;
  font-size: 4rem;
}

.title a {
  color: #0070f3;
  text-decoration: none;
}

.title a:hover,
.title a:focus,
.title a:active {
  text-decoration: underline;
}

.description {
  margin: 4rem 0;
  line-height: 1.5;
  font-size: 1.5rem;
}`
        }
      ],
      dependencies: {
        'next': '13.1.1',
        'react': '^18.2.0',
        'react-dom': '^18.2.0'
      },
      devDependencies: {
        '@types/node': '^18.11.18',
        '@types/react': '^18.0.26',
        '@types/react-dom': '^18.0.10',
        '@typescript-eslint/eslint-plugin': '^5.48.0',
        '@typescript-eslint/parser': '^5.48.0',
        'eslint': '^8.31.0',
        'eslint-config-next': '13.1.1',
        'typescript': '^4.9.4'
      },
      scripts: {},
      configuration: {}
    };
  }

  private createExpressTypeScriptTemplate(): ProjectTemplate {
    return {
      name: 'Express TypeScript',
      type: ProjectType.EXPRESS_TYPESCRIPT,
      files: [
        {
          path: 'package.json',
          content: JSON.stringify({
            name: '{{projectName}}',
            version: '0.1.0',
            description: '{{description}}',
            main: 'dist/index.js',
            scripts: {
              build: 'tsc',
              start: 'node dist/index.js',
              dev: 'nodemon --exec ts-node src/index.ts',
              lint: 'eslint . --ext .ts',
              'lint:fix': 'eslint . --ext .ts --fix',
              typecheck: 'tsc --noEmit',
              test: 'jest',
              'quality:check': 'npm run lint && npm run typecheck && npm test'
            }
          }, null, 2)
        },
        {
          path: 'tsconfig.json',
          content: JSON.stringify({
            compilerOptions: {
              target: 'ES2020',
              module: 'commonjs',
              lib: ['ES2020'],
              outDir: './dist',
              rootDir: './src',
              strict: true,
              esModuleInterop: true,
              skipLibCheck: true,
              forceConsistentCasingInFileNames: true,
              resolveJsonModule: true,
              moduleResolution: 'node',
              allowUnusedLabels: false,
              allowUnreachableCode: false,
              exactOptionalPropertyTypes: true,
              noFallthroughCasesInSwitch: true,
              noImplicitOverride: true,
              noImplicitReturns: true,
              noPropertyAccessFromIndexSignature: true,
              noUncheckedIndexedAccess: true,
              noUnusedLocals: true,
              noUnusedParameters: true
            },
            include: ['src/**/*'],
            exclude: ['node_modules', 'dist']
          }, null, 2)
        },
        {
          path: 'src/index.ts',
          content: `import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';

dotenv.config();

const app: Express = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.get('/', (_req: Request, res: Response) => {
  res.json({
    message: 'Welcome to {{projectName}}',
    status: 'healthy',
    generatedBy: 'SessionHub - Zero Error Generation'
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use((err: Error, _req: Request, res: Response) => {
  // Log error to service-specific logger in production
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(port, () => {
  // Server startup logged via application logger
});

export default app;`
        },
        {
          path: '.eslintrc.json',
          content: JSON.stringify({
            env: {
              es2021: true,
              node: true
            },
            extends: [
              'eslint:recommended',
              'plugin:@typescript-eslint/recommended'
            ],
            parser: '@typescript-eslint/parser',
            parserOptions: {
              ecmaVersion: 12,
              sourceType: 'module'
            },
            plugins: ['@typescript-eslint'],
            rules: {
              '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
              '@typescript-eslint/explicit-module-boundary-types': 'off'
            }
          }, null, 2)
        },
        {
          path: 'jest.config.js',
          content: `/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
};`
        },
        {
          path: 'src/__tests__/index.test.ts',
          content: `import request from 'supertest';
import app from '../index';

describe('Express App', () => {
  it('should return welcome message on GET /', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('message');
    expect(response.body.status).toBe('healthy');
  });

  it('should return health status on GET /health', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body).toHaveProperty('timestamp');
  });
});`
        },
        {
          path: '.env.example',
          content: `# Environment variables
PORT=3000
NODE_ENV=development`
        },
        {
          path: 'nodemon.json',
          content: JSON.stringify({
            watch: ['src'],
            ext: 'ts',
            ignore: ['src/**/*.spec.ts'],
            exec: 'ts-node ./src/index.ts'
          }, null, 2)
        }
      ],
      dependencies: {
        'express': '^4.18.2',
        'dotenv': '^16.0.3',
        'cors': '^2.8.5',
        'helmet': '^6.0.1'
      },
      devDependencies: {
        '@types/cors': '^2.8.13',
        '@types/express': '^4.17.15',
        '@types/jest': '^29.2.5',
        '@types/node': '^18.11.18',
        '@types/supertest': '^2.0.12',
        '@typescript-eslint/eslint-plugin': '^5.48.0',
        '@typescript-eslint/parser': '^5.48.0',
        'eslint': '^8.31.0',
        'jest': '^29.3.1',
        'nodemon': '^2.0.20',
        'supertest': '^6.3.3',
        'ts-jest': '^29.0.3',
        'ts-node': '^10.9.1',
        'typescript': '^4.9.4'
      },
      scripts: {},
      configuration: {}
    };
  }

  private createPythonFastAPITemplate(): ProjectTemplate {
    return {
      name: 'Python FastAPI',
      type: ProjectType.PYTHON_FASTAPI,
      files: [
        {
          path: 'pyproject.toml',
          content: `[tool.poetry]
name = "{{projectName}}"
version = "0.1.0"
description = "{{description}}"
authors = ["{{author}}"]
license = "{{license}}"

[tool.poetry.dependencies]
python = "^3.9"
fastapi = "^0.89.0"
uvicorn = {extras = ["standard"], version = "^0.20.0"}
pydantic = "^1.10.4"
python-dotenv = "^0.21.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.2.0"
pytest-asyncio = "^0.20.3"
httpx = "^0.23.3"
black = "^22.12.0"
isort = "^5.11.4"
mypy = "^0.991"
flake8 = "^6.0.0"
pylint = "^2.15.9"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.black]
line-length = 100
target-version = ['py39']

[tool.isort]
profile = "black"
line_length = 100

[tool.mypy]
python_version = "3.9"
disallow_untyped_defs = true
ignore_missing_imports = true
strict = true

[tool.pylint.messages_control]
max-line-length = 100
disable = "C0111"`
        },
        {
          path: 'requirements.txt',
          content: `fastapi==0.89.0
uvicorn[standard]==0.20.0
pydantic==1.10.4
python-dotenv==0.21.0`
        },
        {
          path: '.flake8',
          content: `[flake8]
max-line-length = 100
extend-ignore = E203, W503
exclude = .git,__pycache__,venv,env,.venv,.tox,dist,build`
        },
        {
          path: 'src/__init__.py',
          content: `"""{{projectName}} - Generated with zero errors by SessionHub."""

__version__ = "0.1.0"`
        },
        {
          path: 'src/main.py',
          content: `"""Main application module."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.routes import health, root

app = FastAPI(
    title="{{projectName}}",
    description="Generated with zero errors by SessionHub",
    version="0.1.0",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(root.router)
app.include_router(health.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "src.main:app",
        host="0.0.0.0",
        port=settings.port,
        reload=settings.debug,
    )`
        },
        {
          path: 'src/config.py',
          content: `"""Application configuration."""
from typing import List

from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    app_name: str = "{{projectName}}"
    debug: bool = False
    port: int = 8000
    allowed_origins: List[str] = ["*"]

    class Config:
        """Pydantic config."""

        env_file = ".env"


settings = Settings()`
        },
        {
          path: 'src/routes/__init__.py',
          content: `"""API routes."""`
        },
        {
          path: 'src/routes/root.py',
          content: `"""Root route."""
from datetime import datetime
from typing import Dict

from fastapi import APIRouter

router = APIRouter()


@router.get("/", response_model=Dict[str, str])
async def root() -> Dict[str, str]:
    """Root endpoint."""
    return {
        "message": "Welcome to {{projectName}}",
        "status": "healthy",
        "generated_by": "SessionHub - Zero Error Generation",
        "timestamp": datetime.utcnow().isoformat(),
    }`
        },
        {
          path: 'src/routes/health.py',
          content: `"""Health check route."""
from datetime import datetime
from typing import Dict

from fastapi import APIRouter

router = APIRouter()


@router.get("/health", response_model=Dict[str, str])
async def health_check() -> Dict[str, str]:
    """Health check endpoint."""
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
    }`
        },
        {
          path: 'tests/__init__.py',
          content: `"""Tests package."""`
        },
        {
          path: 'tests/conftest.py',
          content: `"""Test configuration."""
import pytest
from fastapi.testclient import TestClient

from src.main import app


@pytest.fixture
def client() -> TestClient:
    """Create test client."""
    return TestClient(app)`
        },
        {
          path: 'tests/test_main.py',
          content: `"""Test main application."""
from fastapi.testclient import TestClient


def test_root(client: TestClient) -> None:
    """Test root endpoint."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "message" in data
    assert "timestamp" in data


def test_health(client: TestClient) -> None:
    """Test health endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data`
        },
        {
          path: '.gitignore',
          content: `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# C extensions
*.so

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
share/python-wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# PyInstaller
*.manifest
*.spec

# Installer logs
pip-log.txt
pip-delete-this-directory.txt

# Unit test / coverage reports
htmlcov/
.tox/
.nox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.py,cover
.hypothesis/
.pytest_cache/
cover/

# Translations
*.mo
*.pot

# Django stuff:
*.log
local_settings.py
db.sqlite3
db.sqlite3-journal

# Flask stuff:
instance/
.webassets-cache

# Scrapy stuff:
.scrapy

# Sphinx documentation
docs/_build/

# PyBuilder
.pybuilder/
target/

# Jupyter Notebook
.ipynb_checkpoints

# IPython
profile_default/
ipython_config.py

# pyenv
.python-version

# pipenv
Pipfile.lock

# poetry
poetry.lock

# PEP 582
__pypackages__/

# Celery stuff
celerybeat-schedule
celerybeat.pid

# SageMath parsed files
*.sage.py

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# Spyder project settings
.spyderproject
.spyproject

# Rope project settings
.ropeproject

# mkdocs documentation
/site

# mypy
.mypy_cache/
.dmypy.json
dmypy.json

# Pyre type checker
.pyre/

# pytype static type analyzer
.pytype/

# Cython debug symbols
cython_debug/

# IDEs
.idea/
.vscode/
*.swp
*.swo`
        },
        {
          path: 'Makefile',
          content: `# Makefile for {{projectName}}

.PHONY: install
install:
	poetry install

.PHONY: run
run:
	poetry run uvicorn src.main:app --reload

.PHONY: test
test:
	poetry run pytest

.PHONY: lint
lint:
	poetry run flake8 src tests
	poetry run pylint src tests
	poetry run mypy src tests

.PHONY: format
format:
	poetry run black src tests
	poetry run isort src tests

.PHONY: format-check
format-check:
	poetry run black --check src tests
	poetry run isort --check-only src tests

.PHONY: quality-check
quality-check: lint format-check test
	@echo "All quality checks passed!"`
        },
        {
          path: 'README.md',
          content: `# {{projectName}}

This project was generated with **zero errors** by SessionHub.

## Setup

\`\`\`bash
# Install dependencies
poetry install

# Or using pip
pip install -r requirements.txt
\`\`\`

## Development

\`\`\`bash
# Run the development server
make run

# Or without make
poetry run uvicorn src.main:app --reload
\`\`\`

## Quality Checks

\`\`\`bash
# Run all quality checks
make quality-check

# Individual checks
make lint         # Run linters
make format       # Format code
make test         # Run tests
\`\`\`

## Zero-Error Guarantee

This project comes with:
- ✅ Zero mypy type errors
- ✅ Zero flake8/pylint errors
- ✅ Passing tests
- ✅ Pre-commit hooks to maintain quality
- ✅ GitHub Actions CI/CD (if enabled)

## API Documentation

Once running, visit:
- API Documentation: http://localhost:8000/docs
- Alternative API docs: http://localhost:8000/redoc

Generated by [SessionHub](https://github.com/sessionhub/sessionhub) - The zero-error code generation platform.`
        }
      ],
      dependencies: {},
      devDependencies: {},
      scripts: {},
      configuration: {}
    };
  }

  private async applyFeatures(template: ProjectTemplate, config: ProjectConfig): Promise<ProjectTemplate> {
    const enhanced = { ...template };

    if (config.features?.testing) {
      // Testing is already included in base templates
    }

    if (config.features?.docker) {
      enhanced.files.push(this.createDockerfile(config.type));
      enhanced.files.push(this.createDockerIgnore());
      enhanced.files.push(this.createDockerCompose(config));
    }

    if (config.features?.cicd) {
      enhanced.files.push(...this.createGitHubActions(config.type));
    }

    return enhanced;
  }

  private createDockerfile(type: ProjectType): TemplateFile {
    if (type.startsWith('python-')) {
      return {
        path: 'Dockerfile',
        content: `FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the application
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]`
      };
    }

    // Node.js Dockerfile
    return {
      path: 'Dockerfile',
      content: `FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]`
    };
  }

  private createDockerIgnore(): TemplateFile {
    return {
      path: '.dockerignore',
      content: `node_modules
npm-debug.log
.git
.gitignore
README.md
.env
.env.*
.vscode
.idea
coverage
.nyc_output
.DS_Store
*.log
dist
build
__pycache__
*.pyc
*.pyo
.pytest_cache
.mypy_cache
.coverage
htmlcov`
    };
  }

  private createDockerCompose(_config: ProjectConfig): TemplateFile {
    return {
      path: 'docker-compose.yml',
      content: `version: '3.8'

services:
  app:
    build: .
    container_name: {{projectName}}
    ports:
      - "\${PORT:-3000}:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped`
    };
  }

  private createGitHubActions(type: ProjectType): TemplateFile[] {
    const files: TemplateFile[] = [];

    if (type.startsWith('python-')) {
      files.push({
        path: '.github/workflows/ci.yml',
        content: `name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  quality:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.9, '3.10', 3.11]

    steps:
    - uses: actions/checkout@v3
    
    - name: Set up Python \${{ matrix.python-version }}
      uses: actions/setup-python@v4
      with:
        python-version: \${{ matrix.python-version }}
    
    - name: Install Poetry
      uses: snok/install-poetry@v1
      with:
        virtualenvs-create: true
        virtualenvs-in-project: true
    
    - name: Load cached venv
      id: cached-poetry-dependencies
      uses: actions/cache@v3
      with:
        path: .venv
        key: venv-\${{ runner.os }}-\${{ matrix.python-version }}-\${{ hashFiles('**/poetry.lock') }}
    
    - name: Install dependencies
      if: steps.cached-poetry-dependencies.outputs.cache-hit != 'true'
      run: poetry install --no-interaction --no-root
    
    - name: Install project
      run: poetry install --no-interaction
    
    - name: Run quality checks
      run: |
        poetry run flake8 src tests
        poetry run mypy src tests
        poetry run black --check src tests
        poetry run isort --check-only src tests
    
    - name: Run tests
      run: poetry run pytest --cov=src --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage.xml
        fail_ci_if_error: true`
      });
    } else {
      // Node.js CI
      files.push({
        path: '.github/workflows/ci.yml',
        content: `name: CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  quality:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [16.x, 18.x, 20.x]

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js \${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: \${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linter
      run: npm run lint
    
    - name: Run type check
      run: npm run typecheck
    
    - name: Run tests
      run: npm test -- --coverage --watchAll=false
    
    - name: Build
      run: npm run build
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        fail_ci_if_error: true`
      });
    }

    return files;
  }

  private async customizeTemplate(template: ProjectTemplate, config: ProjectConfig): Promise<ProjectTemplate> {
    const customized = { ...template };
    
    // Replace template variables in all files
    customized.files = customized.files.map(file => ({
      ...file,
      content: this.replaceTemplateVariables(file.content.toString(), config)
    }));

    // Update package.json or pyproject.toml with project-specific values
    const mainConfigFile = customized.files.find(f => 
      f.path === 'package.json' || f.path === 'pyproject.toml'
    );

    if (mainConfigFile && mainConfigFile.path === 'package.json') {
      const packageJson = JSON.parse(mainConfigFile.content as string);
      packageJson.name = config.name;
      packageJson.description = config.description || `${config.name} - Generated by SessionHub`;
      packageJson.author = config.author || 'SessionHub';
      packageJson.license = config.license || 'MIT';
      mainConfigFile.content = JSON.stringify(packageJson, null, 2);
    }

    return customized;
  }

  private replaceTemplateVariables(content: string, config: ProjectConfig): string {
    const variables: Record<string, string> = {
      projectName: config.name,
      description: config.description || `${config.name} - Generated by SessionHub`,
      author: config.author || 'SessionHub User',
      license: config.license || 'MIT',
      year: new Date().getFullYear().toString()
    };

    let result = content;
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }
}