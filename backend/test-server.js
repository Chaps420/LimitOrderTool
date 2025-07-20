// Quick test server
const express = require('express');
const cors = require('cors');
require('dotenv').config();

console.log('🚀 Quick Test Server Starting...');
console.log('Working Directory:', process.cwd());

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Test endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        timestamp: new Date().toISOString(),
        hasCredentials: !!(process.env.XAMAN_API_KEY && process.env.XAMAN_API_SECRET),
        workingDir: process.cwd()
    });
});

app.listen(PORT, () => {
    console.log(`✅ Test server running on http://localhost:${PORT}`);
    console.log(`🔐 API Key present: ${!!process.env.XAMAN_API_KEY}`);
    console.log(`🔐 API Secret present: ${!!process.env.XAMAN_API_SECRET}`);
});
