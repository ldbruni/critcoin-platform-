# 🚀 CritCoin Platform - Quick Start

## For University Windows Machines

## Development Mode (University Networks)

### 🎓 For University Windows Machines

**If university firewall blocks the site, try these options:**

```bash
# 1. Install dependencies (one-time setup)
npm run setup

# 2. Try different port configurations:

# Option A: Standard web ports (most likely to work)
npm run start-university
# Access at: https://localhost:8080

# Option B: Secure ports
npm run start-secure  
# Access at: https://localhost:8443

# Option C: Default HTTPS
npm run start-dev
# Access at: https://localhost:3000
```

### 🔧 Windows Quick Setup

**Double-click:** `university-setup.bat` (Windows) or `university-setup.sh` (Mac/Linux)

This script will:
- Test different port configurations
- Start the servers automatically
- Give you the working URL

### 🔍 Network Diagnostics

**Open:** `network-test.html` in your browser to test which configurations work on your network.

## Production Mode (Railway/Heroku)

**Backend only** - Frontend should be deployed separately:

```bash
# Starts backend server only
npm start
```

---

## Alternative Commands

**If `npm start` doesn't work, try:**

```bash
# Backend (Terminal 1)
cd backend
npm run dev

# Frontend (Terminal 2)  
cd frontend
npm start
```

**For Windows-specific issues:**
```bash
cd frontend
npm run start-windows
```

---

## 🎯 What This Does

- ✅ **HTTPS enabled** - Works on university networks
- ✅ **All interfaces** - Binds to 0.0.0.0 for network compatibility  
- ✅ **Auto-configuration** - No manual setup required
- ✅ **Cross-platform** - Works on Windows, Mac, Linux

---

## 🆘 Still Having Issues?

1. **Try different URLs:**
   - https://localhost:3000
   - https://127.0.0.1:3000
   - https://0.0.0.0:3000

2. **Check Windows Firewall:**
   - Allow Node.js and your browser through firewall

3. **Contact instructor** if still blocked

---

## 🔒 Security Notes

- **HTTPS self-signed certificates**: Normal for development - accept browser warnings
- **Network binding**: Configured for university compatibility (development only)
- **Firewall settings**: May need to allow Node.js through Windows Firewall

---

*The application is now configured to work out-of-the-box on university networks without any student configuration!*