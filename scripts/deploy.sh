#!/bin/bash

# Probe Game Deploy Script
# Builds and deploys using Podman

set -e

echo "🚀 Deploying Probe Game with Podman..."

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ .env file not found!"
    echo "Copy .env.example to .env and configure it"
    exit 1
fi

# Build frontend
echo "📦 Building frontend..."
cd frontend
npm run build
cd ..

# Build containers
echo "🐳 Building containers..."
podman-compose build

# Stop existing containers
echo "🛑 Stopping existing containers..."
podman-compose down || true

# Start containers
echo "▶️  Starting containers..."
podman-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database..."
sleep 5

# Run database migrations
echo "🗄️  Running database migrations..."
podman exec probe-app npx prisma migrate deploy

# Check health
echo "🏥 Checking health..."
sleep 3

if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "❌ Backend health check failed"
    podman-compose logs app
    exit 1
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🌐 Application: http://localhost"
echo "🔧 API:         http://localhost/api"
echo "🗄️  Database:   localhost:5432"
echo ""
echo "📊 View logs:   podman-compose logs -f"
echo "🛑 Stop:        podman-compose down"
echo ""
