# XRPL Limit Order Tool - Deployment Instructions

## Firebase Deployment Status

✅ **Firebase Project Created**: `xrpl-limit-order-tool`  
✅ **Backend Code Ready**: Complete Express.js API with Xaman integration  
✅ **Frontend Updated**: Firebase Functions URL configured  
⏳ **Waiting**: Firebase billing plan upgrade  

## Current Deployment Blocker

**You need to upgrade to Firebase Blaze plan to deploy Cloud Functions:**

1. **Visit**: https://console.firebase.google.com/project/xrpl-limit-order-tool/usage/details
2. **Click**: "Upgrade Project" 
3. **Select**: Blaze (pay-as-you-go) plan
4. **Set Limits**: Recommended $5/month spending limit for safety

**Cost**: Firebase Functions are FREE up to 2 million invocations/month

## After Billing Upgrade

### 1. Deploy Firebase Functions

```powershell
# Deploy the backend API
firebase deploy --only functions
```

### 2. Configure Xaman API Credentials

Get your Xaman API credentials from: https://apps.xumm.dev/

```powershell
# Set Xaman API configuration
firebase functions:config:set xaman.api_key="YOUR_XAMAN_API_KEY"
firebase functions:config:set xaman.api_secret="YOUR_XAMAN_API_SECRET"

# Redeploy with credentials
firebase deploy --only functions
```

### 3. Deploy Frontend to GitHub Pages

```powershell
# Build for production
npm run build

# The dist/ folder will contain your built frontend
# Deploy this to GitHub Pages
```

## API Endpoints (Once Deployed)

- **Health Check**: `https://us-central1-xrpl-limit-order-tool.cloudfunctions.net/api/health`
- **Create Xaman Payload**: `POST /api/xaman/payload`
- **Get Payload Status**: `GET /api/xaman/payload/:uuid`
- **Delete Payload**: `DELETE /api/xaman/payload/:uuid`
- **Token Info**: `GET /api/token/:currency/:issuer`

## Architecture

- **Frontend**: GitHub Pages (static hosting)
- **Backend**: Firebase Functions (serverless API)
- **Wallets**: Xaman, GemWallet, Crossmark support
- **Network**: XRPL Mainnet/Testnet

## Next Steps

1. ✅ Upgrade Firebase billing plan
2. 🔄 Deploy Firebase Functions
3. 🔄 Configure Xaman API credentials  
4. 🔄 Test backend endpoints
5. 🔄 Build and deploy frontend
6. 🔄 Test full application flow

**Your Firebase console**: https://console.firebase.google.com/project/xrpl-limit-order-tool/overview
