#!/bin/bash
set -e
echo "Starting Vercel build..."
cd frontend
echo "Installing dependencies..."
npm ci
echo "Building React app..."
npm run build
echo "Build complete! Checking output..."
ls -la build/
echo "Done!"
