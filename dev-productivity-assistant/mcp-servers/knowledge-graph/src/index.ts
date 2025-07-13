#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import neo4j, { Driver, Session } from 'neo4j-driver';
import { glob } from 'glob';
import { readFileSync } from 'fs';
import { parse } from 'acorn';
import { simple as walk } from 'acorn-walk';
import simpleGit from 'simple-git';

// Tool input schemas
const buildKnowledgeGraphSchema = z.object({
  projectPath: z.string().describe('Path to the project directory'),
  includeGit: z.boolean().default(true).describe('Include git history analysis'),
  includeCode: z.boolean().default(true).describe('Include code structure analysis'),
});

const queryKnowledgeSchema = z.object({
  query: z.string().describe('Natural language query about the codebase'),
  context: z.string().optional().describe('Additional context for the query'),
});

const analyzeRelationshipsSchema = z.object({
  entityType: z.enum(['files', 'functions', 'developers', 'commits']).describe('Type of entity to analyze'),
  depth: z.number().default(2).describe('Depth of relationship analysis'),
});

const findPatternsSchema = z.object({
  patternType: z.enum(['coupling', 'hotspots', 'knowledge-silos', 'change-patterns']).describe('Type of pattern to find'),
  timeRange: z.number().default(90).describe('Time range in days for analysis'),
});

// Available tools
const tools: Tool[] = [
  {
    name: 'build_knowledge_graph',
    description: 'Build a comprehensive knowledge graph from project code and git history',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory',
        },
        includeGit: {
          type: 'boolean',
          description: 'Include git history analysis',
          default: true,
        },
        includeCode: {
          type: 'boolean',
          description: 'Include code structure analysis',
          default: true,
        },
      },
      required: ['projectPath'],
    },
  },
  {
    name: 'query_knowledge',
    description: 'Query the knowledge graph using natural language',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Natural language query about the codebase',
        },
        context: {
          type: 'string',
          description: 'Additional context for the query',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'analyze_relationships',
    description: 'Analyze relationships between different entities in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        entityType: {
          type: 'string',
          enum: ['files', 'functions', 'developers', 'commits'],
          description: 'Type of entity to analyze',
        },
        depth: {
          type: 'number',
          description: 'Depth of relationship analysis',
          default: 2,
        },
      },
      required: ['entityType'],
    },
  },
  {
    name: 'find_patterns',
    description: 'Find patterns and insights in the knowledge graph',
    inputSchema: {
      type: 'object',
      properties: {
        patternType: {
          type: 'string',
          enum: ['coupling', 'hotspots', 'knowledge-silos', 'change-patterns'],
          description: 'Type of pattern to find',
        },
        timeRange: {
          type: 'number',
          description: 'Time range in days for analysis',
          default: 90,
        },
      },
      required: ['patternType'],
    },
  },
];

interface CodeEntity {
  type: 'file' | 'function' | 'class' | 'import';
  name: string;
  path: string;
  dependencies: string[];
  complexity?: number;
  lines?: number;
}

interface GitEntity {
  type: 'commit' | 'author' | 'branch';
  id: string;
  metadata: Record<string, any>;
  relationships: string[];
}

class KnowledgeGraphServer {
  private server: Server;
  private driver: Driver | null = null;

  constructor() {
    this.server = new Server(
      {
        name: 'knowledge-graph',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.initializeNeo4j();
  }

  private async initializeNeo4j() {
    try {
      // Connect to Neo4j
      this.driver = neo4j.driver(
        'bolt://localhost:7687',
        neo4j.auth.basic('neo4j', 'devproductivity')
      );

      // Test connection
      const session = this.driver.session();
      await session.run('RETURN 1');
      await session.close();
      console.error('Connected to Neo4j database');
    } catch (error) {
      console.error('Failed to connect to Neo4j:', error);
      console.error('Make sure Neo4j is running with: npm run neo4j:start');
    }
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'build_knowledge_graph':
            return await this.buildKnowledgeGraph(args);
          case 'query_knowledge':
            return await this.queryKnowledge(args);
          case 'analyze_relationships':
            return await this.analyzeRelationships(args);
          case 'find_patterns':
            return await this.findPatterns(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  private async buildKnowledgeGraph(args: unknown) {
    const { projectPath, includeGit, includeCode } = buildKnowledgeGraphSchema.parse(args);

    if (!this.driver) {
      throw new Error('Neo4j database not connected');
    }

    const session = this.driver.session();
    
    try {
      // Clear existing data
      await session.run('MATCH (n) DETACH DELETE n');

      const results = {
        codeEntities: 0,
        gitEntities: 0,
        relationships: 0,
        insights: [] as any[],
      };

      if (includeCode) {
        const codeStats = await this.extractCodeKnowledge(session, projectPath);
        results.codeEntities = codeStats.entities;
        results.relationships += codeStats.relationships;
      }

      if (includeGit) {
        const gitStats = await this.extractGitKnowledge(session, projectPath);
        results.gitEntities = gitStats.entities;
        results.relationships += gitStats.relationships;
      }

      // Generate insights
      results.insights = await this.generateGraphInsights(session);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } finally {
      await session.close();
    }
  }

  private async extractCodeKnowledge(session: Session, projectPath: string) {
    const pattern = `${projectPath}/**/*.{js,ts,jsx,tsx}`;
    const files = await glob(pattern, { ignore: ['**/node_modules/**', '**/dist/**'] });

    let entities = 0;
    let relationships = 0;

    for (const filePath of files) {
      try {
        const content = readFileSync(filePath, 'utf-8');
        const relativePath = filePath.replace(projectPath, '').replace(/^\//, '');

        // Create file node
        await session.run(
          `CREATE (f:File {
            path: $path,
            name: $name,
            lines: $lines,
            size: $size
          })`,
          {
            path: relativePath,
            name: relativePath.split('/').pop(),
            lines: content.split('\n').length,
            size: content.length,
          }
        );
        entities++;

        // Extract code structure
        const codeStructure = this.analyzeCodeStructure(content, relativePath);
        
        // Create function/class nodes and relationships
        for (const entity of codeStructure.entities) {
          await session.run(
            `CREATE (e:${entity.type === 'function' ? 'Function' : 'Class'} {
              name: $name,
              file: $file,
              complexity: $complexity,
              lines: $lines
            })`,
            {
              name: entity.name,
              file: relativePath,
              complexity: entity.complexity || 0,
              lines: entity.lines || 0,
            }
          );
          entities++;

          // Create relationship to file
          await session.run(
            `MATCH (f:File {path: $filePath})
             MATCH (e:${entity.type === 'function' ? 'Function' : 'Class'} {name: $name, file: $filePath})
             CREATE (f)-[:CONTAINS]->(e)`,
            { filePath: relativePath, name: entity.name }
          );
          relationships++;
        }

        // Create import relationships
        for (const dep of codeStructure.dependencies) {
          await session.run(
            `MATCH (f1:File {path: $fromFile})
             MATCH (f2:File {path: $toFile})
             CREATE (f1)-[:IMPORTS]->(f2)`,
            { fromFile: relativePath, toFile: dep }
          );
          relationships++;
        }

      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    return { entities, relationships };
  }

  private async extractGitKnowledge(session: Session, projectPath: string) {
    const git = simpleGit(projectPath);
    
    try {
      const log = await git.log({ maxCount: 1000 });
      const branches = await git.branch();

      let entities = 0;
      let relationships = 0;

      // Create author nodes
      const authors = new Set(log.all.map(commit => commit.author_name));
      for (const author of authors) {
        await session.run(
          `CREATE (a:Author {
            name: $name,
            email: $email
          })`,
          {
            name: author,
            email: log.all.find(c => c.author_name === author)?.author_email || '',
          }
        );
        entities++;
      }

      // Create commit nodes and relationships
      for (const commit of log.all) {
        await session.run(
          `CREATE (c:Commit {
            hash: $hash,
            message: $message,
            date: $date,
            insertions: $insertions,
            deletions: $deletions
          })`,
          {
            hash: commit.hash,
            message: commit.message,
            date: commit.date,
            insertions: (commit as any).insertions || 0,
            deletions: (commit as any).deletions || 0,
          }
        );
        entities++;

        // Create author relationship
        await session.run(
          `MATCH (a:Author {name: $author})
           MATCH (c:Commit {hash: $hash})
           CREATE (a)-[:AUTHORED]->(c)`,
          { author: commit.author_name, hash: commit.hash }
        );
        relationships++;

        // Create file change relationships
        const files = await git.show(['--pretty=format:', '--name-only', commit.hash]);
        for (const file of files.split('\n').filter(f => f.trim())) {
          await session.run(
            `MATCH (c:Commit {hash: $hash})
             MATCH (f:File {path: $file})
             CREATE (c)-[:MODIFIES]->(f)`,
            { hash: commit.hash, file }
          );
          relationships++;
        }
      }

      return { entities, relationships };
    } catch (error) {
      console.error('Error extracting git knowledge:', error);
      return { entities: 0, relationships: 0 };
    }
  }

  private analyzeCodeStructure(content: string, filePath: string) {
    const entities: CodeEntity[] = [];
    const dependencies: string[] = [];

    try {
      // Extract imports
      const importMatches = content.match(/^import\s+.*from\s+['"]([^'"]+)['"]/gm) || [];
      for (const match of importMatches) {
        const importPath = match.match(/from\s+['"]([^'"]+)['"]/)?.[1];
        if (importPath && !importPath.startsWith('.')) {
          dependencies.push(importPath);
        }
      }

      // Parse AST for functions and classes
      const ast = parse(content, { 
        ecmaVersion: 2022, 
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowReturnOutsideFunction: true
      });

      walk(ast, {
        FunctionDeclaration: (node: any) => {
          entities.push({
            type: 'function',
            name: node.id?.name || 'anonymous',
            path: filePath,
            dependencies: [],
            complexity: this.calculateComplexity(node),
            lines: node.loc ? node.loc.end.line - node.loc.start.line : 0,
          });
        },
        ClassDeclaration: (node: any) => {
          entities.push({
            type: 'class',
            name: node.id?.name || 'anonymous',
            path: filePath,
            dependencies: [],
            lines: node.loc ? node.loc.end.line - node.loc.start.line : 0,
          });
        },
      });
    } catch (error) {
      // Fallback to regex-based analysis
      const functionMatches = content.match(/function\s+(\w+)/g) || [];
      for (const match of functionMatches) {
        const name = match.replace('function ', '');
        entities.push({
          type: 'function',
          name,
          path: filePath,
          dependencies: [],
        });
      }

      const classMatches = content.match(/class\s+(\w+)/g) || [];
      for (const match of classMatches) {
        const name = match.replace('class ', '');
        entities.push({
          type: 'class',
          name,
          path: filePath,
          dependencies: [],
        });
      }
    }

    return { entities, dependencies };
  }

  private calculateComplexity(node: any): number {
    let complexity = 1;
    
    walk(node, {
      IfStatement: () => complexity++,
      WhileStatement: () => complexity++,
      ForStatement: () => complexity++,
      SwitchCase: () => complexity++,
      ConditionalExpression: () => complexity++,
      LogicalExpression: (node: any) => {
        if (node.operator === '&&' || node.operator === '||') complexity++;
      },
    });

    return complexity;
  }

  private async generateGraphInsights(session: Session): Promise<any[]> {
    const insights: any[] = [];

    try {
      // Most connected files
      const connectedFiles = await session.run(`
        MATCH (f:File)
        OPTIONAL MATCH (f)-[r]-()
        RETURN f.path as file, count(r) as connections
        ORDER BY connections DESC
        LIMIT 5
      `);

      insights.push({
        type: 'most_connected_files',
        data: connectedFiles.records.map(r => ({
          file: r.get('file'),
          connections: r.get('connections').toNumber(),
        })),
      });

      // Most active authors
      const activeAuthors = await session.run(`
        MATCH (a:Author)-[:AUTHORED]->(c:Commit)
        RETURN a.name as author, count(c) as commits
        ORDER BY commits DESC
        LIMIT 5
      `);

      insights.push({
        type: 'most_active_authors',
        data: activeAuthors.records.map(r => ({
          author: r.get('author'),
          commits: r.get('commits').toNumber(),
        })),
      });

      // Complex functions
      const complexFunctions = await session.run(`
        MATCH (f:Function)
        WHERE f.complexity > 5
        RETURN f.name as function, f.file as file, f.complexity as complexity
        ORDER BY complexity DESC
        LIMIT 10
      `);

      insights.push({
        type: 'complex_functions',
        data: complexFunctions.records.map(r => ({
          function: r.get('function'),
          file: r.get('file'),
          complexity: r.get('complexity').toNumber(),
        })),
      });

    } catch (error) {
      insights.push({
        type: 'error',
        message: `Failed to generate insights: ${error}`,
      });
    }

    return insights;
  }

  private async queryKnowledge(args: unknown) {
    const { query, context } = queryKnowledgeSchema.parse(args);

    if (!this.driver) {
      throw new Error('Neo4j database not connected');
    }

    const session = this.driver.session();

    try {
      // Convert natural language query to Cypher (simplified approach)
      const cypherQuery = this.translateToQuery(query);
      const result = await session.run(cypherQuery);

      const data = result.records.map(record => {
        const obj: Record<string, any> = {};
        record.keys.forEach(key => {
          obj[key as string] = record.get(key);
        });
        return obj;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: query,
              cypherQuery: cypherQuery,
              results: data,
              interpretation: this.interpretResults(query, data),
            }, null, 2),
          },
        ],
      };
    } finally {
      await session.close();
    }
  }

  private translateToQuery(naturalLanguageQuery: string): string {
    const query = naturalLanguageQuery.toLowerCase();

    if (query.includes('most complex') || query.includes('complexity')) {
      return `
        MATCH (f:Function)
        RETURN f.name as function, f.file as file, f.complexity as complexity
        ORDER BY f.complexity DESC
        LIMIT 10
      `;
    }

    if (query.includes('most changed') || query.includes('hotspot')) {
      return `
        MATCH (f:File)<-[:MODIFIES]-(c:Commit)
        RETURN f.path as file, count(c) as changes
        ORDER BY changes DESC
        LIMIT 10
      `;
    }

    if (query.includes('author') || query.includes('who')) {
      return `
        MATCH (a:Author)-[:AUTHORED]->(c:Commit)
        RETURN a.name as author, count(c) as commits
        ORDER BY commits DESC
        LIMIT 10
      `;
    }

    if (query.includes('dependencies') || query.includes('imports')) {
      return `
        MATCH (f1:File)-[:IMPORTS]->(f2:File)
        RETURN f1.path as from_file, f2.path as to_file
        LIMIT 20
      `;
    }

    // Default query
    return `
      MATCH (n)
      RETURN labels(n) as type, count(n) as count
      ORDER BY count DESC
    `;
  }

  private interpretResults(query: string, data: any[]): string {
    if (data.length === 0) {
      return 'No results found for your query.';
    }

    const query_lower = query.toLowerCase();

    if (query_lower.includes('complex')) {
      return `Found ${data.length} functions with complexity information. The most complex function has a complexity of ${Math.max(...data.map(d => d.complexity || 0))}.`;
    }

    if (query_lower.includes('author')) {
      return `Found ${data.length} authors. The most active author has ${Math.max(...data.map(d => d.commits || 0))} commits.`;
    }

    if (query_lower.includes('changed')) {
      return `Found ${data.length} files with change information. The most frequently changed file has ${Math.max(...data.map(d => d.changes || 0))} changes.`;
    }

    return `Found ${data.length} results for your query.`;
  }

  private async analyzeRelationships(args: unknown) {
    const { entityType, depth } = analyzeRelationshipsSchema.parse(args);

    if (!this.driver) {
      throw new Error('Neo4j database not connected');
    }

    const session = this.driver.session();

    try {
      let cypherQuery = '';

      switch (entityType) {
        case 'files':
          cypherQuery = `
            MATCH (f:File)
            OPTIONAL MATCH path = (f)-[*1..${depth}]-(related)
            RETURN f.path as entity, 
                   collect(distinct related.path) as related_entities,
                   length(path) as relationship_depth
            ORDER BY size(related_entities) DESC
            LIMIT 20
          `;
          break;

        case 'functions':
          cypherQuery = `
            MATCH (func:Function)
            OPTIONAL MATCH (file:File)-[:CONTAINS]->(func)
            OPTIONAL MATCH path = (file)-[*1..${depth}]-(related:File)
            RETURN func.name as entity,
                   func.file as file,
                   collect(distinct related.path) as related_files
            ORDER BY size(related_files) DESC
            LIMIT 20
          `;
          break;

        case 'developers':
          cypherQuery = `
            MATCH (a:Author)
            OPTIONAL MATCH (a)-[:AUTHORED]->(c:Commit)-[:MODIFIES]->(f:File)
            RETURN a.name as entity,
                   count(distinct c) as commits,
                   count(distinct f) as files_touched,
                   collect(distinct f.path)[0..10] as main_files
            ORDER BY commits DESC
            LIMIT 20
          `;
          break;

        case 'commits':
          cypherQuery = `
            MATCH (c:Commit)
            OPTIONAL MATCH (a:Author)-[:AUTHORED]->(c)
            OPTIONAL MATCH (c)-[:MODIFIES]->(f:File)
            RETURN c.hash as entity,
                   c.message as message,
                   a.name as author,
                   count(f) as files_changed
            ORDER BY files_changed DESC
            LIMIT 20
          `;
          break;
      }

      const result = await session.run(cypherQuery);
      const relationships = result.records.map(record => {
        const obj: Record<string, any> = {};
        record.keys.forEach(key => {
          const value = record.get(key);
          obj[key as string] = neo4j.isInt(value) ? value.toNumber() : value;
        });
        return obj;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              entityType,
              depth,
              totalResults: relationships.length,
              relationships,
            }, null, 2),
          },
        ],
      };
    } finally {
      await session.close();
    }
  }

  private async findPatterns(args: unknown) {
    const { patternType, timeRange } = findPatternsSchema.parse(args);

    if (!this.driver) {
      throw new Error('Neo4j database not connected');
    }

    const session = this.driver.session();

    try {
      let cypherQuery = '';
      let interpretation = '';

      switch (patternType) {
        case 'coupling':
          cypherQuery = `
            MATCH (f1:File)-[:IMPORTS]->(f2:File)
            WITH f1, f2, count(*) as import_strength
            MATCH (f1)<-[:MODIFIES]-(c1:Commit)
            MATCH (f2)<-[:MODIFIES]-(c2:Commit)
            WHERE c1.date > datetime() - duration({days: ${timeRange}})
            AND c2.date > datetime() - duration({days: ${timeRange}})
            WITH f1, f2, import_strength, count(distinct c1) as f1_changes, count(distinct c2) as f2_changes
            RETURN f1.path as file1, 
                   f2.path as file2, 
                   import_strength,
                   f1_changes + f2_changes as total_changes,
                   (import_strength * (f1_changes + f2_changes)) as coupling_score
            ORDER BY coupling_score DESC
            LIMIT 15
          `;
          interpretation = 'Files that are frequently imported together and changed together indicate tight coupling.';
          break;

        case 'hotspots':
          cypherQuery = `
            MATCH (f:File)<-[:MODIFIES]-(c:Commit)
            WHERE c.date > datetime() - duration({days: ${timeRange}})
            WITH f, count(c) as change_frequency
            MATCH (func:Function {file: f.path})
            WITH f, change_frequency, avg(func.complexity) as avg_complexity
            RETURN f.path as file,
                   change_frequency,
                   avg_complexity,
                   (change_frequency * avg_complexity) as hotspot_score
            ORDER BY hotspot_score DESC
            LIMIT 15
          `;
          interpretation = 'Hotspots are files that change frequently and have high complexity.';
          break;

        case 'knowledge-silos':
          cypherQuery = `
            MATCH (a:Author)-[:AUTHORED]->(c:Commit)-[:MODIFIES]->(f:File)
            WHERE c.date > datetime() - duration({days: ${timeRange}})
            WITH f, count(distinct a) as author_count, collect(distinct a.name) as authors
            WHERE author_count = 1
            MATCH (f)<-[:MODIFIES]-(commits:Commit)
            WHERE commits.date > datetime() - duration({days: ${timeRange}})
            RETURN f.path as file,
                   authors[0] as sole_author,
                   count(commits) as commits_by_sole_author
            ORDER BY commits_by_sole_author DESC
            LIMIT 15
          `;
          interpretation = 'Knowledge silos are files that only one person has been working on recently.';
          break;

        case 'change-patterns':
          cypherQuery = `
            MATCH (c:Commit)-[:MODIFIES]->(f:File)
            WHERE c.date > datetime() - duration({days: ${timeRange}})
            WITH c, collect(f.path) as files_in_commit
            WHERE size(files_in_commit) > 1
            UNWIND files_in_commit as file1
            UNWIND files_in_commit as file2
            WHERE file1 < file2
            WITH file1, file2, count(*) as co_change_frequency
            WHERE co_change_frequency > 2
            RETURN file1, file2, co_change_frequency
            ORDER BY co_change_frequency DESC
            LIMIT 20
          `;
          interpretation = 'Files that are frequently changed together in the same commits.';
          break;
      }

      const result = await session.run(cypherQuery);
      const patterns = result.records.map(record => {
        const obj: Record<string, any> = {};
        record.keys.forEach(key => {
          const value = record.get(key);
          obj[key as string] = neo4j.isInt(value) ? value.toNumber() : value;
        });
        return obj;
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              patternType,
              timeRange,
              interpretation,
              totalResults: patterns.length,
              patterns,
            }, null, 2),
          },
        ],
      };
    } finally {
      await session.close();
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Knowledge Graph MCP server running on stdio');
  }

  async cleanup() {
    if (this.driver) {
      await this.driver.close();
    }
  }
}

const server = new KnowledgeGraphServer();

process.on('SIGINT', async () => {
  await server.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await server.cleanup();
  process.exit(0);
});

server.run().catch(console.error); 