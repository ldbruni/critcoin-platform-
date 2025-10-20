#!/bin/bash
set -e
echo "Starting Vercel build..."
cd frontend
echo "Installing dependencies..."
npm install
echo "Building React app..."
CI=false npm run build
echo "Build complete! Checking output..."
ls -la build/ || echo "Build directory not found!"
echo "Copying build directory to root..."
cp -r build ../build || echo "Copy failed!"
echo "Build directory copied! Checking..."
cd ..
ls -la build/ || echo "Build not in root!"
echo "Done!"
