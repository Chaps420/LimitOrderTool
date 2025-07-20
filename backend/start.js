// Starter script to launch server.js explicitly
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting XRPL Limit Order Backend Server...');
console.log('Working directory:', process.cwd());
console.log('Script location:', __dirname);

// Verify server.js exists
const serverPath = path.join(__dirname, 'server.js');
console.log('Looking for server at:', serverPath);

if (fs.existsSync(serverPath)) {
    console.log('✅ Server file found, loading...');
    // Load server
    require('./server.js');
} else {
    console.error('❌ Server file not found at:', serverPath);
    process.exit(1);
}
