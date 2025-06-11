import { Session } from '../models/Session';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
const execAsync = promisify(exec);
export class GitVersioningService {
  private static instance: GitVersioningService;
  private sessionsPath: string;
  private initialized: boolean = false;
  private constructor() {
    this.sessionsPath = path.join(process.cwd(), 'sessions', 'history');
  }
  static getInstance(): GitVersioningService {
    if (!GitVersioningService.instance) {
      GitVersioningService.instance = new GitVersioningService();
    }
    return GitVersioningService.instance;
  }
  async initialize(): Promise<void> {
    if (this.initialized) return;
    try {
      // Ensure sessions directory exists
      await fs.mkdir(this.sessionsPath, { recursive: true });
      // Initialize git if not already initialized
      const gitDir = path.join(this.sessionsPath, '.git');
      try {
        await fs.access(gitDir);
      } catch {
        // Git not initialized, initialize it
        await execAsync('git init', { cwd: this.sessionsPath });
        await execAsync('git config user.name "SessionHub"', { cwd: this.sessionsPath });
        await execAsync('git config user.email "sessionhub@local"', { cwd: this.sessionsPath });
        // Create initial commit
        const readmePath = path.join(this.sessionsPath, 'README.md');
        await fs.writeFile(readmePath, '# Session History\n\nThis directory contains versioned session history.\n');
        await execAsync('git add README.md', { cwd: this.sessionsPath });
        await execAsync('git commit -m "Initial commit"', { cwd: this.sessionsPath });
      }
      this.initialized = true;
    } catch (error) {
      throw error;
    }
  }
  async createSessionVersion(session: Session, message: string): Promise<void> {
    await this.initialize();
    try {
      // Create session file path
      const sessionFile = path.join(this.sessionsPath, `${session.id}.json`);
      // Write session data
      const sessionData = {
        ...session,
        versionedAt: new Date().toISOString(),
        versionMessage: message
      };
      await fs.writeFile(sessionFile, JSON.stringify(sessionData, null, 2));
      // Git operations
      await execAsync(`git add ${session.id}.json`, { cwd: this.sessionsPath });
      const commitMessage = `[${session.id}] ${message}\n\nStatus: ${session.status}\nUser: ${session.userId}\nProject: ${session.projectId}`;
      await execAsync(`git commit -m "${commitMessage}"`, { cwd: this.sessionsPath });
      // Tag important milestones
      if (session.status === 'completed' || session.status === 'failed') {
        const tag = `session-${session.id}-${session.status}`;
        await execAsync(`git tag -a ${tag} -m "${message}"`, { cwd: this.sessionsPath });
      }
    } catch (error) {
      // Don't throw - versioning should not break the main flow
    }
  }
  async getSessionHistory(sessionId: string): Promise<Array<{
    commit: string;
    date: string;
    message: string;
    status: string;
  }>> {
    await this.initialize();
    try {
      const { stdout } = await execAsync(
        `git log --pretty=format:"%H|%ad|%s" --date=iso -- ${sessionId}.json`,
        { cwd: this.sessionsPath }
      );
      if (!stdout) return [];
      return stdout.split('\n').filter(line => line.trim()).map(line => {
        const parts = line.split('|');
        const commit = parts[0] || '';
        const date = parts[1] || '';
        const message = parts[2] || '';
        const statusMatch = message.match(/Status: (\w+)/);
        return {
          commit,
          date,
          message: message.split('\n')[0] || 'No message', // First line only
          status: (statusMatch ? statusMatch[1] : 'unknown') as string
        };
      });
    } catch (error) {
      return [];
    }
  }
  async getSessionAtVersion(sessionId: string, commit: string): Promise<Session | null> {
    await this.initialize();
    try {
      const { stdout } = await execAsync(
        `git show ${commit}:${sessionId}.json`,
        { cwd: this.sessionsPath }
      );
      return JSON.parse(stdout);
    } catch (error) {
      return null;
    }
  }
  async compareSessionVersions(sessionId: string, commit1: string, commit2: string): Promise<string> {
    await this.initialize();
    try {
      const { stdout } = await execAsync(
        `git diff ${commit1} ${commit2} -- ${sessionId}.json`,
        { cwd: this.sessionsPath }
      );
      return stdout;
    } catch (error) {
      return '';
    }
  }
  async exportSessionHistory(sessionId: string, outputPath: string): Promise<void> {
    await this.initialize();
    try {
      // Create a bundle with full history
      const bundlePath = path.join(outputPath, `session-${sessionId}-history.bundle`);
      await execAsync(
        `git bundle create ${bundlePath} --all -- ${sessionId}.json`,
        { cwd: this.sessionsPath }
      );
      // Also export the current state
      const sessionFile = path.join(this.sessionsPath, `${sessionId}.json`);
      const currentStatePath = path.join(outputPath, `session-${sessionId}-current.json`);
      await fs.copyFile(sessionFile, currentStatePath);
      // Export commit history as text
      const history = await this.getSessionHistory(sessionId);
      const historyPath = path.join(outputPath, `session-${sessionId}-history.txt`);
      const historyContent = history.map(h => 
        `${h.date} - ${h.message} (${h.commit})`
      ).join('\n');
      await fs.writeFile(historyPath, historyContent);
    } catch (error) {
      throw error;
    }
  }
  async searchSessionsByContent(searchTerm: string): Promise<Array<{
    sessionId: string;
    matches: Array<{ commit: string; line: string }>;
  }>> {
    await this.initialize();
    try {
      const { stdout } = await execAsync(
        `git grep -n "${searchTerm}" --all`,
        { cwd: this.sessionsPath }
      );
      if (!stdout) return [];
      // Parse git grep output
      const matches = new Map<string, Array<{ commit: string; line: string }>>();
      stdout.split('\n').forEach(line => {
        const match = line.match(/([^:]+):([^:]+\.json):(.+)/);
        if (match && match.length >= 4) {
          const [, commit, file, content] = match;
          const sessionId = path.basename(file || '', '.json');
          if (!matches.has(sessionId)) {
            matches.set(sessionId, []);
          }
          matches.get(sessionId)!.push({ commit: commit || '', line: content || '' });
        }
      });
      return Array.from(matches.entries()).map(([sessionId, matchList]) => ({
        sessionId,
        matches: matchList
      }));
    } catch (error) {
      // Git grep returns non-zero if no matches found
      return [];
    }
  }
  async getSessionStatistics(): Promise<{
    totalSessions: number;
    totalCommits: number;
    oldestSession: string | null;
    newestSession: string | null;
    mostActiveSession: { id: string; commits: number } | null;
  }> {
    await this.initialize();
    try {
      // Get all session files
      const files = await fs.readdir(this.sessionsPath);
      const sessionFiles = files.filter(f => f.endsWith('.json') && f !== 'README.md');
      // Get total commits
      const { stdout: commitCount } = await execAsync(
        'git rev-list --count HEAD',
        { cwd: this.sessionsPath }
      );
      // Get oldest and newest sessions
      let oldest: string | null = null;
      let newest: string | null = null;
      if (sessionFiles.length > 0) {
        const { stdout: oldestOutput } = await execAsync(
          'git log --reverse --pretty=format:"%H" -1',
          { cwd: this.sessionsPath }
        );
        const { stdout: newestOutput } = await execAsync(
          'git log --pretty=format:"%H" -1',
          { cwd: this.sessionsPath }
        );
        oldest = oldestOutput.trim();
        newest = newestOutput.trim();
      }
      // Find most active session
      let mostActive: { id: string; commits: number } | null = null;
      let maxCommits = 0;
      for (const file of sessionFiles) {
        const sessionId = path.basename(file, '.json');
        const { stdout } = await execAsync(
          `git rev-list --count HEAD -- ${file}`,
          { cwd: this.sessionsPath }
        );
        const commits = parseInt(stdout.trim());
        if (commits > maxCommits) {
          maxCommits = commits;
          mostActive = { id: sessionId, commits };
        }
      }
      return {
        totalSessions: sessionFiles.length,
        totalCommits: parseInt(commitCount.trim()),
        oldestSession: oldest,
        newestSession: newest,
        mostActiveSession: mostActive
      };
    } catch (error) {
      return {
        totalSessions: 0,
        totalCommits: 0,
        oldestSession: null,
        newestSession: null,
        mostActiveSession: null
      };
    }
  }
}