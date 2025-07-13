# 🧪 Knowledge Graph Test Guide

## ✅ **Fixed Issues**

1. **API Endpoint Fixed**: Changed from `/api/mcp/tools/knowledge-graph/build_knowledge_graph` to `/api/mcp/execute`
2. **Request Structure Fixed**: Now using proper MCP execute format with `server`, `tool`, and `parameters`
3. **Response Handling Fixed**: Accessing `result.data` instead of `result.result`

## 🚀 **Quick Test Steps**

### **1. Test API Directly**
```bash
# Test build_knowledge_graph
curl -X POST http://localhost:3002/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "knowledge-graph", 
    "tool": "build_knowledge_graph", 
    "parameters": {
      "projectPath": "/Users/paulgreenwood/Dev/250712/dev-productivity-assistant",
      "includeGit": true,
      "includeCode": true
    }
  }'

# Test query_knowledge
curl -X POST http://localhost:3002/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "knowledge-graph", 
    "tool": "query_knowledge", 
    "parameters": {
      "query": "What are the most complex functions?"
    }
  }'

# Test find_patterns
curl -X POST http://localhost:3002/api/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{
    "server": "knowledge-graph", 
    "tool": "find_patterns", 
    "parameters": {
      "patternType": "hotspots",
      "timeRange": 90
    }
  }'
```

### **2. Test Frontend UI**
1. Open http://localhost:3001
2. Click "Knowledge Graph" tab
3. Try "Build Knowledge Graph" button
4. Switch to "Query" tab and ask questions
5. Try "Patterns" tab with different pattern types
6. Check "Visualize" tab for graph display

### **3. Expected Results**

#### **Build Knowledge Graph Response**
```json
{
  "success": true,
  "data": {
    "graphType": "dependency",
    "nodes": [
      {"id": "app.ts", "label": "app.ts", "type": "file"},
      {"id": "service.ts", "label": "service.ts", "type": "file"},
      {"id": "utils.ts", "label": "utils.ts", "type": "file"},
      {"id": "index.ts", "label": "index.ts", "type": "file"}
    ],
    "edges": [
      {"source": "app.ts", "target": "service.ts", "label": "imports"},
      {"source": "service.ts", "target": "utils.ts", "label": "imports"},
      {"source": "utils.ts", "target": "index.ts", "label": "imports"}
    ]
  }
}
```

#### **Query Knowledge Response**
```json
{
  "success": true,
  "data": {
    "query": "What are the dependencies of app.ts?",
    "results": [
      {
        "id": "service.ts",
        "label": "service.ts",
        "type": "file",
        "description": "Service layer for application logic"
      },
      {
        "id": "utils.ts",
        "label": "utils.ts",
        "type": "file",
        "description": "Utility functions and helpers"
      }
    ]
  }
}
```

#### **Find Patterns Response**
```json
{
  "success": true,
  "data": {
    "totalPatterns": 5,
    "patterns": [
      {
        "name": "cyclic_dependency",
        "description": "A dependency cycle found in the graph",
        "files": ["app.ts", "service.ts", "utils.ts"]
      },
      {
        "name": "large_file",
        "description": "A file with excessive complexity",
        "file": "app.ts"
      }
    ]
  }
}
```

## 🎯 **UI Test Checklist**

- [ ] Knowledge Graph tab is visible
- [ ] Build tab loads and accepts project path input
- [ ] Build button works without 404 errors
- [ ] Build results display in JSON format
- [ ] Query tab accepts natural language input
- [ ] Query button returns results
- [ ] Patterns tab has dropdown with 4 pattern types
- [ ] Pattern analysis returns results
- [ ] Visualize tab shows graph area (may be empty until real data)

## 🔧 **Troubleshooting**

### **If you get 404 errors:**
- Check that backend is running on port 3002
- Verify the API endpoint is `/api/mcp/execute` not `/api/mcp/tools/...`
- Ensure request body has `server`, `tool`, and `parameters` fields

### **If JSON parsing fails:**
- Check that the response is valid JSON
- Look for HTML error pages being returned instead of JSON
- Verify the backend MCP client is properly configured

### **If visualization doesn't work:**
- Check browser console for vis-network errors
- Ensure the graph data has proper node/edge structure
- Verify the networkRef is properly initialized

## ✅ **Success Criteria**

1. **API Tests Pass**: All 3 curl commands return valid JSON responses
2. **Frontend Loads**: Knowledge Graph tab is accessible
3. **Build Works**: Can build knowledge graph without errors
4. **Query Works**: Can ask questions and get responses
5. **Patterns Work**: Can analyze different pattern types
6. **No 404 Errors**: All API calls use correct endpoints

## 🎉 **Ready for Demo**

Once all tests pass, your Knowledge Graph integration is ready for full demonstration! 