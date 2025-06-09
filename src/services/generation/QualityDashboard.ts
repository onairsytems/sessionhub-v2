import * as fs from 'fs-extra';
import * as path from 'path';
import { QualityReport, ProjectType } from './types';

export interface DashboardData {
  totalProjectsGenerated: number;
  projectsByType: Record<ProjectType, number>;
  zeroErrorRate: number;
  averageGenerationTime: number;
  recentProjects: ProjectSummary[];
  qualityMetrics: AggregatedMetrics;
}

export interface ProjectSummary {
  name: string;
  type: ProjectType;
  generatedAt: Date;
  passed: boolean;
  generationTime: number;
  filesGenerated: number;
  gitEnabled: boolean;
  githubEnabled: boolean;
}

export interface AggregatedMetrics {
  totalErrors: number;
  totalWarnings: number;
  buildSuccessRate: number;
  testPassRate: number;
}

export class QualityDashboard {
  private dataFile: string;
  private maxRecentProjects = 50;

  constructor(dataDir: string = '.sessionhub-dashboard') {
    this.dataFile = path.join(dataDir, 'quality-dashboard.json');
  }

  async initialize(): Promise<void> {
    await fs.ensureDir(path.dirname(this.dataFile));
    
    if (!(await fs.pathExists(this.dataFile))) {
      const initialData: DashboardData = {
        totalProjectsGenerated: 0,
        projectsByType: {} as Record<ProjectType, number>,
        zeroErrorRate: 100,
        averageGenerationTime: 0,
        recentProjects: [],
        qualityMetrics: {
          totalErrors: 0,
          totalWarnings: 0,
          buildSuccessRate: 100,
          testPassRate: 100
        }
      };
      
      await fs.writeJson(this.dataFile, initialData, { spaces: 2 });
    }
  }

  async recordProjectGeneration(
    projectName: string,
    projectType: ProjectType,
    report: QualityReport | null,
    generationTime: number,
    filesGenerated: number,
    gitEnabled: boolean,
    githubEnabled: boolean
  ): Promise<void> {
    await this.initialize();
    
    const data = await this.loadData();
    
    // Update counters
    data.totalProjectsGenerated++;
    data.projectsByType[projectType] = (data.projectsByType[projectType] || 0) + 1;
    
    // Add to recent projects
    const summary: ProjectSummary = {
      name: projectName,
      type: projectType,
      generatedAt: new Date(),
      passed: report?.passed ?? true,
      generationTime,
      filesGenerated,
      gitEnabled,
      githubEnabled
    };
    
    data.recentProjects.unshift(summary);
    if (data.recentProjects.length > this.maxRecentProjects) {
      data.recentProjects = data.recentProjects.slice(0, this.maxRecentProjects);
    }
    
    // Update metrics
    if (report) {
      if (!report.passed) {
        data.qualityMetrics.totalErrors += report.metrics.typeScriptErrors + report.metrics.eslintErrors;
        data.qualityMetrics.totalWarnings += report.metrics.eslintWarnings;
      }
      
      // Update success rates
      const passedProjects = data.recentProjects.filter(p => p.passed).length;
      data.zeroErrorRate = (passedProjects / data.recentProjects.length) * 100;
      
      const buildSuccesses = data.recentProjects.filter(p => p.passed).length;
      data.qualityMetrics.buildSuccessRate = (buildSuccesses / data.recentProjects.length) * 100;
      
      const testSuccesses = data.recentProjects.filter(p => p.passed).length;
      data.qualityMetrics.testPassRate = (testSuccesses / data.recentProjects.length) * 100;
    }
    
    // Update average generation time
    const totalTime = data.recentProjects.reduce((sum, p) => sum + p.generationTime, 0);
    data.averageGenerationTime = totalTime / data.recentProjects.length;
    
    await this.saveData(data);
  }

  async getDashboardData(): Promise<DashboardData> {
    await this.initialize();
    return this.loadData();
  }

  async generateHtmlReport(): Promise<string> {
    const data = await this.getDashboardData();
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SessionHub Quality Dashboard</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
        }
        h1 {
            color: #333;
            margin-bottom: 30px;
        }
        .metrics {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }
        .metric-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .metric-value {
            font-size: 2.5em;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 5px;
        }
        .metric-label {
            color: #666;
            font-size: 0.9em;
        }
        .success-rate {
            color: #10b981;
        }
        .projects-table {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        table {
            width: 100%;
            border-collapse: collapse;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e5e7eb;
        }
        th {
            background-color: #f9fafb;
            font-weight: 600;
            color: #374151;
        }
        .status-passed {
            color: #10b981;
            font-weight: 600;
        }
        .status-failed {
            color: #ef4444;
            font-weight: 600;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 0.75em;
            font-weight: 600;
        }
        .badge-git {
            background-color: #f59e0b;
            color: white;
        }
        .badge-github {
            background-color: #6366f1;
            color: white;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>SessionHub Quality Dashboard</h1>
        
        <div class="metrics">
            <div class="metric-card">
                <div class="metric-value">${data.totalProjectsGenerated}</div>
                <div class="metric-label">Total Projects Generated</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value success-rate">${data.zeroErrorRate.toFixed(1)}%</div>
                <div class="metric-label">Zero-Error Rate</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value">${(data.averageGenerationTime / 1000).toFixed(1)}s</div>
                <div class="metric-label">Average Generation Time</div>
            </div>
            
            <div class="metric-card">
                <div class="metric-value success-rate">${data.qualityMetrics.buildSuccessRate.toFixed(1)}%</div>
                <div class="metric-label">Build Success Rate</div>
            </div>
        </div>
        
        <div class="projects-table">
            <h2 style="padding: 20px 20px 10px;">Recent Projects</h2>
            <table>
                <thead>
                    <tr>
                        <th>Project Name</th>
                        <th>Type</th>
                        <th>Generated</th>
                        <th>Status</th>
                        <th>Files</th>
                        <th>Time</th>
                        <th>Features</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.recentProjects.map(project => `
                    <tr>
                        <td><strong>${project.name}</strong></td>
                        <td>${this.formatProjectType(project.type)}</td>
                        <td>${new Date(project.generatedAt).toLocaleDateString()}</td>
                        <td class="${project.passed ? 'status-passed' : 'status-failed'}">
                            ${project.passed ? '✅ Passed' : '❌ Failed'}
                        </td>
                        <td>${project.filesGenerated}</td>
                        <td>${(project.generationTime / 1000).toFixed(1)}s</td>
                        <td>
                            ${project.gitEnabled ? '<span class="badge badge-git">Git</span>' : ''}
                            ${project.githubEnabled ? '<span class="badge badge-github">GitHub</span>' : ''}
                        </td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        
        <div style="margin-top: 40px; text-align: center; color: #666;">
            <p>Generated by SessionHub - The zero-error code generation platform</p>
            <p style="font-size: 0.9em;">Last updated: ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
  }

  async exportDashboard(outputPath: string): Promise<void> {
    const html = await this.generateHtmlReport();
    await fs.writeFile(outputPath, html, 'utf8');
  }

  private async loadData(): Promise<DashboardData> {
    try {
      return await fs.readJson(this.dataFile);
    } catch {
      // Return default data if file doesn't exist or is corrupted
      return {
        totalProjectsGenerated: 0,
        projectsByType: {} as Record<ProjectType, number>,
        zeroErrorRate: 100,
        averageGenerationTime: 0,
        recentProjects: [],
        qualityMetrics: {
          totalErrors: 0,
          totalWarnings: 0,
          buildSuccessRate: 100,
          testPassRate: 100
        }
      };
    }
  }

  private async saveData(data: DashboardData): Promise<void> {
    await fs.writeJson(this.dataFile, data, { spaces: 2 });
  }

  private formatProjectType(type: ProjectType): string {
    const typeMap: Record<ProjectType, string> = {
      [ProjectType.REACT_TYPESCRIPT]: 'React (TS)',
      [ProjectType.REACT_JAVASCRIPT]: 'React (JS)',
      [ProjectType.NEXTJS]: 'Next.js',
      [ProjectType.VUEJS]: 'Vue.js',
      [ProjectType.EXPRESS_TYPESCRIPT]: 'Express (TS)',
      [ProjectType.EXPRESS_JAVASCRIPT]: 'Express (JS)',
      [ProjectType.PYTHON_FASTAPI]: 'FastAPI',
      [ProjectType.PYTHON_DJANGO]: 'Django',
      [ProjectType.ELECTRON]: 'Electron',
      [ProjectType.NODEJS_CLI]: 'Node.js CLI'
    };
    
    return typeMap[type] || type;
  }
}