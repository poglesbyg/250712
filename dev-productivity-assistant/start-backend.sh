#!/bin/bash

echo "🚀 Starting Developer Productivity Assistant Backend..."
echo "========================================"

# Kill any existing backend processes
echo "Stopping existing backend processes..."
pkill -f "tsx.*src/index.ts" 2>/dev/null || true
pkill -f "node.*dist/index.js" 2>/dev/null || true

# Wait a moment for processes to stop
sleep 2

# Start the backend
echo "Starting backend on port 3002..."
cd backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Build the project
echo "Building TypeScript..."
npm run build

if [ $? -eq 0 ]; then
  echo "✅ Build successful!"
  echo "Starting development server..."
  npm run dev &
  BACKEND_PID=$!
  
  # Wait for server to start
  echo "Waiting for server to start..."
  sleep 5
  
  # Test the server
  echo "Testing server connection..."
  if curl -s http://localhost:3002/api/mcp/servers > /dev/null; then
    echo "✅ Backend is running successfully on http://localhost:3002"
    echo "Backend PID: $BACKEND_PID"
  else
    echo "❌ Backend failed to start or is not responding"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
  fi
else
  echo "❌ Build failed!"
  exit 1
fi 