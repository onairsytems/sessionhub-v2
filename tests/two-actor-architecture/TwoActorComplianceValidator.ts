import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Two-Actor Model Compliance Verification System
 * Validates architectural integrity and boundary enforcement
 */

export interface ActorBoundaryViolation {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  location: string;
  recommendation: string;
  violationCode?: string;
}

export interface TwoActorComplianceResult {
  passed: boolean;
  score: number;
  violations: ActorBoundaryViolation[];
  boundaryIntegrity: {
    planningActorIsolation: boolean;
    executionActorIsolation: boolean;
    communicationProtocol: boolean;
    contextSeparation: boolean;
  };
  architecturalCompliance: {
    layerSeparation: boolean;
    responsibilitySegregation: boolean;
    dataFlowCompliance: boolean;
    errorIsolation: boolean;
  };
  runtimeCompliance: {
    memoryIsolation: boolean;
    processIsolation: boolean;
    resourceSharing: boolean;
    concurrencyManagement: boolean;
  };
  recommendations: string[];
  timestamp: Date;
}

export class TwoActorComplianceValidator {
  private violations: ActorBoundaryViolation[] = [];
  private recommendations: string[] = [];

  async validateTwoActorCompliance(): Promise<TwoActorComplianceResult> {
    console.log('🎭 Starting Two-Actor Model compliance validation...');

    this.violations = [];
    this.recommendations = [];

    // Validate core architectural boundaries
    const boundaryIntegrity = await this.validateBoundaryIntegrity();
    
    // Validate architectural compliance
    const architecturalCompliance = await this.validateArchitecturalCompliance();
    
    // Validate runtime compliance
    const runtimeCompliance = await this.validateRuntimeCompliance();

    // Calculate overall compliance score
    const score = this.calculateComplianceScore();
    const passed = this.violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0;

    return {
      passed,
      score,
      violations: this.violations,
      boundaryIntegrity,
      architecturalCompliance,
      runtimeCompliance,
      recommendations: this.recommendations,
      timestamp: new Date()
    };
  }

  private async validateBoundaryIntegrity(): Promise<any> {
    console.log('🔍 Validating actor boundary integrity...');

    const planningActorIsolation = await this.validatePlanningActorIsolation();
    const executionActorIsolation = await this.validateExecutionActorIsolation();
    const communicationProtocol = await this.validateCommunicationProtocol();
    const contextSeparation = await this.validateContextSeparation();

    return {
      planningActorIsolation,
      executionActorIsolation,
      communicationProtocol,
      contextSeparation
    };
  }

  private async validatePlanningActorIsolation(): Promise<boolean> {
    console.log('📋 Validating Planning Actor isolation...');

    try {
      // Check planning actor files for boundary violations
      const planningFiles = this.findFiles([
        '*planning*.ts',
        '*plan*.ts',
        'PlanningEngine*',
        'SessionWorkflow*'
      ]);

      for (const file of planningFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Planning Actor should NOT have direct file system access
        if (content.includes('fs.writeFile') || content.includes('fs.readFile') || content.includes('writeFileSync')) {
          this.violations.push({
            severity: 'critical',
            type: 'Planning Actor File System Access',
            description: 'Planning Actor directly accessing file system violates boundary separation',
            location: file,
            recommendation: 'Planning Actor should only communicate through defined interfaces',
            violationCode: 'PA-001'
          });
        }

        // Planning Actor should NOT execute system commands
        if (content.includes('exec(') || content.includes('spawn(') || content.includes('child_process')) {
          this.violations.push({
            severity: 'critical',
            type: 'Planning Actor System Command Execution',
            description: 'Planning Actor executing system commands violates execution boundary',
            location: file,
            recommendation: 'All system operations must be delegated to Execution Actor',
            violationCode: 'PA-002'
          });
        }

        // Planning Actor should NOT have database write operations
        if (content.match(/\.(insert|update|delete|create|drop)\s*\(/i)) {
          this.violations.push({
            severity: 'high',
            type: 'Planning Actor Database Write Operations',
            description: 'Planning Actor performing database writes violates data boundary',
            location: file,
            recommendation: 'Planning Actor should only perform read operations and delegate writes',
            violationCode: 'PA-003'
          });
        }

        // Planning Actor should NOT import execution-specific modules
        const executionImports = [
          'CodeExecutor',
          'FileManager',
          'GitManager',
          'BuildValidator',
          'ProjectManager'
        ];

        executionImports.forEach(importName => {
          if (content.includes(`import.*${importName}`) || content.includes(`require.*${importName}`)) {
            this.violations.push({
              severity: 'high',
              type: 'Planning Actor Execution Import',
              description: `Planning Actor importing execution module: ${importName}`,
              location: file,
              recommendation: 'Use dependency injection or communication interfaces instead',
              violationCode: 'PA-004'
            });
          }
        });

        // Check for proper planning actor markers
        if (!content.includes('PLANNING_ACTOR') && !content.includes('@PlanningActor')) {
          if (planningFiles.length > 0) {
            this.violations.push({
              severity: 'medium',
              type: 'Missing Planning Actor Marker',
              description: 'Planning Actor files should be clearly marked',
              location: file,
              recommendation: 'Add PLANNING_ACTOR marker or @PlanningActor decorator',
              violationCode: 'PA-005'
            });
          }
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('PA-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Planning Actor Validation Error',
        description: `Unable to validate Planning Actor isolation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of Planning Actor implementation required'
      });
      return false;
    }
  }

  private async validateExecutionActorIsolation(): Promise<boolean> {
    console.log('⚙️ Validating Execution Actor isolation...');

    try {
      // Check execution actor files for boundary violations
      const executionFiles = this.findFiles([
        '*execution*.ts',
        '*execute*.ts',
        'ExecutionEngine*',
        'CodeExecutor*',
        'FileManager*',
        'GitManager*',
        'BuildValidator*'
      ]);

      for (const file of executionFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Execution Actor should NOT have planning logic
        const planningKeywords = [
          'planStep',
          'createPlan',
          'analyzeRequirements',
          'generateStrategy',
          'planningLogic',
          'strategicDecision'
        ];

        planningKeywords.forEach(keyword => {
          if (content.includes(keyword)) {
            this.violations.push({
              severity: 'critical',
              type: 'Execution Actor Planning Logic',
              description: `Execution Actor contains planning logic: ${keyword}`,
              location: file,
              recommendation: 'Move planning logic to Planning Actor',
              violationCode: 'EA-001'
            });
          }
        });

        // Execution Actor should NOT make strategic decisions
        if (content.includes('strategy') || content.includes('decide') || content.includes('choose')) {
          if (content.includes('decision') || content.includes('determine')) {
            this.violations.push({
              severity: 'high',
              type: 'Execution Actor Strategic Decisions',
              description: 'Execution Actor making strategic decisions violates responsibility boundary',
              location: file,
              recommendation: 'Strategic decisions should be made by Planning Actor',
              violationCode: 'EA-002'
            });
          }
        }

        // Execution Actor should NOT have user interaction logic
        if (content.includes('prompt') || content.includes('askUser') || content.includes('getUserInput')) {
          this.violations.push({
            severity: 'high',
            type: 'Execution Actor User Interaction',
            description: 'Execution Actor directly interacting with users violates interface boundary',
            location: file,
            recommendation: 'All user interactions should go through Planning Actor',
            violationCode: 'EA-003'
          });
        }

        // Check for proper execution actor markers
        if (!content.includes('EXECUTION_ACTOR') && !content.includes('@ExecutionActor')) {
          if (executionFiles.length > 0) {
            this.violations.push({
              severity: 'medium',
              type: 'Missing Execution Actor Marker',
              description: 'Execution Actor files should be clearly marked',
              location: file,
              recommendation: 'Add EXECUTION_ACTOR marker or @ExecutionActor decorator',
              violationCode: 'EA-004'
            });
          }
        }

        // Execution Actor should have proper error boundaries
        if (!content.includes('try') && !content.includes('catch') && content.includes('async')) {
          this.violations.push({
            severity: 'medium',
            type: 'Missing Execution Error Handling',
            description: 'Execution Actor lacks proper error boundaries',
            location: file,
            recommendation: 'Implement comprehensive error handling in Execution Actor',
            violationCode: 'EA-005'
          });
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('EA-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Execution Actor Validation Error',
        description: `Unable to validate Execution Actor isolation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of Execution Actor implementation required'
      });
      return false;
    }
  }

  private async validateCommunicationProtocol(): Promise<boolean> {
    console.log('📡 Validating actor communication protocol...');

    try {
      // Check for proper communication interfaces
      const communicationFiles = this.findFiles([
        '*communication*.ts',
        '*interface*.ts',
        '*protocol*.ts',
        '*message*.ts'
      ]);

      let hasDefinedProtocol = false;
      let hasValidation = false;

      for (const file of communicationFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for defined communication protocol
        if (content.includes('ActorMessage') || content.includes('ActorCommunication') || 
            content.includes('PlanningToExecution') || content.includes('ExecutionToPlanning')) {
          hasDefinedProtocol = true;
        }

        // Check for message validation
        if (content.includes('validateMessage') || content.includes('MessageValidator')) {
          hasValidation = true;
        }

        // Check for direct actor references (should be avoided)
        if (content.includes('planningActor.') && content.includes('executionActor.')) {
          this.violations.push({
            severity: 'high',
            type: 'Direct Actor Reference',
            description: 'Direct references between actors violate communication protocol',
            location: file,
            recommendation: 'Use message passing or event-driven communication',
            violationCode: 'CP-001'
          });
        }

        // Check for synchronous coupling
        if (content.includes('await planningActor') || content.includes('await executionActor')) {
          this.violations.push({
            severity: 'medium',
            type: 'Synchronous Actor Coupling',
            description: 'Synchronous coupling between actors reduces independence',
            location: file,
            recommendation: 'Use asynchronous message passing for better decoupling',
            violationCode: 'CP-002'
          });
        }
      }

      if (!hasDefinedProtocol) {
        this.violations.push({
          severity: 'high',
          type: 'Missing Communication Protocol',
          description: 'No defined communication protocol between actors',
          location: 'communication layer',
          recommendation: 'Define clear message interfaces and protocols',
          violationCode: 'CP-003'
        });
      }

      if (!hasValidation) {
        this.violations.push({
          severity: 'medium',
          type: 'Missing Message Validation',
          description: 'Actor messages are not validated',
          location: 'communication layer',
          recommendation: 'Implement message validation for security and reliability',
          violationCode: 'CP-004'
        });
      }

      return this.violations.filter(v => v.violationCode?.startsWith('CP-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Communication Protocol Validation Error',
        description: `Unable to validate communication protocol: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of communication implementation required'
      });
      return false;
    }
  }

  private async validateContextSeparation(): Promise<boolean> {
    console.log('🔄 Validating context separation...');

    try {
      // Check for proper context isolation
      const contextFiles = this.findFiles([
        '*context*.ts',
        '*state*.ts',
        '*session*.ts'
      ]);

      let hasPlanningContext = false;
      let hasExecutionContext = false;

      for (const file of contextFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for planning context
        if (content.includes('PlanningContext') || content.includes('planningState')) {
          hasPlanningContext = true;
        }

        // Check for execution context
        if (content.includes('ExecutionContext') || content.includes('executionState')) {
          hasExecutionContext = true;
        }

        // Check for context separation
        if (content.includes('contextSeparation') || content.includes('isolateContext')) {
          // Context separation found
        }

        // Check for shared state (potential violation)
        if (content.includes('sharedState') || content.includes('globalState')) {
          this.violations.push({
            severity: 'high',
            type: 'Shared State Between Actors',
            description: 'Shared state between actors violates context separation',
            location: file,
            recommendation: 'Maintain separate state for each actor',
            violationCode: 'CS-001'
          });
        }

        // Check for cross-context pollution
        if (content.includes('planningContext') && content.includes('executionContext')) {
          if (!content.includes('separate') && !content.includes('isolate')) {
            this.violations.push({
              severity: 'medium',
              type: 'Context Pollution Risk',
              description: 'Risk of context pollution between actors',
              location: file,
              recommendation: 'Ensure clear context boundaries and isolation',
              violationCode: 'CS-002'
            });
          }
        }

        // Check for proper context cleanup
        if (content.includes('context') && !content.includes('cleanup') && !content.includes('dispose')) {
          this.violations.push({
            severity: 'low',
            type: 'Missing Context Cleanup',
            description: 'Context cleanup mechanisms not found',
            location: file,
            recommendation: 'Implement proper context cleanup to prevent memory leaks',
            violationCode: 'CS-003'
          });
        }
      }

      if (!hasPlanningContext || !hasExecutionContext) {
        this.violations.push({
          severity: 'high',
          type: 'Missing Actor Contexts',
          description: 'Separate contexts for Planning and Execution actors not found',
          location: 'context management',
          recommendation: 'Implement separate contexts for each actor',
          violationCode: 'CS-004'
        });
      }

      return this.violations.filter(v => v.violationCode?.startsWith('CS-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Context Separation Validation Error',
        description: `Unable to validate context separation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of context management required'
      });
      return false;
    }
  }

  private async validateArchitecturalCompliance(): Promise<any> {
    console.log('🏗️ Validating architectural compliance...');

    const layerSeparation = await this.validateLayerSeparation();
    const responsibilitySegregation = await this.validateResponsibilitySegregation();
    const dataFlowCompliance = await this.validateDataFlowCompliance();
    const errorIsolation = await this.validateErrorIsolation();

    return {
      layerSeparation,
      responsibilitySegregation,
      dataFlowCompliance,
      errorIsolation
    };
  }

  private async validateLayerSeparation(): Promise<boolean> {
    console.log('📚 Validating layer separation...');

    try {
      // Check for proper layered architecture
      const layers = [
        { name: 'presentation', files: ['*ui*.ts', '*component*.ts', '*page*.ts'] },
        { name: 'planning', files: ['*planning*.ts', '*plan*.ts'] },
        { name: 'execution', files: ['*execution*.ts', '*execute*.ts'] },
        { name: 'infrastructure', files: ['*infrastructure*.ts', '*adapter*.ts'] }
      ];

      for (const layer of layers) {
        const layerFiles = this.findFiles(layer.files);
        
        for (const file of layerFiles) {
          const content = readFileSync(file, 'utf-8');
          
          // Presentation layer should not import execution logic
          if (layer.name === 'presentation') {
            if (content.includes('import.*execution') || content.includes('import.*execute')) {
              this.violations.push({
                severity: 'high',
                type: 'Layer Separation Violation',
                description: 'Presentation layer importing execution logic',
                location: file,
                recommendation: 'Use dependency injection or interfaces for layer communication',
                violationCode: 'LS-001'
              });
            }
          }

          // Planning layer should not import infrastructure directly
          if (layer.name === 'planning') {
            if (content.includes('import.*infrastructure') || content.includes('import.*adapter')) {
              this.violations.push({
                severity: 'medium',
                type: 'Planning Layer Infrastructure Import',
                description: 'Planning layer directly importing infrastructure',
                location: file,
                recommendation: 'Use abstractions and interfaces for infrastructure access',
                violationCode: 'LS-002'
              });
            }
          }

          // Check for circular dependencies
          if (content.includes('import') && content.includes(layer.name)) {
            const imports = content.match(/import.*from ['"]([^'"]+)['"]/g) || [];
            imports.forEach(importStatement => {
              const importPath = importStatement.match(/['"]([^'"]+)['"]/)?.[1];
              if (importPath && importPath.includes(layer.name) && importPath !== file) {
                // This is a simplified check - more sophisticated analysis needed
                this.violations.push({
                  severity: 'medium',
                  type: 'Potential Circular Dependency',
                  description: `Potential circular dependency in ${layer.name} layer`,
                  location: file,
                  recommendation: 'Restructure imports to avoid circular dependencies',
                  violationCode: 'LS-003'
                });
              }
            });
          }
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('LS-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Layer Separation Validation Error',
        description: `Unable to validate layer separation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of layer architecture required'
      });
      return false;
    }
  }

  private async validateResponsibilitySegregation(): Promise<boolean> {
    console.log('🎯 Validating responsibility segregation...');

    try {
      // Define expected responsibilities for each actor
      const planningResponsibilities = [
        'analyze', 'plan', 'strategy', 'decision', 'requirement', 'objective'
      ];
      
      const executionResponsibilities = [
        'execute', 'implement', 'build', 'run', 'perform', 'operate'
      ];

      // Check all files for responsibility violations
      const allFiles = this.findFiles(['*.ts', '*.tsx']);
      
      for (const file of allFiles) {
        const content = readFileSync(file, 'utf-8');
        const fileName = file.toLowerCase();
        
        // Planning files should not have execution responsibilities
        if (fileName.includes('planning') || fileName.includes('plan')) {
          executionResponsibilities.forEach(responsibility => {
            const pattern = new RegExp(`\\b${responsibility}\\w*\\s*\\(`, 'gi');
            if (pattern.test(content)) {
              this.violations.push({
                severity: 'medium',
                type: 'Planning Actor Execution Responsibility',
                description: `Planning file contains execution responsibility: ${responsibility}`,
                location: file,
                recommendation: 'Move execution logic to Execution Actor',
                violationCode: 'RS-001'
              });
            }
          });
        }

        // Execution files should not have planning responsibilities
        if (fileName.includes('execution') || fileName.includes('execute')) {
          planningResponsibilities.forEach(responsibility => {
            const pattern = new RegExp(`\\b${responsibility}\\w*\\s*\\(`, 'gi');
            if (pattern.test(content)) {
              this.violations.push({
                severity: 'medium',
                type: 'Execution Actor Planning Responsibility',
                description: `Execution file contains planning responsibility: ${responsibility}`,
                location: file,
                recommendation: 'Move planning logic to Planning Actor',
                violationCode: 'RS-002'
              });
            }
          });
        }

        // Check for mixed responsibilities in single files
        const hasPlanningTerms = planningResponsibilities.some(term => 
          new RegExp(`\\b${term}`, 'i').test(content)
        );
        const hasExecutionTerms = executionResponsibilities.some(term => 
          new RegExp(`\\b${term}`, 'i').test(content)
        );

        if (hasPlanningTerms && hasExecutionTerms && content.length > 1000) {
          this.violations.push({
            severity: 'low',
            type: 'Mixed Responsibilities',
            description: 'File contains both planning and execution responsibilities',
            location: file,
            recommendation: 'Consider splitting file to better align with actor responsibilities',
            violationCode: 'RS-003'
          });
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('RS-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Responsibility Segregation Validation Error',
        description: `Unable to validate responsibility segregation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of responsibility distribution required'
      });
      return false;
    }
  }

  private async validateDataFlowCompliance(): Promise<boolean> {
    console.log('🌊 Validating data flow compliance...');

    try {
      // Check for proper data flow patterns
      const dataFlowFiles = this.findFiles([
        '*data*.ts',
        '*flow*.ts',
        '*stream*.ts',
        '*pipeline*.ts'
      ]);

      let hasDefinedDataFlow = false;

      for (const file of dataFlowFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for defined data flow
        if (content.includes('DataFlow') || content.includes('Pipeline') || content.includes('Stream')) {
          hasDefinedDataFlow = true;
        }

        // Check for data validation
        if (content.includes('validate') || content.includes('schema') || content.includes('type guard')) {
          // Data validation found
        }

        // Check for bidirectional data flow (potential issue)
        if (content.includes('bidirectional') || content.includes('circular')) {
          this.violations.push({
            severity: 'medium',
            type: 'Bidirectional Data Flow',
            description: 'Bidirectional data flow between actors may indicate coupling',
            location: file,
            recommendation: 'Prefer unidirectional data flow for better decoupling',
            violationCode: 'DF-001'
          });
        }

        // Check for data mutation between actors
        if (content.includes('mutate') || content.includes('modify')) {
          if (content.includes('shared') || content.includes('common')) {
            this.violations.push({
              severity: 'high',
              type: 'Shared Data Mutation',
              description: 'Shared data mutation between actors creates dependencies',
              location: file,
              recommendation: 'Use immutable data or message passing instead',
              violationCode: 'DF-002'
            });
          }
        }

        // Check for proper data transformation
        if (content.includes('transform') && !content.includes('validate')) {
          this.violations.push({
            severity: 'low',
            type: 'Unvalidated Data Transformation',
            description: 'Data transformation without validation',
            location: file,
            recommendation: 'Validate data before and after transformation',
            violationCode: 'DF-003'
          });
        }
      }

      if (!hasDefinedDataFlow) {
        this.violations.push({
          severity: 'medium',
          type: 'Missing Data Flow Definition',
          description: 'No clear data flow definition found',
          location: 'data layer',
          recommendation: 'Define clear data flow patterns between actors',
          violationCode: 'DF-004'
        });
      }

      return this.violations.filter(v => v.violationCode?.startsWith('DF-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Data Flow Validation Error',
        description: `Unable to validate data flow compliance: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of data flow patterns required'
      });
      return false;
    }
  }

  private async validateErrorIsolation(): Promise<boolean> {
    console.log('🚨 Validating error isolation...');

    try {
      // Check error handling and isolation patterns
      const errorFiles = this.findFiles([
        '*error*.ts',
        '*exception*.ts',
        '*boundary*.ts'
      ]);

      let hasErrorBoundaries = false;

      for (const file of errorFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for error boundaries
        if (content.includes('ErrorBoundary') || content.includes('catchError')) {
          hasErrorBoundaries = true;
        }

        // Check for actor-specific error handling
        if (content.includes('PlanningError') || content.includes('ExecutionError')) {
          // Actor error isolation found
        }

        // Check for global error handlers (potential issue)
        if (content.includes('global') && content.includes('error')) {
          this.violations.push({
            severity: 'medium',
            type: 'Global Error Handler',
            description: 'Global error handlers may break actor isolation',
            location: file,
            recommendation: 'Use actor-specific error handling',
            violationCode: 'EI-001'
          });
        }

        // Check for error propagation between actors
        if (content.includes('propagate') || content.includes('bubble')) {
          this.violations.push({
            severity: 'medium',
            type: 'Error Propagation Between Actors',
            description: 'Error propagation between actors may create coupling',
            location: file,
            recommendation: 'Isolate errors within actor boundaries',
            violationCode: 'EI-002'
          });
        }
      }

      // Check all actor files for proper error handling
      const actorFiles = this.findFiles(['*planning*.ts', '*execution*.ts']);
      
      for (const file of actorFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for try-catch blocks
        if (content.includes('async') && !content.includes('try') && !content.includes('catch')) {
          this.violations.push({
            severity: 'medium',
            type: 'Missing Error Handling',
            description: 'Async operations without proper error handling',
            location: file,
            recommendation: 'Implement comprehensive error handling',
            violationCode: 'EI-003'
          });
        }

        // Check for error logging without sensitive data
        if (content.includes('console.error') || content.includes('logger.error')) {
          if (content.includes('password') || content.includes('token') || content.includes('secret')) {
            this.violations.push({
              severity: 'high',
              type: 'Sensitive Data in Error Logs',
              description: 'Error logs may contain sensitive information',
              location: file,
              recommendation: 'Sanitize error logs to remove sensitive data',
              violationCode: 'EI-004'
            });
          }
        }
      }

      if (!hasErrorBoundaries) {
        this.violations.push({
          severity: 'medium',
          type: 'Missing Error Boundaries',
          description: 'No error boundaries found for actor isolation',
          location: 'error handling',
          recommendation: 'Implement error boundaries for each actor',
          violationCode: 'EI-005'
        });
      }

      return this.violations.filter(v => v.violationCode?.startsWith('EI-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'medium',
        type: 'Error Isolation Validation Error',
        description: `Unable to validate error isolation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual review of error handling required'
      });
      return false;
    }
  }

  private async validateRuntimeCompliance(): Promise<any> {
    console.log('⚡ Validating runtime compliance...');

    const memoryIsolation = await this.validateMemoryIsolation();
    const processIsolation = await this.validateProcessIsolation();
    const resourceSharing = await this.validateResourceSharing();
    const concurrencyManagement = await this.validateConcurrencyManagement();

    return {
      memoryIsolation,
      processIsolation,
      resourceSharing,
      concurrencyManagement
    };
  }

  private async validateMemoryIsolation(): Promise<boolean> {
    console.log('🧠 Validating memory isolation...');

    try {
      // Check for proper memory management patterns
      const allFiles = this.findFiles(['*.ts', '*.tsx']);
      
      for (const file of allFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for memory leaks
        if (content.includes('setInterval') && !content.includes('clearInterval')) {
          this.violations.push({
            severity: 'medium',
            type: 'Potential Memory Leak',
            description: 'setInterval without clearInterval may cause memory leaks',
            location: file,
            recommendation: 'Ensure all intervals are properly cleared',
            violationCode: 'MI-001'
          });
        }

        // Check for event listener leaks
        if (content.includes('addEventListener') && !content.includes('removeEventListener')) {
          this.violations.push({
            severity: 'medium',
            type: 'Event Listener Memory Leak',
            description: 'Event listeners without cleanup may cause memory leaks',
            location: file,
            recommendation: 'Remove event listeners when components unmount',
            violationCode: 'MI-002'
          });
        }

        // Check for shared memory structures
        if (content.includes('global.') || content.includes('window.')) {
          this.violations.push({
            severity: 'medium',
            type: 'Global Memory Usage',
            description: 'Global memory usage may break actor isolation',
            location: file,
            recommendation: 'Use actor-specific memory management',
            violationCode: 'MI-003'
          });
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('MI-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'low',
        type: 'Memory Isolation Validation Error',
        description: `Unable to validate memory isolation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual memory usage review recommended'
      });
      return false;
    }
  }

  private async validateProcessIsolation(): Promise<boolean> {
    console.log('🔒 Validating process isolation...');

    try {
      // Check for proper process boundaries
      const processFiles = this.findFiles(['*main*.ts', '*background*.ts', '*worker*.ts']);
      
      for (const file of processFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for shared process state
        if (content.includes('process.') && content.includes('shared')) {
          this.violations.push({
            severity: 'medium',
            type: 'Shared Process State',
            description: 'Shared process state may break isolation',
            location: file,
            recommendation: 'Use separate processes or proper isolation',
            violationCode: 'PI-001'
          });
        }

        // Check for worker thread usage
        if (content.includes('Worker') || content.includes('worker_threads')) {
          // This is good for isolation
          return true;
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('PI-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'low',
        type: 'Process Isolation Validation Error',
        description: `Unable to validate process isolation: ${error}`,
        location: 'validation process',
        recommendation: 'Manual process architecture review recommended'
      });
      return false;
    }
  }

  private async validateResourceSharing(): Promise<boolean> {
    console.log('🤝 Validating resource sharing...');

    try {
      // Check for proper resource sharing patterns
      const resourceFiles = this.findFiles(['*resource*.ts', '*pool*.ts', '*cache*.ts']);
      
      // Check for proper resource sharing patterns

      for (const file of resourceFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for resource pooling
        if (content.includes('pool') || content.includes('Pool')) {
          // Resource pooling found
        }

        // Check for resource conflicts
        if (content.includes('lock') || content.includes('mutex') || content.includes('semaphore')) {
          // Resource synchronization found
        } else if (content.includes('shared') && content.includes('resource')) {
          this.violations.push({
            severity: 'medium',
            type: 'Uncontrolled Resource Sharing',
            description: 'Shared resources without proper synchronization',
            location: file,
            recommendation: 'Implement proper resource locking and management',
            violationCode: 'RS-001'
          });
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('RS-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'low',
        type: 'Resource Sharing Validation Error',
        description: `Unable to validate resource sharing: ${error}`,
        location: 'validation process',
        recommendation: 'Manual resource management review recommended'
      });
      return false;
    }
  }

  private async validateConcurrencyManagement(): Promise<boolean> {
    console.log('⚡ Validating concurrency management...');

    try {
      // Check for proper concurrency patterns
      const allFiles = this.findFiles(['*.ts', '*.tsx']);
      
      // Check for proper concurrency patterns

      for (const file of allFiles) {
        const content = readFileSync(file, 'utf-8');
        
        // Check for race conditions
        if (content.includes('Promise.all') || content.includes('Promise.race')) {
          // Concurrency control found
        }

        // Check for async/await patterns
        if (content.includes('async') && content.includes('await')) {
          // Check for potential race conditions
          const asyncPatterns = content.match(/await\s+\w+/g) || [];
          if (asyncPatterns.length > 5 && !content.includes('queue') && !content.includes('semaphore')) {
            this.violations.push({
              severity: 'low',
              type: 'Potential Race Condition',
              description: 'Multiple async operations without synchronization',
              location: file,
              recommendation: 'Consider using queues or proper synchronization',
              violationCode: 'CM-001'
            });
          }
        }

        // Check for proper error handling in concurrent operations
        if (content.includes('Promise.all') && !content.includes('catch')) {
          this.violations.push({
            severity: 'medium',
            type: 'Unhandled Concurrent Errors',
            description: 'Concurrent operations without proper error handling',
            location: file,
            recommendation: 'Add proper error handling for concurrent operations',
            violationCode: 'CM-002'
          });
        }
      }

      return this.violations.filter(v => v.violationCode?.startsWith('CM-')).length === 0;

    } catch (error) {
      this.violations.push({
        severity: 'low',
        type: 'Concurrency Management Validation Error',
        description: `Unable to validate concurrency management: ${error}`,
        location: 'validation process',
        recommendation: 'Manual concurrency review recommended'
      });
      return false;
    }
  }

  private calculateComplianceScore(): number {
    const weights = {
      critical: 30,
      high: 20,
      medium: 10,
      low: 5
    };

    let deductions = 0;
    this.violations.forEach(violation => {
      deductions += weights[violation.severity];
    });

    // Generate recommendations based on violations
    this.generateRecommendations();

    return Math.max(0, 100 - deductions);
  }

  private generateRecommendations(): void {
    const violationTypes = [...new Set(this.violations.map(v => v.type))];
    
    if (violationTypes.includes('Planning Actor File System Access')) {
      this.recommendations.push('Implement strict Planning Actor boundaries - no direct file system access');
    }

    if (violationTypes.includes('Execution Actor Planning Logic')) {
      this.recommendations.push('Move all strategic decision-making to Planning Actor');
    }

    if (violationTypes.includes('Direct Actor Reference')) {
      this.recommendations.push('Replace direct actor references with message-based communication');
    }

    if (violationTypes.includes('Shared State Between Actors')) {
      this.recommendations.push('Eliminate shared state and implement proper context isolation');
    }

    if (violationTypes.includes('Missing Communication Protocol')) {
      this.recommendations.push('Define and implement formal communication protocols between actors');
    }

    // Add general recommendations
    this.recommendations.push('Regular Two-Actor Model compliance audits');
    this.recommendations.push('Automated boundary violation detection in CI/CD');
    this.recommendations.push('Actor-specific testing and validation');

    // Remove duplicates
    this.recommendations = [...new Set(this.recommendations)];
  }

  private findFiles(patterns: string[]): string[] {
    const files: string[] = [];
    
    patterns.forEach(pattern => {
      try {
        const result = execSync(`find . -name "${pattern}" | grep -v node_modules | grep -v dist`, { 
          encoding: 'utf-8' 
        });
        files.push(...result.split('\n').filter(Boolean));
      } catch (error) {
        // Pattern not found, continue
      }
    });

    return [...new Set(files)]; // Remove duplicates
  }

  async generateComplianceReport(result: TwoActorComplianceResult): Promise<void> {
    const reportPath = join(__dirname, '../../test-results/two-actor-compliance-report.md');
    
    // Ensure directory exists
    const dir = join(__dirname, '../../test-results');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    let report = `# Two-Actor Model Compliance Report\n\n`;
    report += `**SessionHub v2.10 - Architectural Integrity Validation**\n\n`;
    report += `**Date:** ${result.timestamp.toISOString()}\n`;
    report += `**Compliance Score:** ${result.score}/100\n`;
    report += `**Overall Status:** ${result.passed ? '✅ COMPLIANT' : '❌ NON-COMPLIANT'}\n`;
    report += `**Violations Found:** ${result.violations.length}\n\n`;

    // Executive Summary
    report += `## Executive Summary\n\n`;
    if (result.passed && result.score >= 90) {
      report += `✅ **EXCELLENT COMPLIANCE**: SessionHub demonstrates exceptional adherence to the Two-Actor Model with a compliance score of ${result.score}/100. `;
      report += `Architectural boundaries are well-maintained and the system is ready for production deployment.\n\n`;
    } else if (result.score >= 70) {
      report += `🟡 **GOOD COMPLIANCE**: SessionHub shows strong Two-Actor Model implementation with a score of ${result.score}/100. `;
      report += `Minor violations require attention but overall architecture is sound.\n\n`;
    } else {
      report += `🔴 **COMPLIANCE ISSUES**: SessionHub requires significant architectural improvements with a score of ${result.score}/100. `;
      report += `Critical violations must be addressed to maintain Two-Actor Model integrity.\n\n`;
    }

    // Boundary Integrity
    report += `## Boundary Integrity Assessment\n\n`;
    report += `| Component | Status | Description |\n`;
    report += `|-----------|--------|--------------|\n`;
    report += `| Planning Actor Isolation | ${result.boundaryIntegrity.planningActorIsolation ? '✅' : '❌'} | Proper separation of planning concerns |\n`;
    report += `| Execution Actor Isolation | ${result.boundaryIntegrity.executionActorIsolation ? '✅' : '❌'} | Proper separation of execution concerns |\n`;
    report += `| Communication Protocol | ${result.boundaryIntegrity.communicationProtocol ? '✅' : '❌'} | Defined actor communication interfaces |\n`;
    report += `| Context Separation | ${result.boundaryIntegrity.contextSeparation ? '✅' : '❌'} | Isolated actor contexts and state |\n`;

    // Architectural Compliance
    report += `\n## Architectural Compliance\n\n`;
    report += `| Component | Status | Description |\n`;
    report += `|-----------|--------|--------------|\n`;
    report += `| Layer Separation | ${result.architecturalCompliance.layerSeparation ? '✅' : '❌'} | Proper layered architecture |\n`;
    report += `| Responsibility Segregation | ${result.architecturalCompliance.responsibilitySegregation ? '✅' : '❌'} | Clear actor responsibilities |\n`;
    report += `| Data Flow Compliance | ${result.architecturalCompliance.dataFlowCompliance ? '✅' : '❌'} | Proper data flow patterns |\n`;
    report += `| Error Isolation | ${result.architecturalCompliance.errorIsolation ? '✅' : '❌'} | Actor-specific error handling |\n`;

    // Runtime Compliance
    report += `\n## Runtime Compliance\n\n`;
    report += `| Component | Status | Description |\n`;
    report += `|-----------|--------|--------------|\n`;
    report += `| Memory Isolation | ${result.runtimeCompliance.memoryIsolation ? '✅' : '❌'} | Proper memory management |\n`;
    report += `| Process Isolation | ${result.runtimeCompliance.processIsolation ? '✅' : '❌'} | Process boundary enforcement |\n`;
    report += `| Resource Sharing | ${result.runtimeCompliance.resourceSharing ? '✅' : '❌'} | Controlled resource access |\n`;
    report += `| Concurrency Management | ${result.runtimeCompliance.concurrencyManagement ? '✅' : '❌'} | Proper concurrent operations |\n`;

    // Detailed Violations
    if (result.violations.length > 0) {
      report += `\n## Detailed Violations\n\n`;
      
      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        const severityViolations = result.violations.filter(v => v.severity === severity);
        if (severityViolations.length > 0) {
          report += `### ${severity.toUpperCase()} Severity (${severityViolations.length})\n\n`;
          
          severityViolations.forEach((violation, index) => {
            report += `#### ${index + 1}. ${violation.type}\n`;
            report += `- **Location:** ${violation.location}\n`;
            report += `- **Description:** ${violation.description}\n`;
            report += `- **Recommendation:** ${violation.recommendation}\n`;
            if (violation.violationCode) {
              report += `- **Code:** ${violation.violationCode}\n`;
            }
            report += `\n`;
          });
        }
      });
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      report += `## Recommendations\n\n`;
      result.recommendations.forEach((rec, index) => {
        report += `${index + 1}. ${rec}\n`;
      });
      report += `\n`;
    }

    // Compliance Checklist
    report += `## Two-Actor Model Compliance Checklist\n\n`;
    const checklist = [
      { item: 'Planning Actor has no direct file system access', checked: !result.violations.some(v => v.violationCode === 'PA-001') },
      { item: 'Planning Actor has no system command execution', checked: !result.violations.some(v => v.violationCode === 'PA-002') },
      { item: 'Execution Actor has no planning logic', checked: !result.violations.some(v => v.violationCode === 'EA-001') },
      { item: 'Actors communicate through defined protocols', checked: !result.violations.some(v => v.violationCode === 'CP-001') },
      { item: 'Context separation is maintained', checked: !result.violations.some(v => v.violationCode === 'CS-001') },
      { item: 'Layer separation is enforced', checked: !result.violations.some(v => v.violationCode === 'LS-001') },
      { item: 'Responsibilities are properly segregated', checked: result.architecturalCompliance.responsibilitySegregation },
      { item: 'Error isolation is implemented', checked: result.architecturalCompliance.errorIsolation },
      { item: 'Memory isolation is maintained', checked: result.runtimeCompliance.memoryIsolation },
      { item: 'Resource sharing is controlled', checked: result.runtimeCompliance.resourceSharing }
    ];

    checklist.forEach(item => {
      report += `- [${item.checked ? 'x' : ' '}] ${item.item}\n`;
    });

    // Certification
    report += `\n## Two-Actor Model Certification\n\n`;
    if (result.passed && result.score >= 85) {
      report += `### ✅ CERTIFIED COMPLIANT\n\n`;
      report += `SessionHub is certified as compliant with the Two-Actor Model architecture.\n`;
      report += `The system maintains proper separation of concerns and is approved for production deployment.\n\n`;
      report += `**Certification Level:** FULL COMPLIANCE\n`;
      report += `**Valid Until:** ${new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} (6 months)\n`;
    } else {
      report += `### ❌ NON-COMPLIANT\n\n`;
      report += `SessionHub does not meet Two-Actor Model compliance standards.\n`;
      report += `Architectural violations must be addressed before production deployment.\n\n`;
      report += `**Required Actions:** Address all critical and high severity violations\n`;
      report += `**Re-evaluation Required:** After violation remediation\n`;
    }

    // Footer
    report += `\n---\n`;
    report += `*This report was generated by SessionHub Two-Actor Compliance Validator v2.10*\n`;
    report += `*Validation Framework: Comprehensive Architectural Boundary Analysis*\n`;

    writeFileSync(reportPath, report);
    console.log(`📄 Two-Actor compliance report generated: ${reportPath}`);
  }
}

export const twoActorComplianceValidator = new TwoActorComplianceValidator();