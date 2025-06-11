import { EventEmitter } from 'events';
import { Logger } from '../../../lib/logging/Logger';

export interface MockConfig {
  enabled: boolean;
  latency: {
    min: number; // milliseconds
    max: number;
  };
  errorRate: number; // 0-100 percentage
  scenarios: MockScenario[];
}

export interface MockScenario {
  id: string;
  name: string;
  description: string;
  integrationId: string;
  responses: MockResponse[];
  enabled: boolean;
}

export interface MockResponse {
  tool: string;
  input?: any; // Match specific input
  output: any;
  delay?: number; // Additional delay for this response
  error?: string; // Simulate error
  probability?: number; // Probability of this response (0-1)
}

export interface MockIntegration {
  id: string;
  name: string;
  description: string;
  tools: MockTool[];
  version: string;
  category: string;
}

export interface MockTool {
  name: string;
  description: string;
  input_schema: any;
  responses: Map<string, any>; // Input hash -> response
}

export class MCPMockService extends EventEmitter {
  private logger: Logger;
  private config: MockConfig;
  private mockIntegrations: Map<string, MockIntegration> = new Map();
  private scenarios: Map<string, MockScenario> = new Map();
  private callHistory: MockCallRecord[] = [];
  private _isOfflineMode: boolean = false;

  constructor(config: MockConfig) {
    super();
    this.logger = new Logger('MCP');
    this.config = config;
    this.initializeMockIntegrations();
    this.initializeScenarios();
  }

  private initializeMockIntegrations(): void {
    // Initialize core mock integrations
    const coreIntegrations: MockIntegration[] = [
      {
        id: 'github-mock',
        name: 'GitHub (Mock)',
        description: 'Mock GitHub integration for testing',
        version: '1.0.0',
        category: 'development',
        tools: [
          {
            name: 'list_repositories',
            description: 'List user repositories',
            input_schema: {
              type: 'object',
              properties: {
                user: { type: 'string' },
                page: { type: 'number' },
                per_page: { type: 'number' },
              },
            },
            responses: new Map([
              ['default', {
                repositories: [
                  { id: 1, name: 'test-repo-1', private: false, stars: 10 },
                  { id: 2, name: 'test-repo-2', private: true, stars: 5 },
                ],
                total_count: 2,
              }],
            ]),
          },
          {
            name: 'create_issue',
            description: 'Create a new issue',
            input_schema: {
              type: 'object',
              properties: {
                repo: { type: 'string' },
                title: { type: 'string' },
                body: { type: 'string' },
              },
              required: ['repo', 'title'],
            },
            responses: new Map([
              ['default', {
                id: 123,
                number: 42,
                title: 'Test Issue',
                state: 'open',
                created_at: new Date().toISOString(),
              }],
            ]),
          },
        ],
      },
      {
        id: 'linear-mock',
        name: 'Linear (Mock)',
        description: 'Mock Linear integration for testing',
        version: '1.0.0',
        category: 'productivity',
        tools: [
          {
            name: 'list_issues',
            description: 'List issues',
            input_schema: {
              type: 'object',
              properties: {
                projectId: { type: 'string' },
                state: { type: 'string' },
              },
            },
            responses: new Map([
              ['default', {
                issues: [
                  { id: 'LIN-1', title: 'Fix bug', state: 'in_progress' },
                  { id: 'LIN-2', title: 'Add feature', state: 'backlog' },
                ],
              }],
            ]),
          },
        ],
      },
      {
        id: 'figma-mock',
        name: 'Figma (Mock)',
        description: 'Mock Figma integration for testing',
        version: '1.0.0',
        category: 'design',
        tools: [
          {
            name: 'get_file',
            description: 'Get Figma file',
            input_schema: {
              type: 'object',
              properties: {
                fileId: { type: 'string' },
              },
              required: ['fileId'],
            },
            responses: new Map([
              ['default', {
                name: 'Design System',
                lastModified: new Date().toISOString(),
                version: '1.2.3',
                pages: [
                  { id: '1', name: 'Components' },
                  { id: '2', name: 'Colors' },
                ],
              }],
            ]),
          },
        ],
      },
      {
        id: 'slack-mock',
        name: 'Slack (Mock)',
        description: 'Mock Slack integration for testing',
        version: '1.0.0',
        category: 'communication',
        tools: [
          {
            name: 'send_message',
            description: 'Send a message to a channel',
            input_schema: {
              type: 'object',
              properties: {
                channel: { type: 'string' },
                text: { type: 'string' },
              },
              required: ['channel', 'text'],
            },
            responses: new Map([
              ['default', {
                ok: true,
                ts: Date.now().toString(),
                channel: 'C1234567890',
              }],
            ]),
          },
        ],
      },
      {
        id: 'vercel-mock',
        name: 'Vercel (Mock)',
        description: 'Mock Vercel integration for testing',
        version: '1.0.0',
        category: 'deployment',
        tools: [
          {
            name: 'list_deployments',
            description: 'List deployments',
            input_schema: {
              type: 'object',
              properties: {
                projectId: { type: 'string' },
              },
            },
            responses: new Map([
              ['default', {
                deployments: [
                  { id: 'd1', url: 'https://test.vercel.app', state: 'READY' },
                  { id: 'd2', url: 'https://test-2.vercel.app', state: 'BUILDING' },
                ],
              }],
            ]),
          },
        ],
      },
    ];

    for (const integration of coreIntegrations) {
      this.mockIntegrations.set(integration.id, integration);
    }
  }

  private initializeScenarios(): void {
    for (const scenario of this.config.scenarios) {
      this.scenarios.set(scenario.id, scenario);
    }
  }

  async executeTool(
    integrationId: string,
    tool: string,
    input: any
  ): Promise<any> {
    const startTime = Date.now();

    try {
      // Record call
      const callRecord: MockCallRecord = {
        id: `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        integrationId,
        tool,
        input,
        timestamp: new Date(),
        duration: 0,
        success: false,
      };

      // Simulate latency
      const latency = this.calculateLatency();
      await this.delay(latency);

      // Check if should fail based on error rate
      if (this.shouldFail()) {
        const error = new Error('Mock API error: Service unavailable');
        callRecord.error = error.message;
        callRecord.duration = Date.now() - startTime;
        this.callHistory.push(callRecord);
        throw error;
      }

      // Get response
      const response = await this.getMockResponse(integrationId, tool, input);
      
      callRecord.output = response;
      callRecord.success = true;
      callRecord.duration = Date.now() - startTime;
      this.callHistory.push(callRecord);

      this.emit('mock-call', callRecord);
      return response;

    } catch (error) {
      this.logger.error('Mock execution failed:', error as Error);
      throw error;
    }
  }

  private async getMockResponse(
    integrationId: string,
    tool: string,
    input: any
  ): Promise<any> {
    // Check for scenario-based response
    const scenarioResponse = this.getScenarioResponse(integrationId, tool, input);
    if (scenarioResponse) {
      return scenarioResponse;
    }

    // Get default mock response
    const integration = this.mockIntegrations.get(integrationId);
    if (!integration) {
      throw new Error(`Mock integration ${integrationId} not found`);
    }

    const mockTool = integration.tools.find(t => t.name === tool);
    if (!mockTool) {
      throw new Error(`Mock tool ${tool} not found in integration ${integrationId}`);
    }

    // Get response based on input hash or default
    const inputHash = this.hashInput(input);
    const response = mockTool.responses.get(inputHash) || mockTool.responses.get('default');
    
    if (!response) {
      throw new Error(`No mock response configured for tool ${tool}`);
    }

    // Deep clone to avoid mutations
    return JSON.parse(JSON.stringify(response));
  }

  private getScenarioResponse(
    integrationId: string,
    tool: string,
    input: any
  ): any | null {
    for (const scenario of this.scenarios.values()) {
      if (!scenario.enabled || scenario.integrationId !== integrationId) {
        continue;
      }

      for (const response of scenario.responses) {
        if (response.tool !== tool) continue;

        // Check input match if specified
        if (response.input && !this.matchesInput(input, response.input)) {
          continue;
        }

        // Check probability
        if (response.probability !== undefined && Math.random() > response.probability) {
          continue;
        }

        // Apply additional delay if specified
        if (response.delay) {
          this.delay(response.delay);
        }

        // Throw error if specified
        if (response.error) {
          throw new Error(response.error);
        }

        return response.output;
      }
    }

    return null;
  }

  private matchesInput(actual: any, expected: any): boolean {
    // Simple deep equality check
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  private hashInput(input: any): string {
    return JSON.stringify(input);
  }

  private calculateLatency(): number {
    const { min, max } = this.config.latency;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private shouldFail(): boolean {
    return Math.random() * 100 < this.config.errorRate;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  enableOfflineMode(): void {
    this._isOfflineMode = true;
    this.config.enabled = true;
    this.emit('offline-mode-enabled');
  }

  disableOfflineMode(): void {
    this._isOfflineMode = false;
    this.emit('offline-mode-disabled');
  }

  addMockIntegration(integration: MockIntegration): void {
    this.mockIntegrations.set(integration.id, integration);
    this.emit('mock-integration-added', integration);
  }

  addMockResponse(
    integrationId: string,
    tool: string,
    input: any,
    output: any
  ): void {
    const integration = this.mockIntegrations.get(integrationId);
    if (!integration) {
      throw new Error(`Integration ${integrationId} not found`);
    }

    const mockTool = integration.tools.find(t => t.name === tool);
    if (!mockTool) {
      throw new Error(`Tool ${tool} not found`);
    }

    const inputHash = this.hashInput(input);
    mockTool.responses.set(inputHash, output);

    this.emit('mock-response-added', {
      integrationId,
      tool,
      input,
      output,
    });
  }

  addScenario(scenario: MockScenario): void {
    this.scenarios.set(scenario.id, scenario);
    this.emit('scenario-added', scenario);
  }

  enableScenario(scenarioId: string): void {
    const scenario = this.scenarios.get(scenarioId);
    if (scenario) {
      scenario.enabled = true;
      this.emit('scenario-enabled', scenarioId);
    }
  }

  disableScenario(scenarioId: string): void {
    const scenario = this.scenarios.get(scenarioId);
    if (scenario) {
      scenario.enabled = false;
      this.emit('scenario-disabled', scenarioId);
    }
  }

  getCallHistory(integrationId?: string): MockCallRecord[] {
    if (integrationId) {
      return this.callHistory.filter(c => c.integrationId === integrationId);
    }
    return [...this.callHistory];
  }

  clearCallHistory(): void {
    this.callHistory = [];
    this.emit('call-history-cleared');
  }

  getMockIntegrations(): MockIntegration[] {
    return Array.from(this.mockIntegrations.values());
  }

  getScenarios(): MockScenario[] {
    return Array.from(this.scenarios.values());
  }

  exportMockData(): string {
    const data = {
      integrations: Array.from(this.mockIntegrations.entries()),
      scenarios: Array.from(this.scenarios.values()),
      config: this.config,
      callHistory: this.callHistory,
    };

    return JSON.stringify(data, null, 2);
  }

  importMockData(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      // Import integrations
      if (parsed.integrations) {
        this.mockIntegrations.clear();
        for (const [id, integration] of parsed.integrations) {
          // Convert responses back to Map
          for (const tool of integration.tools) {
            tool.responses = new Map(Object.entries(tool.responses));
          }
          this.mockIntegrations.set(id, integration);
        }
      }

      // Import scenarios
      if (parsed.scenarios) {
        this.scenarios.clear();
        for (const scenario of parsed.scenarios) {
          this.scenarios.set(scenario.id, scenario);
        }
      }

      // Import config
      if (parsed.config) {
        Object.assign(this.config, parsed.config);
      }

      this.emit('mock-data-imported');
    } catch (error) {
      this.logger.error('Failed to import mock data:', error as Error);
      throw error;
    }
  }

  isInOfflineMode(): boolean {
    return this._isOfflineMode;
  }
}

interface MockCallRecord {
  id: string;
  integrationId: string;
  tool: string;
  input: any;
  output?: any;
  error?: string;
  timestamp: Date;
  duration: number;
  success: boolean;
}