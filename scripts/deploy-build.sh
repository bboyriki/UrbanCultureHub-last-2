#!/usr/bin/env bash
# Deploy build script — runs on every deployment to build the latest code.
# Uses sufficient memory for Vite's frontend bundle and falls back gracefully.
set -e

echo "🔧 Step 1: Generating environment variables for frontend build..."
node scripts/prepare-build.js

echo "🎨 Step 2: Building frontend (Vite)..."
# Allow up to 3GB for the Vite bundler — the frontend bundle is large.
# This succeeds on the deployment VM which has sufficient RAM.
NODE_ENV=production NODE_OPTIONS='--max-old-space-size=3072' npx vite build
echo "✅ Frontend build complete"

echo "⚙️  Step 3: Building server (esbuild)..."
# esbuild is extremely memory-efficient — completes in ~120ms.
npx esbuild server/index.ts \
  --platform=node \
  --packages=external \
  --bundle \
  --format=esm \
  --outdir=dist
echo "✅ Server build complete"

echo "🚀 Build finished — dist/public/ and dist/index.js are ready"
