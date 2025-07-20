// Simple test to debug the issue
console.log('Current working directory:', process.cwd());
console.log('Script file location:', __filename);
console.log('Script directory:', __dirname);

require('dotenv').config();

console.log('Environment variables:');
console.log('XAMAN_API_KEY:', process.env.XAMAN_API_KEY ? 'Present' : 'Missing');
console.log('XAMAN_API_SECRET:', process.env.XAMAN_API_SECRET ? 'Present' : 'Missing');
console.log('PORT:', process.env.PORT);

console.log('✅ Debug test complete');
