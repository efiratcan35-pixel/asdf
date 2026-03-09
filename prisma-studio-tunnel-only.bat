@echo off
setlocal

set HOST=46.225.217.170
set USER=root
set LOCAL_PORT=5555
set REMOTE_PORT=5555

start "" http://localhost:%LOCAL_PORT%
echo SSH tunnel aciliyor. Bu pencereyi kapatmayin.
echo Kapatmak icin Ctrl + C kullanin.
ssh -N -L %LOCAL_PORT%:127.0.0.1:%REMOTE_PORT% %USER%@%HOST%

endlocal
