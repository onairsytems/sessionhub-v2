import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { OnboardingWizard } from '../../renderer/components/OnboardingWizard';
import { ServiceSetupWizard } from '../../renderer/components/ServiceSetupWizard';

// Mock electron APIs
const mockElectron = {
  store: {
    get: jest.fn(),
    set: jest.fn()
  },
  validateClaudeAPI: jest.fn(),
  validateSupabase: jest.fn(),
  detectInstalledIDEs: jest.fn(),
  checkIDEAvailability: jest.fn(),
  showNotification: jest.fn()
};

Object.defineProperty(window, 'electron', {
  value: mockElectron,
  writable: true
});

describe('OnboardingWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockElectron.store.get.mockResolvedValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('shows onboarding wizard when first run', async () => {
    mockElectron.store.get.mockResolvedValueOnce(false);
    
    render(<OnboardingWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('SessionHub Setup')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Welcome to SessionHub')).toBeInTheDocument();
  });

  test('does not show onboarding when already completed', async () => {
    mockElectron.store.get.mockResolvedValueOnce(true);
    
    const { container } = render(<OnboardingWizard />);
    
    await waitFor(() => {
      expect(container.firstChild).toBeNull();
    });
  });

  test('progresses through onboarding steps', async () => {
    mockElectron.store.get.mockResolvedValueOnce(false);
    
    render(<OnboardingWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to SessionHub')).toBeInTheDocument();
    });

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Experience Level')).toBeInTheDocument();
    });
  });

  test('allows user level selection', async () => {
    mockElectron.store.get.mockResolvedValueOnce(false);
    
    render(<OnboardingWizard />);
    
    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByText('New to AI Development')).toBeInTheDocument();
    });

    const beginnerOption = screen.getByText('New to AI Development');
    fireEvent.click(beginnerOption);

    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Service Selection')).toBeInTheDocument();
    });
  });

  test('allows service selection', async () => {
    mockElectron.store.get.mockResolvedValueOnce(false);
    
    render(<OnboardingWizard />);
    
    // Navigate to service selection
    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const beginnerOption = screen.getByText('New to AI Development');
      fireEvent.click(beginnerOption);
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(screen.getByText('Claude API')).toBeInTheDocument();
    });

    const claudeService = screen.getByText('Claude API');
    fireEvent.click(claudeService);

    expect(screen.getByText('Claude API')).toBeInTheDocument();
  });

  test('completes onboarding successfully', async () => {
    mockElectron.store.get.mockResolvedValueOnce(false);
    mockElectron.store.set.mockResolvedValue(true);
    mockElectron.showNotification.mockResolvedValue(true);
    
    render(<OnboardingWizard />);
    
    // Navigate through all steps quickly for completion test
    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const beginnerOption = screen.getByText('New to AI Development');
      fireEvent.click(beginnerOption);
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const nextButton = screen.getByText('Next');
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      const completeButton = screen.getByText('Complete Setup');
      fireEvent.click(completeButton);
    });

    await waitFor(() => {
      expect(mockElectron.store.set).toHaveBeenCalledWith('onboarding.completed', true);
    });
  });
});

describe('ServiceSetupWizard', () => {
  const mockProps = {
    service: 'claude',
    onNext: jest.fn(),
    onBack: jest.fn(),
    onSkip: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockElectron.store.get.mockResolvedValue(null);
  });

  test('renders Claude API setup wizard', async () => {
    render(<ServiceSetupWizard {...mockProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Claude API')).toBeInTheDocument();
    });
    
    expect(screen.getByText('API Key')).toBeInTheDocument();
    expect(screen.getByText('Preferred Model')).toBeInTheDocument();
  });

  test('validates Claude API configuration', async () => {
    mockElectron.validateClaudeAPI.mockResolvedValueOnce({
      valid: true,
      model: 'claude-3-5-sonnet-20241022'
    });

    render(<ServiceSetupWizard {...mockProps} />);
    
    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText('sk-ant-api03-...');
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-api03-test-key' } });
    });

    const modelSelect = screen.getByDisplayValue('');
    fireEvent.change(modelSelect, { target: { value: 'claude-3-5-sonnet-20241022' } });

    const configureButton = screen.getByText('Configure & Continue');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(mockElectron.validateClaudeAPI).toHaveBeenCalledWith(
        'sk-ant-api03-test-key',
        'claude-3-5-sonnet-20241022'
      );
    });
  });

  test('shows validation errors for invalid API key', async () => {
    mockElectron.validateClaudeAPI.mockResolvedValueOnce({
      valid: false,
      error: 'Invalid API key'
    });

    render(<ServiceSetupWizard {...mockProps} />);
    
    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText('sk-ant-api03-...');
      fireEvent.change(apiKeyInput, { target: { value: 'invalid-key' } });
    });

    const modelSelect = screen.getByDisplayValue('');
    fireEvent.change(modelSelect, { target: { value: 'claude-3-5-sonnet-20241022' } });

    const configureButton = screen.getByText('Configure & Continue');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid API key format')).toBeInTheDocument();
    });
  });

  test('renders Supabase setup wizard', async () => {
    const supabaseProps = { ...mockProps, service: 'supabase' };
    
    render(<ServiceSetupWizard {...supabaseProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('Supabase Database')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Project URL')).toBeInTheDocument();
    expect(screen.getByText('Anon Public Key')).toBeInTheDocument();
  });

  test('validates Supabase configuration', async () => {
    mockElectron.validateSupabase.mockResolvedValueOnce({
      valid: true,
      projectId: 'test-project'
    });

    const supabaseProps = { ...mockProps, service: 'supabase' };
    render(<ServiceSetupWizard {...supabaseProps} />);
    
    await waitFor(() => {
      const urlInput = screen.getByPlaceholderText('https://your-project.supabase.co');
      fireEvent.change(urlInput, { target: { value: 'https://test-project.supabase.co' } });
    });

    const keyInput = screen.getByPlaceholderText('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
    fireEvent.change(keyInput, { target: { value: 'test-anon-key' } });

    const configureButton = screen.getByText('Configure & Continue');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(mockElectron.validateSupabase).toHaveBeenCalledWith({
        url: 'https://test-project.supabase.co',
        anonKey: 'test-anon-key',
        serviceKey: ''
      });
    });
  });

  test('renders IDE integration wizard with auto-detection', async () => {
    mockElectron.detectInstalledIDEs.mockResolvedValueOnce([
      { id: 'vscode', name: 'Visual Studio Code', path: '/Applications/Visual Studio Code.app' }
    ]);

    const ideProps = { ...mockProps, service: 'ide' };
    render(<ServiceSetupWizard {...ideProps} />);
    
    await waitFor(() => {
      expect(screen.getByText('IDE Integration')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Found Visual Studio Code')).toBeInTheDocument();
    });
    
    expect(screen.getByText('Preferred IDE')).toBeInTheDocument();
    expect(screen.getByText('Auto-launch IDE')).toBeInTheDocument();
  });

  test('allows skipping service configuration', async () => {
    render(<ServiceSetupWizard {...mockProps} />);
    
    await waitFor(() => {
      const skipButton = screen.getByText('Skip for Now');
      fireEvent.click(skipButton);
    });

    expect(mockProps.onSkip).toHaveBeenCalled();
  });
});

describe('Onboarding Integration Tests', () => {
  test('full onboarding flow with service configuration', async () => {
    mockElectron.store.get.mockResolvedValueOnce(false);
    mockElectron.validateClaudeAPI.mockResolvedValue({ valid: true });
    mockElectron.store.set.mockResolvedValue(true);
    
    render(<OnboardingWizard />);
    
    // Welcome step
    await waitFor(() => {
      expect(screen.getByText('Welcome to SessionHub')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Next'));

    // User level step
    await waitFor(() => {
      fireEvent.click(screen.getByText('New to AI Development'));
    });
    
    fireEvent.click(screen.getByText('Next'));

    // Service selection step
    await waitFor(() => {
      fireEvent.click(screen.getByText('Claude API'));
    });
    
    fireEvent.click(screen.getByText('Next'));

    // Claude API setup
    await waitFor(() => {
      expect(screen.getByText('🤖')).toBeInTheDocument();
    });

    const apiKeyInput = screen.getByPlaceholderText('sk-ant-api03-...');
    fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-api03-test-key' } });

    const modelSelect = screen.getByDisplayValue('');
    fireEvent.change(modelSelect, { target: { value: 'claude-3-5-sonnet-20241022' } });

    fireEvent.click(screen.getByText('Configure & Continue'));

    // Should complete and save configuration
    await waitFor(() => {
      expect(mockElectron.store.set).toHaveBeenCalledWith('services.claude', {
        apiKey: 'sk-ant-api03-test-key',
        model: 'claude-3-5-sonnet-20241022'
      });
    });
  });
});

describe('Onboarding Error Handling', () => {
  test('handles network errors gracefully', async () => {
    mockElectron.store.get.mockRejectedValueOnce(new Error('Network error'));
    
    render(<OnboardingWizard />);
    
    await waitFor(() => {
      expect(screen.getByText('Welcome to SessionHub')).toBeInTheDocument();
    });
  });

  test('shows error messages for service validation failures', async () => {
    mockElectron.validateClaudeAPI.mockRejectedValueOnce(new Error('API error'));
    
    render(<ServiceSetupWizard {...{ service: 'claude', onNext: jest.fn(), onBack: jest.fn(), onSkip: jest.fn() }} />);
    
    await waitFor(() => {
      const apiKeyInput = screen.getByPlaceholderText('sk-ant-api03-...');
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-api03-test' } });
    });

    const configureButton = screen.getByText('Configure & Continue');
    fireEvent.click(configureButton);

    await waitFor(() => {
      expect(screen.getByText('Failed to validate API key')).toBeInTheDocument();
    });
  });
});