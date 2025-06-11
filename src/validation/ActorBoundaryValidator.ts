export interface APICall {
  endpoint: string;
  actor: string;
  payload: any;
}

export interface ContentValidation {
  actor: string;
  content: string;
  type: string;
}

export interface ContentViolation {
  reason: string;
}

export class ActorBoundaryValidator {
  async validateAPICall(apiCall: APICall): Promise<boolean> {
    // Planning actor can only use chat API
    if (apiCall.actor === 'planning' && apiCall.endpoint.includes('/chat')) {
      return true;
    }
    
    // Execution actor can only use code API
    if (apiCall.actor === 'execution' && apiCall.endpoint.includes('/code')) {
      return true;
    }
    
    return false;
  }

  async validateContent(content: ContentValidation): Promise<ContentViolation[]> {
    const violations: ContentViolation[] = [];
    
    // Check for execution keywords in planning output
    if (content.actor === 'planning') {
      const executionKeywords = ['execute', 'run', 'eval', 'exec'];
      if (executionKeywords.some(keyword => content.content.toLowerCase().includes(keyword))) {
        violations.push({ reason: 'Contains execution keyword' });
      }
    }
    
    // Check for planning keywords in execution output
    if (content.actor === 'execution') {
      const planningKeywords = ['strategy', 'recommend', 'analysis', 'suggest'];
      if (planningKeywords.some(keyword => content.content.toLowerCase().includes(keyword))) {
        violations.push({ reason: 'Contains planning keyword' });
      }
    }
    
    return violations;
  }
}