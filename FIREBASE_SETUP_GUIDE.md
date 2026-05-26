# 🔥 Firebase Authentication Setup Guide

## Problem Summary
Firebase authentication was working in **development** (Replit workspace) but failing in **production** (deployed URL) with errors like "Failed to fetch user account".

## Root Cause
The issue was that **Vite environment variables** (VITE_*) need to be **embedded into the code at build time**, but Replit secrets weren't being converted to `.env.production` format before the build step.

## What Was Fixed

### 1. **Pre-build Script Created** (`scripts/generate-env.cjs`)
- Automatically runs before every build (`npm run build`)
- Converts Replit secrets to `.env.production` file
- Ensures Firebase credentials are available to Vite during production builds

### 2. **Vite Config Updated** (`vite.config.ts`)
- Now uses `loadEnv()` to properly load environment variables
- Explicitly injects Firebase credentials into the build using `define`
- Adds logging to verify credentials are detected during build

### 3. **Enhanced Error Logging** (`client/src/firebase/firebase.ts`)
- Better console messages showing exactly which credentials are missing
- Helps diagnose auth issues in both dev and production

### 4. **Git Ignore Updated** (`.gitignore`)
- All `.env` files are now ignored to prevent credential leaks

---

## 🚨 CRITICAL: Firebase Console Configuration

### You MUST Add These Domains to Firebase Console

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project**: `bboy-battle`
3. **Go to**: Authentication → Settings → Authorized domains
4. **Add ALL of these domains**:

   ```
   bboy-battle.firebaseapp.com
   *.replit.dev
   *.repl.co
   ```

   **Your specific Replit domains**:
   - Development: `66e588a6-f6cb-44a4-8f4f-e51b53342d94-00-19cy85482jx3z.kirk.replit.dev`
   - Production: Add your custom production domain if you have one (check Deployment settings)

### How to Find Your Exact Domains

Run this in your Replit shell:
```bash
env | grep REPLIT_DOMAINS
env | grep REPLIT_DEV_DOMAIN
```

Then add **both** domains to Firebase Authorized domains.

---

## Environment Variables Check

### Development (Replit Workspace)
These should be in **Replit Secrets** (lock icon in sidebar):
- ✅ `VITE_FIREBASE_API_KEY`
- ✅ `VITE_FIREBASE_PROJECT_ID`
- ✅ `VITE_FIREBASE_APP_ID`
- ✅ `FIREBASE_SERVICE_ACCOUNT` (backend auth)

### Production (Deployment)
**These are automatically handled** - the prebuild script reads from the same Replit secrets and generates `.env.production` before building.

---

## How to Verify It's Working

### 1. **Check Build Output**
When you deploy, look for these messages in the build logs:
```
🔥 Generating .env.production from deployment secrets...
✅ Generated .env.production successfully
  VITE_FIREBASE_API_KEY: ✅ Set
  VITE_FIREBASE_PROJECT_ID: ✅ Set
  VITE_FIREBASE_APP_ID: ✅ Set
```

### 2. **Check Browser Console** (on deployed site)
Open browser DevTools → Console tab. You should see:
```
✅ Firebase initialized successfully
📧 Auth Domain: bboy-battle.firebaseapp.com
🔑 Project ID: bboy-battle
```

If you see errors like:
```
❌ Firebase is NOT configured!
```
Then the environment variables didn't get injected during build.

### 3. **Test Login**
- Go to your deployed URL
- Try to sign in with a test account
- Check browser console for any Firebase errors
- Common errors and fixes:

#### Error: "auth/unauthorized-domain"
**Fix**: Add your deployed domain to Firebase Authorized domains (see above)

#### Error: "Failed to fetch user account"
**Fix**: Check that `FIREBASE_SERVICE_ACCOUNT` secret is set correctly in Replit

#### Error: "Firebase is NOT configured"
**Fix**: Redeploy the app to trigger the prebuild script

---

## Files Changed

### New Files
- `scripts/generate-env.cjs` - Pre-build script that generates `.env.production`
- `FIREBASE_SETUP_GUIDE.md` - This file

### Modified Files
- `package.json` - Added `prebuild` script
- `vite.config.ts` - Enhanced to load and inject environment variables properly
- `client/src/firebase/firebase.ts` - Added better error logging
- `.gitignore` - Added `.env*` files to prevent credential leaks

---

## Testing Checklist

Before deploying:
- [ ] Verify all Firebase secrets are in Replit Secrets
- [ ] Run `npm run build` locally to test the prebuild script
- [ ] Check that `.env.production` is created (but NOT committed to git)

After deploying:
- [ ] Open deployed URL in browser
- [ ] Open DevTools Console
- [ ] Verify Firebase initialization message appears
- [ ] Test signup with new email
- [ ] Test login with existing account
- [ ] Verify authorized domains in Firebase Console include your deployed URL

---

## Troubleshooting

### Build fails with "Missing required environment variables"
**Solution**: Add the missing variables to Replit Secrets

### Login works in dev but not production
**Solution**: 
1. Check Firebase Authorized domains includes your production URL
2. Redeploy to ensure prebuild script runs
3. Check browser console for specific Firebase errors

### "auth/network-request-failed" errors
**Solution**: This is usually a CORS issue. Verify:
1. Your domain is in Firebase Authorized domains
2. Firebase project settings allow your domain

---

## Support

If you're still having issues:
1. Check the browser console for specific error messages
2. Verify the Firebase Admin SDK is initialized on the server (check server logs)
3. Ensure all environment variables are set correctly in Replit Secrets

---

## Security Notes

- ✅ All `.env` files are gitignored to prevent credential leaks
- ✅ Firebase credentials are only in Replit Secrets, never hardcoded
- ✅ The prebuild script generates `.env.production` temporarily during build, then it's discarded
- ✅ Production builds have credentials embedded but obfuscated in the bundle

---

**Last Updated**: November 24, 2025
**Firebase Project**: bboy-battle
**Auth Methods**: Email/Password
