#!/bin/bash

# Probe Game Setup Script for macOS
# This script sets up the development environment on Mac Mini M4 Pro

set -e

echo "🎮 Setting up Probe Game Development Environment..."
echo ""

# Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    
    # Add Homebrew to PATH for Apple Silicon
    if [[ $(uname -m) == 'arm64' ]]; then
        echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
        eval "$(/opt/homebrew/bin/brew shellenv)"
    fi
else
    echo "✓ Homebrew already installed"
fi

# Install required dependencies
echo ""
echo "📦 Installing system dependencies..."

# Check and install Node.js
if ! command -v node &> /dev/null; then
    echo "Installing Node.js..."
    brew install node@20
    brew link node@20
else
    echo "✓ Node.js already installed ($(node -v))"
fi

# Check and install PostgreSQL
if ! command -v psql &> /dev/null; then
    echo "Installing PostgreSQL..."
    brew install postgresql@16
    brew services start postgresql@16
else
    echo "✓ PostgreSQL already installed"
fi

# Check and install Podman (optional)
if ! command -v podman &> /dev/null; then
    echo "Installing Podman..."
    brew install podman podman-compose
    podman machine init
    podman machine start
else
    echo "✓ Podman already installed"
fi

# Setup environment file
echo ""
echo "⚙️  Setting up environment variables..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created .env file from template"
    echo "⚠️  Please edit .env file with your configuration!"
else
    echo "✓ .env file already exists"
fi

# Setup backend
echo ""
echo "🔧 Setting up backend..."
cd backend

if [ ! -d "node_modules" ]; then
    echo "Installing backend dependencies..."
    npm install
else
    echo "✓ Backend dependencies already installed"
fi

# Setup database
echo ""
echo "🗄️  Setting up database..."

# Source .env for database credentials
set -a
source ../.env
set +a

# Create database if it doesn't exist
if ! psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "Creating database..."
    createdb $DB_NAME
    echo "✓ Database created"
else
    echo "✓ Database already exists"
fi

# Run Prisma migrations
echo "Running database migrations..."
npx prisma generate
npx prisma migrate dev --name init

cd ..

# Setup frontend
echo ""
echo "🎨 Setting up frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
else
    echo "✓ Frontend dependencies already installed"
fi

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✓ Created frontend .env file"
fi

cd ..

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p logs
mkdir -p ssl

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Edit .env files with your configuration"
echo "   2. Start backend: cd backend && npm run dev"
echo "   3. Start frontend: cd frontend && npm run dev"
echo "   4. Access the app at http://localhost:5173"
echo ""
echo "🐳 For Podman deployment:"
echo "   podman-compose build"
echo "   podman-compose up -d"
echo ""
