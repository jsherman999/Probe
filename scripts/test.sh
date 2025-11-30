#!/bin/bash

# Probe Game Test Runner
# Runs all tests for backend and frontend

set -e

echo "🧪 Running Probe Game Tests..."
echo ""

# Backend tests
echo "📦 Testing Backend..."
cd backend
npm test
echo "✅ Backend tests passed!"
echo ""

# Frontend tests
echo "🎨 Testing Frontend..."
cd ../frontend
npm test
echo "✅ Frontend tests passed!"
echo ""

# Backend coverage (optional)
echo "📊 Generating Backend Coverage..."
cd ../backend
npm run test:coverage
echo ""

echo "✅ All tests passed!"
