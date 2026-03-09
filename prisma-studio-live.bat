@echo off
setlocal

set HOST=46.225.217.170
set USER=root
set REMOTE_APP_DIR=/opt/efc/api
set LOCAL_PORT=5555
set REMOTE_PORT=5555

echo [1/3] Sunucuda Prisma Studio (tmux) kontrol ediliyor...
ssh %USER%@%HOST% "tmux has-session -t studio 2>/dev/null || tmux new-session -d -s studio 'cd %REMOTE_APP_DIR% && npx --yes prisma@6.16.2 studio --schema ./prisma/schema.prisma --port %REMOTE_PORT% --hostname 127.0.0.1'"
if errorlevel 1 (
  echo Sunucu komutu basarisiz oldu. SSH/Parola kontrol edin.
  pause
  exit /b 1
)

echo [2/3] Tarayici aciliyor: http://localhost:%LOCAL_PORT%
start "" http://localhost:%LOCAL_PORT%

echo [3/3] SSH tunnel aciliyor. Bu pencereyi kapatmayin.
echo Kapatmak icin Ctrl + C kullanin.
ssh -N -L %LOCAL_PORT%:127.0.0.1:%REMOTE_PORT% %USER%@%HOST%

endlocal
