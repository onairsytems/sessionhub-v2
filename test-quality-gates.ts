// Test file to verify quality gates are working
const test = 'hello'
console.log(test)  // This should be caught by console check

// This should cause a TypeScript error
const numberTest: number = 'string'

// This should cause an ESLint error (unused variable)
const unusedVariable = 42