#!/bin/bash

# Developer Productivity Assistant - Docker Setup Script
# This script sets up and runs the entire application stack using Docker

set -e

echo "🚀 Developer Productivity Assistant - Docker Setup"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if Docker is installed
check_docker() {
    print_header "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Docker and Docker Compose are installed ✓"
}

# Check if Docker daemon is running
check_docker_daemon() {
    print_header "Checking Docker daemon..."
    
    if ! docker info &> /dev/null; then
        print_error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi
    
    print_status "Docker daemon is running ✓"
}

# Clean up existing containers and volumes
cleanup() {
    print_header "Cleaning up existing containers..."
    
    # Stop and remove containers
    docker-compose down --volumes --remove-orphans 2>/dev/null || true
    
    # Remove unused images
    docker image prune -f 2>/dev/null || true
    
    print_status "Cleanup completed ✓"
}

# Build Docker images
build_images() {
    print_header "Building Docker images..."
    
    # Build all images
    docker-compose build --no-cache
    
    print_status "Docker images built successfully ✓"
}

# Initialize Ollama with required models
setup_ollama() {
    print_header "Setting up Ollama..."
    
    # Start Ollama service first
    docker-compose up -d ollama
    
    # Wait for Ollama to be ready
    print_status "Waiting for Ollama to be ready..."
    sleep 30
    
    # Pull required models
    print_status "Pulling Ollama models (this may take a while)..."
    docker-compose exec ollama ollama pull llama3.1:latest || print_warning "Failed to pull llama3.1:latest"
    docker-compose exec ollama ollama pull llama2:latest || print_warning "Failed to pull llama2:latest"
    
    print_status "Ollama setup completed ✓"
}

# Initialize Neo4j database
setup_neo4j() {
    print_header "Setting up Neo4j database..."
    
    # Start Neo4j service
    docker-compose up -d neo4j
    
    # Wait for Neo4j to be ready
    print_status "Waiting for Neo4j to be ready..."
    sleep 30
    
    # Create initial constraints and indexes
    print_status "Setting up Neo4j constraints and indexes..."
    docker-compose exec neo4j cypher-shell -u neo4j -p devassistant123 "
        CREATE CONSTRAINT IF NOT EXISTS FOR (f:File) REQUIRE f.path IS UNIQUE;
        CREATE CONSTRAINT IF NOT EXISTS FOR (fn:Function) REQUIRE fn.name IS UNIQUE;
        CREATE CONSTRAINT IF NOT EXISTS FOR (c:Class) REQUIRE c.name IS UNIQUE;
        CREATE CONSTRAINT IF NOT EXISTS FOR (a:Author) REQUIRE a.email IS UNIQUE;
        CREATE CONSTRAINT IF NOT EXISTS FOR (commit:Commit) REQUIRE commit.hash IS UNIQUE;
        CREATE INDEX IF NOT EXISTS FOR (f:File) ON (f.name);
        CREATE INDEX IF NOT EXISTS FOR (fn:Function) ON (fn.complexity);
        CREATE INDEX IF NOT EXISTS FOR (c:Commit) ON (c.date);
    " || print_warning "Failed to set up Neo4j constraints"
    
    print_status "Neo4j setup completed ✓"
}

# Start all services
start_services() {
    print_header "Starting all services..."
    
    # Start all services
    docker-compose up -d
    
    print_status "All services started ✓"
}

# Check service health
check_health() {
    print_header "Checking service health..."
    
    # Wait for services to be ready
    sleep 60
    
    # Check each service
    services=("frontend:3000" "backend:3002" "neo4j:7474" "redis:6379" "ollama:11434")
    
    for service in "${services[@]}"; do
        name=$(echo $service | cut -d':' -f1)
        port=$(echo $service | cut -d':' -f2)
        
        if docker-compose ps | grep -q "$name.*Up"; then
            print_status "$name service is running ✓"
        else
            print_error "$name service is not running properly"
        fi
    done
}

# Display access information
show_access_info() {
    print_header "🎉 Setup Complete! Access Information:"
    echo ""
    echo "Main Application:"
    echo "  🌐 Frontend:              http://localhost:3000"
    echo "  🔧 Backend API:           http://localhost:3002"
    echo "  📊 API Health:            http://localhost:3002/health"
    echo ""
    echo "Databases & Services:"
    echo "  🗄️  Neo4j Browser:        http://localhost:7474"
    echo "  🔴 Redis:                 localhost:6379"
    echo "  🤖 Ollama:                http://localhost:11434"
    echo ""
    echo "Monitoring & Analytics:"
    echo "  📈 Grafana:               http://localhost:3001"
    echo "  📊 Prometheus:            http://localhost:9090"
    echo "  🔍 Nginx (Load Balancer): http://localhost:80"
    echo ""
    echo "Credentials:"
    echo "  Neo4j: neo4j / devassistant123"
    echo "  Grafana: admin / devassistant123"
    echo ""
    echo "Useful Commands:"
    echo "  📋 View logs:             docker-compose logs -f [service]"
    echo "  🔄 Restart service:       docker-compose restart [service]"
    echo "  🛑 Stop all:              docker-compose down"
    echo "  🗑️  Clean up:              docker-compose down --volumes"
    echo ""
}

# Main execution
main() {
    print_header "Starting Docker setup process..."
    
    check_docker
    check_docker_daemon
    
    if [ "$1" = "--clean" ]; then
        cleanup
    fi
    
    build_images
    setup_ollama
    setup_neo4j
    start_services
    check_health
    show_access_info
    
    print_status "Docker setup completed successfully! 🎉"
}

# Handle script arguments
case "$1" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo "Options:"
        echo "  --clean    Clean up existing containers and volumes before setup"
        echo "  --help     Show this help message"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac 