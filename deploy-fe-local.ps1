# File: deploy-fe-local.ps1
# Proxy script to run local frontend deployment from the root folder.

Write-Host "📂 Navigating to frontend directory..." -ForegroundColor Gray
cd frontend
.\deploy-fe-local.ps1
