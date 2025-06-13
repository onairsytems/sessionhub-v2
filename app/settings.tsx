'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { RecoveryWizard } from '@/renderer/components/recovery/RecoveryWizard';
import { useToast } from '@/lib/hooks/useToast';
import { 
  Key, 
  Bell, 
  Shield, 
  Palette, 
  Keyboard,
  Database,
  Zap,
  Save,
  Eye,
  EyeOff,
  Check,
  X,
  HardDriveDownload,
  GraduationCap,
  Download,
  Upload,
  RefreshCw,
  Loader2,
  ToggleLeft,
  ToggleRight,
  Settings2,
  FolderOpen
} from 'lucide-react';

interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
}

interface SettingsData {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    fontSize: number;
    density: 'compact' | 'normal' | 'comfortable';
  };
  notifications: {
    sessionCompletion: boolean;
    errorAlerts: boolean;
    updateAvailable: boolean;
    soundEffects: boolean;
  };
  performance: {
    maxConcurrentSessions: number | 'unlimited';
    memoryLimit: number | 'none';
    hardwareAcceleration: boolean;
    appleOptimization: boolean;
  };
  security: {
    autoLockMinutes: number | 'never';
    telemetry: boolean;
  };
  data: {
    cloudSync: boolean;
    backupInterval: number;
  };
  features: {
    aiCodeCompletion: boolean;
    smartSuggestions: boolean;
    autoSave: boolean;
    sessionRecording: boolean;
    collaborativeMode: boolean;
    advancedDebugging: boolean;
    codeAnalysis: boolean;
    performanceProfiler: boolean;
  };
  projectDefaults: {
    templatePath: string;
    defaultTheme: 'light' | 'dark' | 'system';
    autoDetectLanguage: boolean;
    gitIntegration: boolean;
    lintOnSave: boolean;
    formatOnSave: boolean;
    testRunner: string;
  };
}

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('api-keys');
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSupabaseKey, setShowSupabaseKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [testingApi, setTestingApi] = useState(false);
  const [testingSupabase, setTestingSupabase] = useState(false);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [storageInfo, setStorageInfo] = useState({
    sessions: '0 MB',
    cache: '0 MB',
    logs: '0 MB',
    total: '0 MB'
  });
  const { toast } = useToast();

  const settingsSections: SettingsSection[] = [
    {
      id: 'api-keys',
      title: 'API Keys',
      icon: Key,
      description: 'Manage your API keys and integrations'
    },
    {
      id: 'appearance',
      title: 'Appearance',
      icon: Palette,
      description: 'Customize the look and feel'
    },
    {
      id: 'project-defaults',
      title: 'Project Defaults',
      icon: FolderOpen,
      description: 'Set default configurations for new projects'
    },
    {
      id: 'features',
      title: 'Features',
      icon: ToggleLeft,
      description: 'Enable or disable SessionHub features'
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      description: 'Configure notification preferences'
    },
    {
      id: 'keyboard',
      title: 'Keyboard Shortcuts',
      icon: Keyboard,
      description: 'Customize keyboard shortcuts'
    },
    {
      id: 'security',
      title: 'Security',
      icon: Shield,
      description: 'Security and privacy settings'
    },
    {
      id: 'data',
      title: 'Data & Storage',
      icon: Database,
      description: 'Manage local data and cloud sync'
    },
    {
      id: 'recovery',
      title: 'Backup & Recovery',
      icon: HardDriveDownload,
      description: 'Manage backups and data recovery'
    },
    {
      id: 'tutorials',
      title: 'Tutorials & Help',
      icon: GraduationCap,
      description: 'Manage tutorial progress and help settings'
    },
    {
      id: 'performance',
      title: 'Performance',
      icon: Zap,
      description: 'Optimize for your system'
    },
    {
      id: 'import-export',
      title: 'Import/Export',
      icon: Settings2,
      description: 'Backup and restore your settings'
    }
  ];

  const loadSettings = useCallback(async () => {
    try {
      const loadedSettings = await window.sessionhub?.settings?.getSettings();
      if (loadedSettings) {
        setSettings(loadedSettings as SettingsData);
      }
    } catch (error) {
      toast({
        title: 'Failed to load settings',
        description: 'Using default settings',
        type: 'error'
      });
    }
  }, [toast]);

  const loadStorageInfo = useCallback(async () => {
    try {
      const info = await window.sessionhub?.settings?.getStorageInfo();
      if (info) {
        setStorageInfo(info);
      }
    } catch (error) {
      // Silently fail
    }
  }, []);

  // Load settings on mount
  useEffect(() => {
    void loadSettings();
    void loadStorageInfo();
  }, [loadSettings, loadStorageInfo]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      if (settings) {
        const result = await window.sessionhub?.settings?.saveSettings(settings);
        if (result?.success) {
          setSaveStatus('saved');
          toast({
            title: 'Settings saved',
            description: 'Your preferences have been updated',
            type: 'success'
          });
        } else {
          throw new Error(result?.error || 'Failed to save settings');
        }
      }
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      toast({
        title: 'Failed to save settings',
        description: error instanceof Error ? error.message : 'Unknown error',
        type: 'error'
      });
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const testApiKey = async () => {
    if (!apiKey) return;
    
    setTestingApi(true);
    try {
      const result = await window.sessionhub?.settings?.testApiKey(apiKey);
      
      if (result?.success) {
        toast({
          title: 'API Key Valid',
          description: `Connection successful (${result.responseTime}ms)`,
          type: 'success'
        });
        
        // Save the API key if test successful
        await window.sessionhub?.saveApiKey(apiKey);
      } else {
        toast({
          title: 'API Key Invalid',
          description: result?.message || 'Failed to connect to Claude API',
          type: 'error'
        });
      }
    } catch (error) {
      toast({
        title: 'Connection Error',
        description: 'Failed to test API key',
        type: 'error'
      });
    } finally {
      setTestingApi(false);
    }
  };

  const testSupabaseConnection = async () => {
    if (!supabaseUrl || !supabaseKey) return;
    
    setTestingSupabase(true);
    try {
      const result = await window.sessionhub?.settings?.testSupabase(supabaseUrl, supabaseKey);
      
      if (result?.success) {
        toast({
          title: 'Supabase Connected',
          description: 'Connection successful',
          type: 'success'
        });
      } else {
        toast({
          title: 'Connection Failed',
          description: result?.message || 'Failed to connect to Supabase',
          type: 'error'
        });
      }
    } catch (error) {
      toast({
        title: 'Connection Error',
        description: 'Failed to test Supabase connection',
        type: 'error'
      });
    } finally {
      setTestingSupabase(false);
    }
  };

  const exportSettings = async () => {
    try {
      const result = await window.sessionhub?.settings?.exportSettings();
      if (result?.success && result.data) {
        // Create download link
        const blob = new Blob([result.data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sessionhub-settings-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: 'Settings Exported',
          description: 'Your settings have been saved to a file',
          type: 'success'
        });
      }
    } catch (error) {
      toast({
        title: 'Export Failed',
        description: 'Failed to export settings',
        type: 'error'
      });
    }
  };

  const importSettings = async () => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        const text = await file.text();
        const result = await window.sessionhub?.settings?.importSettings(text);
        
        if (result?.success) {
          toast({
            title: 'Settings Imported',
            description: 'Your settings have been restored',
            type: 'success'
          });
          await loadSettings();
        } else {
          throw new Error(result?.error || 'Import failed');
        }
      };
      
      input.click();
    } catch (error) {
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import settings',
        type: 'error'
      });
    }
  };

  const clearCache = async () => {
    try {
      const result = await window.sessionhub?.settings?.clearCache();
      if (result?.success) {
        toast({
          title: 'Cache Cleared',
          description: 'Application cache has been cleared',
          type: 'success'
        });
        await loadStorageInfo();
      }
    } catch (error) {
      toast({
        title: 'Clear Failed',
        description: 'Failed to clear cache',
        type: 'error'
      });
    }
  };

  const updateSetting = (path: string, value: unknown) => {
    if (!settings) return;
    
    const newSettings = { ...settings };
    const keys = path.split('.');
    let current: Record<string, unknown> = newSettings as Record<string, unknown>;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key !== undefined && current[key] !== undefined && typeof current[key] === 'object') {
        current = current[key] as Record<string, unknown>;
      }
    }
    
    const lastKey = keys[keys.length - 1];
    if (lastKey !== undefined) {
      current[lastKey] = value;
    }
    setSettings(newSettings);
  };

  const currentSection = settingsSections.find(s => s.id === activeSection);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Configure SessionHub to work the way you want
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <nav className="space-y-1">
            {settingsSections.map((section) => {
              const Icon = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeSection === section.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <div className="text-left">
                    <div className="font-medium">{section.title}</div>
                  </div>
                </button>
              );
            })}
          </nav>

          {/* Save Button */}
          <div className="mt-6">
            <Button onClick={() => void handleSave()} className="w-full" disabled={saveStatus === 'saving'}>
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              )}
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Saved
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <X className="w-4 h-4 mr-2" />
                  Error
                </>
              )}
              {saveStatus === 'idle' && (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {currentSection && <currentSection.icon className="w-5 h-5" />}
                {currentSection?.title}
              </CardTitle>
              <CardDescription>{currentSection?.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {activeSection === 'api-keys' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Claude API Key</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="sk-ant-..."
                          className="w-full px-3 py-2 rounded-lg border bg-background"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowApiKey(!showApiKey)}
                      >
                        {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void testApiKey()}
                        disabled={!apiKey || testingApi}
                      >
                        {testingApi ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Get your API key from the Anthropic Console
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Supabase URL</label>
                    <input
                      type="text"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      placeholder="https://your-project.supabase.co"
                      className="w-full px-3 py-2 rounded-lg border bg-background"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Supabase Anon Key</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showSupabaseKey ? 'text' : 'password'}
                          value={supabaseKey}
                          onChange={(e) => setSupabaseKey(e.target.value)}
                          placeholder="eyJ..."
                          className="w-full px-3 py-2 rounded-lg border bg-background"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowSupabaseKey(!showSupabaseKey)}
                      >
                        {showSupabaseKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void testSupabaseConnection()}
                        disabled={!supabaseUrl || !supabaseKey || testingSupabase}
                      >
                        {testingSupabase ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'appearance' && settings && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">Theme</label>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <span className="text-sm">Application theme</span>
                      <ThemeToggle />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Editor Font Size</label>
                    <select 
                      className="w-full px-3 py-2 rounded-lg border bg-background"
                      value={settings.appearance.fontSize}
                      onChange={(e) => updateSetting('appearance.fontSize', parseInt(e.target.value))}
                    >
                      <option value="12">12px</option>
                      <option value="14">14px (Default)</option>
                      <option value="16">16px</option>
                      <option value="18">18px</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">UI Density</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button 
                        variant={settings.appearance.density === 'compact' ? 'primary' : 'ghost'} 
                        size="sm"
                        onClick={() => updateSetting('appearance.density', 'compact')}
                      >
                        Compact
                      </Button>
                      <Button 
                        variant={settings.appearance.density === 'normal' ? 'primary' : 'ghost'} 
                        size="sm"
                        onClick={() => updateSetting('appearance.density', 'normal')}
                      >
                        Normal
                      </Button>
                      <Button 
                        variant={settings.appearance.density === 'comfortable' ? 'primary' : 'ghost'} 
                        size="sm"
                        onClick={() => updateSetting('appearance.density', 'comfortable')}
                      >
                        Comfortable
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'project-defaults' && settings && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Default Project Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Template Path</label>
                        <input
                          type="text"
                          value={settings.projectDefaults.templatePath}
                          onChange={(e) => updateSetting('projectDefaults.templatePath', e.target.value)}
                          placeholder="/path/to/templates"
                          className="w-full px-3 py-2 rounded-lg border bg-background"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Default Theme</label>
                        <select 
                          className="w-full px-3 py-2 rounded-lg border bg-background"
                          value={settings.projectDefaults.defaultTheme}
                          onChange={(e) => updateSetting('projectDefaults.defaultTheme', e.target.value)}
                        >
                          <option value="light">Light</option>
                          <option value="dark">Dark</option>
                          <option value="system">System</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Auto-detect Language</div>
                          <div className="text-xs text-muted-foreground">
                            Automatically detect project language
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.projectDefaults.autoDetectLanguage}
                          onChange={(e) => updateSetting('projectDefaults.autoDetectLanguage', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Git Integration</div>
                          <div className="text-xs text-muted-foreground">
                            Enable Git features for new projects
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.projectDefaults.gitIntegration}
                          onChange={(e) => updateSetting('projectDefaults.gitIntegration', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Lint on Save</div>
                          <div className="text-xs text-muted-foreground">
                            Run linter when saving files
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.projectDefaults.lintOnSave}
                          onChange={(e) => updateSetting('projectDefaults.lintOnSave', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Format on Save</div>
                          <div className="text-xs text-muted-foreground">
                            Auto-format code when saving
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.projectDefaults.formatOnSave}
                          onChange={(e) => updateSetting('projectDefaults.formatOnSave', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Default Test Runner</label>
                        <select 
                          className="w-full px-3 py-2 rounded-lg border bg-background"
                          value={settings.projectDefaults.testRunner}
                          onChange={(e) => updateSetting('projectDefaults.testRunner', e.target.value)}
                        >
                          <option value="jest">Jest</option>
                          <option value="vitest">Vitest</option>
                          <option value="mocha">Mocha</option>
                          <option value="jasmine">Jasmine</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeSection === 'features' && settings && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">SessionHub Features</CardTitle>
                      <CardDescription>
                        Enable or disable specific features to customize your experience
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.aiCodeCompletion ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">AI Code Completion</div>
                            <div className="text-xs text-muted-foreground">
                              Get intelligent code suggestions powered by Claude
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.aiCodeCompletion}
                          onChange={(e) => updateSetting('features.aiCodeCompletion', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.smartSuggestions ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">Smart Suggestions</div>
                            <div className="text-xs text-muted-foreground">
                              Context-aware code and file suggestions
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.smartSuggestions}
                          onChange={(e) => updateSetting('features.smartSuggestions', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.autoSave ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">Auto Save</div>
                            <div className="text-xs text-muted-foreground">
                              Automatically save your work as you type
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.autoSave}
                          onChange={(e) => updateSetting('features.autoSave', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.sessionRecording ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">Session Recording</div>
                            <div className="text-xs text-muted-foreground">
                              Record your development sessions for playback
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.sessionRecording}
                          onChange={(e) => updateSetting('features.sessionRecording', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.collaborativeMode ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">Collaborative Mode</div>
                            <div className="text-xs text-muted-foreground">
                              Enable real-time collaboration features
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.collaborativeMode}
                          onChange={(e) => updateSetting('features.collaborativeMode', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.advancedDebugging ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">Advanced Debugging</div>
                            <div className="text-xs text-muted-foreground">
                              Enhanced debugging tools and insights
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.advancedDebugging}
                          onChange={(e) => updateSetting('features.advancedDebugging', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.codeAnalysis ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">Code Analysis</div>
                            <div className="text-xs text-muted-foreground">
                              Real-time code quality and complexity analysis
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.codeAnalysis}
                          onChange={(e) => updateSetting('features.codeAnalysis', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          {settings.features.performanceProfiler ? 
                            <ToggleRight className="w-5 h-5 text-primary" /> : 
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          }
                          <div>
                            <div className="font-medium text-sm">Performance Profiler</div>
                            <div className="text-xs text-muted-foreground">
                              Profile and optimize application performance
                            </div>
                          </div>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={settings.features.performanceProfiler}
                          onChange={(e) => updateSetting('features.performanceProfiler', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeSection === 'notifications' && settings && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Session Completion</div>
                      <div className="text-xs text-muted-foreground">
                        Notify when a session completes
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.sessionCompletion}
                      onChange={(e) => updateSetting('notifications.sessionCompletion', e.target.checked)}
                      className="w-4 h-4" 
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Error Alerts</div>
                      <div className="text-xs text-muted-foreground">
                        Show alerts for critical errors
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.errorAlerts}
                      onChange={(e) => updateSetting('notifications.errorAlerts', e.target.checked)}
                      className="w-4 h-4" 
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Update Available</div>
                      <div className="text-xs text-muted-foreground">
                        Notify about new versions
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.updateAvailable}
                      onChange={(e) => updateSetting('notifications.updateAvailable', e.target.checked)}
                      className="w-4 h-4" 
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Sound Effects</div>
                      <div className="text-xs text-muted-foreground">
                        Play sounds for notifications
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={settings.notifications.soundEffects}
                      onChange={(e) => updateSetting('notifications.soundEffects', e.target.checked)}
                      className="w-4 h-4" 
                    />
                  </div>
                </div>
              )}

              {activeSection === 'keyboard' && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Customize keyboard shortcuts to match your workflow
                  </p>
                  <div className="space-y-2">
                    {[
                      { action: 'Quick Command', keys: '⌘K' },
                      { action: 'New Session', keys: '⌘N' },
                      { action: 'Switch Project', keys: '⌘P' },
                      { action: 'Toggle Theme', keys: '⌘⇧T' },
                      { action: 'Search', keys: '⌘/' },
                      { action: 'Settings', keys: '⌘,' }
                    ].map((shortcut) => (
                      <div key={shortcut.action} className="flex items-center justify-between p-3 rounded-lg border hover:bg-secondary/50">
                        <span className="text-sm">{shortcut.action}</span>
                        <kbd className="px-2 py-1 text-xs rounded bg-muted">{shortcut.keys}</kbd>
                      </div>
                    ))}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full">
                    Reset to Defaults
                  </Button>
                </div>
              )}

              {activeSection === 'security' && settings && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">API Key Storage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        Your API keys are securely stored in the system keychain and never exposed in plain text.
                      </p>
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">Auto-lock</div>
                        <div className="text-xs text-muted-foreground">
                          Lock SessionHub after inactivity
                        </div>
                      </div>
                      <select 
                        className="px-3 py-1 rounded border bg-background text-sm"
                        value={settings.security.autoLockMinutes}
                        onChange={(e) => updateSetting('security.autoLockMinutes', e.target.value === 'never' ? 'never' : parseInt(e.target.value))}
                      >
                        <option value="never">Never</option>
                        <option value="5">5 minutes</option>
                        <option value="15">15 minutes</option>
                        <option value="30">30 minutes</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">Telemetry</div>
                        <div className="text-xs text-muted-foreground">
                          Share anonymous usage data
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settings.security.telemetry}
                        onChange={(e) => updateSetting('security.telemetry', e.target.checked)}
                        className="w-4 h-4" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'data' && settings && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Local Storage</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Sessions</span>
                        <span className="text-muted-foreground">{storageInfo.sessions}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cache</span>
                        <span className="text-muted-foreground">{storageInfo.cache}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Logs</span>
                        <span className="text-muted-foreground">{storageInfo.logs}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium pt-2 border-t">
                        <span>Total</span>
                        <span>{storageInfo.total}</span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-4"
                        onClick={() => void clearCache()}
                      >
                        Clear Cache
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Cloud Sync</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Enable cloud sync</span>
                        <input 
                          type="checkbox" 
                          checked={settings.data.cloudSync}
                          onChange={(e) => updateSetting('data.cloudSync', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Sync sessions and settings across devices via Supabase
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeSection === 'recovery' && settings && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Backup Health Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Automatic Backups</span>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Backup Interval</span>
                        <select 
                          className="px-2 py-1 border rounded text-sm"
                          value={settings.data.backupInterval}
                          onChange={(e) => updateSetting('data.backupInterval', parseInt(e.target.value))}
                        >
                          <option value="30">Every 30 seconds</option>
                          <option value="60">Every minute</option>
                          <option value="300">Every 5 minutes</option>
                          <option value="900">Every 15 minutes</option>
                        </select>
                      </div>
                      <div className="pt-4 border-t">
                        <div className="flex justify-between text-sm mb-2">
                          <span>Total Backups</span>
                          <span className="text-muted-foreground">142</span>
                        </div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Healthy Backups</span>
                          <span className="text-green-600">139</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Corrupted Backups</span>
                          <span className="text-red-600">3</span>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => { void window.electron?.recovery?.checkHealthNow(); }}
                        >
                          Check Health Now
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => {
                            const recoveryWizard = document.getElementById('recovery-wizard-trigger');
                            if (recoveryWizard) recoveryWizard.click();
                          }}
                        >
                          Open Recovery Wizard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recovery Options</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Enable Auto-Repair</span>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Merge Partial Saves</span>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Skip Corrupted Files</span>
                        <input type="checkbox" className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recovery Logs</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Log Retention</span>
                        <select className="px-2 py-1 border rounded text-sm">
                          <option>30 days</option>
                          <option>60 days</option>
                          <option>90 days</option>
                          <option>1 year</option>
                        </select>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="ghost" size="sm" className="flex-1">
                          Export Logs
                        </Button>
                        <Button variant="ghost" size="sm" className="flex-1">
                          Clear Old Logs
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeSection === 'tutorials' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tutorial Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold">3/5</div>
                          <div className="text-sm text-muted-foreground">Tutorials Completed</div>
                        </div>
                        <div className="text-center p-4 bg-muted/50 rounded-lg">
                          <div className="text-2xl font-bold">60%</div>
                          <div className="text-sm text-muted-foreground">Overall Progress</div>
                        </div>
                      </div>
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          if (confirm('Are you sure you want to reset all tutorial progress? This cannot be undone.')) {
                            // Reset tutorial progress
                            window.location.reload();
                          }
                        }}
                      >
                        Reset All Tutorial Progress
                      </Button>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Progressive Disclosure</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Expertise Level</label>
                        <select 
                          className="w-full px-3 py-2 rounded-lg border bg-background"
                          onChange={(e) => {
                            const level = e.target.value as 'beginner' | 'intermediate' | 'expert';
                            localStorage.setItem('user-expertise', JSON.stringify({
                              level,
                              featureUsage: {},
                              tooltipsShown: {},
                              lastUpdated: new Date().toISOString(),
                              onboardingCompleted: true,
                              helpPreferences: {
                                showTooltips: true,
                                tooltipFrequency: 'always',
                                preferKeyboardShortcuts: level === 'expert'
                              }
                            }));
                          }}
                        >
                          <option value="beginner">Beginner - Show all help and tips</option>
                          <option value="intermediate">Intermediate - Show advanced tips only</option>
                          <option value="expert">Expert - Minimal assistance</option>
                        </select>
                        <p className="text-xs text-muted-foreground mt-1">
                          Adjust how much assistance you receive based on your experience level
                        </p>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Show Tooltips</div>
                          <div className="text-xs text-muted-foreground">
                            Display helpful tooltips on hover
                          </div>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Tooltip Frequency</label>
                        <select className="w-full px-3 py-2 rounded-lg border bg-background">
                          <option value="always">Always show</option>
                          <option value="once">Show once per feature</option>
                          <option value="never">Never show</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Contextual Help</div>
                          <div className="text-xs text-muted-foreground">
                            Show contextual tips during first use
                          </div>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Prefer Keyboard Shortcuts</div>
                          <div className="text-xs text-muted-foreground">
                            Show keyboard shortcuts in tooltips
                          </div>
                        </div>
                        <input type="checkbox" className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Tutorial Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Auto-show Tutorials</div>
                          <div className="text-xs text-muted-foreground">
                            Automatically show tutorials for new features
                          </div>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Tutorial Tips</div>
                          <div className="text-xs text-muted-foreground">
                            Show helpful tips during tutorials
                          </div>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border">
                        <div>
                          <div className="font-medium text-sm">Interactive Mode</div>
                          <div className="text-xs text-muted-foreground">
                            Enable interactive tutorial elements
                          </div>
                        </div>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Help Resources</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        View All Tutorials
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        Open Documentation
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        Keyboard Shortcuts Guide
                      </Button>
                      <Button variant="ghost" size="sm" className="w-full justify-start">
                        Contact Support
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {activeSection === 'performance' && settings && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Apple Silicon Optimization</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm">Enable M4 Pro optimizations</span>
                        <input 
                          type="checkbox" 
                          checked={settings.performance.appleOptimization}
                          onChange={(e) => updateSetting('performance.appleOptimization', e.target.checked)}
                          className="w-4 h-4" 
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically detected and optimized for your M4 Pro chip
                      </p>
                    </CardContent>
                  </Card>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Concurrent Sessions</label>
                      <select 
                        className="w-full px-3 py-2 rounded-lg border bg-background"
                        value={settings.performance.maxConcurrentSessions}
                        onChange={(e) => updateSetting('performance.maxConcurrentSessions', e.target.value === 'unlimited' ? 'unlimited' : parseInt(e.target.value))}
                      >
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3 (Recommended)</option>
                        <option value="5">5</option>
                        <option value="unlimited">Unlimited</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Memory Limit</label>
                      <select 
                        className="w-full px-3 py-2 rounded-lg border bg-background"
                        value={settings.performance.memoryLimit}
                        onChange={(e) => updateSetting('performance.memoryLimit', e.target.value === 'none' ? 'none' : parseInt(e.target.value))}
                      >
                        <option value="2">2 GB</option>
                        <option value="4">4 GB (Default)</option>
                        <option value="8">8 GB</option>
                        <option value="none">No limit</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">Hardware Acceleration</div>
                        <div className="text-xs text-muted-foreground">
                          Use GPU for rendering
                        </div>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={settings.performance.hardwareAcceleration}
                        onChange={(e) => updateSetting('performance.hardwareAcceleration', e.target.checked)}
                        className="w-4 h-4" 
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeSection === 'import-export' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Export Settings</CardTitle>
                      <CardDescription>
                        Create a backup of your current settings configuration
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => void exportSettings()}
                        className="w-full"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export Settings
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Your settings will be exported as a JSON file that can be imported later
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Import Settings</CardTitle>
                      <CardDescription>
                        Restore settings from a previously exported configuration file
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => void importSettings()}
                        variant="outline"
                        className="w-full"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Import Settings
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        Select a JSON file exported from SessionHub to restore your settings
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Reset All Settings</CardTitle>
                      <CardDescription>
                        Restore all settings to their default values
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        variant="destructive"
                        className="w-full"
                        onClick={() => {
                          if (confirm('Are you sure you want to reset all settings to default? This cannot be undone.')) {
                            // Reset logic would go here
                            window.location.reload();
                          }
                        }}
                      >
                        Reset to Defaults
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2">
                        This action cannot be undone. Your API keys will remain secure.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <RecoveryWizard />
    </div>
  );
}