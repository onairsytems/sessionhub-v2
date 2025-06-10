
/**
 * Supabase Service for SessionHub
 * Manages all Supabase connections, operations, and authentication
 * Integrates with Mac Keychain for secure credential storage
 */

import { createClient, SupabaseClient, User, Session as SupabaseSession } from '@supabase/supabase-js';
import { MacKeychainService } from '@/src/lib/security/MacKeychainService';
import { Logger } from '@/src/lib/logging/Logger';
import { Session } from '@/src/models/Session';
import { SessionConverter } from '@/src/services/converters/SessionConverter';

// Database types based on schema
export interface Project {
  id?: string;
  name: string;
  path: string;
  type: 'nextjs' | 'react' | 'node' | 'python' | 'java' | 'other';
  created_at?: string;
  last_accessed?: string;
  metadata?: Record<string, any>;
}

export interface SupabaseSessionRecord {
  id?: string;
  user_id: string;
  project_id: string;
  status?: 'active' | 'completed' | 'paused' | 'cancelled';
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, any>;
  title?: string;
  description?: string;
  total_duration?: string;
}

export interface Instruction {
  id?: string;
  session_id: string;
  type: 'code_generation' | 'code_review' | 'refactoring' | 'debugging' | 
        'architecture' | 'documentation' | 'testing' | 'other';
  content: string;
  created_at?: string;
  metadata?: Record<string, any>;
  sequence_number?: number;
  parent_instruction_id?: string;
}

export interface ExecutionResult {
  id?: string;
  instruction_id: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'cancelled';
  outputs?: Record<string, any>;
  errors?: unknown[];
  duration?: string;
  created_at?: string;
  started_at?: string;
  completed_at?: string;
  resources_used?: Record<string, any>;
}

export interface Pattern {
  id?: string;
  pattern_type: 'command' | 'workflow' | 'error_resolution' | 'code_pattern' | 'optimization';
  description: string;
  frequency?: number;
  success_rate?: number;
  metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
  last_used_at?: string;
  project_id?: string;
}

// Configuration interface
export interface SupabaseConfig {
  url?: string;
  anonKey?: string;
  serviceKey?: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
      detectSessionInUrl?: boolean;
    };
    global?: {
      fetch?: typeof fetch;
    };
  };
}

// Error types
export class SupabaseServiceError extends Error {
  constructor(message: string, public code?: string, public details?: any) {
    super(message);
    this.name = 'SupabaseServiceError';
  }
}

export class SupabaseService {
  private client: SupabaseClient | null = null;
  private readonly logger: Logger;
  private readonly keychainService: MacKeychainService;
  private isOnline: boolean = true;
  private retryCount: number = 3;
  private retryDelay: number = 1000; // milliseconds
  private offlineQueue: Array<() => Promise<unknown>> = [];
  private reconnectInterval: NodeJS.Timeout | null = null;

  // Keychain account names
  private readonly SUPABASE_URL_KEY = 'supabase-url';
  private readonly SUPABASE_ANON_KEY = 'supabase-anon-key';
  private readonly SUPABASE_SERVICE_KEY = 'supabase-service-key';

  constructor(logger: Logger) {
    this.logger = logger;
    this.keychainService = new MacKeychainService(logger);
    this.setupConnectivityMonitoring();
  }

  /**
   * Initialize Supabase client with credentials from Keychain
   */
  async initialize(config?: SupabaseConfig): Promise<void> {
    try {
      // Try to get credentials from config or Keychain
      const url = config?.url || await this.keychainService.getCredential(this.SUPABASE_URL_KEY);
      const anonKey = config?.anonKey || await this.keychainService.getCredential(this.SUPABASE_ANON_KEY);

      if (!url || !anonKey) {
        throw new SupabaseServiceError('Missing Supabase credentials. Please configure them first.');
      }

      // Create Supabase client
      this.client = createClient(url, anonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          ...config?.options?.auth
        },
        global: config?.options?.global
      });

      // Test connection
      const { error } = await this.client.from('projects').select('count').limit(1);
      if (error) {
        throw new SupabaseServiceError('Failed to connect to Supabase', error.code, error);
      }

      this.logger.info('Supabase client initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Supabase client', error as Error);
      throw error;
    }
  }

  /**
   * Store Supabase credentials in Keychain
   */
  async configureCredentials(url: string, anonKey: string, serviceKey?: string): Promise<void> {
    try {
      await this.keychainService.setCredential(this.SUPABASE_URL_KEY, url, 'Supabase Project URL');
      await this.keychainService.setCredential(this.SUPABASE_ANON_KEY, anonKey, 'Supabase Anonymous Key');
      
      if (serviceKey) {
        await this.keychainService.setCredential(this.SUPABASE_SERVICE_KEY, serviceKey, 'Supabase Service Key');
      }

      this.logger.info('Supabase credentials stored securely in Keychain');
      
      // Reinitialize client with new credentials
      await this.initialize({ url, anonKey });
    } catch (error) {
      this.logger.error('Failed to store Supabase credentials', error as Error);
      throw error;
    }
  }

  /**
   * Get the Supabase client (ensures initialization)
   */
  public getClient(): SupabaseClient {
    if (!this.client) {
      throw new SupabaseServiceError('Supabase client not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Setup connectivity monitoring
   */
  private setupConnectivityMonitoring(): void {
    // Monitor online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }

    // Periodic connectivity check
    this.reconnectInterval = setInterval(() => {
      this.checkConnectivity();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Handle online event
   */
  private async handleOnline(): Promise<void> {
    this.isOnline = true;
    this.logger.info('Connection restored');
    
    // Process offline queue
    while (this.offlineQueue.length > 0) {
      const operation = this.offlineQueue.shift();
      if (operation) {
        try {
          await operation();
        } catch (error) {
          this.logger.error('Failed to process offline queue item', error as Error);
        }
      }
    }
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false;
    this.logger.warn('Connection lost - entering offline mode');
  }

  /**
   * Check connectivity status
   */
  private async checkConnectivity(): Promise<boolean> {
    if (!this.client) return false;

    try {
      const { error } = await this.client.from('projects').select('count').limit(1);
      this.isOnline = !error;
      return this.isOnline;
    } catch {
      this.isOnline = false;
      return false;
    }
  }

  /**
   * Execute operation with retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.retryCount; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`${operationName} failed (attempt ${attempt}/${this.retryCount})`, lastError);
        
        if (attempt < this.retryCount) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }

    throw new SupabaseServiceError(
      `${operationName} failed after ${this.retryCount} attempts`,
      'MAX_RETRIES_EXCEEDED',
      lastError
    );
  }

  /**
   * Queue operation for offline execution
   */
  private queueOfflineOperation<T>(operation: () => Promise<T>): void {
    this.offlineQueue.push(operation);
    this.logger.info('Operation queued for offline execution');
  }

  // Authentication methods

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<{ user: User | null; session: SupabaseSession | null }> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      
      if (error) {
        throw new SupabaseServiceError('Authentication failed', error.status?.toString(), error);
      }
      
      return { user: data.user, session: data.session };
    }, 'signIn');
  }

  /**
   * Sign up new user
   */
  async signUp(email: string, password: string): Promise<{ user: User | null; session: SupabaseSession | null }> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client.auth.signUp({ email, password });
      
      if (error) {
        throw new SupabaseServiceError('Sign up failed', error.status?.toString(), error);
      }
      
      return { user: data.user, session: data.session };
    }, 'signUp');
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    const client = this.getClient();
    
    const { error } = await client.auth.signOut();
    if (error) {
      throw new SupabaseServiceError('Sign out failed', error.status?.toString(), error);
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser(): Promise<User | null> {
    const client = this.getClient();
    const { data: { user } } = await client.auth.getUser();
    return user;
  }

  /**
   * Get current session
   */
  async getAuthSession(): Promise<SupabaseSession | null> {
    const client = this.getClient();
    const { data: { session } } = await client.auth.getSession();
    return session;
  }

  /**
   * Refresh session
   */
  async refreshSession(): Promise<SupabaseSession | null> {
    const client = this.getClient();
    const { data: { session }, error } = await client.auth.refreshSession();
    
    if (error) {
      throw new SupabaseServiceError('Session refresh failed', error.status?.toString(), error);
    }
    
    return session;
  }

  // CRUD operations for Projects

  /**
   * Create a new project
   */
  async createProject(project: Omit<Project, 'id' | 'created_at' | 'last_accessed'>): Promise<Project> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.createProject(project));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('projects')
        .insert(project)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to create project', error.code, error);
      }
      
      return data;
    }, 'createProject');
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('projects')
        .select('*')
        .order('last_accessed', { ascending: false });
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch projects', error.code, error);
      }
      
      return data || [];
    }, 'getProjects');
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('projects')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw new SupabaseServiceError('Failed to fetch project', error.code, error);
      }
      
      return data;
    }, 'getProject');
  }

  /**
   * Update project
   */
  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.updateProject(id, updates));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to update project', error.code, error);
      }
      
      return data;
    }, 'updateProject');
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.deleteProject(id));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { error } = await client
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new SupabaseServiceError('Failed to delete project', error.code, error);
      }
    }, 'deleteProject');
  }

  // CRUD operations for Sessions

  /**
   * Create a new session (Supabase record format)
   */
  async createSessionRecord(session: Omit<SupabaseSessionRecord, 'id' | 'created_at' | 'updated_at'>): Promise<SupabaseSessionRecord> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.createSessionRecord(session));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .insert(session)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to create session', error.code, error);
      }
      
      return data;
    }, 'createSessionRecord');
  }

  /**
   * Create a new session (domain model format)
   */
  async createSession(session: Omit<Session, 'id' | 'createdAt' | 'updatedAt'>): Promise<Session> {
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    const now = new Date().toISOString();
    const fullSession: Session = {
      ...session,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    const record = SessionConverter.toSupabaseRecord(fullSession);
    const createdRecord = await this.createSessionRecord(record);
    return SessionConverter.toSession(createdRecord);
  }

  /**
   * Get sessions for a project
   */
  async getProjectSessions(projectId: string): Promise<Session[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch sessions', error.code, error);
      }
      
      return SessionConverter.toSessions(data || []);
    }, 'getProjectSessions');
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(): Promise<Session[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('status', 'active');
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch active sessions', error.code, error);
      }
      
      return SessionConverter.toSessions(data || []);
    }, 'getActiveSessions');
  }

  /**
   * Get active session states for SessionStateManager
   * Returns SessionState objects from sessions with state metadata
   */
  async getActiveSessionStates(): Promise<any[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .select('metadata')
        .eq('status', 'active')
        .eq('metadata->>_type', 'session_state');
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch active session states', error.code, error);
      }
      
      return (data || []).map(item => item.metadata).filter(Boolean);
    }, 'getActiveSessionStates');
  }

  /**
   * Update session (Supabase record format)
   */
  async updateSessionRecord(id: string, updates: Partial<SupabaseSessionRecord>): Promise<SupabaseSessionRecord> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.updateSessionRecord(id, updates));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to update session', error.code, error);
      }
      
      return data;
    }, 'updateSessionRecord');
  }

  /**
   * Update session (domain model format)
   */
  async updateSession(id: string, updates: Partial<Session>): Promise<Session> {
    const recordUpdates = SessionConverter.toSupabaseUpdate(updates);
    const updatedRecord = await this.updateSessionRecord(id, recordUpdates);
    return SessionConverter.toSession(updatedRecord);
  }

  /**
   * Delete session
   */
  async deleteSession(id: string): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.deleteSession(id));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { error } = await client
        .from('sessions')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new SupabaseServiceError('Failed to delete session', error.code, error);
      }
    }, 'deleteSession');
  }

  // CRUD operations for Instructions

  /**
   * Create a new instruction
   */
  async createInstruction(instruction: Omit<Instruction, 'id' | 'created_at'>): Promise<Instruction> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.createInstruction(instruction));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('instructions')
        .insert(instruction)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to create instruction', error.code, error);
      }
      
      return data;
    }, 'createInstruction');
  }

  /**
   * Get instructions for a session
   */
  async getSessionInstructions(sessionId: string): Promise<Instruction[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('instructions')
        .select('*')
        .eq('session_id', sessionId)
        .order('sequence_number', { ascending: true });
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch instructions', error.code, error);
      }
      
      return data || [];
    }, 'getSessionInstructions');
  }

  /**
   * Update instruction
   */
  async updateInstruction(id: string, updates: Partial<Instruction>): Promise<Instruction> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.updateInstruction(id, updates));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('instructions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to update instruction', error.code, error);
      }
      
      return data;
    }, 'updateInstruction');
  }

  /**
   * Delete instruction
   */
  async deleteInstruction(id: string): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.deleteInstruction(id));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { error } = await client
        .from('instructions')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new SupabaseServiceError('Failed to delete instruction', error.code, error);
      }
    }, 'deleteInstruction');
  }

  // CRUD operations for Execution Results

  /**
   * Create execution result
   */
  async createExecutionResult(result: Omit<ExecutionResult, 'id' | 'created_at'>): Promise<ExecutionResult> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.createExecutionResult(result));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('execution_results')
        .insert(result)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to create execution result', error.code, error);
      }
      
      return data;
    }, 'createExecutionResult');
  }

  /**
   * Get execution results for an instruction
   */
  async getInstructionResults(instructionId: string): Promise<ExecutionResult[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('execution_results')
        .select('*')
        .eq('instruction_id', instructionId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch execution results', error.code, error);
      }
      
      return data || [];
    }, 'getInstructionResults');
  }

  /**
   * Update execution result
   */
  async updateExecutionResult(id: string, updates: Partial<ExecutionResult>): Promise<ExecutionResult> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.updateExecutionResult(id, updates));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('execution_results')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to update execution result', error.code, error);
      }
      
      return data;
    }, 'updateExecutionResult');
  }

  // CRUD operations for Patterns

  /**
   * Create a new pattern
   */
  async createPattern(pattern: Omit<Pattern, 'id' | 'created_at' | 'updated_at'>): Promise<Pattern> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.createPattern(pattern));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('patterns')
        .insert(pattern)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to create pattern', error.code, error);
      }
      
      return data;
    }, 'createPattern');
  }

  /**
   * Get all patterns
   */
  async getPatterns(filters?: { type?: string; projectId?: string }): Promise<Pattern[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      let query = client.from('patterns').select('*');
      
      if (filters?.type) {
        query = query.eq('pattern_type', filters.type);
      }
      
      if (filters?.projectId) {
        query = query.eq('project_id', filters.projectId);
      }
      
      const { data, error } = await query.order('frequency', { ascending: false });
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch patterns', error.code, error);
      }
      
      return data || [];
    }, 'getPatterns');
  }

  /**
   * Update pattern
   */
  async updatePattern(id: string, updates: Partial<Pattern>): Promise<Pattern> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.updatePattern(id, updates));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('patterns')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to update pattern', error.code, error);
      }
      
      return data;
    }, 'updatePattern');
  }

  /**
   * Delete pattern
   */
  async deletePattern(id: string): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.deletePattern(id));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { error } = await client
        .from('patterns')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new SupabaseServiceError('Failed to delete pattern', error.code, error);
      }
    }, 'deletePattern');
  }

  /**
   * Update pattern statistics
   */
  async updatePatternStats(id: string): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.updatePatternStats(id));
      return;
    }
    
    return this.executeWithRetry(async () => {
      const { error } = await client.rpc('update_pattern_statistics', { pattern_id: id });
      
      if (error) {
        throw new SupabaseServiceError('Failed to update pattern statistics', error.code, error);
      }
    }, 'updatePatternStats');
  }

  // Utility methods

  /**
   * Get session statistics
   */
  async getSessionStatistics(sessionId?: string): Promise<any[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      let query = client.from('session_statistics').select('*');
      
      if (sessionId) {
        query = query.eq('session_id', sessionId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch session statistics', error.code, error);
      }
      
      return data || [];
    }, 'getSessionStatistics');
  }

  /**
   * Calculate session duration
   */
  async calculateSessionDuration(sessionId: string): Promise<string | null> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client.rpc('calculate_session_duration', { session_id: sessionId });
      
      if (error) {
        throw new SupabaseServiceError('Failed to calculate session duration', error.code, error);
      }
      
      return data;
    }, 'calculateSessionDuration');
  }

  /**
   * Check if service is initialized
   */
  isInitialized(): boolean {
    return this.client !== null;
  }

  /**
   * Check if service is online
   */
  isServiceOnline(): boolean {
    return this.isOnline;
  }

  /**
   * Get offline queue size
   */
  getOfflineQueueSize(): number {
    return this.offlineQueue.length;
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.logger.info('Offline queue cleared');
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.reconnectInterval) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnline());
      window.removeEventListener('offline', () => this.handleOffline());
    }

    this.client = null;
    this.logger.info('Supabase service cleaned up');
  }

  /**
   * Export configuration (for backup)
   */
  async exportConfiguration(): Promise<{ url?: string; hasServiceKey: boolean }> {
    const url = await this.keychainService.getCredential(this.SUPABASE_URL_KEY);
    const serviceKey = await this.keychainService.getCredential(this.SUPABASE_SERVICE_KEY);
    
    return {
      url: url || undefined,
      hasServiceKey: !!serviceKey
    };
  }

  // Session State Management methods for SessionStateManager

  /**
   * Upsert session state data
   * Stores SessionStateManager's state in the session metadata
   */
  async upsertSessionState(sessionState: any): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.upsertSessionState(sessionState));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }

    return this.executeWithRetry(async () => {
      // First check if session exists
      const { data: existingSession } = await client
        .from('sessions')
        .select('id')
        .eq('id', sessionState.sessionId)
        .single();

      if (existingSession) {
        // Update existing session's metadata
        const { error } = await client
          .from('sessions')
          .update({
            metadata: {
              ...sessionState,
              _type: 'session_state'
            },
            updated_at: new Date().toISOString()
          })
          .eq('id', sessionState.sessionId);

        if (error) {
          throw new SupabaseServiceError('Failed to update session state', error.code, error);
        }
      } else {
        // Create new session with state in metadata
        const { error } = await client
          .from('sessions')
          .insert({
            id: sessionState.sessionId,
            user_id: sessionState.context?.userId || 'system-user', // System user for operations without user context
            project_id: sessionState.context?.projectId || 'system-project', // System project for operations without project context
            status: sessionState.status || 'active',
            metadata: {
              ...sessionState,
              _type: 'session_state'
            }
          });

        if (error) {
          throw new SupabaseServiceError('Failed to create session state', error.code, error);
        }
      }
    }, 'upsertSessionState');
  }

  /**
   * Get session state data
   * Retrieves SessionStateManager's state from session metadata
   */
  async getSessionState(sessionId: string): Promise<any> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .select('metadata')
        .eq('id', sessionId)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw new SupabaseServiceError('Failed to fetch session state', error.code, error);
      }

      if (data && data.metadata && data.metadata._type === 'session_state') {
        return data.metadata;
      }

      return null;
    }, 'getSessionState');
  }

  /**
   * Clean up old session states
   */
  async cleanupOldSessions(cutoffDate: Date): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.cleanupOldSessions(cutoffDate));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }

    return this.executeWithRetry(async () => {
      const { error } = await client
        .from('sessions')
        .delete()
        .lt('updated_at', cutoffDate.toISOString())
        .neq('status', 'active');

      if (error) {
        throw new SupabaseServiceError('Failed to cleanup old sessions', error.code, error);
      }
    }, 'cleanupOldSessions');
  }

  /**
   * Create a session template
   */
  async createSessionTemplate(template: any): Promise<any> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.createSessionTemplate(template));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('session_templates')
        .insert(template)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to create session template', error.code, error);
      }
      
      return data;
    }, 'createSessionTemplate');
  }

  /**
   * Get session templates
   */
  async getSessionTemplates(category?: string, isPublic?: boolean): Promise<any[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      let query = client.from('session_templates').select('*');
      
      if (category) {
        query = query.eq('category', category);
      }
      
      if (isPublic !== undefined) {
        query = query.eq('is_public', isPublic);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch session templates', error.code, error);
      }
      
      return data || [];
    }, 'getSessionTemplates');
  }

  /**
   * Get a specific session template
   */
  async getSessionTemplate(templateId: string): Promise<any> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('session_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch session template', error.code, error);
      }
      
      return data;
    }, 'getSessionTemplate');
  }

  /**
   * Increment template usage count
   */
  async incrementTemplateUsage(templateId: string): Promise<void> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.incrementTemplateUsage(templateId));
      return;
    }
    
    return this.executeWithRetry(async () => {
      const { error } = await client.rpc('increment_template_usage', {
        template_id: templateId
      });
      
      if (error) {
        throw new SupabaseServiceError('Failed to increment template usage', error.code, error);
      }
    }, 'incrementTemplateUsage');
  }


  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw new SupabaseServiceError('Failed to fetch session', error.code, error);
      }
      
      return data ? SessionConverter.toSession(data) : null;
    }, 'getSession');
  }

  /**
   * Get user sessions
   */
  async getUserSessions(userId: string): Promise<Session[]> {
    const client = this.getClient();
    
    return this.executeWithRetry(async () => {
      const { data, error } = await client
        .from('sessions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        throw new SupabaseServiceError('Failed to fetch user sessions', error.code, error);
      }
      
      return SessionConverter.toSessions(data || []);
    }, 'getUserSessions');
  }

  /**
   * Upsert a session (insert or update)
   */
  async upsertSession(session: Session): Promise<Session> {
    const client = this.getClient();
    
    if (!this.isOnline) {
      this.queueOfflineOperation(() => this.upsertSession(session));
      throw new SupabaseServiceError('Offline mode - operation queued');
    }
    
    return this.executeWithRetry(async () => {
      const record = SessionConverter.toSupabaseRecord(session);
      const { data, error } = await client
        .from('sessions')
        .upsert(record)
        .select()
        .single();
      
      if (error) {
        throw new SupabaseServiceError('Failed to upsert session', error.code, error);
      }
      
      return SessionConverter.toSession(data);
    }, 'upsertSession');
  }

}

// Export singleton instance
export const supabaseService = new SupabaseService(new Logger('SupabaseService'));