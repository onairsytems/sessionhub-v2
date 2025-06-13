/**
 * IPC handlers for tutorial and help system
 */

import { ipcMain } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  steps: TutorialStep[];
  category: string;
}

export interface TutorialStep {
  id: string;
  title: string;
  content: string;
  action?: {
    type: 'click' | 'type' | 'navigate' | 'highlight';
    target: string;
    value?: string;
  };
  validation?: {
    type: 'element-exists' | 'value-equals' | 'session-created';
    target: string;
    value?: string;
  };
  tips?: string[];
}

// Built-in tutorials
const TUTORIALS: Tutorial[] = [
  {
    id: 'getting-started',
    title: 'Getting Started with SessionHub',
    description: 'Learn the basics of SessionHub and create your first session',
    difficulty: 'beginner',
    duration: '5 minutes',
    category: 'Basics',
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to SessionHub!',
        content: `SessionHub revolutionizes development using the Two-Actor Model.

Let's walk through creating your first session together.`,
        tips: [
          'SessionHub separates planning from execution for better results',
          'Each session creates a clear, reproducible development task'
        ]
      },
      {
        id: 'new-session',
        title: 'Create a New Session',
        content: 'Click the "New Session" button to start your first development task.',
        action: {
          type: 'highlight',
          target: '[data-testid="new-session-button"]'
        },
        validation: {
          type: 'element-exists',
          target: '[data-testid="session-editor"]'
        }
      },
      {
        id: 'describe-task',
        title: 'Describe Your Task',
        content: `Now describe what you want to build. For example:

"Create a simple todo list component with add and remove functionality"

Be specific about your requirements!`,
        action: {
          type: 'type',
          target: '[data-testid="session-input"]',
          value: 'Create a simple todo list component with add and remove functionality'
        },
        tips: [
          'Clear descriptions lead to better results',
          'Include specific requirements like styling or functionality',
          'You can always refine in follow-up sessions'
        ]
      },
      {
        id: 'start-session',
        title: 'Start the Session',
        content: 'Click "Start Session" to begin. Watch as the Planning Actor analyzes your request!',
        action: {
          type: 'highlight',
          target: '[data-testid="start-session-button"]'
        }
      },
      {
        id: 'monitor-progress',
        title: 'Monitor Progress',
        content: `Watch the progress tracker:

1. Planning - AI analyzes your request
2. Validation - Plan is checked
3. Execution - Code is generated
4. Complete - Success!`,
        tips: [
          'Each step has real-time status updates',
          'You can see detailed logs if needed',
          'Sessions typically complete in 1-5 minutes'
        ]
      },
      {
        id: 'review-results',
        title: 'Review Your Results',
        content: 'Once complete, your code is ready in your IDE. Review the changes and test your new component!',
        validation: {
          type: 'session-created',
          target: ''
        }
      },
      {
        id: 'complete',
        title: 'Congratulations!',
        content: `You've created your first SessionHub session! 

Next steps:
- Try a session template
- Learn about the Two-Actor Model
- Explore advanced features`,
        tips: [
          'Use templates for common tasks',
          'Chain sessions for complex features',
          'Check the user guide for advanced techniques'
        ]
      }
    ]
  },
  {
    id: 'two-actor-model',
    title: 'Mastering the Two-Actor Model',
    description: 'Understand how Planning and Execution Actors work together',
    difficulty: 'intermediate',
    duration: '10 minutes',
    category: 'Core Concepts',
    steps: [
      {
        id: 'intro',
        title: 'The Two-Actor Model',
        content: `SessionHub's power comes from separating thinking from doing:

• Planning Actor - Analyzes and plans
• Execution Actor - Implements precisely

This separation ensures quality and consistency.`
      },
      {
        id: 'planning-actor',
        title: 'Understanding the Planning Actor',
        content: `The Planning Actor:
- Analyzes your requirements
- Researches the codebase
- Creates step-by-step instructions
- Considers edge cases
- Plans tests and validation

Think of it as your architect who designs before building.`,
        tips: [
          'Good planning prevents execution errors',
          'The plan is visible before execution starts',
          'You can review and approve plans'
        ]
      },
      {
        id: 'execution-actor',
        title: 'Understanding the Execution Actor',
        content: `The Execution Actor:
- Follows the plan exactly
- Writes production-ready code
- Maintains code style
- Runs validations
- Reports progress

Think of it as your builder who constructs precisely.`,
        tips: [
          'Execution is deterministic and reliable',
          'Code quality is enforced automatically',
          'No improvisation ensures consistency'
        ]
      },
      {
        id: 'effective-requests',
        title: 'Writing Effective Requests',
        content: `Good Request Example:
"Create a user profile component that displays name, email, and avatar. Include edit mode with form validation."

This works because it's:
- Specific about requirements
- Clear about functionality
- Detailed enough to plan`,
        action: {
          type: 'navigate',
          target: '/sessions/new'
        }
      },
      {
        id: 'practice',
        title: 'Practice Session',
        content: `Let's practice with a real example. Create a session with:

"Build a search component with:
- Input field with debouncing
- Results list with highlighting
- Loading and error states
- Keyboard navigation"`,
        validation: {
          type: 'element-exists',
          target: '[data-testid="session-editor"]'
        }
      }
    ]
  },
  {
    id: 'first-session-creation',
    title: 'Creating Your First Session - Interactive',
    description: 'Interactive walkthrough of the Two-Actor Model in action',
    difficulty: 'beginner',
    duration: '8 minutes',
    category: 'Basics',
    steps: [
      {
        id: 'welcome',
        title: 'Welcome to Session Creation!',
        content: `Let's create your first AI-powered session together. 

This interactive tutorial will guide you through:
• Understanding the Two-Actor Model
• Writing effective session descriptions
• Monitoring the planning phase
• Reviewing and executing the plan`,
        action: {
          type: 'highlight',
          target: '[data-testid="start-session-button"]'
        }
      },
      {
        id: 'two-actor-intro',
        title: 'The Two-Actor Model Explained',
        content: `Your session will be handled by two specialized AI actors:

**Planning Actor** 🧠
• Analyzes your request thoroughly
• Breaks it down into specific tasks
• Considers edge cases and best practices
• Creates a detailed action plan

**Execution Actor** 🔨
• Follows the plan precisely
• Implements each task step-by-step
• Maintains code quality
• Reports progress in real-time`,
        tips: [
          'This separation ensures better, more reliable results',
          'The plan acts as a contract between you and the AI',
          'You can review and approve plans before execution'
        ]
      },
      {
        id: 'write-description',
        title: 'Describe Your Session Goal',
        content: `Now, let's write a clear description of what you want to build.

Good descriptions include:
• Clear goal or outcome
• Specific requirements
• Any constraints or preferences

Example: "Create a React component for user authentication with login, signup, and password reset forms. Include form validation and error handling."`,
        action: {
          type: 'highlight',
          target: '[data-testid="session-description"]'
        },
        validation: {
          type: 'value-equals',
          target: '[data-testid="session-description"]',
          value: '.{20,}'
        },
        tips: [
          'Be specific but not overly technical',
          'Include user-facing features',
          'Mention any frameworks or libraries to use'
        ]
      },
      {
        id: 'planning-phase',
        title: 'Watch the Planning Phase',
        content: `Great! Now click "Start Session" to begin.

The Planning Actor will:
1. Analyze your requirements
2. Research your codebase
3. Create a detailed task list
4. Define success criteria

This typically takes 30-60 seconds.`,
        action: {
          type: 'click',
          target: '[data-testid="start-session-button"]'
        },
        validation: {
          type: 'element-exists',
          target: '[data-testid="planning-indicator"]'
        }
      },
      {
        id: 'review-plan',
        title: 'Review the Generated Plan',
        content: `The Planning Actor has created a detailed plan!

Review each task to ensure it meets your needs:
• Are all requirements covered?
• Is the approach correct?
• Are there any missing steps?

You can:
✅ Approve - Proceed with execution
✏️ Edit - Modify tasks or add details
❌ Cancel - Start over with a refined description`,
        action: {
          type: 'highlight',
          target: '[data-testid="plan-review"]'
        },
        tips: [
          'Good plans have clear, actionable tasks',
          'Each task should have a specific outcome',
          'Dependencies between tasks are handled automatically'
        ]
      },
      {
        id: 'execution-phase',
        title: 'Monitor Execution Progress',
        content: `Excellent! The Execution Actor is now working through the plan.

Watch as it:
• Completes each task in order
• Shows real-time progress
• Writes actual code files
• Runs validations

You'll see status updates for each task.`,
        action: {
          type: 'highlight',
          target: '[data-testid="execution-progress"]'
        },
        validation: {
          type: 'element-exists',
          target: '[data-testid="execution-progress"]'
        }
      },
      {
        id: 'completion',
        title: 'Session Complete! 🎉',
        content: `Congratulations! You've successfully completed your first session.

What you've learned:
• How the Two-Actor Model works in practice
• Writing effective session descriptions
• Understanding the planning process
• Monitoring execution progress

Next steps:
• Review the generated code in your IDE
• Save this as a template for similar tasks
• Try more complex sessions`,
        tips: [
          'Templates speed up similar tasks',
          'You can chain sessions for complex features',
          'The history tab shows all past sessions'
        ]
      }
    ]
  },
  {
    id: 'using-templates',
    title: 'Working with Session Templates',
    description: 'Accelerate development with pre-built session templates',
    difficulty: 'beginner',
    duration: '7 minutes',
    category: 'Features',
    steps: [
      {
        id: 'intro',
        title: 'Session Templates',
        content: `Templates provide proven patterns for common tasks:

• Faster development
• Best practices built-in
• Customizable variables
• Consistent results`,
        action: {
          type: 'navigate',
          target: '/templates'
        }
      },
      {
        id: 'browse',
        title: 'Browse Templates',
        content: 'Explore available templates organized by category. Each template shows estimated time and difficulty.',
        action: {
          type: 'highlight',
          target: '[data-testid="template-grid"]'
        },
        tips: [
          'Filter by framework or category',
          'Star frequently used templates',
          'Each template has a detailed description'
        ]
      },
      {
        id: 'select',
        title: 'Select a Template',
        content: 'Click on "React CRUD Application" template to see how templates work.',
        action: {
          type: 'click',
          target: '[data-testid="template-react-crud-app"]'
        }
      },
      {
        id: 'customize',
        title: 'Customize Variables',
        content: `Templates have variables you customize:

• Entity Name: "Product"
• Fields: "name, price, description, category"

This creates a personalized session!`,
        tips: [
          'Variables make templates flexible',
          'Preview shows the final request',
          'You can still edit after generation'
        ]
      },
      {
        id: 'use',
        title: 'Use the Template',
        content: 'Click "Use Template" to create a session with your customized values.',
        action: {
          type: 'highlight',
          target: '[data-testid="use-template-button"]'
        }
      }
    ]
  }
];

export function registerTutorialHandlers() {
  // Get all tutorials
  ipcMain.handle('get-tutorials', async () => {
    return TUTORIALS;
  });

  // Get specific tutorial
  ipcMain.handle('get-tutorial', async (_, tutorialId: string) => {
    const tutorial = TUTORIALS.find(t => t.id === tutorialId);
    if (!tutorial) {
      throw new Error(`Tutorial not found: ${tutorialId}`);
    }
    return tutorial;
  });

  // Get tutorial categories
  ipcMain.handle('get-tutorial-categories', async () => {
    const categories = new Set(TUTORIALS.map(t => t.category));
    return Array.from(categories);
  });

  // Mark tutorial as completed
  ipcMain.handle('complete-tutorial', async (_, tutorialId: string) => {
    // Store completion status
    const store = (global as unknown as { store: { get: (key: string, defaultValue: string[]) => string[]; set: (key: string, value: string[]) => void } }).store;
    const completed = store.get('completedTutorials', []);
    if (!completed.includes(tutorialId)) {
      completed.push(tutorialId);
      store.set('completedTutorials', completed);
    }
    return true;
  });

  // Get completed tutorials
  ipcMain.handle('get-completed-tutorials', async () => {
    const store = (global as unknown as { store: { get: (key: string, defaultValue: string[]) => string[] } }).store;
    return store.get('completedTutorials', []);
  });

  // Get help content
  ipcMain.handle('get-help-content', async (_, topic: string) => {
    const helpPath = path.join(__dirname, '../../docs/user-guide', `${topic}.md`);
    try {
      const content = await fs.readFile(helpPath, 'utf-8');
      return content;
    } catch (error) {
      throw new Error(`Help content not found: ${topic}`);
    }
  });

  // Search help content
  ipcMain.handle('search-help', async (_, query: string) => {
    const docsDir = path.join(__dirname, '../../docs');
    const results: Array<{
      file: string;
      title: string;
      snippet: string;
      line: number;
    }> = [];
    
    // Search through all documentation files
    async function searchDir(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await searchDir(fullPath);
        } else if (entry.name.endsWith('.md')) {
          const content = await fs.readFile(fullPath, 'utf-8');
          if (content.toLowerCase().includes(query.toLowerCase())) {
            // Extract relevant snippet
            const lines = content.split('\n');
            const matchIndex = lines.findIndex(line => 
              line.toLowerCase().includes(query.toLowerCase())
            );
            
            if (matchIndex !== -1) {
              const title = lines[0]?.replace(/^#\s+/, '') || 'Untitled';
              results.push({
                file: fullPath.replace(docsDir, ''),
                title,
                snippet: lines.slice(
                  Math.max(0, matchIndex - 1),
                  Math.min(lines.length, matchIndex + 2)
                ).join('\n'),
                line: matchIndex + 1
              });
            }
          }
        }
      }
    }
    
    await searchDir(docsDir);
    return results;
  });
}