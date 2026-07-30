# File: frontend/deploy-fe-local.ps1
# Script to build and deploy frontend directly from your local machine to VPS.
# This solves the GitHub Actions I/O Timeout (firewall blocking GH runner IPs).

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "🚀 Local Deploy Tool for NamThuEdu Frontend" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Check prerequisites
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Error: pnpm is not installed. Please install pnpm first." -ForegroundColor Red
    exit 1
}

# VPS configuration
$vpsHost = "namthuedu.vn"
$vpsUser = "root"
$vpsPort = 22
$targetPath = "/var/www/namthuedu-fe"

Write-Host "📍 Target: ${vpsUser}@${vpsHost}:${vpsPort}" -ForegroundColor Yellow
Write-Host "📂 Remote Path: $targetPath" -ForegroundColor Yellow

# 2. Build the project locally
Write-Host "`n📦 Step 1: Installing dependencies..." -ForegroundColor Cyan
pnpm install --frozen-lockfile

Write-Host "`n🏗️ Step 2: Building frontend (production mode)..." -ForegroundColor Cyan
# Set environment variables for production build
$env:VITE_API_URL = "https://namthuedu.vn/api"
$env:VITE_API_BASE_URL = "https://namthuedu.vn"
$env:VITE_API_TIMEOUT = "30000"
$env:VITE_ADDRESS_API = "https://namthuedu.vn/api/address"
$env:VITE_APP_NAME = "NamThu Education"
$env:VITE_APP_ENV = "production"
$env:VITE_WS_URL = "wss://namthuedu.vn"
$env:VITE_WS_KEY = "namthuedu"
$env:VITE_ENABLE_MONITORING = "true"
$env:VITE_ENABLE_ANALYTICS = "true"
$env:VITE_ENABLE_DEBUG = "false"
$env:VITE_USE_MOCK_DATA = "false"
# Đọc VITE_GROQ_API_KEY từ file .env để tránh lộ secret và bị GitHub block push
$groqKey = ""
if (Test-Path ".env") {
    $envContent = Get-Content ".env" -Raw
    if ($envContent -match 'VITE_GROQ_API_KEY\s*=\s*([^\r\n]+)') {
        $groqKey = $Matches[1].Trim()
    }
}
$env:VITE_GROQ_API_KEY = $groqKey
$env:VITE_GROQ_MODEL = "llama-3.3-70b-versatile"

pnpm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed. Aborting deploy." -ForegroundColor Red
    exit 1
}

# 3. Compress the build
Write-Host "`n🗜️ Step 3: Packaging dist folder..." -ForegroundColor Cyan
if (Test-Path "dist.tar.gz") {
    Remove-Item "dist.tar.gz" -Force
}
tar -czf dist.tar.gz -C dist .

if (-not (Test-Path "dist.tar.gz")) {
    Write-Host "❌ Failed to package dist.tar.gz" -ForegroundColor Red
    exit 1
}

# 4. Upload to VPS via SCP
Write-Host "`n⬆️ Step 4: Uploading package to VPS (dist.tar.gz)..." -ForegroundColor Cyan
Write-Host "Prompting SSH connection. Please enter password if asked." -ForegroundColor Gray

# Clean remote target folder structure or backup if needed
scp -P $vpsPort dist.tar.gz "${vpsUser}@${vpsHost}:${targetPath}/dist.tar.gz"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SCP upload failed. Make sure SSH port $vpsPort is open and VPS is reachable." -ForegroundColor Red
    exit 1
}

# 5. Extract and reload nginx via SSH
Write-Host "`n🔄 Step 5: Reloading Nginx on VPS..." -ForegroundColor Cyan
ssh -p $vpsPort "${vpsUser}@${vpsHost}" "bash ${targetPath}/deploy-fe.sh"

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ SSH deploy execution failed." -ForegroundColor Red
    exit 1
}

Write-Host "`n✅ DEPLOYED SUCCESSFULLY FROM LOCAL MACHINE!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Cyan
