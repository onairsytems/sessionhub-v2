# Actor Boundary Violations: Examples & Corrections

## 🚨 Critical Violations: Code in Planning Actor

### ❌ VIOLATION: Direct Code Writing
```
Planning Actor: "Here's the validation function:

function validateEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}
"
```

### ✅ CORRECTION: Describe Functionality
```
Planning Actor: "Create an email validation function that:
- Accepts an email string parameter
- Uses a regular expression to validate email format
- Checks for @ symbol and domain structure
- Returns boolean indicating validity"
```

---

### ❌ VIOLATION: File Creation with Content
```
Planning Actor: "Create the config file:

cat > config.json << 'EOF'
{
  "apiKey": "your-key-here",
  "endpoint": "https://api.example.com",
  "timeout": 5000
}
EOF
"
```

### ✅ CORRECTION: Describe File Requirements
```
Planning Actor: "Create a configuration file that:
- Stores API credentials
- Defines the API endpoint URL
- Sets request timeout value
- Uses JSON format for easy parsing"
```

---

### ❌ VIOLATION: Shell Commands
```
Planning Actor: "Run these commands:
npm install express cors helmet
npm install -D @types/express @types/cors
mkdir -p src/routes src/middleware
"
```

### ✅ CORRECTION: Describe Setup Requirements
```
Planning Actor: "Set up the server environment:
- Install necessary web server framework
- Add CORS support for cross-origin requests
- Include security middleware
- Create directory structure for routes and middleware
- Ensure TypeScript type definitions are available"
```

---

## 🚨 Critical Violations: Strategic Decisions in Execution Actor

### ❌ VIOLATION: Architecture Questioning
```typescript
// execution-code.ts
// Should we use microservices or monolithic architecture?
// I think microservices would be better for scalability
// Let's evaluate the pros and cons...
```

### ✅ CORRECTION: Direct Implementation
```typescript
// execution-code.ts
// Implementing microservices architecture as specified
import { createMicroservice } from './framework';

const userService = createMicroservice({
  name: 'user-service',
  port: 3001
});
```

---

### ❌ VIOLATION: Requirement Analysis
```typescript
// execution-code.ts
/*
 * Analyzing user requirements:
 * - Users need authentication
 * - Should support OAuth and JWT
 * - Must consider security implications
 * - Recommend implementing rate limiting
 */
```

### ✅ CORRECTION: Direct Implementation
```typescript
// execution-code.ts
// Implementing authentication system with OAuth and JWT
import { OAuth2Server } from 'oauth2-server';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // limit each IP to 5 requests per windowMs
});
```

---

## 🟡 High Severity: Implementation Details in Planning

### ❌ VIOLATION: Specific Technology Stack
```
Planning Actor: "Use React 18.2.0 with Redux Toolkit 1.9.5 
and React Router 6.14.2. Configure webpack with these loaders..."
```

### ✅ CORRECTION: Capability Requirements
```
Planning Actor: "Build a modern single-page application with:
- Component-based UI architecture
- Centralized state management
- Client-side routing
- Optimized build process"
```

---

### ❌ VIOLATION: Exact File Paths
```
Planning Actor: "Create these files:
- src/components/Header/Header.tsx
- src/components/Header/Header.styles.ts
- src/components/Header/Header.test.tsx"
```

### ✅ CORRECTION: Component Structure
```
Planning Actor: "Create a header component with:
- Main component logic
- Separated styling
- Comprehensive test coverage
- Follow project's component organization pattern"
```

---

## 🟡 High Severity: Planning in Execution

### ❌ VIOLATION: Strategy Comments
```typescript
// We should consider different caching strategies
// Redis might be better than in-memory caching
// Need to evaluate performance implications
```

### ✅ CORRECTION: Implementation Comments
```typescript
// Implementing Redis caching for session data
// Using TTL of 24 hours for session expiry
// Connection pooling enabled for performance
```

---

## 🟠 Medium Severity: Boundary Blur

### ❌ VIOLATION: Mixed Instructions
```
Planning Actor: "Create a user service that validates email 
using /^[^\s@]+@[^\s@]+\.[^\s@]+$/ regex pattern"
```

### ✅ CORRECTION: Clear Separation
```
Planning Actor: "Create a user service that:
- Validates email addresses
- Ensures proper email format
- Rejects invalid patterns"
```

---

### ❌ VIOLATION: Conditional Planning
```typescript
// If performance becomes an issue, we might need to optimize
if (users.length > 10000) {
  // Should probably implement pagination
}
```

### ✅ CORRECTION: Decisive Implementation
```typescript
// Implementing pagination for large datasets
if (users.length > 10000) {
  return paginate(users, page, limit);
}
```

---

## 🔍 Detection Patterns

### Planning Actor Red Flags
1. **Code blocks** (```language```)
2. **Function definitions** (function, const =>, class)
3. **Import statements** (import/require)
4. **Shell commands** (npm, git, mkdir)
5. **File content** (cat, echo, heredocs)
6. **Specific versions** (package@version)
7. **Exact paths** (/src/specific/path.ts)

### Execution Actor Red Flags
1. **Questions** (should we?, which is better?)
2. **Analysis** (let's evaluate, considering options)
3. **Recommendations** (I suggest, recommend)
4. **Planning words** (strategy, approach, architecture)
5. **Uncertainty** (might, probably, perhaps)
6. **Comparisons** (X vs Y, pros and cons)
7. **Future tense** (will need to, should consider)

---

## 🎯 Quick Reference Card

### Planning Actor Must:
- ✅ Describe WHAT, not HOW
- ✅ Define goals and outcomes
- ✅ List requirements
- ✅ Specify validation criteria
- ✅ Trust execution actor completely

### Planning Actor Must NOT:
- ❌ Write any code
- ❌ Specify exact implementations
- ❌ Choose specific libraries
- ❌ Define file structures
- ❌ Include technical details

### Execution Actor Must:
- ✅ Implement immediately
- ✅ Make all technical decisions
- ✅ Write all code
- ✅ Handle all file operations
- ✅ Report results clearly

### Execution Actor Must NOT:
- ❌ Question requirements
- ❌ Analyze alternatives
- ❌ Make strategic decisions
- ❌ Suggest different approaches
- ❌ Delay with planning

---

## 🛠️ Automatic Correction Examples

### Before (Violation):
```
Planning: "Install express with npm install express@4.18.2"
```

### After (Corrected):
```
Planning: "Set up a web server framework"
```

### Before (Violation):
```typescript
// Should we use async/await or promises?
```

### After (Corrected):
```typescript
// Using async/await for asynchronous operations
```

---

*This document is part of SessionHub's Actor Role Enforcement system. Violations are detected and prevented at runtime.*