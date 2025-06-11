# React Todo App - SessionHub Demo

This demo showcases how SessionHub can build a complete React application through a series of well-planned sessions.

## Overview

A fully-featured todo application built with:
- React 18 with TypeScript
- Tailwind CSS for styling
- Context API for state management
- Local storage persistence
- Comprehensive test coverage

## Sessions Used

### Session 1: Initial Setup and Components
```
Create a React todo app with TypeScript:
- Todo list component showing all todos
- Add todo form with validation
- Todo item with checkbox and delete button
- Use Tailwind CSS for styling
- Set up proper TypeScript interfaces
```

### Session 2: State Management
```
Add state management to the todo app:
- Implement Context API for global state
- Add todo CRUD operations
- Persist todos to localStorage
- Add todo filtering (all/active/completed)
- Include proper TypeScript types
```

### Session 3: Advanced Features
```
Add advanced features to todo app:
- Due date for todos with date picker
- Priority levels (high/medium/low)
- Search functionality
- Bulk operations (mark all complete, delete completed)
- Keyboard shortcuts
```

### Session 4: Testing and Polish
```
Add comprehensive tests and polish:
- Unit tests for all components
- Integration tests for user flows
- Accessibility improvements
- Loading and error states
- Animations and transitions
```

## Project Structure

```
src/
├── components/
│   ├── TodoList.tsx
│   ├── TodoItem.tsx
│   ├── AddTodoForm.tsx
│   ├── TodoFilters.tsx
│   └── SearchBar.tsx
├── context/
│   └── TodoContext.tsx
├── hooks/
│   ├── useTodos.ts
│   └── useLocalStorage.ts
├── types/
│   └── todo.ts
├── utils/
│   └── todoHelpers.ts
└── App.tsx
```

## Key Features Demonstrated

1. **Component Architecture**
   - Reusable components
   - Proper prop types
   - Composition patterns

2. **State Management**
   - Context API setup
   - Custom hooks
   - Side effects handling

3. **TypeScript Integration**
   - Interfaces for all data
   - Type-safe components
   - Generic hooks

4. **Testing Strategy**
   - Component unit tests
   - Hook testing
   - Integration tests

5. **Code Quality**
   - ESLint configuration
   - Prettier formatting
   - Consistent patterns

## Running the Demo

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Learning Points

### 1. Session Planning
Each session had a clear, focused goal that built upon previous work.

### 2. Incremental Development
Complex features were added gradually, ensuring stability at each step.

### 3. Quality Gates
Every session passed TypeScript, ESLint, and test requirements.

### 4. Best Practices
The generated code follows React best practices and modern patterns.

## Try It Yourself

Use this as a template for your own React projects:

1. Start with basic components
2. Add state management
3. Implement features incrementally
4. Finish with testing and polish

## Code Snippets

### Todo Context (Simplified)
```typescript
interface TodoContextType {
  todos: Todo[];
  addTodo: (todo: Omit<Todo, 'id'>) => void;
  toggleTodo: (id: string) => void;
  deleteTodo: (id: string) => void;
}

export const TodoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [todos, setTodos] = useLocalStorage<Todo[]>('todos', []);
  
  // Implementation...
};
```

### Custom Hook Usage
```typescript
export const useTodos = () => {
  const context = useContext(TodoContext);
  if (!context) {
    throw new Error('useTodos must be used within TodoProvider');
  }
  return context;
};
```

## Next Steps

- Explore the [Session Templates](../../templates) used
- Read the [Two-Actor Model Guide](../../../docs/user-guide/two-actor-model.md)
- Create your own React project with SessionHub