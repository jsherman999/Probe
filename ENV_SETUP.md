# Environment Variables Configuration

## Backend (.env)

Create a `.env` file in the `backend/` directory:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
DATABASE_URL=postgresql://probe_user:your_password@localhost:5432/probe_game

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_in_production_minimum_32_characters
REFRESH_TOKEN_SECRET=your_super_secret_refresh_key_change_in_production_minimum_32_characters
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Game Configuration
MAX_PLAYERS_PER_GAME=4
MIN_PLAYERS_PER_GAME=2
WORD_MIN_LENGTH=4
WORD_MAX_LENGTH=12
TURN_TIMEOUT_SECONDS=60
```

## Frontend (.env)

Create a `.env` file in the `frontend/` directory:

```env
# API Configuration
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000

# Feature Flags
VITE_ENABLE_SOUND=true
VITE_ENABLE_ANIMATIONS=true
VITE_DEBUG_MODE=false
```

## Production Environment Variables

### Backend Production (.env.production)

```env
# Server Configuration
NODE_ENV=production
PORT=3000

# Database Configuration (use your production database)
DATABASE_URL=postgresql://probe_prod:STRONG_PASSWORD@localhost:5432/probe_prod

# JWT Configuration (MUST BE CHANGED FOR PRODUCTION)
JWT_SECRET=<generate-with-openssl-rand-base64-64>
REFRESH_TOKEN_SECRET=<generate-with-openssl-rand-base64-64>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# CORS Configuration (your actual domain)
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# Game Configuration
MAX_PLAYERS_PER_GAME=4
MIN_PLAYERS_PER_GAME=2
WORD_MIN_LENGTH=4
WORD_MAX_LENGTH=12
TURN_TIMEOUT_SECONDS=60

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/probe/app.log
```

### Frontend Production (.env.production)

```env
# API Configuration (your actual domain)
VITE_API_URL=https://your-domain.com/api
VITE_SOCKET_URL=https://your-domain.com

# Feature Flags
VITE_ENABLE_SOUND=true
VITE_ENABLE_ANIMATIONS=true
VITE_DEBUG_MODE=false
```

## Generating Secure Secrets

Use OpenSSL to generate secure random secrets:

```bash
# Generate JWT secret
openssl rand -base64 64

# Generate refresh token secret
openssl rand -base64 64
```

## Container Environment Variables

For Podman/Docker deployments, you can also use `podman-compose.yml` to set environment variables:

```yaml
services:
  app:
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=postgresql://probe:password@postgres:5432/probe_game
      - JWT_SECRET=${JWT_SECRET}
      - REFRESH_TOKEN_SECRET=${REFRESH_TOKEN_SECRET}
```

Then create a `.env` file in the project root for compose:

```env
JWT_SECRET=<your-generated-secret>
REFRESH_TOKEN_SECRET=<your-generated-secret>
```

## Security Best Practices

1. **Never commit `.env` files to version control**
   - Already added to `.gitignore`

2. **Use strong, randomly generated secrets**
   - Minimum 32 characters for JWT secrets
   - Use cryptographically secure random generators

3. **Rotate secrets regularly**
   - Change JWT secrets every 3-6 months
   - Have a key rotation strategy

4. **Use environment-specific files**
   - Development: `.env`
   - Production: `.env.production`
   - Never use development secrets in production

5. **Restrict database access**
   - Use separate database users for development/production
   - Grant only necessary permissions
   - Use SSL/TLS for database connections in production

6. **Validate environment variables on startup**
   - Check all required variables are set
   - Fail fast if critical variables are missing

## Environment Variable Checklist

Before deploying to production:

- [ ] Generated new JWT_SECRET (64+ characters)
- [ ] Generated new REFRESH_TOKEN_SECRET (64+ characters)
- [ ] Updated DATABASE_URL with production credentials
- [ ] Updated ALLOWED_ORIGINS with production domain
- [ ] Set NODE_ENV=production
- [ ] Updated VITE_API_URL with production URL
- [ ] Updated VITE_SOCKET_URL with production URL
- [ ] Verified `.env` files are in `.gitignore`
- [ ] Documented secrets in secure password manager
- [ ] Set up backup for environment variables
