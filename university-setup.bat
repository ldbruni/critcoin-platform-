@echo off
echo Starting CritCoin Platform for University Networks
echo ================================================

echo.
echo Testing different port configurations...
echo.

echo Option 1: Standard ports (8080/8081)
echo Frontend: https://localhost:8080
echo Backend:  http://localhost:8081
echo.

echo Option 2: Secure ports (8443/8444)  
echo Frontend: https://localhost:8443
echo Backend:  http://localhost:8444
echo.

echo Option 3: Alternative IP addresses
echo Try these if localhost is blocked:
echo - https://127.0.0.1:8080
echo - https://0.0.0.0:8080
echo.

set /p choice="Choose option (1, 2, or 3): "

if "%choice%"=="1" (
    echo Starting on standard ports...
    start "Backend" cmd /k "cd backend && npm run start-university"
    timeout /t 3
    start "Frontend" cmd /k "cd frontend && npm run start-university"
    echo.
    echo Access the site at: https://localhost:8080
) else if "%choice%"=="2" (
    echo Starting on secure ports...
    start "Backend" cmd /k "cd backend && npm run start-secure"
    timeout /t 3
    start "Frontend" cmd /k "cd frontend && npm run start-secure"
    echo.
    echo Access the site at: https://localhost:8443
) else if "%choice%"=="3" (
    echo Starting standard configuration...
    start "Backend" cmd /k "cd backend && npm run dev"
    timeout /t 3
    start "Frontend" cmd /k "cd frontend && npm run start-dev"
    echo.
    echo Try these URLs:
    echo - https://localhost:3000
    echo - https://127.0.0.1:3000
    echo - https://0.0.0.0:3000
) else (
    echo Invalid choice. Starting default configuration...
    start "Backend" cmd /k "cd backend && npm run dev"
    timeout /t 3
    start "Frontend" cmd /k "cd frontend && npm run start-dev"
    echo.
    echo Access the site at: https://localhost:3000
)

echo.
echo If you get certificate warnings, click "Advanced" then "Proceed to localhost"
echo This is normal for development HTTPS certificates.
echo.
pause