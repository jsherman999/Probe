#!/bin/bash
set -e

echo "🔍 Fetching current ngrok URLs..."

# Wait for ngrok to be ready
sleep 3

# Fetch backend URL
BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | jq -r '.tunnels[] | select(.config.addr | contains(":3000")) | .public_url' | head -1)
# Fetch frontend URL
FRONTEND_URL=$(curl -s http://localhost:4041/api/tunnels | jq -r '.tunnels[] | select(.config.addr | contains(":5200")) | .public_url' | head -1)

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    echo "❌ Error: Could not fetch ngrok URLs. Make sure ngrok tunnels are running."
    exit 1
fi

echo "✅ Backend URL: $BACKEND_URL"
echo "✅ Frontend URL: $FRONTEND_URL"

# Update backend .env
BACKEND_ENV="/Users/jay/cc_projects/Probe/backend/.env"
echo ""
echo "📝 Updating backend ALLOWED_ORIGINS..."
# Add frontend URL to ALLOWED_ORIGINS if not already present
if ! grep -q "$FRONTEND_URL" "$BACKEND_ENV"; then
    sed -i '' "s|ALLOWED_ORIGINS=\(.*\)|ALLOWED_ORIGINS=\1,$FRONTEND_URL|" "$BACKEND_ENV"
    echo "   Added $FRONTEND_URL to ALLOWED_ORIGINS"
else
    echo "   $FRONTEND_URL already in ALLOWED_ORIGINS"
fi

# Update frontend .env
FRONTEND_ENV="/Users/jay/cc_projects/Probe/frontend/.env"
echo ""
echo "📝 Updating frontend environment..."
sed -i '' "s|VITE_API_URL=.*|VITE_API_URL=$BACKEND_URL/api|" "$FRONTEND_ENV"
sed -i '' "s|VITE_SOCKET_URL=.*|VITE_SOCKET_URL=$BACKEND_URL|" "$FRONTEND_ENV"
echo "   Updated VITE_API_URL=$BACKEND_URL/api"
echo "   Updated VITE_SOCKET_URL=$BACKEND_URL"

echo ""
echo "🔄 Rebuilding frontend..."
cd /Users/jay/cc_projects/Probe/frontend
npm run build

echo ""
echo "🔄 Restarting services..."
launchctl stop com.probe.backend
launchctl stop com.probe.frontend
sleep 2
launchctl start com.probe.backend
launchctl start com.probe.frontend

echo ""
echo "✅ Setup complete!"
echo ""
echo "🌐 Share this URL with players:"
echo "   $FRONTEND_URL"
echo ""
echo "📊 Monitor ngrok traffic:"
echo "   Backend:  http://localhost:4040"
echo "   Frontend: http://localhost:4041"
