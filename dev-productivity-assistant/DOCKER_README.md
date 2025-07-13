# 🐳 Docker Deployment Guide

This guide will help you deploy the Developer Productivity Assistant using Docker containers.

## 🚀 Quick Start

### Prerequisites
- Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available
- 10GB disk space for images and data

### One-Command Setup
```bash
chmod +x docker-setup.sh
./docker-setup.sh
```

This will:
1. Build all Docker images
2. Set up databases (Neo4j, Redis)
3. Initialize Ollama with AI models
4. Start all services
5. Configure monitoring

## 📋 Manual Setup

### 1. Build Images
```bash
docker-compose build
```

### 2. Start Core Services
```bash
# Start databases first
docker-compose up -d neo4j redis

# Wait for databases to be ready
sleep 30

# Start Ollama and pull models
docker-compose up -d ollama
docker-compose exec ollama ollama pull llama3.1:latest
```

### 3. Start Application Services
```bash
# Start MCP servers
docker-compose up -d mcp-servers

# Start backend API
docker-compose up -d backend

# Start frontend
docker-compose up -d frontend
```

### 4. Start Monitoring (Optional)
```bash
docker-compose up -d prometheus grafana nginx
```

## 🌐 Service Access

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Main application interface |
| **Backend API** | http://localhost:3002 | REST API endpoints |
| **Neo4j Browser** | http://localhost:7474 | Graph database interface |
| **Grafana** | http://localhost:3001 | Monitoring dashboards |
| **Prometheus** | http://localhost:9090 | Metrics collection |
| **Nginx** | http://localhost:80 | Load balancer/proxy |

## 🔐 Default Credentials

| Service | Username | Password |
|---------|----------|----------|
| Neo4j | neo4j | devassistant123 |
| Grafana | admin | devassistant123 |

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Nginx       │    │    Frontend     │    │    Backend      │
│  Load Balancer  │◄──►│   (Next.js)     │◄──►│   (Express)     │
│     :80         │    │     :3000       │    │     :3002       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                       │
                       ┌─────────────────┐             │
                       │   MCP Servers   │◄────────────┘
                       │   Git Analytics │
                       │  Code Quality   │
                       │ Knowledge Graph │
                       │   :8001-8003    │
                       └─────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Neo4j       │    │     Redis       │    │     Ollama      │
│   Database      │    │     Cache       │    │   Local LLM     │
│     :7474       │    │     :6379       │    │    :11434       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🛠️ Management Commands

### View Service Status
```bash
docker-compose ps
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mcp-servers
```

### Restart Services
```bash
# Restart specific service
docker-compose restart backend

# Restart all services
docker-compose restart
```

### Scale Services
```bash
# Scale backend to 3 instances
docker-compose up -d --scale backend=3

# Scale MCP servers
docker-compose up -d --scale mcp-servers=2
```

### Update Services
```bash
# Rebuild and restart
docker-compose build
docker-compose up -d
```

## 🔧 Configuration

### Environment Variables
Edit `docker.env` to customize:

```env
# Database
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=devassistant123

# AI Model
OLLAMA_BASE_URL=http://ollama:11434
LLM_MODEL=llama3.1:latest

# API Configuration
PORT=3002
REDIS_URL=redis://redis:6379
```

### Volume Mounts
Data is persisted in Docker volumes:
- `neo4j_data` - Graph database
- `redis_data` - Cache data
- `ollama_data` - AI models
- `prometheus_data` - Metrics
- `grafana_data` - Dashboards

### Custom Configuration
1. **Neo4j Memory**: Edit `docker-compose.yml` Neo4j environment
2. **Nginx Config**: Modify `nginx.conf`
3. **Monitoring**: Update `prometheus.yml`

## 🐛 Troubleshooting

### Common Issues

**1. Port Conflicts**
```bash
# Check what's using ports
lsof -i :3000
lsof -i :3002

# Stop conflicting services
docker-compose down
```

**2. Out of Memory**
```bash
# Check Docker memory usage
docker stats

# Increase Docker memory limit in Docker Desktop
# Settings > Resources > Memory > 6GB+
```

**3. Database Connection Issues**
```bash
# Check Neo4j logs
docker-compose logs neo4j

# Restart database
docker-compose restart neo4j
```

**4. Ollama Model Issues**
```bash
# Pull models manually
docker-compose exec ollama ollama pull llama3.1:latest
docker-compose exec ollama ollama list
```

### Health Checks
```bash
# Check service health
curl http://localhost:3002/health
curl http://localhost:3000
curl http://localhost:7474

# Check Docker health status
docker-compose ps
```

### Performance Optimization

**1. Resource Limits**
```yaml
# In docker-compose.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

**2. Database Tuning**
```yaml
# Neo4j optimization
environment:
  - NEO4J_dbms_memory_heap_max__size=2G
  - NEO4J_dbms_memory_pagecache_size=1G
```

## 🔄 Backup & Restore

### Backup Data
```bash
# Backup Neo4j
docker-compose exec neo4j neo4j-admin dump --database=neo4j --to=/data/backup.dump

# Backup volumes
docker run --rm -v neo4j_data:/data -v $(pwd):/backup alpine tar czf /backup/neo4j_backup.tar.gz /data
```

### Restore Data
```bash
# Restore Neo4j
docker-compose exec neo4j neo4j-admin load --from=/data/backup.dump --database=neo4j --force

# Restore volumes
docker run --rm -v neo4j_data:/data -v $(pwd):/backup alpine tar xzf /backup/neo4j_backup.tar.gz -C /
```

## 📊 Monitoring

### Grafana Dashboards
1. Open http://localhost:3001
2. Login with admin/devassistant123
3. Pre-configured dashboards available:
   - Application Performance
   - Database Metrics
   - System Resources
   - API Response Times

### Prometheus Metrics
Available at http://localhost:9090/metrics:
- Application metrics
- Database performance
- System resources
- Custom business metrics

## 🚀 Production Deployment

### Security Considerations
1. **Change default passwords**
2. **Use environment-specific configs**
3. **Enable HTTPS with SSL certificates**
4. **Set up proper firewall rules**
5. **Use secrets management**

### Scaling
```bash
# Use Docker Swarm for production
docker swarm init
docker stack deploy -c docker-compose.yml dev-assistant
```

### CI/CD Integration
```yaml
# GitHub Actions example
- name: Deploy to production
  run: |
    docker-compose -f docker-compose.prod.yml up -d
```

## 🆘 Support

For issues and questions:
1. Check logs: `docker-compose logs -f`
2. Verify service health: `docker-compose ps`
3. Check resource usage: `docker stats`
4. Review configuration files

## 🔄 Updates

To update the application:
```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker-compose build --no-cache
docker-compose up -d
```

---

**Happy Coding! 🎉** 