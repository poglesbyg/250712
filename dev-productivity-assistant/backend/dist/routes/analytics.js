"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const simple_git_1 = __importDefault(require("simple-git"));
const fs_1 = require("fs");
const path_1 = require("path");
const glob_1 = require("glob");
const router = (0, express_1.Router)();
exports.analyticsRouter = router;
const timeRangeSchema = zod_1.z.object({
    start: zod_1.z.string().datetime(),
    end: zod_1.z.string().datetime()
});
const productivityQuerySchema = zod_1.z.object({
    start: zod_1.z.string().datetime().optional(),
    end: zod_1.z.string().datetime().optional(),
    projectPath: zod_1.z.string().optional()
});
// Get productivity metrics
router.get('/productivity', async (req, res) => {
    try {
        const { start, end, projectPath } = productivityQuerySchema.parse(req.query);
        const startDate = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
        const endDate = end ? new Date(end) : new Date();
        const repoPath = projectPath || process.cwd();
        const metrics = await calculateProductivityMetrics(repoPath, startDate, endDate);
        res.json(metrics);
    }
    catch (error) {
        console.error('Error calculating productivity metrics:', error);
        res.status(500).json({ error: 'Failed to calculate productivity metrics' });
    }
});
// Get focus analysis
router.get('/focus', async (req, res) => {
    try {
        const { start, end } = timeRangeSchema.parse(req.query);
        const startDate = new Date(start);
        const endDate = new Date(end);
        const focusAnalysis = await analyzeFocusPatterns(startDate, endDate);
        res.json(focusAnalysis);
    }
    catch (error) {
        console.error('Error analyzing focus patterns:', error);
        res.status(500).json({ error: 'Failed to analyze focus patterns' });
    }
});
// Get context switching analysis
router.get('/context-switches', async (req, res) => {
    try {
        const { start, end } = timeRangeSchema.parse(req.query);
        const startDate = new Date(start);
        const endDate = new Date(end);
        const contextSwitches = await analyzeContextSwitches(startDate, endDate);
        res.json(contextSwitches);
    }
    catch (error) {
        console.error('Error analyzing context switches:', error);
        res.status(500).json({ error: 'Failed to analyze context switches' });
    }
});
// Get coding time analysis
router.get('/coding-time', async (req, res) => {
    try {
        const { start, end, projectPath } = productivityQuerySchema.parse(req.query);
        const startDate = start ? new Date(start) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const endDate = end ? new Date(end) : new Date();
        const repoPath = projectPath || process.cwd();
        const codingTime = await analyzeCodingTime(repoPath, startDate, endDate);
        res.json(codingTime);
    }
    catch (error) {
        console.error('Error analyzing coding time:', error);
        res.status(500).json({ error: 'Failed to analyze coding time' });
    }
});
// Get productivity trends
router.get('/trends', async (req, res) => {
    try {
        const { start, end, projectPath } = productivityQuerySchema.parse(req.query);
        const startDate = start ? new Date(start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
        const endDate = end ? new Date(end) : new Date();
        const repoPath = projectPath || process.cwd();
        const trends = await analyzeProductivityTrends(repoPath, startDate, endDate);
        res.json(trends);
    }
    catch (error) {
        console.error('Error analyzing productivity trends:', error);
        res.status(500).json({ error: 'Failed to analyze productivity trends' });
    }
});
async function calculateProductivityMetrics(projectPath, startDate, endDate) {
    const git = (0, simple_git_1.default)(projectPath);
    try {
        // Get git commits in date range
        const log = await git.log({
            from: startDate.toISOString(),
            to: endDate.toISOString(),
            maxCount: 1000
        });
        // Analyze commit patterns
        const commitFrequency = analyzeCommitFrequency([...log.all], startDate, endDate);
        const peakHours = analyzePeakHours([...log.all]);
        // Analyze code quality metrics
        const codeQuality = await analyzeCodeQuality(projectPath);
        const languageBreakdown = await analyzeLanguageBreakdown(projectPath);
        // Calculate productivity score
        const productivityScore = calculateProductivityScore(commitFrequency, codeQuality, peakHours);
        // Simulate focus blocks and context switches (in real implementation, this would come from IDE tracking)
        const focusBlocks = generateFocusBlocks([...log.all]);
        const contextSwitches = calculateContextSwitches([...log.all]);
        return {
            totalCodingTime: calculateTotalCodingTime([...log.all]),
            peakHours,
            productivityScore,
            contextSwitches,
            focusBlocks,
            commitFrequency,
            codeQuality,
            languageBreakdown,
            collaborationMetrics: {
                pairProgramming: 0.15, // 15% of coding time
                codeReviews: log.all.length * 0.3, // Estimate 30% of commits involve reviews
                mentoring: 0.05 // 5% of time spent mentoring
            }
        };
    }
    catch (error) {
        console.error('Error calculating productivity metrics:', error);
        throw error;
    }
}
function analyzeCommitFrequency(commits, startDate, endDate) {
    const frequencyMap = new Map();
    commits.forEach(commit => {
        const date = new Date(commit.date).toISOString().split('T')[0];
        frequencyMap.set(date, (frequencyMap.get(date) || 0) + 1);
    });
    const result = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        result.push({
            date: dateStr,
            count: frequencyMap.get(dateStr) || 0
        });
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return result;
}
function analyzePeakHours(commits) {
    const hourlyActivity = new Array(24).fill(0);
    commits.forEach(commit => {
        const hour = new Date(commit.date).getHours();
        hourlyActivity[hour]++;
    });
    return hourlyActivity.map((activity, hour) => ({ hour, activity }))
        .sort((a, b) => b.activity - a.activity);
}
async function analyzeCodeQuality(projectPath) {
    try {
        const files = await (0, glob_1.glob)('**/*.{js,ts,jsx,tsx,py,java,cpp,c,cs}', {
            cwd: projectPath,
            ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
        });
        let totalLines = 0;
        let totalComplexity = 0;
        let filesAnalyzed = 0;
        for (const file of files) {
            try {
                const content = (0, fs_1.readFileSync)((0, path_1.join)(projectPath, file), 'utf-8');
                const lines = content.split('\n').length;
                totalLines += lines;
                // Simple complexity calculation based on control structures
                const complexity = calculateFileComplexity(content);
                totalComplexity += complexity;
                filesAnalyzed++;
            }
            catch (error) {
                // Skip files that can't be read
                continue;
            }
        }
        return {
            linesOfCode: totalLines,
            filesModified: filesAnalyzed,
            complexity: filesAnalyzed > 0 ? totalComplexity / filesAnalyzed : 0,
            testCoverage: 0.75 // Placeholder - would need actual test coverage tool
        };
    }
    catch (error) {
        return {
            linesOfCode: 0,
            filesModified: 0,
            complexity: 0,
            testCoverage: 0
        };
    }
}
function calculateFileComplexity(content) {
    // Simple complexity calculation
    const complexityKeywords = [
        'if', 'else', 'while', 'for', 'switch', 'case', 'catch', 'try',
        'function', 'class', 'def', 'method', '&&', '||', '?'
    ];
    let complexity = 1; // Base complexity
    complexityKeywords.forEach(keyword => {
        const matches = content.match(new RegExp(`\\b${keyword}\\b`, 'g'));
        if (matches) {
            complexity += matches.length;
        }
    });
    return complexity;
}
async function analyzeLanguageBreakdown(projectPath) {
    try {
        const languageMap = new Map();
        const files = await (0, glob_1.glob)('**/*', {
            cwd: projectPath,
            ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**']
        });
        for (const file of files) {
            try {
                const ext = (0, path_1.extname)(file);
                const stats = (0, fs_1.statSync)((0, path_1.join)(projectPath, file));
                if (stats.isFile()) {
                    const content = (0, fs_1.readFileSync)((0, path_1.join)(projectPath, file), 'utf-8');
                    const lines = content.split('\n').length;
                    const language = getLanguageFromExtension(ext);
                    languageMap.set(language, (languageMap.get(language) || 0) + lines);
                }
            }
            catch (error) {
                // Skip files that can't be read
                continue;
            }
        }
        const totalLines = Array.from(languageMap.values()).reduce((sum, lines) => sum + lines, 0);
        return Array.from(languageMap.entries())
            .map(([language, lines]) => ({
            language,
            lines,
            percentage: totalLines > 0 ? (lines / totalLines) * 100 : 0
        }))
            .sort((a, b) => b.lines - a.lines);
    }
    catch (error) {
        return [];
    }
}
function getLanguageFromExtension(ext) {
    const languageMap = {
        '.js': 'JavaScript',
        '.ts': 'TypeScript',
        '.jsx': 'React',
        '.tsx': 'React TypeScript',
        '.py': 'Python',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.cs': 'C#',
        '.go': 'Go',
        '.rs': 'Rust',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.dart': 'Dart',
        '.html': 'HTML',
        '.css': 'CSS',
        '.scss': 'SCSS',
        '.less': 'LESS',
        '.json': 'JSON',
        '.xml': 'XML',
        '.yaml': 'YAML',
        '.yml': 'YAML',
        '.md': 'Markdown',
        '.sql': 'SQL'
    };
    return languageMap[ext.toLowerCase()] || 'Other';
}
function calculateProductivityScore(commitFrequency, codeQuality, peakHours) {
    // Calculate base score from commit frequency
    const avgCommitsPerDay = commitFrequency.reduce((sum, day) => sum + day.count, 0) / commitFrequency.length;
    let score = Math.min(avgCommitsPerDay * 20, 40); // Max 40 points from commits
    // Add points for code quality
    if (codeQuality.complexity < 10)
        score += 20;
    else if (codeQuality.complexity < 15)
        score += 15;
    else if (codeQuality.complexity < 20)
        score += 10;
    else
        score += 5;
    // Add points for consistent work patterns
    const workingHours = peakHours.filter(h => h.hour >= 8 && h.hour <= 18);
    if (workingHours.length > 0) {
        score += 20;
    }
    // Add points for test coverage
    score += codeQuality.testCoverage * 20;
    return Math.min(Math.max(score, 0), 100);
}
function calculateTotalCodingTime(commits) {
    // Estimate coding time based on commit frequency and timing
    // This is a simplified estimation - real implementation would track actual editor time
    return commits.length * 30; // Assume 30 minutes per commit on average
}
function generateFocusBlocks(commits) {
    // Generate focus blocks based on commit timing patterns
    const blocks = [];
    for (let i = 0; i < commits.length - 1; i++) {
        const current = new Date(commits[i].date);
        const next = new Date(commits[i + 1].date);
        const duration = (current.getTime() - next.getTime()) / (1000 * 60); // minutes
        if (duration > 15 && duration < 240) { // Between 15 minutes and 4 hours
            blocks.push({
                start: next.toISOString(),
                end: current.toISOString(),
                duration: Math.round(duration)
            });
        }
    }
    return blocks.slice(0, 10); // Return top 10 focus blocks
}
function calculateContextSwitches(commits) {
    // Estimate context switches based on commit message patterns
    let switches = 0;
    for (let i = 1; i < commits.length; i++) {
        const current = commits[i].message.toLowerCase();
        const previous = commits[i - 1].message.toLowerCase();
        // Simple heuristic: if commit messages are very different, it's likely a context switch
        const similarity = calculateStringSimilarity(current, previous);
        if (similarity < 0.3) {
            switches++;
        }
    }
    return switches;
}
function calculateStringSimilarity(str1, str2) {
    const words1 = str1.split(/\s+/);
    const words2 = str2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    const totalWords = new Set([...words1, ...words2]).size;
    return commonWords.length / totalWords;
}
async function analyzeFocusPatterns(startDate, endDate) {
    // In a real implementation, this would analyze actual focus data from IDE/system monitoring
    // For now, we'll generate realistic sample data
    const focusSessions = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        // Generate 2-4 focus sessions per day
        const sessionsPerDay = Math.floor(Math.random() * 3) + 2;
        for (let i = 0; i < sessionsPerDay; i++) {
            const sessionStart = new Date(currentDate);
            sessionStart.setHours(9 + i * 2, Math.random() * 60, 0, 0);
            const duration = 30 + Math.random() * 90; // 30-120 minutes
            const sessionEnd = new Date(sessionStart.getTime() + duration * 60000);
            focusSessions.push({
                start: sessionStart,
                end: sessionEnd,
                duration: Math.round(duration),
                intensity: Math.random() * 0.5 + 0.5, // 0.5-1.0
                interruptions: Math.floor(Math.random() * 3)
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return {
        totalFocusTime: focusSessions.reduce((sum, session) => sum + session.duration, 0),
        averageSessionLength: focusSessions.reduce((sum, session) => sum + session.duration, 0) / focusSessions.length,
        focusEfficiency: focusSessions.reduce((sum, session) => sum + session.intensity, 0) / focusSessions.length,
        totalInterruptions: focusSessions.reduce((sum, session) => sum + session.interruptions, 0),
        sessions: focusSessions.slice(0, 20) // Return last 20 sessions
    };
}
async function analyzeContextSwitches(startDate, endDate) {
    // Generate sample context switch data
    const contextSwitches = [];
    const tasks = ['Feature Development', 'Bug Fixing', 'Code Review', 'Documentation', 'Testing', 'Refactoring'];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const switchesPerDay = Math.floor(Math.random() * 5) + 2;
        for (let i = 0; i < switchesPerDay; i++) {
            const switchTime = new Date(currentDate);
            switchTime.setHours(9 + i * 2, Math.random() * 60, 0, 0);
            contextSwitches.push({
                timestamp: switchTime,
                fromTask: tasks[Math.floor(Math.random() * tasks.length)],
                toTask: tasks[Math.floor(Math.random() * tasks.length)],
                switchTime: Math.random() * 10 + 2 // 2-12 minutes
            });
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    return {
        totalSwitches: contextSwitches.length,
        averageSwitchTime: contextSwitches.reduce((sum, cs) => sum + cs.switchTime, 0) / contextSwitches.length,
        mostCommonTransition: 'Feature Development → Bug Fixing',
        switchesPerDay: contextSwitches.length / Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)),
        recentSwitches: contextSwitches.slice(-10)
    };
}
async function analyzeCodingTime(projectPath, startDate, endDate) {
    const git = (0, simple_git_1.default)(projectPath);
    try {
        const log = await git.log({
            from: startDate.toISOString(),
            to: endDate.toISOString(),
            maxCount: 1000
        });
        const dailyCodingTime = new Map();
        const hourlyDistribution = new Array(24).fill(0);
        // Analyze commit patterns to estimate coding time
        log.all.forEach(commit => {
            const date = new Date(commit.date);
            const dateStr = date.toISOString().split('T')[0];
            const hour = date.getHours();
            // Estimate 30-60 minutes of coding time per commit
            const estimatedTime = Math.random() * 30 + 30;
            dailyCodingTime.set(dateStr, (dailyCodingTime.get(dateStr) || 0) + estimatedTime);
            hourlyDistribution[hour] += estimatedTime;
        });
        const totalTime = Array.from(dailyCodingTime.values()).reduce((sum, time) => sum + time, 0);
        const dailyAverage = totalTime / dailyCodingTime.size;
        return {
            totalCodingTime: Math.round(totalTime),
            dailyAverage: Math.round(dailyAverage),
            peakHour: hourlyDistribution.indexOf(Math.max(...hourlyDistribution)),
            dailyBreakdown: Array.from(dailyCodingTime.entries()).map(([date, time]) => ({
                date,
                minutes: Math.round(time)
            })),
            hourlyDistribution: hourlyDistribution.map((time, hour) => ({
                hour,
                minutes: Math.round(time)
            }))
        };
    }
    catch (error) {
        return {
            totalCodingTime: 0,
            dailyAverage: 0,
            peakHour: 10,
            dailyBreakdown: [],
            hourlyDistribution: []
        };
    }
}
async function analyzeProductivityTrends(projectPath, startDate, endDate) {
    const git = (0, simple_git_1.default)(projectPath);
    try {
        const log = await git.log({
            from: startDate.toISOString(),
            to: endDate.toISOString(),
            maxCount: 1000
        });
        // Calculate weekly trends
        const weeklyMetrics = new Map();
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const weekStart = new Date(currentDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay()); // Start of week
            const weekKey = weekStart.toISOString().split('T')[0];
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekCommits = log.all.filter(commit => {
                const commitDate = new Date(commit.date);
                return commitDate >= weekStart && commitDate <= weekEnd;
            });
            weeklyMetrics.set(weekKey, {
                week: weekKey,
                commits: weekCommits.length,
                estimatedCodingTime: weekCommits.length * 35, // 35 minutes per commit
                productivity: Math.min(weekCommits.length * 10, 100), // Simple productivity score
                codeQuality: Math.max(100 - weekCommits.length * 2, 60) // Inverse relationship for demo
            });
            currentDate.setDate(currentDate.getDate() + 7);
        }
        const trends = Array.from(weeklyMetrics.values());
        return {
            weeklyTrends: trends,
            overallTrend: calculateTrend(trends.map(t => t.productivity)),
            averageProductivity: trends.reduce((sum, t) => sum + t.productivity, 0) / trends.length,
            totalCodingTime: trends.reduce((sum, t) => sum + t.estimatedCodingTime, 0),
            insights: generateProductivityInsights(trends)
        };
    }
    catch (error) {
        return {
            weeklyTrends: [],
            overallTrend: 'stable',
            averageProductivity: 75,
            totalCodingTime: 0,
            insights: []
        };
    }
}
function calculateTrend(values) {
    if (values.length < 2)
        return 'stable';
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((sum, val) => sum + val, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, val) => sum + val, 0) / secondHalf.length;
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    if (change > 10)
        return 'improving';
    if (change < -10)
        return 'declining';
    return 'stable';
}
function generateProductivityInsights(trends) {
    const insights = [];
    if (trends.length === 0)
        return insights;
    const avgProductivity = trends.reduce((sum, t) => sum + t.productivity, 0) / trends.length;
    if (avgProductivity > 80) {
        insights.push('Excellent productivity levels maintained consistently');
    }
    else if (avgProductivity > 60) {
        insights.push('Good productivity with room for improvement');
    }
    else {
        insights.push('Consider strategies to boost productivity');
    }
    const recentTrend = trends.slice(-3);
    const isImproving = recentTrend.every((t, i) => i === 0 || t.productivity >= recentTrend[i - 1].productivity);
    if (isImproving) {
        insights.push('Productivity has been improving recently');
    }
    const mostProductiveWeek = trends.reduce((max, t) => t.productivity > max.productivity ? t : max);
    insights.push(`Most productive week: ${mostProductiveWeek.week} with ${mostProductiveWeek.commits} commits`);
    return insights;
}
//# sourceMappingURL=analytics.js.map