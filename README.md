# XRPL Limit Order Tool

A modern web application for creating multiple XRPL limit sell orders with market cap distribution and sequential batch execution. **Runs with or without a backend server!**

## ✨ Features

- **🎯 Dual Distribution System**: Linear (default) and Logarithmic order placement algorithms
- **⚡ Standalone Mode**: Runs completely client-side without requiring a backend server
- **🔄 Auto-Detection**: Automatically switches between backend and standalone modes
- **📊 Enhanced Token Distribution**: More realistic market behavior with logarithmic weighting

## Features

- **Market Cap Distribution**: Automatically spread limit orders across a market cap range with Linear or Logarithmic distribution
- **Sequential Batch Processing**: Create unlimited orders with individual signatures in a streamlined flow
- **Dual Operating Modes**: Works with backend (full API) or standalone (client-side only)
- **Modern UI**: Dark theme with gold accents inspired by professional trading platforms
- **Multi-Wallet Support**: Compatible with Xaman, GemWallet, and Crossmark wallets
- **Real-time Validation**: Form validation and order preview before signing
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Token Supply Auto-Fill**: Automatically fetches token supply from XRPL network

## Quick Start

### Option 1: With Backend (Full Features)

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Start the backend server:
   ```bash
   cd backend
   npm install
   node server.js
   ```

4. Open your browser to `http://localhost:3003`

### Option 2: Standalone Mode (No Backend Required)

1. **Static Hosting**: Deploy frontend files to any static hosting service
   - GitHub Pages, Netlify, Vercel, etc.
   - No server setup required!

2. **Local Development**: 
   ```bash
   npm run dev
   ```
   - Stop the backend server (Ctrl+C)
   - App automatically switches to standalone mode

3. **Direct File Access**: Open `index.html` directly in your browser

## Usage

### Market Cap Distribution Strategy

1. **Connect Wallet**: Click "Connect Wallet" to connect your XRPL wallet
2. **Select Token**: Choose a token or enter custom token details (supply auto-fills)
3. **Choose Distribution Method**:
   - ✅ **Linear (Default)**: Evenly spaced price intervals
   - 📈 **Logarithmic**: More orders at lower prices (realistic market behavior)
4. **Set Parameters**:
   - Bottom Market Cap: Lowest market cap for orders
   - Top Market Cap: Highest market cap for orders
   - Number of Orders: How many orders to create (unlimited in sequential mode)
   - Total Token Amount: Total tokens to sell across all orders
5. **Calculate Orders**: Preview your order distribution
6. **Sign Transactions**: Execute orders with individual QR codes (sequential signing)

## Technical Details

### Architecture

- **Frontend**: Vanilla JavaScript with modern ES6 modules
- **Build Tool**: Vite for development and production builds
- **XRPL Integration**: Direct connection to XRPL network
- **Wallet Integration**: Support for major XRPL wallets
- **Dual Mode Support**: Backend API integration or standalone client-side operation

### Operating Modes

**🔐 Backend Mode (Full Features):**
- Real Xaman API integration via secure backend proxy
- Advanced payload monitoring and status updates
- CORS handling for API requests
- Production-ready for high-volume usage

**⚡ Standalone Mode (No Backend Required):**
- Client-side Xaman SDK integration
- Direct XRPL network connections
- QR code generation via external API
- Perfect for static hosting deployments

### Key Components

- `XRPLClient`: Handles XRPL network communication
- `WalletConnector`: Manages wallet connections and transaction signing (backend mode)
- `WalletConnectorStandalone`: Client-side wallet integration (standalone mode)
- `OrderManager`: Calculates Linear/Logarithmic distributions and creates XRPL transactions

## Supported Wallets

- **Xaman** (formerly XUMM): Mobile and browser extension
- **GemWallet**: Browser extension
- **Crossmark**: Browser extension

## Development

### Project Structure

```
src/
├── css/
│   └── styles.css                    # Modern dark theme styling
├── js/
│   ├── app.js                       # Main application logic with mode detection
│   ├── xrpl-client.js               # XRPL network interface
│   ├── wallet-connector-real.js     # Backend-based wallet integration
│   ├── wallet-connector-standalone.js # Client-side wallet integration
│   └── order-manager.js             # Linear/Logarithmic distribution calculations
backend/
├── server.js                        # Node.js backend for Xaman API (optional)
├── package.json                     # Backend dependencies
└── README.md                        # Backend setup instructions
index.html                           # Main HTML file
standalone-demo.html                 # Standalone mode demonstration
package.json                         # Frontend dependencies and scripts
vite.config.js                      # Vite configuration
```

### Available Scripts

- `npm run dev`: Start development server (frontend)
- `npm run build`: Build for production
- `npm run preview`: Preview production build

### Backend Scripts (Optional)

- `cd backend && npm install`: Install backend dependencies
- `cd backend && node server.js`: Start backend server on port 3002

## Deployment Options

### Static Hosting (Standalone Mode)
Deploy just the frontend files to any static hosting service:

- **GitHub Pages**: Push to gh-pages branch or use Actions
- **Netlify**: Drag & drop build folder or connect Git repo
- **Vercel**: Import project and deploy automatically
- **AWS S3**: Upload static files to S3 bucket
- **Any CDN**: Works with any static file hosting

### Full Stack Deployment (Backend Mode)
Deploy both frontend and backend for full API integration:

- **Railway**: Connect GitHub repo, auto-deploy both services
- **Heroku**: Deploy Node.js backend + static frontend
- **DigitalOcean**: VPS with PM2 process manager
- **AWS/Google Cloud/Azure**: Container or serverless deployment

## Configuration

The application connects to the public XRPL network by default. You can modify the network configuration in `src/js/xrpl-client.js`.

## Security Considerations

- All transactions are signed locally in the user's wallet
- No private keys are stored or transmitted
- Network connections use secure WebSocket (wss://)
- Input validation prevents malformed transactions

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Modern mobile browsers

## License

MIT License - see LICENSE file for details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Support

For issues and questions:
- Check the GitHub issues
- Review XRPL documentation
- Test with small amounts first

## Disclaimer

This is a trading tool that interacts with live cryptocurrency markets. Always:
- Test with small amounts first
- Understand the risks involved
- Verify all transaction details before signing
- Keep your wallet software updated
