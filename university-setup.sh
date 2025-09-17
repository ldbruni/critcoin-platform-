#!/bin/bash

echo "🎓 CritCoin Platform - University Network Setup"
echo "=============================================="
echo ""

echo "Testing different port configurations for university firewalls..."
echo ""

echo "Option 1: Standard web ports (8080/8081)"
echo "  Frontend: https://localhost:8080"
echo "  Backend:  http://localhost:8081"
echo ""

echo "Option 2: Secure web ports (8443/8444)"
echo "  Frontend: https://localhost:8443"
echo "  Backend:  http://localhost:8444"
echo ""

echo "Option 3: Alternative IPs (if localhost blocked)"
echo "  Try: https://127.0.0.1:8080 or https://0.0.0.0:8080"
echo ""

read -p "Choose option (1, 2, or 3): " choice

case $choice in
    1)
        echo "🚀 Starting on standard ports..."
        cd backend && npm run start-university &
        sleep 3
        cd ../frontend && npm run start-university &
        echo ""
        echo "✅ Access the site at: https://localhost:8080"
        ;;
    2)
        echo "🔒 Starting on secure ports..."
        cd backend && npm run start-secure &
        sleep 3
        cd ../frontend && npm run start-secure &
        echo ""
        echo "✅ Access the site at: https://localhost:8443"
        ;;
    3)
        echo "🌐 Starting with IP alternatives..."
        cd backend && npm run dev &
        sleep 3
        cd ../frontend && npm run start-dev &
        echo ""
        echo "✅ Try these URLs:"
        echo "  - https://localhost:3000"
        echo "  - https://127.0.0.1:3000"
        echo "  - https://0.0.0.0:3000"
        ;;
    *)
        echo "❓ Invalid choice. Starting default..."
        cd backend && npm run dev &
        sleep 3
        cd ../frontend && npm run start-dev &
        echo ""
        echo "✅ Access the site at: https://localhost:3000"
        ;;
esac

echo ""
echo "📜 Certificate Warning: Click 'Advanced' then 'Proceed to localhost'"
echo "🔒 This is normal for development HTTPS certificates."
echo ""
echo "Press Ctrl+C to stop both servers"
wait