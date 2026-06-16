#!/bin/bash

# Script to fix Nginx config for media files (audio/images)
# Run on VPS: bash /var/www/namthuedu/scripts/fix-nginx-media.sh

echo "===== FIX NGINX CONFIG FOR MEDIA FILES ====="
echo ""

# Backup current config
echo "1. Backing up current Nginx config..."
cp /etc/nginx/sites-available/namthuedu-vn.conf /etc/nginx/sites-available/namthuedu-vn.conf.backup.$(date +%Y%m%d_%H%M%S)

# Create new config
echo "2. Creating new Nginx config..."
cat > /etc/nginx/sites-available/namthuedu-vn.conf << 'NGINX_CONFIG'
# Frontend (SPA) - namthuedu.vn
server {
    listen 80;
    listen [::]:80;
    server_name namthuedu.vn www.namthuedu.vn;

    root /var/www/namthuedu-fe/dist;
    index index.html;

    charset utf-8;

    # ACME challenge cho Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Gzip cho assets
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Cache static assets có hash (immutable)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # ===== PROXY BACKEND API =====
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ===== SERVE BACKEND STORAGE FILES (AUDIO/IMAGES) =====
    location /storage/ {
        alias /var/www/namthuedu/backend/storage/app/public/;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000";
        add_header Access-Control-Allow-Origin "*";
        try_files $uri =404;
    }

    # ===== SERVE BACKEND PUBLIC FILES =====
    location /files/ {
        alias /var/www/namthuedu/backend/public/files/;
        expires 1y;
        add_header Cache-Control "public, max-age=31536000";
        add_header Access-Control-Allow-Origin "*";
        try_files $uri =404;
    }

    # SPA fallback — mọi route về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    access_log /var/log/nginx/namthuedu-vn-access.log;
    error_log  /var/log/nginx/namthuedu-vn-error.log;
}
NGINX_CONFIG

# Test Nginx config
echo "3. Testing Nginx config..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Nginx config is valid!"
    
    # Reload Nginx
    echo "4. Reloading Nginx..."
    systemctl reload nginx
    
    echo ""
    echo "===== SUCCESS! ====="
    echo "✓ Nginx config updated"
    echo "✓ Nginx reloaded"
    echo ""
    echo "Test audio URL:"
    echo "curl -I https://namthuedu.vn/storage/kids-exams/audios/test.mp3"
    echo ""
else
    echo "✗ Nginx config has errors!"
    echo "Restoring backup..."
    cp /etc/nginx/sites-available/namthuedu-vn.conf.backup.$(date +%Y%m%d)* /etc/nginx/sites-available/namthuedu-vn.conf
    echo "Backup restored. Please check the error above."
fi
