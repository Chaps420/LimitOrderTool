// XRPL Limit Order Tool - Secure Backend Server
// This server acts as a proxy for Xaman API calls to keep credentials secure

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Environment variables
const XAMAN_API_KEY = process.env.XAMAN_API_KEY;
const XAMAN_API_SECRET = process.env.XAMAN_API_SECRET;
const XAMAN_API_URL = 'https://xumm.app/api/v1/platform';

// Validate required environment variables
if (!XAMAN_API_KEY || !XAMAN_API_SECRET) {
    console.error('❌ Missing required environment variables: XAMAN_API_KEY, XAMAN_API_SECRET');
    process.exit(1);
}

console.log('🔐 Xaman API credentials loaded from environment');
console.log(`🚀 Starting secure backend server on port ${PORT}`);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        hasCredentials: !!(XAMAN_API_KEY && XAMAN_API_SECRET)
    });
});

// Create Xaman payload (for wallet connection)
app.post('/create-payload', async (req, res) => {
    try {
        console.log('📝 Creating Xaman payload via backend API');
        
        const { txjson, options } = req.body;
        
        const response = await fetch(`${XAMAN_API_URL}/payload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': XAMAN_API_KEY,
                'X-API-Secret': XAMAN_API_SECRET
            },
            body: JSON.stringify({
                txjson: txjson,
                options: options || {}
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Xaman API error:', data);
            return res.status(response.status).json({ 
                error: 'Xaman API error', 
                details: data 
            });
        }

        console.log('✅ Payload created:', data.uuid);
        res.json(data);
        
    } catch (error) {
        console.error('❌ Backend payload creation error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
});

// Create batch order payload
app.post('/create-batch-payload', async (req, res) => {
    try {
        console.log('📦 Creating batch payload via backend API');
        
        const { transactions, options } = req.body;
        
        if (!transactions || !Array.isArray(transactions)) {
            return res.status(400).json({ 
                error: 'Invalid request', 
                message: 'transactions array is required' 
            });
        }

        const response = await fetch(`${XAMAN_API_URL}/payload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': XAMAN_API_KEY,
                'X-API-Secret': XAMAN_API_SECRET
            },
            body: JSON.stringify({
                txjson: transactions,
                options: options || {}
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Xaman batch API error:', data);
            return res.status(response.status).json({ 
                error: 'Xaman API error', 
                details: data 
            });
        }

        console.log('✅ Batch payload created:', data.uuid);
        res.json(data);
        
    } catch (error) {
        console.error('❌ Backend batch creation error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
});

// Check payload status
app.get('/payload-status/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        
        const response = await fetch(`${XAMAN_API_URL}/payload/${uuid}`, {
            headers: {
                'X-API-Key': XAMAN_API_KEY,
                'X-API-Secret': XAMAN_API_SECRET
            }
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error('❌ Xaman status API error:', data);
            return res.status(response.status).json({ 
                error: 'Xaman API error', 
                details: data 
            });
        }

        res.json(data);
        
    } catch (error) {
        console.error('❌ Backend status check error:', error);
        res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('🚨 Unhandled error:', error);
    res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: 'API endpoint not found'
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`✅ Secure backend server running on http://localhost:${PORT}`);
    console.log('🔐 API credentials are safely stored in environment variables');
    console.log('📡 Ready to proxy Xaman API calls');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Received SIGTERM, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('🛑 Received SIGINT, shutting down gracefully');
    process.exit(0);
});
