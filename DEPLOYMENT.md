# Deployment Guide

## Prerequisites

- macOS (Mac Mini M4 Pro recommended)
- Node.js 20+ LTS
- PostgreSQL 16+
- Podman (for containerized deployment)

## Quick Start (Development)

1. **Clone the repository**
   ```bash
   git clone https://github.com/jsherman999/Probe.git
   cd Probe
   ```

2. **Run setup script**
   ```bash
   ./scripts/setup.sh
   ```

3. **Configure environment**
   ```bash
   # Edit .env files with your settings
   nano .env
   nano frontend/.env
   ```

4. **Start development servers**
   ```bash
   ./scripts/start.sh
   ```

4. **Access the application**
   - Frontend: http://localhost:5200
   - Backend API: http://localhost:3000
   - Health check: http://localhost:3000/health

## Production Deployment (Podman)

### Option 1: Automated Deployment

```bash
./scripts/deploy.sh
```

This script will:
- Build the frontend
- Build all containers
- Start services
- Run database migrations
- Perform health checks

### Option 2: Manual Deployment

1. **Build frontend**
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Build containers**
   ```bash
   podman-compose build
   ```

3. **Start services**
   ```bash
   podman-compose up -d
   ```

4. **Run migrations**
   ```bash
   podman exec probe-app npx prisma migrate deploy
   ```

5. **Verify deployment**
   ```bash
   curl http://localhost/health
   ```

## Production Deployment (Native)

For running directly on macOS without containers:

1. **Build frontend**
   ```bash
   cd frontend
   npm run build
   cd ..
   ```

2. **Build backend**
   ```bash
   cd backend
   npm run build
   cd ..
   ```

3. **Setup PostgreSQL database**
   ```bash
   createdb probe_game
   cd backend
   npx prisma migrate deploy
   cd ..
   ```

4. **Start with PM2 (process manager)**
   ```bash
   npm install -g pm2
   cd backend
   pm2 start dist/server.js --name probe-backend
   cd ..
   ```

5. **Serve frontend with Nginx or Caddy**
   - Copy `frontend/dist` to web server root
   - Configure reverse proxy to backend

## Production Deployment (launchd - macOS)

For automatic startup and restart on macOS using launchd:

### 1. Build the frontend

```bash
cd frontend
npx vite build
cd ..
```

### 2. Create launchd plist files

Create `~/Library/LaunchAgents/com.probe.backend.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.probe.backend</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/npx</string>
        <string>tsx</string>
        <string>src/server.ts</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/Probe/backend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>DATABASE_URL</key>
        <string>postgresql://user:password@localhost:5432/probe_game</string>
        <key>PORT</key>
        <string>3000</string>
        <key>JWT_SECRET</key>
        <string>your_jwt_secret</string>
        <key>REFRESH_TOKEN_SECRET</key>
        <string>your_refresh_secret</string>
        <key>ALLOWED_ORIGINS</key>
        <string>http://localhost:5200,http://YOUR_IP:5200</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/path/to/Probe/logs/backend.log</string>
    <key>StandardErrorPath</key>
    <string>/path/to/Probe/logs/backend.error.log</string>
</dict>
</plist>
```

Create `~/Library/LaunchAgents/com.probe.frontend.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.probe.frontend</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/npx</string>
        <string>vite</string>
        <string>preview</string>
        <string>--port</string>
        <string>5200</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/path/to/Probe/frontend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/path/to/Probe/logs/frontend.log</string>
    <key>StandardErrorPath</key>
    <string>/path/to/Probe/logs/frontend.error.log</string>
</dict>
</plist>
```

### 3. Create logs directory

```bash
mkdir -p /path/to/Probe/logs
```

### 4. Load the services

```bash
launchctl load ~/Library/LaunchAgents/com.probe.backend.plist
launchctl load ~/Library/LaunchAgents/com.probe.frontend.plist
```

### 5. Manage services

```bash
# Check status
launchctl list | grep com.probe

# Stop services
launchctl unload ~/Library/LaunchAgents/com.probe.backend.plist
launchctl unload ~/Library/LaunchAgents/com.probe.frontend.plist

# Start services
launchctl load ~/Library/LaunchAgents/com.probe.backend.plist
launchctl load ~/Library/LaunchAgents/com.probe.frontend.plist

# View logs
tail -f /path/to/Probe/logs/backend.log
tail -f /path/to/Probe/logs/frontend.log
```

The services will automatically start on login and restart if they crash.

## Environment Variables

### Backend (.env)
```env
NODE_ENV=production
DATABASE_URL=postgresql://user:password@localhost:5432/probe_game
JWT_SECRET=your_secret_key_change_in_production
REFRESH_TOKEN_SECRET=your_refresh_secret
PORT=3000
ALLOWED_ORIGINS=https://your-domain.com
```

### Frontend (.env)
```env
VITE_API_URL=https://your-domain.com/api
VITE_SOCKET_URL=https://your-domain.com
```

## SSL/TLS Setup

For production with HTTPS:

1. **Get SSL certificate** (Let's Encrypt recommended)
   ```bash
   brew install certbot
   sudo certbot certonly --standalone -d your-domain.com
   ```

2. **Copy certificates**
   ```bash
   mkdir -p ssl
   sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem ssl/cert.pem
   sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem ssl/key.pem
   ```

3. **Update nginx.conf**
   - Uncomment HTTPS server block
   - Update domain name
   - Restart containers

## Monitoring & Maintenance

### View Logs
```bash
# Container logs
podman-compose logs -f app

# Native logs
tail -f logs/app.log
```

### Database Backup
```bash
# Backup
pg_dump probe_game > backup_$(date +%Y%m%d).sql

# Restore
psql probe_game < backup_YYYYMMDD.sql
```

### Health Checks
```bash
# Check backend
curl http://localhost:3000/health

# Check database
psql -c "SELECT 1" probe_game

# Check containers
podman-compose ps
```

### Updates
```bash
git pull origin main
./scripts/deploy.sh
```

## Troubleshooting

### Backend won't start
- Check DATABASE_URL is correct
- Verify PostgreSQL is running: `pg_isready`
- Check logs: `podman-compose logs app`

### Frontend won't connect
- Verify VITE_API_URL is correct
- Check CORS settings in backend
- Inspect browser console for errors

### Database connection issues
- Check PostgreSQL is running
- Verify credentials in DATABASE_URL
- Check firewall settings

### WebSocket connection fails
- Verify nginx WebSocket proxy configuration
- Check Socket.io connection in browser DevTools
- Ensure proper CORS and authentication

## Performance Tuning

### PostgreSQL
```sql
-- Increase connection pool
ALTER SYSTEM SET max_connections = 200;

-- Optimize for SSD
ALTER SYSTEM SET random_page_cost = 1.1;
```

### Node.js
```bash
# Set NODE_ENV
export NODE_ENV=production

# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
```

### Nginx
```nginx
# Enable caching
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m;

# Increase worker connections
worker_connections 2048;
```

## Scaling

For high traffic:

1. **Database**: Use connection pooling (PgBouncer)
2. **Backend**: Run multiple instances behind load balancer
3. **Caching**: Add Redis for session/game state
4. **CDN**: Serve static assets from CDN

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT secrets
- [ ] Enable HTTPS
- [ ] Configure firewall
- [ ] Regular security updates
- [ ] Enable rate limiting
- [ ] Implement proper logging
- [ ] Regular backups
- [ ] Monitor for unusual activity

## Support

For issues:
1. Check logs
2. Review troubleshooting section
3. Open GitHub issue
4. Contact maintainers
