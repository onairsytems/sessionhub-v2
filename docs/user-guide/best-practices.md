# SessionHub Best Practices

Master these practices to maximize your productivity with SessionHub and the Two-Actor Model.

## 1. Writing Effective Session Requests

### Be Specific and Clear

**✅ Good Request:**
```
Create a user authentication system with:
- Email/password login
- JWT token generation
- Password reset via email
- Session management with 24h expiry
- Rate limiting: 5 attempts per minute
```

**❌ Poor Request:**
```
Add login to my app
```

### Include Success Criteria

Always define what "done" looks like:
```
Success criteria:
- Users can register with email/password
- Login returns JWT token
- Protected routes require valid token
- Tests cover all auth endpoints
```

### Specify Technical Requirements

```
Technical requirements:
- Use bcrypt for password hashing
- Store sessions in Redis
- Follow REST conventions
- Include OpenAPI documentation
```

## 2. Optimal Session Sizing

### Single Responsibility Principle

Each session should have one clear goal:
- ✅ "Create user profile component"
- ✅ "Add search functionality to product list"
- ❌ "Build entire e-commerce platform"

### Complexity Guidelines

| Complexity | Session Size | Example |
|------------|--------------|---------|
| Simple | 1-3 files | Add a button component |
| Medium | 4-8 files | Create CRUD endpoints |
| Complex | 9-15 files | Implement auth system |
| Too Large | 15+ files | Split into multiple sessions |

### Chain Sessions for Complex Features

```
Feature: User Dashboard
├── Session 1: Dashboard layout and routing
├── Session 2: User statistics components
├── Session 3: Activity feed implementation
└── Session 4: Integration and testing
```

## 3. Leveraging the Planning Actor

### Provide Context

Include relevant information:
```
Context:
- Next.js 14 app with App Router
- Using Prisma with PostgreSQL
- Tailwind CSS for styling
- Existing auth system in place
```

### Specify Constraints

Mention any limitations:
```
Constraints:
- Cannot modify database schema
- Must maintain backward compatibility
- Follow existing naming conventions
- Use only approved npm packages
```

### Request Planning Details

For complex tasks, ask for detailed planning:
```
Please provide:
1. Detailed implementation steps
2. Potential edge cases
3. Testing strategy
4. Performance considerations
```

## 4. Maximizing Execution Success

### Environment Preparation

Before starting a session:
```bash
# Ensure clean git status
git status

# Install dependencies
npm install

# Run existing tests
npm test

# Check for type errors
npm run typecheck
```

### Monitor Progress

Watch for:
- Planning completion
- Validation checks
- File modifications
- Test results

### Quick Iteration

If execution fails:
1. Read error messages carefully
2. Fix environment issues
3. Retry with refined request
4. Use fix-specific templates

## 5. Session Templates Best Practices

### When to Use Templates

- Repetitive tasks (CRUD, API endpoints)
- Standard patterns (authentication, forms)
- Team consistency
- Learning new patterns

### Customizing Templates

1. Start with closest matching template
2. Modify variables to fit your needs
3. Add specific requirements
4. Save as custom template if reusing

### Creating Custom Templates

```json
{
  "id": "team-component",
  "name": "Team Component Standard",
  "variables": {
    "componentName": {
      "type": "text",
      "required": true
    }
  },
  "template": {
    "request": "Create ${componentName} following our standards..."
  }
}
```

## 6. Quality and Testing

### Include Test Requirements

Always specify testing needs:
```
Testing requirements:
- Unit tests for all functions
- Integration tests for API endpoints  
- 80% code coverage minimum
- E2E tests for critical paths
```

### Leverage Quality Gates

SessionHub enforces:
- TypeScript compilation
- ESLint rules
- Test passage
- Build success

Work with these, not against them!

### Code Review Integration

```
After session:
1. Review generated code
2. Run local tests
3. Check code coverage
4. Create PR for team review
```

## 7. Advanced Patterns

### Multi-Actor Collaboration

For very complex features:
```
Session 1: "Plan the architecture for real-time chat"
Session 2: "Implement WebSocket server based on plan"
Session 3: "Create React chat components"
Session 4: "Integrate and test chat system"
```

### Iterative Refinement

```
Version 1: Basic implementation
Version 2: Add error handling
Version 3: Optimize performance
Version 4: Polish UI/UX
```

### Architecture-First Development

1. **Planning Session**: Design system architecture
2. **Review**: Validate approach with team
3. **Implementation Sessions**: Build components
4. **Integration Session**: Connect everything

## 8. Troubleshooting Patterns

### Debug Sessions

```
Debug session request:
"Find and fix the memory leak in UserDashboard component:
- Profile shows increasing memory usage
- Happens after multiple re-renders
- Console shows detached DOM nodes"
```

### Performance Sessions

```
Optimization request:
"Optimize ProductList performance:
- Currently renders 1000+ items
- Scrolling is laggy
- Initial load takes 3+ seconds
Target: <100ms render time"
```

### Refactoring Sessions

```
Refactoring request:
"Refactor UserService class:
- Extract authentication logic
- Implement dependency injection
- Add proper error handling
- Maintain all existing tests"
```

## 9. Team Collaboration

### Shared Templates

Create team-specific templates:
- API endpoint template
- Component template
- Test suite template
- Documentation template

### Naming Conventions

```
Session naming:
- feature/user-auth
- bugfix/memory-leak
- refactor/api-cleanup
- test/coverage-improvement
```

### Documentation Sessions

```
"Document the API endpoints:
- OpenAPI 3.0 specification
- Example requests/responses
- Error scenarios
- Authentication requirements"
```

## 10. Productivity Tips

### Keyboard Shortcuts

- `⌘N` - New session
- `⌘K` - Quick switch project
- `⌘⇧P` - Command palette
- `⌘E` - Recent sessions
- `⌘/` - Toggle help

### Session History

Use previous sessions as templates:
1. Find similar past session
2. Copy and modify request
3. Adjust for current needs

### Batch Operations

Group related small tasks:
```
"Update all API endpoints:
1. Add rate limiting headers
2. Standardize error responses
3. Add request ID tracking
4. Update API documentation"
```

### Time Management

- Simple tasks: 5-10 minutes
- Medium tasks: 15-30 minutes  
- Complex tasks: 45-60 minutes
- Break longer tasks into sessions

## Common Pitfalls to Avoid

### 1. Vague Requests
❌ "Make it better"
✅ "Improve performance by implementing pagination and caching"

### 2. Mixing Concerns
❌ "Add auth and redesign UI and optimize database"
✅ Separate sessions for each concern

### 3. Ignoring Context
❌ Starting without checking project state
✅ Review code, check dependencies, verify environment

### 4. Skipping Tests
❌ "Implementation only, no tests"
✅ Always include appropriate tests

### 5. Over-Engineering
❌ "Create ultimate flexible solution"
✅ Solve the specific problem at hand

## Summary

Success with SessionHub comes from:
1. Clear, specific requests
2. Right-sized sessions
3. Leveraging templates
4. Following quality practices
5. Iterative improvement

Remember: The Two-Actor Model works best when you provide clear direction (planning) and maintain a clean environment (execution).

## Next Steps

- Practice with [Session Templates](../sessions/library/templates)
- Review [Troubleshooting Guide](../troubleshooting/README.md)
- Join the [Community Forum](https://github.com/sessionhub/community)