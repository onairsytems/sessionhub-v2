/**
 * ErrorCatalog.ts
 * Comprehensive catalog of known errors with fix suggestions
 */

interface ErrorEntry {
  code: string;
  description: string;
  examples: string[];
  fixes: string[];
  documentation?: string;
}

export class ErrorCatalog {
  private catalog: Map<string, ErrorEntry> = new Map();

  constructor() {
    this.initializeCatalog();
  }

  private initializeCatalog(): void {
    // TypeScript Errors
    this.addEntry({
      code: 'TS2322',
      description: 'Type is not assignable to type',
      examples: [
        'const x: string = 123; // Type number is not assignable to type string',
        'interface User { name: string; } const user: User = { name: 123 };'
      ],
      fixes: [
        'Ensure the value matches the expected type',
        'Update the type annotation to match the value',
        'Use type assertion if you are certain about the type',
        'Check if you need to convert the value (e.g., toString(), Number())'
      ]
    });

    this.addEntry({
      code: 'TS2339',
      description: 'Property does not exist on type',
      examples: [
        'const obj = { a: 1 }; console.log(obj.b); // Property b does not exist'
      ],
      fixes: [
        'Add the property to the type definition',
        'Check for typos in the property name',
        'Use optional chaining (?.) if the property might not exist',
        'Add an index signature if accessing dynamic properties'
      ]
    });

    this.addEntry({
      code: 'TS2345',
      description: 'Argument of type is not assignable to parameter',
      examples: [
        'function greet(name: string) {} greet(123); // Argument of type number'
      ],
      fixes: [
        'Pass the correct type of argument',
        'Convert the argument to the expected type',
        'Update the function parameter type if needed',
        'Check if you are calling the correct function'
      ]
    });

    this.addEntry({
      code: 'TS2304',
      description: 'Cannot find name',
      examples: [
        'console.log(nonExistentVariable); // Cannot find name'
      ],
      fixes: [
        'Import the missing module or variable',
        'Declare the variable before using it',
        'Check for typos in the variable name',
        'Install missing @types packages for libraries'
      ]
    });

    this.addEntry({
      code: 'TS7053',
      description: 'Element implicitly has an any type (index access)',
      examples: [
        'const obj = {}; obj["key"]; // Element implicitly has any type'
      ],
      fixes: [
        'Add proper type annotations to the object',
        'Use Record<string, Type> for dynamic keys',
        'Enable noUncheckedIndexedAccess in tsconfig',
        'Check if the property exists before accessing'
      ]
    });

    this.addEntry({
      code: 'TS2531',
      description: 'Object is possibly null or undefined',
      examples: [
        'const elem = document.getElementById("id"); elem.innerHTML = "text";'
      ],
      fixes: [
        'Add null check before accessing the object',
        'Use optional chaining (?.) operator',
        'Use non-null assertion (!) if certain it exists',
        'Provide a default value with nullish coalescing (??)'
      ]
    });

    // Next.js Errors
    this.addEntry({
      code: 'NEXT_SERVER_COMPONENT_CLIENT_CODE',
      description: 'Server component contains client-side code',
      examples: [
        'useState in a server component',
        'onClick handler in a server component'
      ],
      fixes: [
        'Add "use client" directive at the top of the file',
        'Move client-side logic to a separate client component',
        'Use server actions for server-side interactions',
        'Refactor to use server-side data fetching'
      ]
    });

    this.addEntry({
      code: '@next/next/no-html-link-for-pages',
      description: 'Using anchor tag instead of Next.js Link',
      examples: [
        '<a href="/about">About</a> // Should use Link'
      ],
      fixes: [
        'Import Link from next/link',
        'Replace <a> with <Link>',
        'For external links, keep using <a> tag',
        'Use Link for all internal navigation'
      ]
    });

    // React Errors
    this.addEntry({
      code: 'react-hooks/rules-of-hooks',
      description: 'React Hook rules violation',
      examples: [
        'Using hooks inside conditions',
        'Using hooks inside loops'
      ],
      fixes: [
        'Move hooks to the top level of the component',
        'Do not call hooks inside conditions or loops',
        'Ensure hooks are called in the same order',
        'Extract conditional logic inside the hook'
      ]
    });

    this.addEntry({
      code: 'react/jsx-key',
      description: 'Missing key prop in list',
      examples: [
        'items.map(item => <div>{item}</div>) // Missing key'
      ],
      fixes: [
        'Add a unique key prop to each list item',
        'Use item.id or index as key (prefer stable IDs)',
        'Ensure keys are unique among siblings',
        'Do not use Math.random() for keys'
      ]
    });

    // ESLint Errors
    this.addEntry({
      code: '@typescript-eslint/no-explicit-any',
      description: 'Using any type',
      examples: [
        'let value: any = "something";'
      ],
      fixes: [
        'Replace any with a specific type',
        'Use unknown if the type is truly unknown',
        'Create a proper interface or type alias',
        'Use generics for flexible typing'
      ]
    });

    this.addEntry({
      code: '@typescript-eslint/no-unused-vars',
      description: 'Variable is declared but never used',
      examples: [
        'const unused = 5; // Never used'
      ],
      fixes: [
        'Remove the unused variable',
        'Use the variable if it was meant to be used',
        'Prefix with underscore if intentionally unused',
        'Check if the variable is used in a different scope'
      ]
    });

    // Environment Errors
    this.addEntry({
      code: 'ENV_VAR_BRACKET_ACCESS',
      description: 'Using bracket notation for environment variables',
      examples: [
        'process.env["NODE_ENV"] // Should use dot notation'
      ],
      fixes: [
        'Use dot notation: process.env.NODE_ENV',
        'Define types for process.env in global.d.ts',
        'Use a config module to centralize env access',
        'Validate environment variables at startup'
      ]
    });

    // Code Quality
    this.addEntry({
      code: 'NO_CONSOLE',
      description: 'Console statement detected',
      examples: [
        'console.log("debug info")'
      ],
      fixes: [
        'Remove console statements before production',
        'Use a proper logging library',
        'Use debug module for development logging',
        'Conditionally log based on environment'
      ]
    });

    this.addEntry({
      code: 'NO_DEBUGGER',
      description: 'Debugger statement detected',
      examples: [
        'debugger; // Must be removed'
      ],
      fixes: [
        'Remove the debugger statement',
        'Use breakpoints in your IDE instead',
        'Use browser DevTools for debugging',
        'Add conditional debugging for development only'
      ]
    });
  }

  private addEntry(entry: ErrorEntry): void {
    this.catalog.set(entry.code, entry);
  }

  public getSuggestion(code: string, message: string): string | undefined {
    const entry = this.catalog.get(code);
    if (!entry) {
      return this.getGenericSuggestion(message);
    }

    // Return the most relevant fix based on the error message
    const relevantFix = entry.fixes.find(fix => 
      message.toLowerCase().includes(fix.toLowerCase().split(' ')[0])
    );

    return relevantFix || entry.fixes[0];
  }

  public getEntry(code: string): ErrorEntry | undefined {
    return this.catalog.get(code);
  }

  public getAllCodes(): string[] {
    return Array.from(this.catalog.keys());
  }

  private getGenericSuggestion(message: string): string {
    // Provide generic suggestions based on error message patterns
    if (message.includes('Cannot find module')) {
      return 'Install the missing package or check the import path';
    }
    if (message.includes('is not assignable to type')) {
      return 'Check type compatibility or update type definitions';
    }
    if (message.includes('Property') && message.includes('does not exist')) {
      return 'Add the missing property to the type or interface';
    }
    if (message.includes('possibly null')) {
      return 'Add null check or use optional chaining';
    }
    if (message.includes('Expected')) {
      return 'Check syntax and ensure all required elements are present';
    }
    return 'Review the error message and check TypeScript/ESLint documentation';
  }
}