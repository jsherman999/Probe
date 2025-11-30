#!/bin/bash

# Probe Game - Code Quality Checker
# Runs linting and formatting checks

set -e

echo "🔍 Checking Code Quality..."
echo ""

# Backend checks
echo "📦 Checking Backend..."
cd backend

echo "  - Running ESLint..."
npx eslint src --ext .ts || true

echo "  - Checking Prettier formatting..."
npx prettier --check "src/**/*.ts" || true

echo ""

# Frontend checks
echo "🎨 Checking Frontend..."
cd ../frontend

echo "  - Running ESLint..."
npx eslint src --ext .ts,.tsx || true

echo "  - Checking Prettier formatting..."
npx prettier --check "src/**/*.{ts,tsx}" || true

echo ""
echo "✅ Code quality check complete!"
echo ""
echo "To auto-fix issues, run:"
echo "  cd backend && npx eslint src --ext .ts --fix"
echo "  cd frontend && npx eslint src --ext .ts,.tsx --fix"
echo "  npx prettier --write \"**/*.{ts,tsx}\""
