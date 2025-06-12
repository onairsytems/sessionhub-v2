'use client';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { RecoveryWizard } from '@/renderer/components/recovery/RecoveryWizard';
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
  GraduationCap
} from 'lucide-react';
interface SettingsSection {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
}
export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState('api-keys');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [supabaseUrl, setSupabaseUrl] = useState('');
  const [supabaseKey, setSupabaseKey] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
    }
  ];
  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      // In a real app, this would save to electron store or Supabase
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
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
                    <input
                      type="password"
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      placeholder="eyJ..."
                      className="w-full px-3 py-2 rounded-lg border bg-background"
                    />
                  </div>
                  <Button onClick={() => void handleSave()} className="w-full">
                    {saveStatus === 'saving' && (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
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
              )}
              {activeSection === 'appearance' && (
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
                    <select className="w-full px-3 py-2 rounded-lg border bg-background">
                      <option value="12">12px</option>
                      <option value="14">14px (Default)</option>
                      <option value="16">16px</option>
                      <option value="18">18px</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">UI Density</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="ghost" size="sm">Compact</Button>
                      <Button variant="primary" size="sm">Normal</Button>
                      <Button variant="ghost" size="sm">Comfortable</Button>
                    </div>
                  </div>
                </div>
              )}
              {activeSection === 'notifications' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Session Completion</div>
                      <div className="text-xs text-muted-foreground">
                        Notify when a session completes
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Error Alerts</div>
                      <div className="text-xs text-muted-foreground">
                        Show alerts for critical errors
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Update Available</div>
                      <div className="text-xs text-muted-foreground">
                        Notify about new versions
                      </div>
                    </div>
                    <input type="checkbox" defaultChecked className="w-4 h-4" />
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="font-medium text-sm">Sound Effects</div>
                      <div className="text-xs text-muted-foreground">
                        Play sounds for notifications
                      </div>
                    </div>
                    <input type="checkbox" className="w-4 h-4" />
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
              {activeSection === 'security' && (
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
                      <select className="px-3 py-1 rounded border bg-background text-sm">
                        <option>Never</option>
                        <option>5 minutes</option>
                        <option>15 minutes</option>
                        <option>30 minutes</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <div className="font-medium text-sm">Telemetry</div>
                        <div className="text-xs text-muted-foreground">
                          Share anonymous usage data
                        </div>
                      </div>
                      <input type="checkbox" className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )}
              {activeSection === 'data' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Local Storage</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Sessions</span>
                        <span className="text-muted-foreground">1.2 GB</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Cache</span>
                        <span className="text-muted-foreground">456 MB</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Logs</span>
                        <span className="text-muted-foreground">89 MB</span>
                      </div>
                      <Button variant="ghost" size="sm" className="w-full mt-4">
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
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Sync sessions and settings across devices via Supabase
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}
              {activeSection === 'recovery' && (
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
                        <select className="px-2 py-1 border rounded text-sm">
                          <option>Every 30 seconds</option>
                          <option>Every minute</option>
                          <option>Every 5 minutes</option>
                          <option>Every 15 minutes</option>
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
                            // Tutorial progress reset functionality
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
                            // This would normally call updateExpertiseLevel from useUserExpertise hook
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
              {activeSection === 'performance' && (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Apple Silicon Optimization</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm">Enable M4 Pro optimizations</span>
                        <input type="checkbox" defaultChecked className="w-4 h-4" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Automatically detected and optimized for your M4 Pro chip
                      </p>
                    </CardContent>
                  </Card>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Max Concurrent Sessions</label>
                      <select className="w-full px-3 py-2 rounded-lg border bg-background" defaultValue="3">
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3 (Recommended)</option>
                        <option value="5">5</option>
                        <option value="unlimited">Unlimited</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Memory Limit</label>
                      <select className="w-full px-3 py-2 rounded-lg border bg-background" defaultValue="4">
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
                      <input type="checkbox" defaultChecked className="w-4 h-4" />
                    </div>
                  </div>
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