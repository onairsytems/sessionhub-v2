export interface MergeResult {
  success: boolean;
  hasConflicts: boolean;
  conflicts: string[];
}

export class GitVersioningService {
  async createBranch(_branchName: string, _projectPath: string): Promise<void> {
    // Mock implementation
  }

  async switchBranch(_branchName: string, _projectPath: string): Promise<void> {
    // Mock implementation
  }

  async commit(_message: string, _projectPath: string): Promise<void> {
    // Mock implementation
  }

  async mergeBranch(branchName: string, _projectPath: string): Promise<MergeResult> {
    if (branchName === 'main') {
      return {
        success: false,
        hasConflicts: true,
        conflicts: ['auth.js']
      };
    }
    return {
      success: true,
      hasConflicts: false,
      conflicts: []
    };
  }

  async completeMerge(_projectPath: string): Promise<MergeResult> {
    return {
      success: true,
      hasConflicts: false,
      conflicts: []
    };
  }
}