#!/bin/bash
set -e
echo "Starting Vercel build..."
cd frontend
echo "Installing dependencies..."
npm install
echo "Building React app..."
npm run build
echo "Build complete! Checking output..."
ls -la build/
echo "Moving build directory to root..."
mv build ../build
echo "Build directory moved! Checking..."
cd ..
ls -la build/
echo "Done!"
