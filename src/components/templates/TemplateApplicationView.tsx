/**
 * @actor user
 * @responsibility Template application interface for rapid project setup
 */

import React, { useState, useEffect } from 'react';
import { 
  ProjectTemplate,
  ProjectTemplateSystem,
  ProjectSetupOptions,
  ProjectSetupResult,
  CustomizableOption
} from '@/src/services/templates/ProjectTemplateSystem';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
// import { Label } from '@/components/ui/label';
// Removed unused Select imports
// import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FolderPlus,
  Rocket,
  Clock,
  Star,
  GitBranch,
  Package,
  Terminal,
  AlertCircle,
  CheckCircle,
  Loader2,
  Code,
  Layers
} from 'lucide-react';
import { useToast } from '@/lib/hooks/useToast';

interface TemplateApplicationViewProps {
  templateSystem: ProjectTemplateSystem;
  selectedTemplate?: ProjectTemplate;
  onProjectCreated?: (projectPath: string) => void;
  onCancel?: () => void;
}

export const TemplateApplicationView: React.FC<TemplateApplicationViewProps> = ({
  templateSystem,
  selectedTemplate,
  onProjectCreated,
  onCancel
}) => {
  const { toast } = useToast();
  const [template, setTemplate] = useState<ProjectTemplate | null>(selectedTemplate || null);
  const [projectName, setProjectName] = useState('');
  const [projectPath, setProjectPath] = useState('');
  const [customizations, setCustomizations] = useState<Record<string, any>>({});
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupProgress, setSetupProgress] = useState(0);
  const [setupResult, setSetupResult] = useState<ProjectSetupResult | null>(null);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if (selectedTemplate) {
      setTemplate(selectedTemplate);
      initializeCustomizations(selectedTemplate);
    }
  }, [selectedTemplate]);

  const initializeCustomizations = (tmpl: ProjectTemplate) => {
    const defaults: Record<string, any> = {};
    for (const option of tmpl.customizableOptions) {
      defaults[option.id] = option.defaultValue;
    }
    setCustomizations(defaults);
  };

  const handleProjectNameChange = (name: string) => {
    setProjectName(name);
    if (name) {
      const defaultPath = `/Users/jonathanhoggard/Development/${name.toLowerCase().replace(/\s+/g, '-')}`;
      setProjectPath(defaultPath);
    }
  };

  const handleCustomizationChange = (optionId: string, value: any) => {
    setCustomizations(prev => ({
      ...prev,
      [optionId]: value
    }));
  };

  const handleSetupProject = async () => {
    if (!template || !projectName || !projectPath) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields'
      });
      return;
    }

    setIsSettingUp(true);
    setSetupProgress(0);
    setSetupResult(null);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setSetupProgress(prev => Math.min(prev + 10, 90));
      }, 500);

      const options: ProjectSetupOptions = {
        templateId: template.id,
        projectName,
        projectPath,
        customizations,
        skipDependencies: customizations['skipDependencies'] || false,
        skipGitInit: customizations['skipGitInit'] || false,
        openInEditor: customizations['openInEditor'] || false
      };

      const result = await templateSystem.setupProject(options);
      
      clearInterval(progressInterval);
      setSetupProgress(100);
      setSetupResult(result);

      if (result.success) {
        toast({
          title: 'Project Created Successfully',
        });
        
        if (onProjectCreated) {
          setTimeout(() => {
            onProjectCreated(result.projectPath);
          }, 1500);
        }
      } else {
        toast({
          title: 'Setup Failed',
        });
      }
    } catch (error) {
      toast({
        title: 'Setup Error',
        description: (error as Error).message,
      });
    } finally {
      setIsSettingUp(false);
    }
  };

  const renderCustomizationControl = (option: CustomizableOption) => {
    const value = customizations[option.id];

    switch (option.type) {
      case 'boolean':
        return (
          <div className="flex items-center justify-between space-x-2">
            <div className="space-y-0.5">
              <label htmlFor={option.id}>{option.name}</label>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
            <input type="checkbox"
              id={option.id}
              checked={value}
              onChange={(e) => handleCustomizationChange(option.id, e.target.checked)}
              disabled={isSettingUp}
             />
          </div>
        );

      case 'select':
        return (
          <div className="space-y-2">
            <label htmlFor={option.id}>{option.name}</label>
            <select
              value={value}
              onChange={(e) => handleCustomizationChange(option.id, e.target.value)}
              disabled={isSettingUp}
              className="w-full px-3 py-2 border rounded-md"
            >
              {option.options?.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <p className="text-sm text-muted-foreground">{option.description}</p>
          </div>
        );

      case 'string':
        return (
          <div className="space-y-2">
            <label htmlFor={option.id}>{option.name}</label>
            <Input
              id={option.id}
              value={value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleCustomizationChange(option.id, e.target.value)}
              disabled={isSettingUp}
             />
            <p className="text-sm text-muted-foreground">{option.description}</p>
          </div>
        );

      default:
        return null;
    }
  };

  if (!template) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No template selected</p>
      </div>
    );
  }

  if (setupResult) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {setupResult.success ? (
              <>
                <CheckCircle className="w-6 h-6 text-green-500"  />
                Project Created Successfully
              </>
            ) : (
              <>
                <AlertCircle className="w-6 h-6 text-red-500"  />
                Setup Failed
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {setupResult.success ? (
            <>
              <div className="space-y-2">
                <p className="text-sm font-medium">Project Location:</p>
                <code className="block p-2 bg-muted rounded text-sm">{setupResult.projectPath}</code>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">Files Created:</p>
                <div className="max-h-32 overflow-y-auto">
                  {setupResult.filesCreated.map((file, index) => (
                    <div key={index} className="text-sm text-muted-foreground">
                      • {file}
                    </div>
                  ))}
                </div>
              </div>

              {setupResult.nextSteps.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Next Steps:</p>
                  <div className="space-y-1">
                    {setupResult.nextSteps.map((step, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <span className="text-sm text-muted-foreground">{index + 1}.</span>
                        <code className="text-sm">{step}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4"  />
                Setup completed in {(setupResult.setupDuration / 1000).toFixed(1)}s
              </div>
            </>
          ) : (
            <>
              {setupResult.errors.map((error, index) => (
                <Alert key={index} variant="destructive">
                  <AlertCircle className="h-4 w-4"  />
                  <strong>Error</strong>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ))}
              
              {setupResult.warnings.map((warning, index) => (
                <Alert key={index}>
                  <AlertCircle className="h-4 w-4"  />
                  <strong>Warning</strong>
                  <AlertDescription>{warning}</AlertDescription>
                </Alert>
              ))}
            </>
          )}
        </CardContent>
        <CardFooter>
          <Button
            onClick={() => {
              setSetupResult(null);
              setProjectName('');
              setProjectPath('');
              initializeCustomizations(template);
            }}
            variant="outline"
            className="w-full"
          >
            Create Another Project
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-2xl">{template.name}</CardTitle>
            <CardDescription>{template.description}</CardDescription>
          </div>
          <Badge variant="secondary">
            <Clock className="w-3 h-3 mr-1"  />
            ~{Math.round(template.estimatedSetupTime / 60000)}min
          </Badge>
        </div>
        <div className="flex gap-2 mt-4">
          <Badge variant="outline">{template.framework}</Badge>
          <Badge variant="outline">{template.language}</Badge>
          <Badge variant="outline">
            <Star className="w-3 h-3 mr-1"  />
            {template.metadata.userRating.toFixed(1)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {isSettingUp ? (
          <div className="space-y-4 py-8">
            <div className="text-center space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto"  />
              <p className="text-sm font-medium">Setting up your project...</p>
              <p className="text-sm text-muted-foreground">This may take a few minutes</p>
            </div>
            <Progress value={setupProgress} className="w-full"  />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Setup</TabsTrigger>
              <TabsTrigger value="customize">Customize</TabsTrigger>
              <TabsTrigger value="features">Features</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4 mt-6">
              <div className="space-y-2">
                <label htmlFor="projectName">Project Name</label>
                <Input
                  id="projectName"
                  placeholder="my-awesome-project"
                  value={projectName}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleProjectNameChange(e.target.value)}
                  disabled={isSettingUp}
                 />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="projectPath">Project Location</label>
                <div className="flex gap-2">
                  <Input
                    id="projectPath"
                    placeholder="/path/to/project"
                    value={projectPath}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectPath(e.target.value)}
                    disabled={isSettingUp}
                    className="flex-1"
                   />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // Would open file picker in Electron
                      toast({
                        title: 'Select Directory',
                        description: 'File picker would open here',
                      });
                    }}
                    disabled={isSettingUp}
                  >
                    <FolderPlus className="w-4 h-4"  />
                  </Button>
                </div>
              </div>
              
              <div className="space-y-4 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="skipDeps">Skip Dependencies</label>
                    <p className="text-sm text-muted-foreground">
                      Install dependencies manually later
                    </p>
                  </div>
                  <input type="checkbox"
                    id="skipDeps"
                    checked={customizations['skipDependencies'] || false}
                    onChange={(e) => 
                      handleCustomizationChange('skipDependencies', e.target.checked)
                    }
                    disabled={isSettingUp}
                   />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="skipGit">Skip Git Init</label>
                    <p className="text-sm text-muted-foreground">
                      Don't initialize a Git repository
                    </p>
                  </div>
                  <input type="checkbox"
                    id="skipGit"
                    checked={customizations['skipGitInit'] || false}
                    onChange={(e) => 
                      handleCustomizationChange('skipGitInit', e.target.checked)
                    }
                    disabled={isSettingUp}
                   />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <label htmlFor="openEditor">Open in Editor</label>
                    <p className="text-sm text-muted-foreground">
                      Open project in default editor after setup
                    </p>
                  </div>
                  <input type="checkbox"
                    id="openEditor"
                    checked={customizations['openInEditor'] || false}
                    onChange={(e) => 
                      handleCustomizationChange('openInEditor', e.target.checked)
                    }
                    disabled={isSettingUp}
                   />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="customize" className="space-y-4 mt-6">
              {template.customizableOptions.length > 0 ? (
                template.customizableOptions.map((option) => (
                  <div key={option.id}>
                    {renderCustomizationControl(option)}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No customization options available for this template
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="features" className="space-y-4 mt-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Code className="w-4 h-4"  />
                    Technologies
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {template.features.map((feature, index) => (
                      <Badge key={index} variant="secondary">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Terminal className="w-4 h-4"  />
                    Scripts
                  </h4>
                  <div className="space-y-1">
                    {Object.entries(template.scripts).map(([script, command]) => (
                      <div key={script} className="flex items-center justify-between text-sm">
                        <code className="text-muted-foreground">npm run {script}</code>
                        <code className="text-xs bg-muted px-2 py-1 rounded">{command}</code>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <Layers className="w-4 h-4"  />
                    Project Structure
                  </h4>
                  <div className="space-y-1">
                    {template.structure.directories.slice(0, 5).map((dir, index) => (
                      <div key={index} className="text-sm text-muted-foreground">
                        • {dir.path} - {dir.description}
                      </div>
                    ))}
                    {template.structure.directories.length > 5 && (
                      <div className="text-sm text-muted-foreground">
                        ... and {template.structure.directories.length - 5} more
                      </div>
                    )}
                  </div>
                </div>
                
                {template.configuration.docker && (
                  <Alert>
                    <Package className="h-4 w-4"  />
                    <strong>Docker Support</strong>
                    <AlertDescription>
                      This template includes Docker configuration for containerized deployment
                    </AlertDescription>
                  </Alert>
                )}
                
                {template.dependencies.runtime && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <GitBranch className="w-4 h-4"  />
                      Dependencies
                    </h4>
                    <div className="text-sm text-muted-foreground">
                      {Object.keys(template.dependencies.runtime).length} runtime dependencies,{' '}
                      {Object.keys(template.dependencies.dev).length} dev dependencies
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
      
      <CardFooter className="flex gap-2">
        <Button
          onClick={handleSetupProject}
          disabled={!projectName || !projectPath || isSettingUp}
          className="flex-1"
        >
          {isSettingUp ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin"  />
              Setting up...
            </>
          ) : (
            <>
              <Rocket className="w-4 h-4 mr-2"  />
              Create Project
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          disabled={isSettingUp}
        >
          Cancel
        </Button>
      </CardFooter>
    </Card>
  );
};