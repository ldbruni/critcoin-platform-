# Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Variables
- [ ] Frontend `.env` with `REACT_APP_ADMIN_WALLET`
- [ ] Backend `.env` with `MONGO_URI`, `ADMIN_WALLET`, `PORT`
- [ ] Update API URLs in frontend to production backend URL

### 2. Code Preparation
- [ ] Remove console.log statements
- [ ] Update CORS settings for production
- [ ] Set production MongoDB connection
- [ ] Build frontend: `npm run build`

### 3. Repository Setup
- [ ] Push all code to GitHub
- [ ] Ensure `.env` files are in `.gitignore`
- [ ] Add README with setup instructions

## Deployment Steps

### Frontend (Vercel)
1. Go to vercel.com
2. Import GitHub repository
3. Set build command: `npm run build`
4. Set output directory: `build`
5. Add environment variables
6. Deploy

### Backend (Railway)
1. Go to railway.app
2. Create new project from GitHub
3. Select backend folder
4. Add environment variables
5. Deploy automatically

### Database
- Already using MongoDB Atlas ✅

## Post-Deployment
- [ ] Test all functionality
- [ ] Update frontend API URLs
- [ ] Test admin panel access
- [ ] Verify transactions work
- [ ] Test wallet connections

## URLs to Update
- Update all API calls in frontend from localhost:3001 to production URL