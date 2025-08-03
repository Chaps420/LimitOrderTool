import { XRPLClient } from './xrpl-client.js';
import { WalletConnector } from './wallet-connector-real.js';
import { WalletConnectorStandalone } from './wallet-connector-standalone.js';
import { OrderManager } from './order-manager.js';

class App {
    constructor() {
        this.xrplClient = new XRPLClient();
        
        // Auto-detect standalone mode (no backend available)
        this.standaloneMode = false;
        this.githubMode = false; // Track GitHub Pages mode
        this.walletConnector = null;
        
        this.orderManager = new OrderManager();
        this.orders = [];
        this.walletAddress = null;
        
        // Sequential signing allows unlimited orders (no batch limit)
        this.MAX_BATCH_ORDERS = 999; // Effectively unlimited for sequential signing
        this.MIN_ORDERS = 1;
        
        this.init();
    }

    async waitForXRPLLibrary() {
        // Wait up to 10 seconds for XRPL library to load
        const maxWait = 10000;
        const checkInterval = 100;
        let waited = 0;
        
        console.log('⏳ Waiting for XRPL library to load...');
        
        while (!window.xrpl && waited < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            waited += checkInterval;
        }
        
        if (!window.xrpl) {
            throw new Error('XRPL library failed to load after 10 seconds');
        }
        
        console.log('✅ XRPL library is ready');
    }

    /**
     * Auto-detect if backend is available, switch to standalone if not
     */
    async detectAndInitializeWalletConnector() {
        console.log('🔍 Detecting wallet connector mode...');
        
        try {
            // First try GitHub Pages mode (direct Xaman API)
            console.log('� Using GitHub Pages mode with direct Xaman API...');
            
            try {
                // Always use GitHub connector for production
                const { WalletConnectorGitHub } = await import('./wallet-connector-github.js');
                this.standaloneMode = false;
                this.githubMode = true; // Set GitHub mode flag
                this.walletConnector = new WalletConnectorGitHub();
                this.walletConnector.onConnect = (address) => {
                    this.onWalletConnected(address);
                };
                this.updateUIForMode('github');
                console.log('✅ GitHub Pages mode initialized');
                return;
            } catch (githubError) {
                console.log('� GitHub mode failed:', githubError.message);
            }
            
            // Fallback: Try local backend
            console.log('📡 Trying local backend at localhost:3002...');
            try {
                const response = await fetch('http://localhost:3002/health', { 
                    method: 'GET',
                    signal: AbortSignal.timeout(3000)
                });
                
                if (response.ok) {
                    console.log('🔐 Local backend detected, using development mode');
                    const { WalletConnector } = await import('./wallet-connector.js');
                    this.standaloneMode = false;
                    this.walletConnector = new WalletConnector();
                    this.walletConnector.onConnect = (address) => {
                        this.onWalletConnected(address);
                    };
                    this.updateUIForMode('backend');
                    console.log('✅ Local backend mode initialized');
                    return;
                }
            } catch (backendError) {
                console.log('📡 Local backend not available:', backendError.message);
            }
            
            // Final fallback: Standalone mode
            throw new Error('No backend services available');
            
        } catch (error) {
            console.log('⚡ No backend detected, switching to standalone mode:', error.message);
            
            try {
                const { WalletConnectorStandalone } = await import('./wallet-connector-standalone.js');
                this.standaloneMode = true;
                this.walletConnector = new WalletConnectorStandalone();
                this.walletConnector.onConnect = (address) => {
                    this.onWalletConnected(address);
                };
                this.updateUIForMode('standalone');
                console.log('✅ Standalone mode initialized');
            } catch (standaloneError) {
                console.error('❌ Failed to initialize standalone mode:', standaloneError);
                this.showError('❌ Failed to initialize wallet system: ' + standaloneError.message);
            }
        }
    }

    getFirebaseUrl() {
        // Use the actual Firebase project ID we created
        const projectId = 'xrpl-limit-order-tool';
        
        // For local development, use Firebase emulator
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return `http://localhost:5001/${projectId}/us-central1/api`;
        }
        
        // For production (GitHub Pages), use Firebase Functions URL
        return `https://us-central1-${projectId}.cloudfunctions.net/api`;
    }

    extractProjectIdFromHostname(hostname) {
        // Not needed anymore since we use fixed project ID
        return 'xrpl-limit-order-tool';
    }

    /**
     * Update UI based on current mode
     */
    updateUIForMode(mode) {
        const statusElement = document.getElementById('backend-status');
        if (statusElement) {
            if (mode === 'github') {
                statusElement.innerHTML = '<span style="color: #28a745;">🐙 GitHub Pages Mode</span>';
                statusElement.title = 'Using GitHub Pages with direct Xaman API integration';
            } else if (mode === 'firebase') {
                statusElement.innerHTML = '<span style="color: #28a745;">🔥 Firebase Production Mode</span>';
                statusElement.title = 'Connected to Firebase Functions with full Xaman API';
            } else if (mode === 'backend') {
                statusElement.innerHTML = '<span style="color: #28a745;">✅ Local Backend Mode</span>';
                statusElement.title = 'Connected to local backend server with full Xaman API';
            } else {
                statusElement.innerHTML = '<span style="color: #ffc107;">⚡ Standalone Mode (Limited)</span>';
                statusElement.title = 'Running without backend server - limited wallet integration';
            }
        }

        // Show mode indicator in UI
        this.showModeNotification(mode);
    }

    /**
     * Show notification about current mode
     */
    showModeNotification(mode) {
        const message = mode === 'github' 
            ? '🐙 GitHub Pages Mode - Direct Xaman API integration!'
            : mode === 'standalone' 
            ? '⚡ Running in Standalone Mode - No backend required!'
            : '🔐 Running with Backend - Full Xaman API integration';
        
        const type = mode === 'standalone' ? 'info' : 'success';
        this.showNotification(message, type);
    }

    // Helper function to decode hex-encoded currency codes
    decodeCurrencyCode(currency) {
        // If it's exactly 3 characters, it's a standard currency code
        if (currency.length === 3) {
            return currency;
        }
        
        // If it's 40 characters and all hex, it's an encoded currency
        if (currency.length === 40 && /^[0-9A-F]+$/i.test(currency)) {
            try {
                let decoded = '';
                for (let i = 0; i < currency.length; i += 2) {
                    const hex = currency.substr(i, 2);
                    const charCode = parseInt(hex, 16);
                    if (charCode !== 0) {
                        decoded += String.fromCharCode(charCode);
                    }
                }
                // Return decoded name if it contains readable characters
                if (decoded.trim() && /^[\x20-\x7E]+$/.test(decoded.trim())) {
                    return decoded.trim();
                }
            } catch (e) {
                console.log('Could not decode currency:', currency);
            }
        }
        
        // Return original if can't decode
        return currency;
    }

    // Helper function to get a friendly token name
    getFriendlyTokenName(currency, issuer) {
        const decoded = this.decodeCurrencyCode(currency);
        
        // Known token mappings for better display names
        const knownTokens = {
            'solo': 'SOLO',
            'coreum': 'CORE',
            'evernode': 'EVR',
            'xft': 'XFT',
            'csc': 'CSC',
            'honey': 'HONEY',
            'nps': 'NPS'
        };
        
        const lowerDecoded = decoded.toLowerCase();
        if (knownTokens[lowerDecoded]) {
            return knownTokens[lowerDecoded];
        }
        
        return decoded;
    }

    async init() {
        // Wait for XRPL library to be fully loaded
        await this.waitForXRPLLibrary();
        
        // First, detect and initialize the appropriate wallet connector
        await this.detectAndInitializeWalletConnector();
        
        this.setupEventListeners();
        await this.xrplClient.connect();
        this.updateNetworkStatus('connected', 'Connected to XRPL');
        this.loadPopularTokens();
        
        // Session-based connection - no automatic reconnection from localStorage
        console.log('🔄 Session-based mode - wallet must be connected each session');
        console.log('💡 No automatic reconnection - user must connect wallet manually');
        
        // Check backend status (skip for standalone and GitHub modes)
        if (!this.standaloneMode && !this.githubMode) {
            await this.checkBackendStatus();
        }
    }

    async ensureXRPLConnection() {
        console.log('🔗 Ensuring XRPL connection...');
        
        // Wait up to 10 seconds for XRPL client to be connected
        let attempts = 0;
        const maxAttempts = 100; // 10 seconds with 100ms intervals
        
        while (!this.xrplClient.isConnected && attempts < maxAttempts) {
            console.log(`⏳ Waiting for XRPL connection (attempt ${attempts + 1}/${maxAttempts})...`);
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        if (!this.xrplClient.isConnected) {
            console.error('❌ XRPL connection timeout after 10 seconds');
            throw new Error('XRPL connection timeout');
        }
        
        console.log('✅ XRPL connection confirmed');
    }

    setupEventListeners() {
        // Wallet connection
        const connectWalletBtn = document.getElementById('connectWallet');
        if (connectWalletBtn) {
            connectWalletBtn.addEventListener('click', () => {
                this.connectWallet();
            });
        }

        // Wallet disconnection
        const disconnectWalletBtn = document.getElementById('disconnectWallet');
        if (disconnectWalletBtn) {
            disconnectWalletBtn.addEventListener('click', () => {
                this.disconnectWallet();
            });
        }

        // Token selection
        const tokenSelect = document.getElementById('tokenSelect');
        if (tokenSelect) {
            tokenSelect.addEventListener('change', (e) => {
                this.handleTokenSelection(e.target.value);
            });
        }

        // Calculate orders
        const calculateOrdersBtn = document.getElementById('calculateOrders');
        if (calculateOrdersBtn) {
            calculateOrdersBtn.addEventListener('click', () => {
                this.calculateOrders();
            });
        }

        // Create orders
        const createOrdersBtn = document.getElementById('createOrders');
        if (createOrdersBtn) {
            createOrdersBtn.addEventListener('click', () => {
                this.createOrders();
            });
        }

        // Sign transaction
        const signTransactionBtn = document.getElementById('signTransaction');
        if (signTransactionBtn) {
            signTransactionBtn.addEventListener('click', (event) => {
                console.log('🔘 Sign transaction button click event triggered');
                event.preventDefault();
                event.stopPropagation();
                this.signTransaction();
            });
        }

        // Test live connection (admin feature)
        const testBtn = document.getElementById('testLiveConnection');
        if (testBtn) {
            testBtn.addEventListener('click', () => {
                this.testLiveWalletConnection();
            });
        }

        // Form validation
        this.setupFormValidation();
    }

    async checkBackendStatus() {
        const statusElement = document.getElementById('backend-status');
        if (!statusElement) return;

        try {
            const response = await fetch('http://localhost:3002/health');
            if (response.ok) {
                const status = await response.json();
                statusElement.innerHTML = '<span style="color: #28a745;">✅ Running on localhost:3002</span>';
                statusElement.title = `Has Credentials: ${status.hasCredentials}`;
                console.log('🔐 Backend server is running with credentials:', status.hasCredentials);
            }
        } catch (error) {
            statusElement.innerHTML = '<span style="color: #dc3545;">❌ Offline</span>';
            statusElement.title = 'Backend server not accessible';
            console.warn('⚠️ Backend server not accessible:', error);
        }
    }

    async testLiveWalletConnection() {
        const testBtn = document.getElementById('testLiveConnection');
        const originalText = testBtn.textContent;
        
        testBtn.innerHTML = '<span class="spinner"></span> Testing Live API...';
        testBtn.disabled = true;

        try {
            console.log('🧪 Testing live Xaman API connection...');
            
            // Try to create a real sign-in payload
            const testPayload = await this.walletConnector.createXamanPayload({
                TransactionType: 'SignIn'
            });

            if (testPayload.uuid && !testPayload.uuid.startsWith('mock-')) {
                testBtn.innerHTML = '✅ Live API Connected!';
                testBtn.style.background = '#28a745';
                console.log('✅ Real Xaman payload created:', testPayload.uuid);
                
                // Show success message
                this.showNotification('🎉 Live Xaman API is working! Ready for real wallet connections.', 'success');
            } else {
                testBtn.innerHTML = '🧪 Using Mock (Dev Mode)';
                testBtn.style.background = '#ffc107';
                testBtn.style.color = '#000';
                console.log('🧪 Mock payload created for development');
            }
            
        } catch (error) {
            testBtn.innerHTML = '❌ API Test Failed';
            testBtn.style.background = '#dc3545';
            console.error('❌ Live API test failed:', error);
            this.showNotification('API test failed: ' + error.message, 'error');
        }

        // Reset button after 3 seconds
        setTimeout(() => {
            testBtn.textContent = originalText;
            testBtn.disabled = false;
            testBtn.style.background = '';
            testBtn.style.color = '';
        }, 3000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#ffc107'};
            color: white;
            border-radius: 8px;
            z-index: 10000;
            font-weight: 500;
            max-width: 300px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    async connectWallet() {
        console.log('🔗 Connect wallet button clicked');
        
        if (!this.walletConnector) {
            console.error('❌ Wallet connector not initialized');
            this.showError('Wallet connector not ready. Please refresh the page.');
            return;
        }
        
        const button = document.getElementById('connectWallet');
        const originalText = button.textContent;
        
        console.log('🔄 Starting wallet connection...');
        button.innerHTML = '<span class="spinner"></span> Connecting...';
        button.disabled = true;

        try {
            console.log('🎯 Calling wallet connector...');
            const result = await this.walletConnector.connect();
            console.log('✅ Wallet connected with result:', result);
            
            const address = result.address || result;
            this.walletAddress = address;
            
            // Session-based connection - no localStorage persistence
            console.log('📝 Session-based connection - no persistence to localStorage');
            
            // Update UI
            this.onWalletConnected(address);
            
        } catch (error) {
            console.error('❌ Wallet connection failed:', error);
            button.textContent = originalText;
            button.disabled = false;
            
            this.showError('Failed to connect wallet: ' + error.message);
        }
    }

    async onWalletConnected(address) {
        // Validate address before proceeding
        if (!address || typeof address !== 'string') {
            console.warn('Invalid wallet address received:', address);
            return;
        }
        
        // Set the wallet address in the app
        this.walletAddress = address;
        
        // Update UI elements
        document.getElementById('connectWallet').style.display = 'none';
        document.getElementById('disconnectWallet').style.display = 'block';
        
        const walletInfo = document.getElementById('walletInfo');
        const walletAddress = document.getElementById('walletAddress');
        walletAddress.textContent = `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
        walletInfo.style.display = 'flex';
        
        this.updateNetworkStatus('connected', `Wallet Connected: ${address.substring(0, 12)}...`);
        
        console.log('🔄 Loading wallet balance and tokens...');
        
        // Wait for XRPL connection before loading balance
        await this.ensureXRPLConnection();
        
        // Fetch wallet balance and holdings
        await this.loadWalletBalance();
        
        console.log('✅ Wallet balance loaded, enabling order creation');
        // Enable order creation
        this.enableOrderCreation();
    }

    disconnectWallet() {
        // Disconnect from wallet connector
        if (this.walletConnector) {
            this.walletConnector.disconnect();
        }
        
        // Clear wallet data
        this.walletAddress = null;
        
        // Session-based connection - no localStorage to clear
        console.log('🗑️ Session-based disconnect - no localStorage to clear');
        
        // Update UI
        document.getElementById('connectWallet').style.display = 'block';
        document.getElementById('disconnectWallet').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'none';
        
        this.updateNetworkStatus('disconnected', 'Wallet Disconnected');
        
        // Disable order creation
        this.disableOrderCreation();
        
        // Clear any existing orders
        this.orders = [];
        this.updateOrdersDisplay();
        
        console.log('🔌 Wallet disconnected successfully');
    }

    disableOrderCreation() {
        // Disable order creation buttons
        document.getElementById('calculateOrders').disabled = true;
        document.getElementById('createOrders').disabled = true;
        document.getElementById('signTransaction').disabled = true;
        
        // Clear token selection
        const tokenSelect = document.getElementById('tokenSelect');
        tokenSelect.innerHTML = `
            <option value="">Select a token...</option>
            <option value="custom">Custom Token</option>
        `;
    }

    async loadWalletBalance() {
        try {
            console.log('📊 Getting account info for:', this.walletAddress);
            // Get account info and token balances
            const accountInfo = await this.xrplClient.getAccountInfo(this.walletAddress);
            console.log('✅ Account info received:', accountInfo);
            
            console.log('🔍 Getting token balances...');
            const tokenBalances = await this.xrplClient.getTokenBalances(this.walletAddress);
            console.log('✅ Token balances received:', tokenBalances);
            
            // Update token selection with owned tokens
            this.populateOwnedTokens(tokenBalances);
            
            // Show balance info
            this.displayWalletBalances(accountInfo, tokenBalances);
            
        } catch (error) {
            console.warn('Could not load wallet balances:', error);
        }
    }

    populateOwnedTokens(tokenBalances) {
        console.log('🪙 Populating owned tokens:', tokenBalances);
        const tokenSelect = document.getElementById('tokenSelect');
        
        // Clear existing options except the first ones
        const existingOptions = Array.from(tokenSelect.options);
        existingOptions.forEach(option => {
            if (option.value !== '' && option.value !== 'custom') {
                option.remove();
            }
        });
        
        // Remove any existing optgroups
        const existingOptGroups = tokenSelect.querySelectorAll('optgroup');
        existingOptGroups.forEach(group => group.remove());
        
        // Add owned tokens
        if (tokenBalances && tokenBalances.length > 0) {
            console.log('✅ Adding', tokenBalances.length, 'token balances to dropdown');
            const ownedSection = document.createElement('optgroup');
            ownedSection.label = 'Your Tokens';
            
            let addedTokens = 0;
            tokenBalances.forEach((line, index) => {
                console.log(`🔍 Processing token ${index + 1}:`, line.currency, 'Balance:', line.balance, 'Issuer:', line.account);
                console.log('📋 Full line object:', JSON.stringify(line, null, 2));
                
                // XRPL account_lines returns balance as a string
                const balanceValue = parseFloat(line.balance || 0);
                
                if (balanceValue > 0 && line.currency && line.account) {
                    const option = document.createElement('option');
                    option.value = `${line.currency}:${line.account}`;
                    option.setAttribute('data-balance', line.balance);
                    option.setAttribute('data-currency', line.currency);
                    option.setAttribute('data-issuer', line.account);
                    
                    // Format balance for display
                    const balanceAmount = balanceValue.toLocaleString(undefined, {
                        maximumFractionDigits: 6,
                        minimumFractionDigits: 0
                    });
                    
                    // Get friendly token name
                    const friendlyName = this.getFriendlyTokenName(line.currency, line.account);
                    const shortIssuer = line.account.substring(0, 8) + '...';
                    
                    option.textContent = `${friendlyName} (Balance: ${balanceAmount}) - ${shortIssuer}`;
                    ownedSection.appendChild(option);
                    addedTokens++;
                    console.log('✅ Added token option:', option.textContent, 'Value:', option.value);
                } else {
                    console.log('⚠️ Skipping token - Balance:', line.balance, 'Currency:', line.currency, 'Account:', line.account);
                }
            });
            
            // Only add the optgroup if we have tokens
            if (addedTokens > 0) {
                // Insert before custom option
                const customOption = tokenSelect.querySelector('option[value="custom"]');
                tokenSelect.insertBefore(ownedSection, customOption);
                console.log(`🗂️ Token dropdown updated with ${addedTokens} tokens`);
            } else {
                console.log('⚠️ No valid tokens to add to dropdown');
            }
        } else {
            console.log('⚠️ No token balances found or empty array');
        }
    }

    displayWalletBalances(accountInfo, tokenBalances) {
        // Create or update balance display
        let balanceDisplay = document.getElementById('walletBalances');
        if (!balanceDisplay) {
            balanceDisplay = document.createElement('div');
            balanceDisplay.id = 'walletBalances';
            balanceDisplay.className = 'wallet-balances';
            
            const headerActions = document.querySelector('.header-actions');
            headerActions.insertBefore(balanceDisplay, headerActions.firstChild);
        }
        
        const xrpBalance = (parseInt(accountInfo.Balance) / 1000000).toFixed(2);
        const tokenCount = tokenBalances ? tokenBalances.filter(line => parseFloat(line.balance) > 0).length : 0;
        
        balanceDisplay.innerHTML = `
            <div class="balance-item">
                <span class="balance-label">XRP:</span>
                <span class="balance-value">${xrpBalance}</span>
            </div>
            <div class="balance-item">
                <span class="balance-label">Tokens:</span>
                <span class="balance-value">${tokenCount}</span>
            </div>
        `;
    }

    async handleTokenSelection(value) {
        const customInput = document.getElementById('customTokenInput');
        const tokenSupplyInput = document.getElementById('tokenSupply');
        
        if (value === 'custom') {
            customInput.style.display = 'flex';
            tokenSupplyInput.value = '';
        } else {
            customInput.style.display = 'none';
            
            if (value && value.includes(':')) {
                // Parse owned token (format: "CURRENCY:ISSUER")
                const [currency, issuer] = value.split(':');
                document.getElementById('customTokenCode').value = currency;
                document.getElementById('customTokenIssuer').value = issuer;
                
                // Find the selected option and get the balance for reference only
                const tokenSelect = document.getElementById('tokenSelect');
                const selectedOption = tokenSelect.querySelector(`option[value="${value}"]`);
                
                if (selectedOption && selectedOption.getAttribute('data-balance')) {
                    const balance = parseFloat(selectedOption.getAttribute('data-balance'));
                    // Don't auto-fill with personal balance - user needs to enter total supply
                    tokenSupplyInput.placeholder = `Enter total token supply (Your balance: ${balance.toLocaleString()})`;
                    console.log('📋 Token selected - balance available for reference:', balance);
                } else {
                    tokenSupplyInput.placeholder = 'Loading token supply...';
                }
                
                // Auto-load token details if available
                await this.loadTokenDetails(currency, issuer);
            } else if (value) {
                // Load token details for popular tokens
                tokenSupplyInput.value = '';
                await this.loadTokenDetails(value);
            } else {
                // Clear when no token selected
                tokenSupplyInput.value = '';
                tokenSupplyInput.placeholder = '1,000,000,000';
            }
        }
        
        // Trigger validation for total tokens after token selection changes
        setTimeout(() => {
            this.validateTokenAmount();
        }, 100); // Small delay to ensure DOM is updated
    }

    async loadTokenDetails(tokenSymbol, issuer = null) {
        try {
            const tokenSupplyInput = document.getElementById('tokenSupply');
            
            // Show loading state with animation
            tokenSupplyInput.classList.add('loading');
            tokenSupplyInput.placeholder = 'Loading token supply...';
            
            if (issuer) {
                // For owned tokens with issuer, get live data from XRPL
                console.log('🔍 Fetching token info for:', tokenSymbol, 'from issuer:', issuer);
                
                // Get token supply information
                const tokenInfo = await this.xrplClient.getTokenInfo(tokenSymbol, issuer);
                if (tokenInfo && tokenInfo.totalSupply > 0) {
                    tokenSupplyInput.value = tokenInfo.totalSupply.toString();
                    console.log('📊 Token supply loaded:', tokenInfo.totalSupply);
                } else {
                    tokenSupplyInput.placeholder = 'Could not fetch supply - enter manually';
                }
                
            } else {
                // For popular tokens, use predefined data
                const tokenData = this.getTokenData(tokenSymbol);
                if (tokenData && tokenData.supply) {
                    tokenSupplyInput.value = tokenData.supply.toString();
                    console.log('📊 Predefined token supply loaded:', tokenData.supply);
                } else {
                    tokenSupplyInput.placeholder = 'Enter total token supply';
                }
            }
            
        } catch (error) {
            console.warn('Could not load token details:', error);
            document.getElementById('tokenSupply').placeholder = 'Could not fetch data - enter manually';
        } finally {
            // Remove loading animation
            document.getElementById('tokenSupply').classList.remove('loading');
        }
    }

    getTokenData(symbol) {
        // Predefined popular XRPL tokens with real issuer addresses
        const tokens = {
            'SOLO': { 
                supply: 400000000, 
                issuer: 'rHZwvHEs56GCmHupwjA4RY7oPA3EoAJWuN',
                name: 'Sologenic'
            },
            'CORE': { 
                supply: 10000000000, 
                issuer: 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D',
                name: 'Coreum'
            },
            'CSC': { 
                supply: 1000000000, 
                issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr',
                name: 'CasinoCoin'
            },
            'XPR': { 
                supply: 15000000000, 
                issuer: 'rDNvpqNrWJFweWBqt4yFTdMqaYZn2XQ5oW',
                name: 'Proton'
            },
            'VGB': { 
                supply: 10000000000, 
                issuer: 'rckzVpTnKpP4TJ1puQe827bV3X4oYtdTP',
                name: 'VegasBaby'
            }
        };
        
        return tokens[symbol];
    }

    calculateOrders() {
        const bottomMarketCap = parseFloat(document.getElementById('bottomMarketCap').value);
        const topMarketCap = parseFloat(document.getElementById('topMarketCap').value);
        const orderCount = parseInt(document.getElementById('orderCount').value);
        const totalTokens = parseFloat(document.getElementById('totalTokens').value);
        const tokenSupply = parseFloat(document.getElementById('tokenSupply').value);
        const useLogarithmic = document.getElementById('useLogarithmic').checked;

        // Validation
        if (!this.validateMarketCapInputs(bottomMarketCap, topMarketCap, orderCount, totalTokens, tokenSupply)) {
            return;
        }

        try {
            this.orders = this.orderManager.calculateMarketCapDistribution({
                bottomMarketCap,
                topMarketCap,
                orderCount,
                totalTokens,
                tokenSupply,
                useLogarithmic
            });

            this.displayOrderPreview();
            document.getElementById('createOrders').disabled = false;
            
        } catch (error) {
            this.showError('Error calculating orders: ' + error.message);
        }
    }

    validateMarketCapInputs(bottomMarketCap, topMarketCap, orderCount, totalTokens, tokenSupply) {
        if (!bottomMarketCap || !topMarketCap || !orderCount || !totalTokens || !tokenSupply) {
            this.showError('Please fill in all required fields');
            return false;
        }

        if (bottomMarketCap >= topMarketCap) {
            this.showError('Bottom market cap must be less than top market cap');
            return false;
        }

        // Sequential signing validation
        if (orderCount < this.MIN_ORDERS || orderCount > this.MAX_BATCH_ORDERS) {
            this.showError(`Number of orders must be between ${this.MIN_ORDERS} and ${this.MAX_BATCH_ORDERS} (sequential signing supports many orders)`);
            return false;
        }

        if (totalTokens <= 0) {
            this.showError('Total token amount must be greater than 0');
            return false;
        }

        // Check if user is trying to sell more tokens than they hold
        const tokenSelect = document.getElementById('tokenSelect');
        const selectedToken = tokenSelect.value;
        
        if (selectedToken && selectedToken.includes(':')) {
            // This is an owned token - validate against balance
            const selectedOption = tokenSelect.querySelector(`option[value="${selectedToken}"]`);
            if (selectedOption && selectedOption.getAttribute('data-balance')) {
                const userBalance = parseFloat(selectedOption.getAttribute('data-balance'));
                
                if (totalTokens > userBalance) {
                    this.showError(`You can't sell more tokens than you hold. Your balance: ${userBalance.toLocaleString()}, trying to sell: ${totalTokens.toLocaleString()}`);
                    return false;
                }
            }
        }

        return true;
    }

    displayOrderPreview() {
        const previewSection = document.getElementById('previewSection');
        const previewBody = document.getElementById('ordersPreviewBody');
        const totalOrdersCount = document.getElementById('totalOrdersCount');
        const totalXRPExpected = document.getElementById('totalXRPExpected');
        const distributionTypeEl = document.getElementById('distributionType');
        const batchFeeEl = document.getElementById('batchFee');

        // Clear previous preview
        previewBody.innerHTML = '';

        // Calculate totals
        let totalXRP = 0;

        // Show distribution type
        if (distributionTypeEl && this.orders.length > 0) {
            const distributionType = this.orders[0].distributionType || 'linear';
            distributionTypeEl.textContent = distributionType.charAt(0).toUpperCase() + distributionType.slice(1);
            distributionTypeEl.style.color = distributionType === 'logarithmic' ? '#ffc107' : '#51cf66';
        }

        // Populate table
        this.orders.forEach((order, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${order.price.toFixed(6)}</td>
                <td>${order.amount.toLocaleString()}</td>
                <td>$${order.marketCap.toLocaleString()}</td>
                <td>${(order.amount * order.price).toFixed(2)} XRP</td>
            `;
            previewBody.appendChild(row);
            
            totalXRP += order.amount * order.price;
        });

        // Update stats
        totalOrdersCount.textContent = this.orders.length;
        totalXRPExpected.textContent = `${totalXRP.toFixed(2)} XRP`;
        
        // Calculate and display batch fee (12 drops per transaction)
        const batchFee = this.orders.length * 12;
        if (batchFeeEl) {
            batchFeeEl.textContent = `${batchFee} drops`;
            batchFeeEl.title = `${this.orders.length} orders × 12 drops = ${batchFee} drops (${(batchFee / 1000000).toFixed(6)} XRP)`;
        }

        // Show preview
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth' });
    }

    hidePreview() {
        document.getElementById('previewSection').style.display = 'none';
        document.getElementById('createOrders').disabled = true;
    }

    async createOrders() {
        if (!this.walletAddress) {
            this.showError('Please connect your wallet first');
            return;
        }

        try {
            const tokenCode = document.getElementById('tokenSelect').value === 'custom' 
                ? document.getElementById('customTokenCode').value
                : document.getElementById('tokenSelect').value;
                
            const tokenIssuer = document.getElementById('tokenSelect').value === 'custom'
                ? document.getElementById('customTokenIssuer').value
                : this.getTokenData(document.getElementById('tokenSelect').value)?.issuer;

            if (!tokenCode || !tokenIssuer) {
                this.showError('Please select a valid token');
                return;
            }

            // Show status section
            this.showStatus('Preparing transactions...');

            // Create XRPL transactions
            const transactions = await this.orderManager.createXRPLTransactions(
                this.orders,
                this.walletAddress,
                tokenCode,
                tokenIssuer
            );

            this.pendingTransactions = transactions;
            this.showStatus(`${transactions.length} limit orders prepared. Ready to sign as single batch transaction...`);
            
            // Enable sign button with explicit debugging
            const signBtn = document.getElementById('signTransaction');
            if (signBtn) {
                signBtn.disabled = false;
                signBtn.style.pointerEvents = 'auto';
                signBtn.style.opacity = '1';
                console.log('✅ Sign transaction button enabled and made clickable');
            } else {
                console.error('❌ Sign transaction button not found!');
            }
            
            console.log(`✅ Created ${transactions.length} transactions for batch signing`);
            
        } catch (error) {
            this.showError('Error creating orders: ' + error.message);
        }
    }

    async signTransaction() {
        console.log('🔐 Sign transaction button clicked');
        
        // Add more debugging
        console.log('📋 Wallet connector status:', {
            isConnected: this.walletConnector?.isConnected,
            walletAddress: this.walletAddress,
            connectorType: this.walletConnector?.constructor?.name
        });
        
        if (!this.walletConnector.isConnected) {
            console.error('❌ Wallet not connected');
            this.showError('Please connect your wallet first');
            return;
        }

        if (!this.pendingTransactions || this.pendingTransactions.length === 0) {
            console.log('❌ No pending transactions found, checking for calculated orders...');
            
            // Check if we have calculated orders in the preview table
            const previewSection = document.getElementById('previewSection');
            const previewBody = document.getElementById('ordersPreviewBody');
            const orderRows = previewBody ? previewBody.querySelectorAll('tr') : [];
            
            if (orderRows.length > 0) {
                console.log(`🔄 Found ${orderRows.length} calculated orders, converting to transactions...`);
                
                // Get the selected token info
                const tokenSelect = document.getElementById('tokenSelect');
                
                if (!tokenSelect || !tokenSelect.value) {
                    this.showError('Please select a valid token first');
                    return;
                }
                
                let currency, issuer;
                
                if (tokenSelect.value.includes(':')) {
                    // Owned token format: "CURRENCY:ISSUER"
                    [currency, issuer] = tokenSelect.value.split(':');
                    console.log('📋 Using owned token:', { currency, issuer });
                } else {
                    // Popular token - need to get issuer
                    const tokenData = this.getTokenData(tokenSelect.value);
                    currency = tokenSelect.value;
                    issuer = tokenData?.issuer;
                    console.log('📋 Using popular token:', { currency, issuer });
                }
                
                if (!currency || !issuer) {
                    this.showError('Invalid token selection - missing currency or issuer');
                    return;
                }
                
                // Convert order preview rows to transaction format
                const orders = [];
                orderRows.forEach((row, index) => {
                    const cells = row.cells;
                    // Remove commas from quantity and parse correctly
                    const quantityText = cells[2].textContent.replace(/,/g, '');
                    const quantity = parseFloat(quantityText);
                    const totalXrpText = cells[4].textContent.replace(' XRP', '').replace(',', '');
                    const totalXrp = parseFloat(totalXrpText);
                    
                    console.log(`📝 Order ${index + 1}: ${quantity} ${currency} for ${totalXrp} XRP`);
                    
                    // Create proper XRPL OfferCreate transaction
                    orders.push({
                        TransactionType: 'OfferCreate',
                        Account: this.walletAddress,
                        TakerPays: Math.floor(totalXrp * 1000000).toString(), // XRP in drops (what we receive)
                        TakerGets: {
                            currency: currency,
                            issuer: issuer,
                            value: quantity.toString()
                        }, // Tokens (what we're selling)
                        Fee: "12", // Default fee in drops
                        Flags: 0
                    });
                });
                
                console.log('🏗️ Created orders from preview:', orders);
                
                // Now create the batch transaction
                try {
                    this.showStatus(`Creating batch transaction for ${orders.length} limit orders...`);
                    console.log('📦 Creating batch transaction with wallet connector...');
                    
                    const result = await this.walletConnector.createBatchOrders(this.walletAddress, orders);
                    
                    // Check if this is a sequential signing result (new behavior)
                    if (result && result.success && result.signedTransactions) {
                        this.showStatus(`✅ ${result.signedTransactions.length} limit orders created successfully!`, 'success');
                        console.log('🎉 Sequential transactions signed successfully!');
                        
                        // Clear the order preview
                        if (previewBody) {
                            previewBody.innerHTML = '';
                        }
                        if (previewSection) {
                            previewSection.style.display = 'none';
                        }
                        
                        // Update transaction status
                        this.updateTransactionStatus(`✅ ${result.signedTransactions.length} transactions completed successfully!`, 'success');
                        
                        // Reset form after successful submission
                        setTimeout(() => {
                            this.resetForm();
                        }, 3000);
                        
                    } else if (result && result.uuid) {
                        // This is the old batch behavior (if true batching were to work)
                        this.showStatus('Batch transaction created. Opening Xaman for single signature...');
                        console.log('✅ Batch payload created, waiting for signature...');
                        
                        // Wait for the batch transaction to be signed
                        const signResult = await this.walletConnector.waitForXamanResult(result.uuid);
                        
                        if (signResult.signed || signResult.batchComplete) {
                            this.showStatus(`✅ ${orders.length} limit orders created successfully!`, 'success');
                            console.log('🎉 Batch transaction signed successfully!');
                            
                            // Clear the order preview
                            if (previewBody) {
                                previewBody.innerHTML = '';
                            }
                            if (previewSection) {
                                previewSection.style.display = 'none';
                            }
                            
                            // Update transaction status
                            this.updateTransactionStatus('✅ Batch transaction completed successfully!', 'success');
                            
                            // Reset form after successful batch submission
                            setTimeout(() => {
                                this.resetForm();
                            }, 3000);
                        } else {
                            this.showError('Batch transaction was cancelled or rejected');
                        }
                    } else {
                        this.showError('Failed to create batch transaction');
                    }
                    
                } catch (error) {
                    console.error('❌ Failed to create batch orders:', error);
                    this.showError(`Failed to create orders: ${error.message}`);
                    this.updateTransactionStatus(`❌ Transaction failed: ${error.message}`, 'error');
                }
                
            } else {
                // No orders calculated yet - show guidance
                const tokenSelect = document.getElementById('tokenSelect');
                const bottomMarketCap = document.getElementById('bottomMarketCap');
                const topMarketCap = document.getElementById('topMarketCap');
                
                if (tokenSelect && tokenSelect.value && bottomMarketCap && bottomMarketCap.value && topMarketCap && topMarketCap.value) {
                    this.showError('Please click "Calculate Orders" first to generate your limit orders, then come back to sign the transaction.');
                    
                    // Highlight the calculate button
                    const calculateBtn = document.getElementById('calculateOrders');
                    if (calculateBtn) {
                        calculateBtn.style.animation = 'pulse 2s infinite';
                        calculateBtn.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.5)';
                        setTimeout(() => {
                            calculateBtn.style.animation = '';
                            calculateBtn.style.boxShadow = '';
                        }, 4000);
                    }
                } else {
                    this.showError('Please fill in the Market Cap Distribution form and calculate orders first');
                }
            }
            return;
        }

        // Original batch signing code for when pendingTransactions exists
        try {
            this.showStatus(`Creating batch transaction for ${this.pendingTransactions.length} limit orders...`);
            
            console.log('🔥 Starting batch transaction signing process...');
            console.log(`📦 Batch contains ${this.pendingTransactions.length} transactions`);
            
            // Use batch order creation instead of individual signing
            const result = await this.walletConnector.createBatchOrders(this.walletAddress, this.pendingTransactions);
            
            if (result && result.uuid) {
                this.showStatus('Batch transaction created. Opening Xaman for single signature...');
                console.log('✅ Batch payload created, waiting for signature...');
                
                // Wait for the batch transaction to be signed
                const signResult = await this.walletConnector.waitForXamanResult(result.uuid);
                
                if (signResult.signed) {
                    this.showStatus('Batch transaction signed successfully! All limit orders submitted to XRPL...', 'success');
                    console.log('🎉 Batch transaction signed successfully!');
                    
                    // Reset form after successful batch submission
                    setTimeout(() => {
                        this.resetForm();
                    }, 3000);
                } else {
                    this.showError('Batch transaction was cancelled or rejected');
                }
            } else {
                this.showError('Failed to create batch transaction');
            }
            
        } catch (error) {
            console.error('❌ Batch transaction error:', error);
            this.showError('Error with batch transaction: ' + error.message);
        }
    }



    enableOrderCreation() {
        document.getElementById('calculateOrders').disabled = false;
    }

    updateNetworkStatus(status, message) {
        const statusElement = document.getElementById('networkStatus');
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('.status-text');
        
        dot.className = `status-dot ${status}`;
        text.textContent = message;
    }

    updateOrdersDisplay() {
        // Clear orders preview
        const ordersPreviewBody = document.getElementById('ordersPreviewBody');
        if (ordersPreviewBody) {
            ordersPreviewBody.innerHTML = '';
        }

        // Hide preview section
        const previewSection = document.getElementById('previewSection');
        if (previewSection) {
            previewSection.style.display = 'none';
        }

        // Reset preview stats
        const totalOrdersCount = document.getElementById('totalOrdersCount');
        const totalXRPExpected = document.getElementById('totalXRPExpected');
        if (totalOrdersCount) totalOrdersCount.textContent = '0';
        if (totalXRPExpected) totalXRPExpected.textContent = '0';

        console.log('🧹 Orders display cleared');
    }

    showStatus(message, type = 'pending') {
        const statusSection = document.getElementById('statusSection');
        const statusDisplay = document.getElementById('statusDisplay');
        
        const statusItem = document.createElement('div');
        statusItem.className = `status-item ${type}`;
        statusItem.innerHTML = `
            <div>${type === 'pending' ? '<span class="spinner"></span>' : ''}</div>
            <div>${message}</div>
        `;
        
        statusDisplay.appendChild(statusItem);
        statusSection.style.display = 'block';
        statusSection.scrollIntoView({ behavior: 'smooth' });
    }

    showError(message) {
        this.showStatus(message, 'error');
    }

    updateTransactionStatus(message, type = 'info') {
        // Update status in the main status area
        const statusEl = document.getElementById('statusMessage');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status-message ${type}`;
            statusEl.style.display = 'block';
        }
        
        // Also log to console with appropriate level
        if (type === 'error') {
            console.error('🔴', message);
        } else if (type === 'success') {
            console.log('✅', message);
        } else {
            console.log('ℹ️', message);
        }
    }

    resetForm() {
        // Reset form fields
        document.querySelectorAll('.form-control').forEach(input => {
            if (input.type !== 'select-one') {
                input.value = '';
            }
        });
        
        // Hide sections
        this.hidePreview();
        
        // Reset orders
        this.orders = [];
        this.pendingTransactions = [];
        
        // Disable buttons
        document.getElementById('createOrders').disabled = true;
        document.getElementById('signTransaction').disabled = true;
    }

    loadPopularTokens() {
        const tokenSelect = document.getElementById('tokenSelect');
        
        // Add popular XRPL tokens
        const popularTokens = [
            { symbol: 'SOLO', name: 'Sologenic' },
            { symbol: 'XLS20', name: 'XLS-20 Example' },
            // Add more as needed
        ];
        
        popularTokens.forEach(token => {
            const option = document.createElement('option');
            option.value = token.symbol;
            option.textContent = `${token.symbol} - ${token.name}`;
            tokenSelect.insertBefore(option, tokenSelect.lastElementChild);
        });
    }

    setupFormValidation() {
        // Add real-time form validation
        const numberInputs = document.querySelectorAll('input[type="number"]');
        
        numberInputs.forEach(input => {
            input.addEventListener('input', () => {
                if (input.value < 0) {
                    input.value = '';
                }
            });
        });

        // Add specific validation for total tokens input
        const totalTokensInput = document.getElementById('totalTokens');
        if (totalTokensInput) {
            totalTokensInput.addEventListener('input', () => {
                this.validateTokenAmount();
            });
        }
    }

    validateTokenAmount() {
        const totalTokensInput = document.getElementById('totalTokens');
        const tokenSelect = document.getElementById('tokenSelect');
        const selectedToken = tokenSelect.value;
        
        if (selectedToken && selectedToken.includes(':') && totalTokensInput.value) {
            // This is an owned token - validate against balance
            const selectedOption = tokenSelect.querySelector(`option[value="${selectedToken}"]`);
            
            if (selectedOption && selectedOption.getAttribute('data-balance')) {
                const userBalance = parseFloat(selectedOption.getAttribute('data-balance'));
                const enteredAmount = parseFloat(totalTokensInput.value);
                
                // Remove any existing validation styling
                totalTokensInput.classList.remove('invalid', 'valid');
                
                if (enteredAmount > userBalance) {
                    // Show error styling
                    totalTokensInput.classList.add('invalid');
                    totalTokensInput.title = `You can only sell up to ${userBalance.toLocaleString()} tokens (your current balance)`;
                    
                    // Optionally limit the value to the maximum balance
                    if (enteredAmount > userBalance * 1.1) { // Allow 10% buffer to prevent constant corrections
                        totalTokensInput.value = userBalance.toString();
                    }
                } else if (enteredAmount > 0) {
                    // Show valid styling
                    totalTokensInput.classList.add('valid');
                    totalTokensInput.title = `Valid amount (${(userBalance - enteredAmount).toLocaleString()} tokens remaining)`;
                }
            }
        } else {
            // Remove validation styling for non-owned tokens or empty input
            totalTokensInput.classList.remove('invalid', 'valid');
            totalTokensInput.title = '';
        }
    }

    // Helper method to validate XRPL addresses
    isValidXRPLAddress(address) {
        if (!address || typeof address !== 'string') {
            return false;
        }
        
        // XRPL classic addresses start with 'r' and are 25-34 characters long
        const classicAddressRegex = /^r[a-zA-Z0-9]{24,33}$/;
        
        // XRPL X-Addresses start with 'X' and are longer
        const xAddressRegex = /^X[a-zA-Z0-9]{46,47}$/;
        
        return classicAddressRegex.test(address) || xAddressRegex.test(address);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    // Make app globally available for debugging
    window.app = app;
    
    // Debug function to test QR modal
    window.testQRModal = () => {
        if (app.walletConnector) {
            app.walletConnector.testQRModal();
        } else {
            console.error('❌ Wallet connector not available');
        }
    };
});
