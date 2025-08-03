import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as express from "express";
import * as cors from "cors";
import fetch from "node-fetch";
import * as dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// Set global options for 2nd gen functions
setGlobalOptions({ maxInstances: 10 });

// Initialize Firebase Admin
admin.initializeApp();

const app = express();

// Configure CORS
app.use(cors({
  origin: true,
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req: any, res: any) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'xrpl-limit-order-functions'
  });
});

// Xaman API proxy endpoints
app.post('/api/xaman/payload', async (req: any, res: any) => {
  try {
    console.log('Creating Xaman payload:', req.body);
    
    // For 2nd gen functions, use environment variables instead of functions.config()
    const xamanApiKey = process.env.XAMAN_API_KEY;
    const xamanApiSecret = process.env.XAMAN_API_SECRET;
    
    if (!xamanApiKey || !xamanApiSecret) {
      console.log('No Xaman credentials, returning mock payload for development');
      // Return mock payload for development/testing
      return res.json({ 
        uuid: 'mock-' + Date.now(),
        next: {
          always: 'https://xumm.app/sign/mock-' + Date.now()
        },
        refs: {
          qr_png: 'https://chart.apis.google.com/chart?cht=qr&chs=300x300&chl=mock-qr-code'
        },
        pushed: false
      });
    }

    const response = await fetch('https://xumm.app/api/v1/platform/payload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': xamanApiKey,
        'X-API-Secret': xamanApiSecret
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      throw new Error(`Xaman API error: ${response.status}`);
    }

    const data = await response.json();
    return res.json(data);

  } catch (error: any) {
    console.error('Xaman payload creation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create Xaman payload',
      details: error.message 
    });
  }
});

// Get Xaman payload status
app.get('/api/xaman/payload/:uuid', async (req: any, res: any) => {
  try {
    const { uuid } = req.params;
    console.log('Getting Xaman payload status:', uuid);
    
    const xamanApiKey = process.env.XAMAN_API_KEY;
    const xamanApiSecret = process.env.XAMAN_API_SECRET;
    
    if (!xamanApiKey || !xamanApiSecret) {
      // Return mock status for development
      if (uuid.startsWith('mock-')) {
        return res.json({
          meta: {
            signed: false,
            resolved: false
          },
          response: null
        });
      }
      return res.status(500).json({ 
        error: 'Xaman API credentials not configured' 
      });
    }

    const response = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
      method: 'GET',
      headers: {
        'X-API-Key': xamanApiKey,
        'X-API-Secret': xamanApiSecret
      }
    });

    if (!response.ok) {
      throw new Error(`Xaman API error: ${response.status}`);
    }

    const data = await response.json();
    return res.json(data);

  } catch (error: any) {
    console.error('Xaman payload status error:', error);
    return res.status(500).json({ 
      error: 'Failed to get payload status',
      details: error.message 
    });
  }
});

// Delete Xaman payload
app.delete('/api/xaman/payload/:uuid', async (req: any, res: any) => {
  try {
    const { uuid } = req.params;
    console.log('Deleting Xaman payload:', uuid);
    
    const xamanApiKey = process.env.XAMAN_API_KEY;
    const xamanApiSecret = process.env.XAMAN_API_SECRET;
    
    if (!xamanApiKey || !xamanApiSecret) {
      return res.status(500).json({ 
        error: 'Xaman API credentials not configured' 
      });
    }

    const response = await fetch(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': xamanApiKey,
        'X-API-Secret': xamanApiSecret
      }
    });

    if (!response.ok) {
      throw new Error(`Xaman API error: ${response.status}`);
    }

    return res.json({ success: true });

  } catch (error: any) {
    console.error('Xaman payload deletion error:', error);
    return res.status(500).json({ 
      error: 'Failed to delete payload',
      details: error.message 
    });
  }
});

// Token info endpoint (proxy for token data)
app.get('/api/token/:currency/:issuer', async (req: any, res: any) => {
  try {
    const { currency, issuer } = req.params;
    
    // Here you could integrate with XRPL APIs or other token data sources
    // For now, return basic structure
    return res.json({
      currency,
      issuer,
      symbol: currency,
      name: `${currency} Token`,
      totalSupply: null, // Would fetch from XRPL
      decimals: 6
    });

  } catch (error: any) {
    console.error('Token info error:', error);
    return res.status(500).json({ 
      error: 'Failed to get token info',
      details: error.message 
    });
  }
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    details: error.message 
  });
});

// Export the Express app as a Firebase Function (v2)
export const api = onRequest(app);

// Additional Firebase Functions can be added here
// export const onUserCreate = onCall((user: any) => {
//   console.log('New user created:', user.uid);
//   // Add any user creation logic here
// });
