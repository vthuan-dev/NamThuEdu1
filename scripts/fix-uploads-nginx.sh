#!/bin/bash

# Script để thêm location block cho /uploads/ trong Nginx

echo "🔧 Adding /uploads/ location block to Nginx config..."

# Backup file gốc
sudo cp /etc/nginx/sites-enabled/namthuedu-vn /etc/nginx/sites-enabled/namthuedu-vn.backup-uploads-$(date +%Y%m%d-%H%M%S)

# Tạo file config mới với location /uploads/
sudo tee /etc/nginx/sites-enabled/namthuedu-vn > /dev/null <<'EOF'
server {
    server_name namthuedu.vn www.namthuedu.vn;
    root /var/www/namthuedu-fe/dist;
    index index.html;
    charset utf-8;

    # ACME challenge cho Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Gzip cho asset
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Serve Laravel storage files
    location /storage/ {
        alias /var/www/namthuedu/backend/public/storage/;
        # CORS được xử lý bởi Laravel
        expires 1M;
    }

    # Serve uploads files (avatars, etc)
    location /uploads/ {
        alias /var/www/namthuedu/backend/public/uploads/;
        # CORS được xử lý bởi Laravel
        expires 1M;
        try_files $uri =404;
    }

    # API proxy to backend on port 8000
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 50M;
    }

    # Cache asset có hash (immutable)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
        try_files $uri =404;
    }

    # SPA fallback — mọi route về index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    access_log /var/log/nginx/namthuedu-vn-access.log;
    error_log  /var/log/nginx/namthuedu-vn-error.log;

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/namthuedu.vn/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/namthuedu.vn/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = www.namthuedu.vn) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = namthuedu.vn) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name namthuedu.vn www.namthuedu.vn;
    return 404; # managed by Certbot
}
EOF

echo "✅ Added /uploads/ location block"

# Test nginx config
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx config test passed"
    echo "🔄 Reloading Nginx..."
    sudo nginx -s reload
    echo "✅ Nginx reloaded successfully"
    echo ""
    echo "🎉 Uploads fix completed!"
    echo "📝 Now you can access images at https://namthuedu.vn/uploads/avatars/..."
else
    echo "❌ Nginx config test failed"
    echo "🔙 Restoring backup..."
    sudo cp /etc/nginx/sites-enabled/namthuedu-vn.backup-uploads-$(date +%Y%m%d-%H%M%S) /etc/nginx/sites-enabled/namthuedu-vn
    exit 1
fi
