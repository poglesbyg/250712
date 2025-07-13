# Knowledge Graph Integration Setup Guide

## Overview

This guide will help you set up and use the Knowledge Graph integration in your Developer Productivity Assistant. The Knowledge Graph uses Neo4j to analyze and visualize relationships between code, git history, and developer patterns.

## Prerequisites

- Docker installed on your system
- Node.js and npm
- Your Developer Productivity Assistant project

## Quick Start

### 1. Start Neo4j Database

```bash
# Start Neo4j using Docker
npm run neo4j:start

# The database will be available at:
# - Web interface: http://localhost:7474
# - Bolt connection: bolt://localhost:7687
# - Username: neo4j
# - Password: devproductivity
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install MCP server dependencies
cd mcp-servers/knowledge-graph && npm install
```

### 3. Start All Services

```bash
# Start all services including the new Knowledge Graph MCP server
npm run dev
```

### 4. Access Knowledge Graph

1. Open your browser to http://localhost:3000
2. Navigate to the "Knowledge Graph" tab
3. Click "Build Knowledge Graph" to analyze your project

## Features

### 🏗️ **Knowledge Graph Building**
- **Code Structure Analysis**: Extracts functions, classes, and dependencies
- **Git History Integration**: Analyzes commits, authors, and file changes
- **Relationship Mapping**: Creates connections between all entities
- **Real-time Processing**: Builds comprehensive knowledge graphs in seconds

### 🔍 **Natural Language Queries**
Ask questions like:
- "What are the most complex functions?"
- "Who has been most active in the last month?"
- "Which files change together most often?"
- "Show me the dependencies between components"

### 📊 **Pattern Analysis**
- **Code Hotspots**: Files that change frequently and have high complexity
- **File Coupling**: Files that are imported together and changed together
- **Knowledge Silos**: Files that only one person has been working on
- **Change Patterns**: Files that are frequently changed together

### 🎨 **Interactive Visualization**
- **Node-Link Diagrams**: Visual representation of relationships
- **Color-coded Entities**: Different colors for files, functions, authors, commits
- **Interactive Exploration**: Click and drag to explore connections
- **Zoom and Pan**: Navigate large graphs easily

## Graph Database Schema

### Node Types

```cypher
// File nodes
(:File {path, name, lines, size})

// Function nodes  
(:Function {name, file, complexity, lines})

// Class nodes
(:Class {name, file, lines})

// Author nodes
(:Author {name, email})

// Commit nodes
(:Commit {hash, message, date, insertions, deletions})
```

### Relationship Types

```cypher
// Code relationships
(File)-[:CONTAINS]->(Function)
(File)-[:CONTAINS]->(Class)
(File)-[:IMPORTS]->(File)

// Git relationships
(Author)-[:AUTHORED]->(Commit)
(Commit)-[:MODIFIES]->(File)
```

## API Endpoints

### Build Knowledge Graph
```typescript
POST /api/mcp/tools/knowledge-graph/build_knowledge_graph
{
  "projectPath": "/path/to/project",
  "includeGit": true,
  "includeCode": true
}
```

### Query Knowledge
```typescript
POST /api/mcp/tools/knowledge-graph/query_knowledge
{
  "query": "What are the most complex functions?",
  "context": "optional context"
}
```

### Analyze Relationships
```typescript
POST /api/mcp/tools/knowledge-graph/analyze_relationships
{
  "entityType": "files|functions|developers|commits",
  "depth": 2
}
```

### Find Patterns
```typescript
POST /api/mcp/tools/knowledge-graph/find_patterns
{
  "patternType": "coupling|hotspots|knowledge-silos|change-patterns",
  "timeRange": 90
}
```

## Use Cases

### 1. **Code Architecture Analysis**
- Identify tightly coupled components
- Find circular dependencies
- Analyze component relationships
- Discover architectural patterns

### 2. **Team Productivity Insights**
- Find knowledge silos and bus factor risks
- Analyze collaboration patterns
- Identify code ownership
- Track contribution patterns

### 3. **Technical Debt Management**
- Locate code hotspots (high complexity + frequent changes)
- Find files that need refactoring
- Analyze change impact
- Prioritize technical debt

### 4. **Onboarding and Knowledge Transfer**
- Visualize codebase structure for new team members
- Identify key files and components
- Show code ownership and expertise areas
- Create learning paths through the codebase

## Advanced Queries

### Complex Cypher Queries

```cypher
// Find the most influential files (connected to many other files)
MATCH (f:File)
OPTIONAL MATCH (f)-[r]-()
RETURN f.path, count(r) as connections
ORDER BY connections DESC
LIMIT 10

// Find developers who work on similar files
MATCH (a1:Author)-[:AUTHORED]->(c1:Commit)-[:MODIFIES]->(f:File)
MATCH (a2:Author)-[:AUTHORED]->(c2:Commit)-[:MODIFIES]->(f)
WHERE a1 <> a2
RETURN a1.name, a2.name, count(f) as shared_files
ORDER BY shared_files DESC

// Find files that are always changed together
MATCH (c:Commit)-[:MODIFIES]->(f1:File)
MATCH (c)-[:MODIFIES]->(f2:File)
WHERE f1 <> f2
RETURN f1.path, f2.path, count(c) as co_changes
ORDER BY co_changes DESC
LIMIT 20
```

## Troubleshooting

### Neo4j Connection Issues
```bash
# Check if Neo4j is running
docker ps | grep neo4j

# Check Neo4j logs
docker logs dev-productivity-neo4j

# Restart Neo4j
npm run neo4j:stop
npm run neo4j:start
```

### Performance Optimization
- For large repositories, consider limiting the analysis scope
- Use time-based filtering for git history
- Index frequently queried properties

### Memory Issues
- Increase Neo4j heap size in Docker configuration
- Process files in batches for very large codebases
- Use pagination for large result sets

## Neo4j Web Interface

Access the Neo4j browser at http://localhost:7474 to:
- Run custom Cypher queries
- Explore the graph visually
- Monitor database performance
- Manage indexes and constraints

## Integration with AI Analysis

The Knowledge Graph can be combined with AI analysis for:
- **Intelligent Code Review**: Use graph context for better suggestions
- **Automated Refactoring**: Identify refactoring opportunities using graph patterns
- **Predictive Analysis**: Predict which files might need attention based on patterns
- **Smart Documentation**: Generate documentation based on code relationships

## Best Practices

1. **Regular Updates**: Rebuild the graph periodically to keep it current
2. **Incremental Analysis**: For large repos, consider incremental updates
3. **Query Optimization**: Use indexes for frequently queried properties
4. **Data Retention**: Set retention policies for historical data
5. **Performance Monitoring**: Monitor query performance and optimize as needed

## Next Steps

1. **Custom Patterns**: Define your own pattern analysis queries
2. **Integration**: Connect with other development tools
3. **Automation**: Set up automated graph updates
4. **Visualization**: Create custom visualization components
5. **AI Enhancement**: Integrate with AI models for deeper insights

## Support

For issues or questions:
1. Check the Neo4j logs
2. Verify all dependencies are installed
3. Ensure Docker is running properly
4. Check the MCP server status in the dashboard 