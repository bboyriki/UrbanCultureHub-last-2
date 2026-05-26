# Environment Variables Setup Guide

This guide explains all required environment variables for the Urban Culture Connect application.

## Firebase Configuration (Frontend)

These variables must be set in **Replit Secrets** (set them with the lock icon):

### Required Variables

```
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

### How to Get These Values

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click **Project Settings** (gear icon)
4. Scroll down to "Your apps" section
5. Select your web app
6. Copy the `firebaseConfig` object values into the variables above

### Firebase Console Setup

After setting the environment variables, you MUST configure authorized domains:

1. Go to **Authentication** → **Settings** → **Authorized domains**
2. Add these domains:
   - `bboy-battle.firebaseapp.com`
   - `*.replit.dev`
   - `*.repl.co`
   - Your specific Replit dev domain (e.g., `66e588a6-f6cb-44a4-8f4f-e51b53342d94-00-19cy85482jx3z.kirk.replit.dev`)
   - Your production domain (when deployed)

## Backend Firebase (Server)

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
```

### How to Get Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key** (or use existing)
5. Copy the entire JSON content
6. Paste it as the value of `FIREBASE_SERVICE_ACCOUNT` (keep it as a single line JSON string)

## Email Configuration (Mailgun)

Required for sending ticket confirmation emails:

```
MAILGUN_API_KEY=your_mailgun_api_key
MAILGUN_DOMAIN=dancehealthy.net
MAILGUN_FROM_EMAIL="Dance Healthy <riki@dancehealthy.net>"
```

### How to Get Mailgun Credentials

1. Go to [Mailgun Dashboard](https://app.mailgun.com/)
2. Select your domain
3. Go to **Sending** → **Domain Settings**
4. Copy the API Key
5. Use your verified domain and sender email

## Google Maps API

```
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## Session Security

```
SESSION_SECRET=a_strong_random_secret
```

Generate a secure random secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## AI/OpenAI Configuration (Optional)

```
AI_INTEGRATIONS_OPENAI_API_KEY=your_openai_api_key
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

## Stripe Configuration (Optional)

If using Stripe for payments:

```
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

## Setting Variables in Replit

1. Click the **🔒 Secrets** icon in the left sidebar
2. Click **Create secret**
3. Enter the key name and value
4. The value is automatically encrypted and hidden
5. Variables are available to your application immediately

## Verifying Setup

After setting all variables, you should see:

### Frontend Console (browser DevTools)
```
✅ Firebase initialized successfully
📧 Auth Domain: bboy-battle.firebaseapp.com
🔑 Project ID: bboy-battle
```

### Server Logs
```
✅ Firebase Admin SDK initialized successfully
✅ Authentication system is READY
✅ Mailgun initialized successfully
```

## Troubleshooting

### "Firebase is NOT configured"
- Check that all `VITE_FIREBASE_*` variables are set
- Restart the application (`npm run dev`)

### "auth/unauthorized-domain"
- Add your domain to Firebase Authorized domains (see Firebase Console Setup above)
- Redeploy or restart the application

### "Failed to send email"
- Verify `MAILGUN_API_KEY` is correct
- Check that the sending domain matches `MAILGUN_DOMAIN`
- Verify the sender email is verified in Mailgun

### "Authentication service unavailable"
- Check that `FIREBASE_SERVICE_ACCOUNT` is properly set
- Verify the JSON is valid (no extra quotes or formatting issues)
- Check server logs for detailed error messages

## Development vs Production

**Development (Replit):** All variables must be in Replit Secrets

**Production (Deployed):** 
- Environment variables are copied from Replit Secrets during deployment
- The build script automatically uses these values
- No additional configuration needed

## Security Best Practices

✅ **DO:**
- Keep all secrets in Replit Secrets (never hardcode them)
- Rotate API keys regularly
- Use service accounts for server-to-server communication
- Enable Firebase security rules

❌ **DON'T:**
- Commit secrets to Git
- Share secret keys in messages or emails
- Use the same secrets across environments
- Log or expose secret values

---

**Last Updated:** November 24, 2025
**For Support:** Contact the development team
