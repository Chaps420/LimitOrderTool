# XRPL Limit Order Tool - Secure Backend

This backend server acts as a secure proxy for Xaman API calls, keeping your API credentials safe from the frontend.

## 🔐 Security Features

- API credentials stored safely in environment variables
- Never exposed to the frontend/browser
- CORS enabled for frontend communication
- Proper error handling and logging

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env` (if available)
   - Or create `.env` with your Xaman API credentials:
   ```
   XAMAN_API_KEY=your-api-key-here
   XAMAN_API_SECRET=your-api-secret-here
   PORT=3001
   ```

3. **Start the server:**
   ```bash
   npm start
   # or for development with auto-reload:
   npm run dev
   ```

4. **Verify it's working:**
   - Visit: http://localhost:3001/health
   - Should return: `{"status":"healthy","hasCredentials":true}`

## 📡 API Endpoints

### `POST /create-payload`
Creates a Xaman payload for wallet connection.
```json
{
  "txjson": {
    "TransactionType": "SignIn"
  },
  "options": {
    "expire": 5
  }
}
```

### `POST /create-batch-payload`  
Creates a batch payload for multiple transactions.
```json
{
  "transactions": [
    {
      "TransactionType": "OfferCreate",
      "Account": "rAccountAddress...",
      "TakerPays": "1000000",
      "TakerGets": "1000"
    }
  ],
  "options": {
    "submit": true,
    "expire": 5
  }
}
```

### `GET /payload-status/:uuid`
Checks the status of a payload by UUID.

### `GET /health`
Health check endpoint.

## 🔧 Configuration

Environment variables:
- `XAMAN_API_KEY` - Your Xaman API key (required)
- `XAMAN_API_SECRET` - Your Xaman API secret (required)  
- `PORT` - Server port (default: 3001)
- `XAMAN_API_URL` - Custom Xaman API URL (optional)

## ⚠️ Security Notes

1. **Never commit the `.env` file** - it contains your API credentials
2. **Use HTTPS in production** - consider using a reverse proxy like nginx
3. **Restrict CORS origins** - modify the CORS settings for production
4. **Monitor API usage** - keep track of your Xaman API limits

## 🏗️ Production Deployment

For production, consider:
1. Using a process manager like PM2
2. Setting up HTTPS with a reverse proxy
3. Implementing rate limiting
4. Adding request logging
5. Using environment-specific configuration

## 🐛 Troubleshooting

- **"Missing required environment variables"** - Make sure `.env` file exists with correct credentials
- **CORS errors** - Check that frontend is running on expected port
- **API errors** - Verify Xaman API credentials are valid and have sufficient permissions
