import { Router } from 'express';
import { z } from 'zod';
import { EventEmitter } from 'events';
import simpleGit from 'simple-git';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { glob } from 'glob';

const router = Router();

// Real-time monitoring system
class ProductivityMonitor extends EventEmitter {
  private metrics: Map<string, any> = new Map();
  private alerts: Array<any> = [];
  private thresholds: Map<string, any> = new Map();
  public isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private projectPath: string;

  constructor(projectPath: string = process.cwd()) {
    super();
    this.projectPath = projectPath;
    this.initializeThresholds();
  }

  private initializeThresholds() {
    this.thresholds.set('commit_frequency', {
      min: 1, // commits per day
      max: 20,
      window: '1d'
    });
    
    this.thresholds.set('code_complexity', {
      max: 15,
      window: 'per_file'
    });
    
    this.thresholds.set('build_time', {
      max: 300, // 5 minutes
      window: 'per_build'
    });
    
    this.thresholds.set('test_coverage', {
      min: 70, // percentage
      window: 'overall'
    });
    
    this.thresholds.set('focus_time', {
      min: 120, // 2 hours per day
      window: '1d'
    });
  }

  async startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('Starting real-time productivity monitoring...');
    
    // Monitor every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      await this.collectMetrics();
      await this.checkAlerts();
    }, 5 * 60 * 1000);
    
    // Initial collection
    await this.collectMetrics();
    this.emit('monitoring_started');
  }

  async stopMonitoring() {
    if (!this.isMonitoring) return;
    
    this.isMonitoring = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    console.log('Stopped productivity monitoring');
    this.emit('monitoring_stopped');
  }

  private async collectMetrics() {
    try {
      const timestamp = new Date().toISOString();
      const git = simpleGit(this.projectPath);
      
      // Collect git metrics
      const recentCommits = await git.log({ maxCount: 50 });
      const todayCommits = recentCommits.all.filter(commit => {
        const commitDate = new Date(commit.date);
        const today = new Date();
        return commitDate.toDateString() === today.toDateString();
      });
      
      // Collect code metrics
      const codeMetrics = await this.collectCodeMetrics();
      
      // Collect build metrics (simulated)
      const buildMetrics = await this.collectBuildMetrics();
      
      // Collect focus metrics (simulated)
      const focusMetrics = await this.collectFocusMetrics();
      
      const currentMetrics = {
        timestamp,
        git: {
          commits_today: todayCommits.length,
          total_commits: recentCommits.all.length,
          last_commit: recentCommits.latest?.date || null,
          active_branches: await this.getActiveBranches(git)
        },
        code: codeMetrics,
        build: buildMetrics,
        focus: focusMetrics
      };
      
      this.metrics.set(timestamp, currentMetrics);
      this.emit('metrics_collected', currentMetrics);
      
      // Keep only last 100 metric entries
      if (this.metrics.size > 100) {
        const oldestKey = this.metrics.keys().next().value;
        if (oldestKey) {
          this.metrics.delete(oldestKey);
        }
      }
      
    } catch (error) {
      console.error('Error collecting metrics:', error);
    }
  }

  private async collectCodeMetrics() {
    try {
      const files = await glob('**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs}', {
        cwd: this.projectPath,
        ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
      });
      
      let totalLines = 0;
      let totalComplexity = 0;
      let highComplexityFiles = 0;
      
      for (const file of files.slice(0, 50)) {
        try {
          const content = readFileSync(join(this.projectPath, file), 'utf-8');
          const lines = content.split('\n').length;
          const complexity = this.calculateComplexity(content);
          
          totalLines += lines;
          totalComplexity += complexity;
          
          if (complexity > 15) {
            highComplexityFiles++;
          }
        } catch (error) {
          continue;
        }
      }
      
      return {
        total_files: files.length,
        total_lines: totalLines,
        average_complexity: totalComplexity / Math.max(1, files.length),
        high_complexity_files: highComplexityFiles,
        test_coverage: 75 // Simulated
      };
    } catch (error) {
      return {
        total_files: 0,
        total_lines: 0,
        average_complexity: 0,
        high_complexity_files: 0,
        test_coverage: 0
      };
    }
  }

  private async collectBuildMetrics() {
    // Simulated build metrics - in real implementation, this would integrate with CI/CD
    return {
      last_build_time: Math.random() * 200 + 50, // 50-250 seconds
      build_success_rate: 0.85 + Math.random() * 0.15, // 85-100%
      failed_builds_today: Math.floor(Math.random() * 3),
      deployment_frequency: Math.random() * 5 + 1 // 1-6 deployments per day
    };
  }

  private async collectFocusMetrics() {
    // Simulated focus metrics - in real implementation, this would track actual IDE usage
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    return {
      focus_time_today: Math.random() * 300 + 60, // 1-6 hours in minutes
      interruptions_today: Math.floor(Math.random() * 10),
      context_switches_today: Math.floor(Math.random() * 15),
      deep_work_sessions: Math.floor(Math.random() * 4) + 1
    };
  }

  private async getActiveBranches(git: any) {
    try {
      const branches = await git.branchLocal();
      return branches.all.length;
    } catch (error) {
      return 1;
    }
  }

  private calculateComplexity(content: string): number {
    const complexityKeywords = [
      'if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try',
      'function', 'class', 'def', 'method', '&&', '||', '?'
    ];
    
    let complexity = 1;
    complexityKeywords.forEach(keyword => {
      const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
      if (matches) complexity += matches.length;
    });
    
    return complexity;
  }

  private async checkAlerts() {
    const latestMetrics = Array.from(this.metrics.values()).pop();
    if (!latestMetrics) return;
    
    const alerts = [];
    
    // Check commit frequency
    const commitThreshold = this.thresholds.get('commit_frequency');
    if (latestMetrics.git.commits_today < commitThreshold.min) {
      alerts.push({
        type: 'warning',
        metric: 'commit_frequency',
        message: `Low commit frequency: ${latestMetrics.git.commits_today} commits today (minimum: ${commitThreshold.min})`,
        value: latestMetrics.git.commits_today,
        threshold: commitThreshold.min,
        timestamp: new Date().toISOString()
      });
    }
    
    if (latestMetrics.git.commits_today > commitThreshold.max) {
      alerts.push({
        type: 'info',
        metric: 'commit_frequency',
        message: `High commit frequency: ${latestMetrics.git.commits_today} commits today (maximum: ${commitThreshold.max})`,
        value: latestMetrics.git.commits_today,
        threshold: commitThreshold.max,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check code complexity
    const complexityThreshold = this.thresholds.get('code_complexity');
    if (latestMetrics.code.average_complexity > complexityThreshold.max) {
      alerts.push({
        type: 'warning',
        metric: 'code_complexity',
        message: `High code complexity: ${latestMetrics.code.average_complexity.toFixed(2)} (maximum: ${complexityThreshold.max})`,
        value: latestMetrics.code.average_complexity,
        threshold: complexityThreshold.max,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check build time
    const buildThreshold = this.thresholds.get('build_time');
    if (latestMetrics.build.last_build_time > buildThreshold.max) {
      alerts.push({
        type: 'error',
        metric: 'build_time',
        message: `Slow build time: ${latestMetrics.build.last_build_time.toFixed(0)}s (maximum: ${buildThreshold.max}s)`,
        value: latestMetrics.build.last_build_time,
        threshold: buildThreshold.max,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check test coverage
    const coverageThreshold = this.thresholds.get('test_coverage');
    if (latestMetrics.code.test_coverage < coverageThreshold.min) {
      alerts.push({
        type: 'warning',
        metric: 'test_coverage',
        message: `Low test coverage: ${latestMetrics.code.test_coverage}% (minimum: ${coverageThreshold.min}%)`,
        value: latestMetrics.code.test_coverage,
        threshold: coverageThreshold.min,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check focus time
    const focusThreshold = this.thresholds.get('focus_time');
    if (latestMetrics.focus.focus_time_today < focusThreshold.min) {
      alerts.push({
        type: 'info',
        metric: 'focus_time',
        message: `Low focus time: ${latestMetrics.focus.focus_time_today.toFixed(0)} minutes today (minimum: ${focusThreshold.min} minutes)`,
        value: latestMetrics.focus.focus_time_today,
        threshold: focusThreshold.min,
        timestamp: new Date().toISOString()
      });
    }
    
    // Add new alerts
    alerts.forEach(alert => {
      this.alerts.push(alert);
      this.emit('alert_triggered', alert);
    });
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  getMetrics() {
    return Array.from(this.metrics.values());
  }

  getAlerts() {
    return this.alerts;
  }

  getRecentAlerts(hours: number = 24) {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.alerts.filter(alert => new Date(alert.timestamp) > cutoff);
  }

  updateThreshold(metric: string, threshold: any) {
    this.thresholds.set(metric, threshold);
    this.emit('threshold_updated', { metric, threshold });
  }

  getThresholds() {
    return Object.fromEntries(this.thresholds);
  }
}

// Global monitor instance
const monitor = new ProductivityMonitor();

// Schema definitions
const workflowSchema = z.object({
  name: z.string(),
  triggers: z.array(z.string()),
  actions: z.array(z.object({
    type: z.string(),
    config: z.any()
  }))
});

const alertConfigSchema = z.object({
  metric: z.string(),
  threshold: z.number(),
  condition: z.enum(['above', 'below', 'equals']),
  enabled: z.boolean().default(true)
});

// API Routes

// Start monitoring
router.post('/monitoring/start', async (req, res) => {
  try {
    await monitor.startMonitoring();
    res.json({ status: 'started', message: 'Real-time monitoring started' });
  } catch (error) {
    console.error('Error starting monitoring:', error);
    res.status(500).json({ error: 'Failed to start monitoring' });
  }
});

// Stop monitoring
router.post('/monitoring/stop', async (req, res) => {
  try {
    await monitor.stopMonitoring();
    res.json({ status: 'stopped', message: 'Real-time monitoring stopped' });
  } catch (error) {
    console.error('Error stopping monitoring:', error);
    res.status(500).json({ error: 'Failed to stop monitoring' });
  }
});

// Get monitoring status
router.get('/monitoring/status', async (req, res) => {
  try {
    const metrics = monitor.getMetrics();
    const alerts = monitor.getRecentAlerts();
    const thresholds = monitor.getThresholds();
    
    res.json({
      isMonitoring: monitor.isMonitoring,
      metricsCount: metrics.length,
      recentAlerts: alerts.length,
      latestMetrics: metrics.length > 0 ? metrics[metrics.length - 1] : null,
      thresholds
    });
  } catch (error) {
    console.error('Error getting monitoring status:', error);
    res.status(500).json({ error: 'Failed to get monitoring status' });
  }
});

// Get real-time metrics
router.get('/monitoring/metrics', async (req, res) => {
  try {
    const { hours } = req.query;
    const hoursBack = hours ? parseInt(hours as string) : 24;
    
    const allMetrics = monitor.getMetrics();
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    const filteredMetrics = allMetrics.filter(metric => 
      new Date(metric.timestamp) > cutoff
    );
    
    res.json({
      metrics: filteredMetrics,
      summary: {
        totalDataPoints: filteredMetrics.length,
        timeRange: `${hoursBack} hours`,
        lastUpdated: filteredMetrics.length > 0 ? filteredMetrics[filteredMetrics.length - 1].timestamp : null
      }
    });
  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Get alerts
router.get('/monitoring/alerts', async (req, res) => {
  try {
    const { hours, type } = req.query;
    const hoursBack = hours ? parseInt(hours as string) : 24;
    
    let alerts = monitor.getRecentAlerts(hoursBack);
    
    if (type) {
      alerts = alerts.filter(alert => alert.type === type);
    }
    
    res.json({
      alerts,
      summary: {
        total: alerts.length,
        byType: alerts.reduce((acc, alert) => {
          acc[alert.type] = (acc[alert.type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        timeRange: `${hoursBack} hours`
      }
    });
  } catch (error) {
    console.error('Error getting alerts:', error);
    res.status(500).json({ error: 'Failed to get alerts' });
  }
});

// Update alert thresholds
router.post('/monitoring/thresholds', async (req, res) => {
  try {
    const { metric, threshold } = req.body;
    
    if (!metric || !threshold) {
      return res.status(400).json({ error: 'Metric and threshold are required' });
    }
    
    monitor.updateThreshold(metric, threshold);
    
    res.json({
      success: true,
      message: `Threshold updated for ${metric}`,
      threshold
    });
  } catch (error) {
    console.error('Error updating threshold:', error);
    res.status(500).json({ error: 'Failed to update threshold' });
  }
});

// Create automated workflow
router.post('/workflows', async (req, res) => {
  try {
    const workflow = workflowSchema.parse(req.body);
    
    // Store workflow (in real implementation, this would be persisted)
    const workflowId = `workflow_${Date.now()}`;
    
    res.json({
      id: workflowId,
      workflow,
      status: 'created',
      message: 'Workflow created successfully'
    });
  } catch (error) {
    console.error('Error creating workflow:', error);
    res.status(400).json({ error: 'Invalid workflow configuration' });
  }
});

// Get workflow suggestions
router.get('/workflows/suggestions', async (req, res) => {
  try {
    const suggestions = [
      {
        name: 'Auto-commit reminder',
        description: 'Remind to commit when no commits for 2 hours',
        triggers: ['no_commits_2h'],
        actions: [
          {
            type: 'notification',
            config: { message: 'Consider committing your changes' }
          }
        ]
      },
      {
        name: 'Code complexity alert',
        description: 'Alert when file complexity exceeds threshold',
        triggers: ['high_complexity'],
        actions: [
          {
            type: 'alert',
            config: { severity: 'warning', message: 'High complexity detected' }
          }
        ]
      },
      {
        name: 'Build failure notification',
        description: 'Notify when build fails',
        triggers: ['build_failure'],
        actions: [
          {
            type: 'notification',
            config: { message: 'Build failed - check logs' }
          }
        ]
      },
      {
        name: 'Focus time tracking',
        description: 'Track and report daily focus time',
        triggers: ['end_of_day'],
        actions: [
          {
            type: 'report',
            config: { type: 'focus_summary' }
          }
        ]
      }
    ];
    
    res.json({ suggestions });
  } catch (error) {
    console.error('Error getting workflow suggestions:', error);
    res.status(500).json({ error: 'Failed to get workflow suggestions' });
  }
});

// Execute workflow action
router.post('/workflows/:id/execute', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;
    
    // Simulate workflow execution
    const result = {
      workflowId: id,
      action,
      status: 'executed',
      timestamp: new Date().toISOString(),
      result: 'Action executed successfully'
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error executing workflow:', error);
    res.status(500).json({ error: 'Failed to execute workflow' });
  }
});

// Get automation templates
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'git_hooks',
        name: 'Git Hooks Setup',
        description: 'Pre-commit hooks for code quality',
        category: 'quality',
        config: {
          preCommit: ['lint', 'test', 'format'],
          prePush: ['build', 'test:e2e']
        }
      },
      {
        id: 'ci_cd_pipeline',
        name: 'CI/CD Pipeline',
        description: 'Automated build and deployment',
        category: 'deployment',
        config: {
          stages: ['build', 'test', 'deploy'],
          triggers: ['push', 'pr']
        }
      },
      {
        id: 'code_review_automation',
        name: 'Code Review Automation',
        description: 'Automated code review checks',
        category: 'review',
        config: {
          checks: ['complexity', 'coverage', 'security'],
          autoAssign: true
        }
      },
      {
        id: 'performance_monitoring',
        name: 'Performance Monitoring',
        description: 'Real-time performance tracking',
        category: 'monitoring',
        config: {
          metrics: ['response_time', 'memory_usage', 'cpu_usage'],
          alerts: ['threshold_exceeded', 'anomaly_detected']
        }
      }
    ];
    
    res.json({ templates });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Apply automation template
router.post('/templates/:id/apply', async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;
    
    // Simulate template application
    const result = {
      templateId: id,
      status: 'applied',
      timestamp: new Date().toISOString(),
      config,
      message: 'Template applied successfully'
    };
    
    res.json(result);
  } catch (error) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// WebSocket-like events for real-time updates
router.get('/monitoring/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial status
  sendEvent('status', {
    isMonitoring: monitor.isMonitoring,
    timestamp: new Date().toISOString()
  });

  // Listen for monitor events
  const onMetricsCollected = (metrics: any) => {
    sendEvent('metrics', metrics);
  };

  const onAlertTriggered = (alert: any) => {
    sendEvent('alert', alert);
  };

  monitor.on('metrics_collected', onMetricsCollected);
  monitor.on('alert_triggered', onAlertTriggered);

  // Clean up on client disconnect
  req.on('close', () => {
    monitor.off('metrics_collected', onMetricsCollected);
    monitor.off('alert_triggered', onAlertTriggered);
  });
});

export { router as automationRouter, monitor as productivityMonitor };