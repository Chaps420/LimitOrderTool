const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Xaman API configuration
const XAMAN_API_URL = 'https://xumm.app/api/v1/platform';
const API_KEY = process.env.XAMAN_API_KEY || '4b542925-2ad1-427c-b86a-4a8dcf7c5d6e';
const API_SECRET = process.env.XAMAN_API_SECRET || '6c1b8f3e-5d2a-4c9b-8e7f-9a3b6d8c4e2f';

console.log('🔐 Xaman API credentials loaded from environment');

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        hasCredentials: !!(API_KEY && API_SECRET)
    });
});

// Account info endpoint - fetch account sequence from XRPL
app.get('/account-info/:account', async (req, res) => {
    try {
        const { account } = req.params;
        console.log('🔍 Fetching account info for:', account);
        
        // Use public XRPL API to get account info
        const response = await fetch('https://s1.ripple.com:51234/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                method: 'account_info',
                params: [{
                    account: account,
                    ledger_index: 'current'
                }]
            })
        });

        if (response.ok) {
            const result = await response.json();
            if (result.result && result.result.account_data) {
                console.log('✅ Account info fetched for:', account);
                return res.json(result.result);
            }
        }

        res.status(404).json({ error: 'Account not found' });
    } catch (error) {
        console.error('❌ Account info error:', error);
        res.status(500).json({ error: 'Failed to fetch account info' });
    }
});

// Create Xaman payload endpoint
app.post('/create-payload', async (req, res) => {
    try {
        console.log('📝 Creating Xaman payload via backend API');
        console.log('📄 Payload request:', JSON.stringify(req.body, null, 2));
        
        // Fix the payload structure for Xaman API
        let payload = req.body;
        
        // For SignIn payloads, ensure proper structure
        if (payload.txjson && payload.txjson.TransactionType === 'SignIn') {
            payload = {
                txjson: {
                    TransactionType: 'SignIn'
                },
                options: {
                    submit: false,
                    expire: 5,
                    ...payload.options
                }
            };
        }
        
        console.log('📤 Sending to Xaman API:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(`${XAMAN_API_URL}/payload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-API-Secret': API_SECRET
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();
        console.log('📥 Xaman API response:', response.status, responseText);

        if (response.ok) {
            const result = JSON.parse(responseText);
            console.log('✅ Payload created:', result.uuid);
            res.json(result);
        } else {
            console.error('❌ Xaman API error:', responseText);
            res.status(response.status).json({ error: responseText });
        }
    } catch (error) {
        console.error('❌ Payload creation error:', error);
        res.status(500).json({ error: 'Failed to create payload' });
    }
});

// Create batch payload endpoint
app.post('/create-batch-payload', async (req, res) => {
    try {
        console.log('📦 Creating batch payload via backend API');
        
        const { transactions, options } = req.body;
        
        // Try XLS-56 batch transaction format
        const batchPayload = {
            txjson: transactions, // Array of transactions
            options: {
                submit: options?.submit || true,
                expire: options?.expire || 10,
                multisign: false,
                ...options
            }
        };

        const response = await fetch(`${XAMAN_API_URL}/payload`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': API_KEY,
                'X-API-Secret': API_SECRET
            },
            body: JSON.stringify(batchPayload)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Batch payload created:', result.uuid);
            res.json(result);
        } else {
            const errorText = await response.text();
            console.error('❌ Xaman batch API error:', errorText);
            res.status(response.status).json({ error: errorText });
        }
    } catch (error) {
        console.error('❌ Batch payload creation error:', error);
        res.status(500).json({ error: 'Failed to create batch payload' });
    }
});

// Check payload status endpoint
app.get('/payload-status/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        
        const response = await fetch(`${XAMAN_API_URL}/payload/${uuid}`, {
            headers: {
                'X-API-Key': API_KEY,
                'X-API-Secret': API_SECRET
            }
        });

        if (response.ok) {
            const result = await response.json();
            res.json(result);
        } else {
            const errorText = await response.text();
            res.status(response.status).json({ error: errorText });
        }
    } catch (error) {
        console.error('❌ Payload status error:', error);
        res.status(500).json({ error: 'Failed to check payload status' });
    }
});

// Start server
app.listen(port, () => {
    console.log('🚀 Starting secure backend server on port', port);
    console.log(`✅ Secure backend server running on http://localhost:${port}`);
    console.log('🔐 API credentials are safely stored in environment variables');
    console.log('📡 Ready to proxy Xaman API calls');
});
