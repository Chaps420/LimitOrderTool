"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.api = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const admin = require("firebase-admin");
const express = require("express");
const cors = require("cors");
const node_fetch_1 = require("node-fetch");
// Set global options for 2nd gen functions
(0, v2_1.setGlobalOptions)({ maxInstances: 10 });
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
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'xrpl-limit-order-functions'
    });
});
// Xaman API proxy endpoints
app.post('/api/xaman/payload', async (req, res) => {
    try {
        console.log('Creating Xaman payload:', req.body);
        // For 2nd gen functions, use environment variables instead of functions.config()
        const xamanApiKey = process.env.XAMAN_API_KEY;
        const xamanApiSecret = process.env.XAMAN_API_SECRET;
        if (!xamanApiKey || !xamanApiSecret) {
            return res.status(500).json({
                error: 'Xaman API credentials not configured. Please set XAMAN_API_KEY and XAMAN_API_SECRET environment variables.'
            });
        }
        const response = await (0, node_fetch_1.default)('https://xumm.app/api/v1/platform/payload', {
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
    }
    catch (error) {
        console.error('Xaman payload creation error:', error);
        return res.status(500).json({
            error: 'Failed to create Xaman payload',
            details: error.message
        });
    }
});
// Get Xaman payload status
app.get('/api/xaman/payload/:uuid', async (req, res) => {
    try {
        const { uuid } = req.params;
        console.log('Getting Xaman payload status:', uuid);
        const xamanApiKey = process.env.XAMAN_API_KEY;
        const xamanApiSecret = process.env.XAMAN_API_SECRET;
        if (!xamanApiKey || !xamanApiSecret) {
            return res.status(500).json({
                error: 'Xaman API credentials not configured'
            });
        }
        const response = await (0, node_fetch_1.default)(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
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
    }
    catch (error) {
        console.error('Xaman payload status error:', error);
        return res.status(500).json({
            error: 'Failed to get payload status',
            details: error.message
        });
    }
});
// Delete Xaman payload
app.delete('/api/xaman/payload/:uuid', async (req, res) => {
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
        const response = await (0, node_fetch_1.default)(`https://xumm.app/api/v1/platform/payload/${uuid}`, {
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
    }
    catch (error) {
        console.error('Xaman payload deletion error:', error);
        return res.status(500).json({
            error: 'Failed to delete payload',
            details: error.message
        });
    }
});
// Token info endpoint (proxy for token data)
app.get('/api/token/:currency/:issuer', async (req, res) => {
    try {
        const { currency, issuer } = req.params;
        // Here you could integrate with XRPL APIs or other token data sources
        // For now, return basic structure
        return res.json({
            currency,
            issuer,
            symbol: currency,
            name: `${currency} Token`,
            totalSupply: null,
            decimals: 6
        });
    }
    catch (error) {
        console.error('Token info error:', error);
        return res.status(500).json({
            error: 'Failed to get token info',
            details: error.message
        });
    }
});
// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Express error:', error);
    res.status(500).json({
        error: 'Internal server error',
        details: error.message
    });
});
// Export the Express app as a Firebase Function (v2)
exports.api = (0, https_1.onRequest)(app);
// Additional Firebase Functions can be added here
// export const onUserCreate = onCall((user: any) => {
//   console.log('New user created:', user.uid);
//   // Add any user creation logic here
// });
//# sourceMappingURL=index.js.map