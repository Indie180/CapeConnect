# CapeConnect - Deployment Guide

Guide for deploying CapeConnect to production.

## Prerequisites

- Web server (Apache, Nginx, or cloud hosting)
- Node.js 16+ (for backend)
- SSL certificate (for HTTPS)
- Domain name

## Frontend Deployment

### Option 1: Static Hosting (Netlify, Vercel, GitHub Pages)

#### Netlify
```bash
# Install Netlify CLI
npm install -g netlify-cli

# Deploy
netlify deploy --prod
```

Configuration in `netlify.toml`:
```toml
[build]
  publish = "."
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

Configuration in `vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

#### GitHub Pages
1. Push code to GitHub repository
2. Go to Settings > Pages
3. Select branch and root folder
4. Save

Add `_redirects` file:
```
/*    /index.html   200
```

### Option 2: Traditional Web Server

#### Apache
Create `.htaccess`:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```

#### Nginx
Configuration:
```nginx
server {
  listen 80;
  server_name capeconnect.co.za;
  root /var/www/capeconnect;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Cache static assets
  location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

## Backend Deployment

### Option 1: Cloud Platform (Heroku, Railway, Render)

#### Heroku
```bash
# Login
heroku login

# Create app
heroku create capeconnect-api

# Deploy
cd backend
git push heroku main

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key
```

#### Railway
1. Connect GitHub repository
2. Select `backend` folder as root
3. Add environment variables
4. Deploy automatically on push

#### Render
1. Create new Web Service
2. Connect repository
3. Set build command: `cd backend && npm install`
4. Set start command: `cd backend && npm start`
5. Add environment variables

### Option 2: VPS (DigitalOcean, AWS EC2, Linode)

```bash
# SSH into server
ssh user@your-server-ip

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone repository
git clone https://github.com/your-org/capeconnect.git
cd capeconnect/backend

# Install dependencies
npm install --production

# Install PM2 for process management
sudo npm install -g pm2

# Start application
pm2 start src/server.js --name capeconnect-api

# Save PM2 configuration
pm2 save
pm2 startup
```

## Environment Variables

### Backend (.env)
```env
NODE_ENV=production
PORT=4000
DATABASE_URL=postgresql://user:pass@host:5432/capeconnect
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRES_IN=7d
CORS_ORIGIN=https://capeconnect.co.za
```

### Frontend (js/config.js)
Update API_BASE_URL:
```javascript
API_BASE_URL: 'https://api.capeconnect.co.za'
```

## Database Setup

### PostgreSQL (Production)

```bash
# Create database
createdb capeconnect

# Run migrations
cd backend
npm run migrate

# Seed data (optional)
npm run seed
```

### Connection String
```
postgresql://username:password@host:5432/capeconnect?ssl=true
```

## SSL/HTTPS Setup

### Let's Encrypt (Free)
```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d capeconnect.co.za -d www.capeconnect.co.za

# Auto-renewal
sudo certbot renew --dry-run
```

## Performance Optimization

### 1. Enable Gzip Compression

Nginx:
```nginx
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
gzip_min_length 1000;
```

### 2. CDN for Static Assets

Use Cloudflare or AWS CloudFront:
- Cache CSS, JS, images
- Reduce server load
- Improve global performance

### 3. Minify Assets

```bash
# Install terser for JS minification
npm install -g terser

# Minify JavaScript
terser js/app.js -o js/app.min.js -c -m

# Update index.html to use minified files
```

### 4. Image Optimization

```bash
# Install imagemin
npm install -g imagemin-cli

# Optimize images
imagemin pictures/* --out-dir=pictures/optimized
```

## Monitoring

### Application Monitoring

#### PM2 Monitoring
```bash
pm2 monit
pm2 logs capeconnect-api
```

#### Error Tracking (Sentry)
```javascript
// Add to backend/src/app.js
const Sentry = require('@sentry/node');
Sentry.init({ dsn: 'your-sentry-dsn' });
```

### Server Monitoring

- **Uptime**: UptimeRobot, Pingdom
- **Performance**: New Relic, DataDog
- **Logs**: Papertrail, Loggly

## Backup Strategy

### Database Backups
```bash
# Daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump capeconnect > /backups/capeconnect_$DATE.sql
```

### Automated Backups
- Use cloud provider's backup service
- Store in S3 or similar
- Keep 30 days of backups

## Security Checklist

- [ ] HTTPS enabled (SSL certificate)
- [ ] Environment variables secured
- [ ] Database credentials rotated
- [ ] CORS configured properly
- [ ] Rate limiting enabled
- [ ] SQL injection protection
- [ ] XSS protection headers
- [ ] CSRF tokens implemented
- [ ] Input validation on all forms
- [ ] Secure password hashing (bcrypt)
- [ ] JWT secrets are strong and unique
- [ ] Regular security updates

## Post-Deployment

### 1. Test Everything
- [ ] Login/logout works
- [ ] Ticket booking works
- [ ] Payment processing works
- [ ] Admin features work
- [ ] Mobile responsive
- [ ] All routes accessible

### 2. Monitor Performance
- Check response times
- Monitor error rates
- Track user activity
- Review server resources

### 3. Set Up Alerts
- Server down alerts
- High error rate alerts
- Database connection issues
- Payment failures

## Rollback Plan

If deployment fails:

```bash
# Frontend: Revert to previous version
git revert HEAD
netlify deploy --prod

# Backend: Rollback with PM2
pm2 reload capeconnect-api --update-env
```

## Scaling

### Horizontal Scaling
- Load balancer (Nginx, AWS ALB)
- Multiple backend instances
- Database read replicas
- Redis for session storage

### Vertical Scaling
- Increase server resources
- Optimize database queries
- Add caching layer
- Use CDN for static assets

## Support

For deployment issues:
1. Check server logs
2. Review error messages
3. Test locally first
4. Contact DevOps team

---

**Ready to deploy!** 🚀 Follow this guide step by step for a smooth deployment.
