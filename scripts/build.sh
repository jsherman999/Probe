#!/bin/bash

# Probe Game - Production Build Script
# Builds optimized production bundles

set -e

echo "🏗️  Building Probe Game for Production..."
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf backend/dist
rm -rf frontend/dist

# Build backend
echo "📦 Building Backend..."
cd backend
npm run build
echo "✅ Backend build complete!"
echo ""

# Build frontend
echo "🎨 Building Frontend..."
cd ../frontend
npm run build
echo "✅ Frontend build complete!"
echo ""

# Display bundle sizes
echo "📊 Bundle Sizes:"
cd dist
du -sh assets/* | sort -h
cd ../..

echo ""
echo "✅ Production build complete!"
echo ""
echo "Backend output: backend/dist/"
echo "Frontend output: frontend/dist/"
echo ""
echo "To deploy, run: ./scripts/deploy.sh"
