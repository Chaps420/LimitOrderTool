# XRPL Limit Order Tool

A modern web application for creating multiple XRPL limit sell orders with market cap distribution and sequential batch execution.

## Features

- **Market Cap Distribution**: Automatically spread limit orders across a market cap range
- **Sequential Batch Processing**: Create multiple orders with individual signatures presented in a streamlined flow
- **Modern UI**: Dark theme with gold accents inspired by professional trading platforms
- **Multi-Wallet Support**: Compatible with Xaman, GemWallet, and Crossmark wallets
- **Real-time Validation**: Form validation and order preview before signing
- **Mobile Responsive**: Optimized for both desktop and mobile devices
- **Secure Backend**: Node.js backend handles API credentials securely

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`

## Usage

### Market Cap Distribution Strategy

1. **Connect Wallet**: Click "Connect Wallet" to connect your XRPL wallet
2. **Select Token**: Choose a token or enter custom token details
3. **Set Parameters**:
   - Bottom Market Cap: Lowest market cap for orders
   - Top Market Cap: Highest market cap for orders
   - Number of Orders: How many orders to create (2-50)
   - Total Token Amount: Total tokens to sell across all orders
4. **Calculate Orders**: Preview your order distribution
5. **Sign Transaction**: Execute all orders with a single signature

### Manual Order Entry

Create individual limit orders with custom prices and amounts.

## Technical Details

### Architecture

- **Frontend**: Vanilla JavaScript with modern ES6 modules
- **Build Tool**: Vite for development and production builds
- **XRPL Integration**: Direct connection to XRPL network
- **Wallet Integration**: Support for major XRPL wallets

### Key Components

- `XRPLClient`: Handles XRPL network communication
- `WalletConnector`: Manages wallet connections and transaction signing
- `OrderManager`: Calculates order distributions and creates XRPL transactions

## Supported Wallets

- **Xaman** (formerly XUMM): Mobile and browser extension
- **GemWallet**: Browser extension
- **Crossmark**: Browser extension

## Development

### Project Structure

```
src/
├── css/
│   └── styles.css          # Modern dark theme styling
├── js/
│   ├── app.js             # Main application logic
│   ├── xrpl-client.js     # XRPL network interface
│   ├── wallet-connector.js # Wallet integration
│   └── order-manager.js    # Order calculation and management
index.html                  # Main HTML file
package.json               # Dependencies and scripts
vite.config.js            # Vite configuration
```

### Available Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run preview`: Preview production build

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
