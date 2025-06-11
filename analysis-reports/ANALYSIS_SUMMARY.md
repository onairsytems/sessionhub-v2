# SessionHub Codebase Analysis Report

## Session 2.15: Comprehensive Analysis Results

**Generated:** 2025-06-11T22:31:31.246Z
**Total Files Analyzed:** 510
**Total Issues Found:** 945

## Summary

- **Critical Errors:** 0
- **Warnings:** 30
- **Console Statements:** 730
- **Build Issues:** 0

## Git Status

- **Branch:** main
- **Repository Clean:** ❌ No
- **Remote Sync:** ✅ Yes
- **Uncommitted Files:** 2
- **Unpushed Commits:** 0

## Error Breakdown

### TypeScript Errors (0)



### ESLint Violations (215)
- jest.config.ts:undefined - null: Parsing error: ESLint was configured to run on `<tsconfigRootDir>/jest.config.ts` using `parserOptions.project`: /users/jonathanhoggard/development/sessionhub-v2/tsconfig.json
However, that TSConfig does not include this file. Either:
- Change ESLint's list of included files to not include this file
- Change that TSConfig to include this file
- Create a new TSConfig that includes this file and include it in your parserOptions.project
See the typescript-eslint docs for more info: https://typescript-eslint.io/linting/troubleshooting#i-get-errors-telling-me-eslint-was-configured-to-run--however-that-tsconfig-does-not--none-of-those-tsconfigs-include-this-file
- main/ipc/contextHandlers.ts:58 - @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.
- main/ipc/mcpServerHandlers.ts:67 - @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.
- main/ipc/onboardingHandlers.ts:43 - @typescript-eslint/no-explicit-any: Unexpected any. Specify a different type.
- main/ipc/onboardingHandlers.ts:82 - @typescript-eslint/no-unsafe-assignment: Unsafe assignment of an `any` value.
- main/ipc/onboardingHandlers.ts:85 - @typescript-eslint/no-unsafe-assignment: Unsafe assignment of an `any` value.
- main/ipc/onboardingHandlers.ts:225 - @typescript-eslint/no-unsafe-assignment: Unsafe assignment of an `any` value.
- main/ipc/onboardingHandlers.ts:228 - @typescript-eslint/no-unsafe-assignment: Unsafe assignment of an `any` value.
- main/ipc/onboardingHandlers.ts:251 - @typescript-eslint/no-unsafe-assignment: Unsafe assignment of an `any` value.
- main/ipc/onboardingHandlers.ts:256 - @typescript-eslint/no-unsafe-assignment: Unsafe assignment of an `any` value.

... and 205 more

### Console Statements (730)
- next.config.production.js:61 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:26 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:33 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:37 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:57 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:58 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:59 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:60 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:61 - Console statement found: console.log
- tests/two-actor-architecture/test-planning-engine.ts:63 - Console statement found: console.error

... and 720 more

### Build Issues (0)


## Recommendations

1. **Immediate Actions:**
   - Fix all TypeScript compilation errors
   - Remove console statements from production code
   - Resolve build issues

2. **Quality Improvements:**
   - Address ESLint violations systematically
   - Implement pre-commit hooks for quality gates
   - Set up continuous integration checks

3. **Next Steps:**
   - Use error tracking system to monitor resolution progress
   - Prioritize critical errors for immediate fix
   - Schedule systematic error resolution sessions
