import { EventEmitter } from 'events';
declare const router: import("express-serve-static-core").Router;
declare class ProductivityMonitor extends EventEmitter {
    private metrics;
    private alerts;
    private thresholds;
    isMonitoring: boolean;
    private monitoringInterval;
    private projectPath;
    constructor(projectPath?: string);
    private initializeThresholds;
    startMonitoring(): Promise<void>;
    stopMonitoring(): Promise<void>;
    private collectMetrics;
    private collectCodeMetrics;
    private collectBuildMetrics;
    private collectFocusMetrics;
    private getActiveBranches;
    private calculateComplexity;
    private checkAlerts;
    getMetrics(): any[];
    getAlerts(): any[];
    getRecentAlerts(hours?: number): any[];
    updateThreshold(metric: string, threshold: any): void;
    getThresholds(): {
        [k: string]: any;
    };
}
declare const monitor: ProductivityMonitor;
export { router as automationRouter, monitor as productivityMonitor };
//# sourceMappingURL=automation.d.ts.map