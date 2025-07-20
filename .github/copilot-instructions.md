<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# XRPL Limit Order Tool - Copilot Instructions

This is a modern web application for creating XRPL limit orders with market cap distribution features.

## Project Context

- **Technology Stack**: Vanilla JavaScript ES6 modules, HTML5, CSS3, Vite build tool
- **Target**: XRPL (XRP Ledger) blockchain integration
- **Primary Feature**: Batch limit order creation with single wallet signature
- **UI Theme**: Dark modern design with gold accents, inspired by professional trading platforms

## Key Components

1. **XRPLClient** (`src/js/xrpl-client.js`): Handles all XRPL network interactions
2. **WalletConnector** (`src/js/wallet-connector.js`): Manages wallet connections (Xaman, GemWallet, Crossmark)
3. **OrderManager** (`src/js/order-manager.js`): Calculates order distributions and creates XRPL transactions
4. **App** (`src/js/app.js`): Main application logic and UI coordination

## Coding Standards

- Use ES6 modules with import/export
- Follow async/await patterns for asynchronous operations
- Implement proper error handling with try/catch blocks
- Use semantic HTML5 elements
- Follow BEM methodology for CSS classes when possible
- Maintain responsive design for mobile compatibility

## XRPL Integration Guidelines

- All amounts should be properly formatted for XRPL (XRP in drops, IOUs with issuer/currency)
- Use OfferCreate transactions for limit orders
- Implement proper sequence number handling for batch transactions
- Always validate addresses and transaction parameters
- Handle network errors gracefully

## UI/UX Guidelines

- Maintain dark theme with gold (#ffc107) accent colors
- Use smooth animations and transitions (0.3s ease)
- Implement loading states and user feedback
- Ensure forms have proper validation and error messages
- Keep the interface clean and professional

## Security Considerations

- Never store or transmit private keys
- All transaction signing must happen in the user's wallet
- Validate all user inputs before processing
- Use secure WebSocket connections (wss://) for XRPL
- Implement proper error boundaries

When suggesting code changes or additions, consider the existing architecture and maintain consistency with the established patterns.
