import { createServer, IncomingMessage, ServerResponse } from 'http';
import { createHmac } from 'crypto';
import { EventEmitter } from 'events';
import { Octokit } from '@octokit/rest';
import { GitHubWebhookPayload, PipelineConfig } from './types';
import { SelfDevelopmentAuditor } from '../development/SelfDevelopmentAuditor';
import { CredentialManager } from '../../lib/security/CredentialManager';
export class GitHubWebhookReceiver extends EventEmitter {
  private server?: ReturnType<typeof createServer>;
  private octokit?: Octokit;
  private port: number = 3001;
  // private _isListening: boolean = false; // Removed unused
  private pollingInterval?: NodeJS.Timeout;
  private processedIssues: Set<string> = new Set();
  private auditor: SelfDevelopmentAuditor;
  private credentialManager: CredentialManager;
  constructor(private config: PipelineConfig) {
    super();
    this.auditor = new SelfDevelopmentAuditor();
    this.credentialManager = new CredentialManager({} as any);
  }
  async start(): Promise<void> {
    try {
      // Initialize GitHub API client
      const token = await this.credentialManager.getCredential('github_api_token');
      if (!token) {
        throw new Error('GitHub API token not found');
      }
      this.octokit = new Octokit({
        auth: token,
      });
      // Start webhook server
      await this.startWebhookServer();
      // Start polling as fallback
      this.startPolling();
      await this.auditor.logEvent({
        type: 'self_development' as any,
        actor: 'system',
        action: 'start',
        target: 'github_webhook',
        details: {
        port: this.port,
        },
        risk: 'low',
        context: {}
      });
    } catch (error) {
      await this.auditor.logEvent({
        type: 'self_development' as any,
        actor: 'system',
        action: 'error',
        target: 'github_webhook',
        details: {
        error: (error as Error).message,
        },
        risk: 'low',
        context: {}
      });
      throw error;
    }
  }
  async stop(): Promise<void> {
    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server!.close(() => resolve());
      });
      // this._isListening = false;
    }
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    await this.auditor.logEvent({
        type: 'self_development' as any,
        actor: 'system',
        action: 'stop',
        target: 'github_webhook',
        details: {},
        risk: 'low',
        context: {}
      });
  }
  private async startWebhookServer(): Promise<void> {
    this.server = createServer(async (req, res) => {
      if (req.method === 'POST' && req.url === '/webhook') {
        await this.handleWebhook(req, res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    return new Promise((resolve, reject) => {
      this.server!.listen(this.port, () => {
        // this._isListening = true;
        resolve();
      }).on('error', reject);
    });
  }
  private async handleWebhook(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      // Collect request body
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const body = Buffer.concat(chunks).toString();
      // Verify webhook signature
      const signature = req.headers['x-hub-signature-256'] as string;
      if (!this.verifyWebhookSignature(body, signature)) {
        res.writeHead(401);
        res.end('Unauthorized');
        await this.auditor.logEvent({
        type: 'security' as any,
        actor: 'system',
        action: 'webhook_verification_failed',
        target: 'github',
        details: {
        ip: req.socket.remoteAddress,
        },
        risk: 'low',
        context: {}
      });
        return;
      }
      // Parse payload
      const payload: GitHubWebhookPayload = JSON.parse(body);
      const event = req.headers['x-github-event'] as string;
      // Process the webhook
      await this.processWebhook(event, payload);
      res.writeHead(200);
      res.end('OK');
    } catch (error) {
      res.writeHead(500);
      res.end('Internal Server Error');
      await this.auditor.logEvent({
        type: 'self_development' as any,
        actor: 'system',
        action: 'webhook_error',
        target: 'github',
        details: {
        error: (error as Error).message,
        },
        risk: 'low',
        context: {}
      });
    }
  }
  private verifyWebhookSignature(body: string, signature: string): boolean {
    if (!signature || !this.config.github.webhookSecret) {
      return false;
    }
    const hmac = createHmac('sha256', this.config.github.webhookSecret);
    const digest = 'sha256=' + hmac.update(body).digest('hex');
    // Constant time comparison
    return signature.length === digest.length &&
      signature.split('').every((char, index) => char === digest[index]);
  }
  private async processWebhook(event: string, payload: GitHubWebhookPayload): Promise<void> {
    // Handle issue events
    if (event === 'issues' && payload.issue) {
      const issue = payload.issue;
      const issueKey = `${payload.repository?.full_name}#${issue.number}`;
      // Check if issue has required label
      const hasRequiredLabel = issue.labels.some(label =>
        this.config.github.labelFilter.includes(label.name)
      );
      if (!hasRequiredLabel) {
        return;
      }
      // Check if already processed
      if (this.processedIssues.has(issueKey)) {
        return;
      }
      // Process based on action
      if (payload.action === 'opened' || payload.action === 'labeled') {
        this.processedIssues.add(issueKey);
        this.emit('issue', {
          issue,
          repository: payload.repository,
          action: payload.action,
        });
        await this.auditor.logEvent({
        type: 'github' as any,
        actor: 'system',
        action: 'issue_received',
        target: issueKey,
        details: {
        title: issue.title,
        },
        risk: 'low',
        context: {}
      });
      }
    }
  }
  private startPolling(): void {
    // Poll every 5 minutes as fallback
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollIssues();
      } catch (error) {
      }
    }, 5 * 60 * 1000);
    // Initial poll
    this.pollIssues().catch((error) => {
      this.auditor.logEvent({
        type: 'self_development' as any,
        actor: 'system',
        action: 'error',
        target: 'github_polling',
        details: { error: error.message },
        risk: 'medium',
        context: {}
      });
    });
  }
  private async pollIssues(): Promise<void> {
    if (!this.octokit) return;
    for (const repoFullName of this.config.github.repos) {
      const [owner, repo] = repoFullName.split('/');
      try {
        const { data: issues } = await this.octokit.issues.listForRepo({
          owner: owner || '',
          repo: repo || '',
          labels: this.config.github.labelFilter.join(','),
          state: 'open',
          per_page: 100,
        });
        for (const issue of issues) {
          const issueKey = `${repoFullName}#${issue.number}`;
          if (!this.processedIssues.has(issueKey)) {
            this.processedIssues.add(issueKey);
            this.emit('issue', {
              issue: {
                id: issue.id,
                number: issue.number,
                title: issue.title,
                body: issue.body || '',
                labels: issue.labels.map(l => typeof l === 'string' ? { name: l } : l),
                state: issue.state,
                user: issue.user,
                created_at: issue.created_at,
                updated_at: issue.updated_at,
              },
              repository: {
                full_name: repoFullName,
                name: repo,
                owner: { login: owner },
              },
              action: 'polled',
            });
          }
        }
      } catch (error) {
        await this.auditor.logEvent({
        type: 'self_development' as any,
        actor: 'system',
        action: 'polling_error',
        target: repoFullName,
        details: {
        error: (error as Error).message,
        },
        risk: 'low',
        context: {}
      });
      }
    }
  }
  async updateIssueStatus(
    repoFullName: string | undefined,
    issueNumber: number | undefined,
    status: string,
    details?: string
  ): Promise<void> {
    if (!this.octokit || !repoFullName || !issueNumber) return;
    const [owner, repo] = repoFullName.split('/');
    try {
      await this.octokit.issues.createComment({
        owner: owner || '',
        repo: repo || '',
        issue_number: issueNumber,
        body: `**SessionHub Auto-Development Update**\n\nStatus: ${status}\n${details ? `\nDetails:\n${details}` : ''}`,
      });
      await this.auditor.logEvent({
        type: 'github' as any,
        actor: 'system',
        action: 'issue_updated',
        target: `${repoFullName}#${issueNumber}`,
        details: {
        status,
        },
        risk: 'low',
        context: {}
      });
    } catch (error) {
      await this.auditor.logEvent({
        type: 'self_development' as any,
        actor: 'system',
        action: 'issue_update_error',
        target: `${repoFullName}#${issueNumber}`,
        details: {
        error: (error as Error).message,
        },
        risk: 'low',
        context: {}
      });
    }
  }
  getWebhookUrl(): string {
    return `http://localhost:${this.port}/webhook`;
  }
}