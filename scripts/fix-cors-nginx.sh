#!/bin/bash

# Script để sửa CORS duplicate header issue trong Nginx

echo "🔧 Fixing CORS duplicate header in Nginx config..."

# Backup file gốc
sudo cp /etc/nginx/sites-enabled/namthuedu-vn /etc/nginx/sites-enabled/namthuedu-vn.backup-$(date +%Y%m%d-%H%M%S)

# Xóa dòng add_header Access-Control-Allow-Origin
sudo sed -i '/location \/storage\//,/}/ {
    /add_header Access-Control-Allow-Origin.*always;/d
}' /etc/nginx/sites-enabled/namthuedu-vn

echo "✅ Removed duplicate CORS header from Nginx"

# Test nginx config
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx config test passed"
    echo "🔄 Reloading Nginx..."
    sudo nginx -s reload
    echo "✅ Nginx reloaded successfully"
    echo ""
    echo "🎉 CORS fix completed!"
    echo "📝 Note: Make sure to deploy updated backend/config/cors.php as well"
else
    echo "❌ Nginx config test failed"
    echo "🔙 Restoring backup..."
    sudo cp /etc/nginx/sites-enabled/namthuedu-vn.backup-$(date +%Y%m%d-%H%M%S) /etc/nginx/sites-enabled/namthuedu-vn
    exit 1
fi
