@echo off
setlocal

cd /d "%~dp0"

echo Starting Nexus Chat backend server...
start "Nexus API Server" cmd /k "npm start"

echo Starting Cloudflare public tunnel...
start "Nexus Cloudflare Tunnel" cmd /k "cloudflared tunnel --url http://localhost:3001"

echo.
echo Keep both windows open while sharing/testing the app.
echo Open the Cloudflare terminal window and copy the https://*.trycloudflare.com URL.
echo.
pause
