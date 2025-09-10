# 🚀 CritCoin Platform - Quick Start

## For University Windows Machines

**Just run these 2 commands - that's it!**

```bash
# 1. Install dependencies
npm run setup

# 2. Start the application
npm start
```

Then open: **https://localhost:3000**

*(Accept the security certificate warning - this is normal for development)*

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