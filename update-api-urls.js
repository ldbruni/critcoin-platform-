// Script to update API URLs for production deployment
// Run this before deployment: node update-api-urls.js

const fs = require('fs');
const path = require('path');

const files = [
  'frontend/src/pages/Explorer.js',
  'frontend/src/pages/Projects.js', 
  'frontend/src/pages/Profiles.js',
  'frontend/src/pages/Admin.js',
  'frontend/src/pages/Bounties.js',
  'frontend/src/pages/FormPage.js'
];

files.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Update localhost URLs to use environment variable
    content = content.replace(
      /"http:\/\/localhost:3001\/api\/([^"]+)"/g,
      'process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api/$1` : "http://localhost:3001/api/$1"'
    );
    
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${filePath}`);
  }
});

console.log('API URLs updated for production deployment!');
console.log('Set REACT_APP_API_URL environment variable to your backend URL');