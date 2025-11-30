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

5. **Access the application**
   - Frontend: http://localhost:5173
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
