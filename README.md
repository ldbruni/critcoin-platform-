# CritCoin - Blockchain Social Platform

A full-stack social platform built on Ethereum using React, Node.js, and MongoDB. Features user profiles, project showcases, forum discussions, bounty system, and a custom ERC-20 token (CritCoin) for transactions.

## 🚀 Features

### User System
- **Profiles**: Create profiles with photos, bios, and astrological signs
- **Wallet Integration**: MetaMask wallet connection and authentication
- **CritCoin Balance**: View and manage your CritCoin (ERC-20 token) balance

### Project Showcase
- **Project Submissions**: Upload and showcase 4 different projects per user
- **Image Uploads**: High-quality project images with automatic optimization
- **Tipping System**: Send CritCoin to project creators
- **Project Discovery**: Browse all projects with author information

### Social Features
- **Forum**: Create and view posts in a community forum
- **Bounty System**: View and complete bounties for CritCoin rewards
- **Explorer**: Discover users and their work

### Admin Panel
- **Dashboard**: Overview of users, posts, projects, and bounties
- **User Management**: Archive/restore user profiles
- **Content Moderation**: Hide/show posts and archive projects
- **Bounty Management**: Create, edit, and manage bounties
- **CritCoin Distribution**: Deploy CritCoin to all active users

## 🛠 Tech Stack

### Frontend
- **React 18** with React Router for navigation
- **Bootstrap 4** for responsive UI
- **Ethers.js** for blockchain interactions

### Backend
- **Node.js** with Express server
- **MongoDB** with Mongoose ODM
- **Multer** for file uploads
- **Sharp** for image processing
- **CORS** enabled for cross-origin requests

### Blockchain
- **Hardhat** development environment
- **ERC-20 Token** (CritCoin) contract
- **Sepolia Testnet** deployment
- **MetaMask** wallet integration

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or cloud)
- MetaMask browser extension
- Git

### 1. Clone Repository
```bash
git clone <your-repo-url>
cd hardhat-boilerplate
```

### 2. Install Dependencies
```bash
# Install root dependencies (Hardhat)
npm install

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 3. Environment Setup

**Backend Environment** (`backend/.env`):
```env
MONGODB_URI=mongodb://localhost:27017/critcoin
ADMIN_WALLET=0x_your_admin_wallet_address
PORT=3001
```

**Frontend Environment** (`frontend/.env`):
```env
REACT_APP_API_URL=http://localhost:3001
REACT_APP_ADMIN_WALLET=0x_your_admin_wallet_address
```

### 4. Database Setup
Start MongoDB service:
```bash
# macOS
brew services start mongodb-community

# Windows
net start MongoDB

# Linux
sudo systemctl start mongod
```

## 🚀 Running the Application

### 1. Start Hardhat Network (Development)
```bash
npx hardhat node
```

### 2. Deploy Smart Contract
```bash
npx hardhat run scripts/deploy.js --network localhost
```

### 3. Start Backend Server
```bash
cd backend
npm run dev  # or npm start for production
```

### 4. Start Frontend
```bash
cd frontend
npm start
```

Visit `http://localhost:3000` to see the application.

## 🔧 Configuration

### MetaMask Setup
1. Install MetaMask browser extension
2. Add Hardhat network:
   - Network Name: Hardhat
   - RPC URL: http://localhost:8545
   - Chain ID: 31337
   - Currency Symbol: ETH

### Admin Setup
1. Set your wallet address in environment variables
2. Access admin panel at `/admin`
3. Admin functions require wallet authentication

## 📁 Project Structure

```
├── backend/                 # Node.js API server
│   ├── models/             # MongoDB schemas
│   │   ├── Profiles.js     # User profiles
│   │   ├── Project.js      # Project submissions
│   │   ├── Post.js         # Forum posts
│   │   ├── Bounty.js       # Bounty system
│   │   └── Transaction.js  # CritCoin transactions
│   ├── routes/             # API endpoints
│   │   ├── profiles.js     # Profile management
│   │   ├── projects.js     # Project CRUD
│   │   ├── posts.js        # Forum posts
│   │   ├── admin.js        # Admin functions
│   │   └── explorer.js     # Discovery features
│   ├── uploads/            # File storage
│   └── server.js           # Express server
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Main pages
│   │   │   ├── Profiles.js # User profiles
│   │   │   ├── Projects.js # Project showcase
│   │   │   ├── FormPage.js # Forum/posts
│   │   │   ├── Bounties.js # Bounty system
│   │   │   ├── Explorer.js # User discovery
│   │   │   └── Admin.js    # Admin panel
│   │   └── contracts/      # Contract ABIs
│   └── public/
├── contracts/              # Solidity smart contracts
│   └── Token.sol          # CritCoin ERC-20 token
├── scripts/               # Deployment scripts
└── test/                  # Contract tests
```

## 🌐 Deployment

### Backend (Railway/Heroku)
1. Set environment variables in hosting platform
2. Configure MongoDB connection string
3. Deploy backend code

### Frontend (Vercel/Netlify)
1. Build the React app: `npm run build`
2. Deploy the `build` folder
3. Set environment variables for production API URL

### Smart Contract (Mainnet/Testnets)
```bash
# Deploy to Sepolia testnet
npx hardhat run scripts/deploy.js --network sepolia

# Update contract addresses in frontend
```

## 🛡 Admin Features

Access the admin panel at `/admin` with admin wallet:

- **Dashboard**: System overview and statistics
- **Profile Management**: Archive/restore user accounts
- **Content Moderation**: Hide inappropriate posts
- **Project Management**: Archive/restore projects
- **Bounty System**: Create and manage bounties
- **CritCoin Distribution**: Mass distribution to users

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -am 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Submit pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Troubleshooting

### Common Issues

**MetaMask Connection Issues:**
- Ensure MetaMask is unlocked
- Check network configuration
- Clear MetaMask activity data if nonce errors occur

**Database Connection:**
- Verify MongoDB is running
- Check connection string in environment variables
- Ensure database permissions are correct

**File Upload Issues:**
- Check upload directory permissions
- Verify file size limits (10MB max)
- Ensure Sharp image processing is working

**API Errors:**
- Check CORS configuration
- Verify API URLs in frontend environment
- Check backend server logs

For additional help, check the [deployment checklist](deployment-checklist.md) or create an issue in this repository.

---

**Happy Building! 🎉**