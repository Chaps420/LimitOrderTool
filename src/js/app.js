import { XRPLClient } from './xrpl-client.js';
import { WalletConnector } from './wallet-connector-xls56.js';
import { OrderManager } from './order-manager.js';

class App {
    constructor() {
        this.xrplClient = new XRPLClient();
        this.walletConnector = new WalletConnector();
        this.orderManager = new OrderManager();
        this.currentStrategy = 'market-cap';
        this.orders = [];
        this.walletAddress = null;
        
        // XLS-56 Batch Transaction Limits
        this.MAX_BATCH_ORDERS = 8;
        this.MIN_ORDERS = 1;
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.xrplClient.connect();
        this.updateNetworkStatus('connected', 'Connected to XRPL');
        this.loadPopularTokens();
        
        // Check for previously connected wallet
        const savedWalletAddress = localStorage.getItem('xrpl-wallet-address');
        const savedWalletType = localStorage.getItem('xrpl-wallet-type');
        
        if (savedWalletAddress && savedWalletType) {
            console.log('🔄 Found saved wallet, attempting to reconnect:', savedWalletAddress);
            
            // Set wallet as connected (user doesn't need to scan QR again)
            this.walletConnector.walletAddress = savedWalletAddress;
            this.walletConnector.walletType = savedWalletType;
            this.walletConnector.isConnected = true;
            this.walletAddress = savedWalletAddress;
            
            // Update UI
            this.onWalletConnected(savedWalletAddress);
            
            console.log('✅ Wallet reconnected automatically');
        }
        
        // Check backend status for admin
        await this.checkBackendStatus();
    }

    setupEventListeners() {
        // Strategy tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchStrategy(e.target.dataset.strategy);
            });
        });

        // Wallet connection
        document.getElementById('connectWallet').addEventListener('click', () => {
            this.connectWallet();
        });

        // Token selection
        document.getElementById('tokenSelect').addEventListener('change', (e) => {
            this.handleTokenSelection(e.target.value);
        });

        // Calculate orders
        document.getElementById('calculateOrders').addEventListener('click', () => {
            this.calculateOrders();
        });

        // Create orders
        document.getElementById('createOrders').addEventListener('click', () => {
            this.createOrders();
        });

        // Sign transaction
        document.getElementById('signTransaction').addEventListener('click', () => {
            this.signTransaction();
        });

        // Add manual order
        document.getElementById('addOrder').addEventListener('click', () => {
            this.addManualOrder();
        });

        // Calculate manual orders
        document.getElementById('calculateManualOrders').addEventListener('click', () => {
            this.calculateManualOrders();
        });

        // Create manual orders
        document.getElementById('createManualOrders').addEventListener('click', () => {
            this.createManualOrders();
        });

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

    switchStrategy(strategy) {
        this.currentStrategy = strategy;
        
        // Update tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.strategy === strategy);
        });

        // Update content
        document.querySelectorAll('.strategy-content').forEach(content => {
            content.classList.toggle('active', content.id === `${strategy.replace('-', '')}Strategy`);
        });

        // Reset preview
        this.hidePreview();
    }

    async connectWallet() {
        const button = document.getElementById('connectWallet');
        const originalText = button.textContent;
        
        button.innerHTML = '<span class="spinner"></span> Connecting...';
        button.disabled = true;

        try {
            const address = await this.walletConnector.connect();
            this.walletAddress = address;
            
            // Save wallet info to localStorage for persistence
            localStorage.setItem('xrpl-wallet-address', address);
            localStorage.setItem('xrpl-wallet-type', this.walletConnector.walletType || 'xaman');
            console.log('💾 Wallet info saved to localStorage');
            
            // Update UI
            this.onWalletConnected(address);
            
        } catch (error) {
            console.error('Wallet connection failed:', error);
            button.textContent = originalText;
            button.disabled = false;
            
            this.showError('Failed to connect wallet: ' + error.message);
        }
    }

    async onWalletConnected(address) {
        const button = document.getElementById('connectWallet');
        
        button.textContent = `${address.substring(0, 8)}...${address.substring(address.length - 8)}`;
        button.classList.add('connected');
        button.disabled = false;
        
        this.updateNetworkStatus('connected', `Wallet Connected: ${address.substring(0, 12)}...`);
        
        console.log('🔄 Loading wallet balance and tokens...');
        // Fetch wallet balance and holdings
        await this.loadWalletBalance();
        
        console.log('✅ Wallet balance loaded, enabling order creation');
        // Enable order creation
        this.enableOrderCreation();
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
                    
                    option.textContent = `${line.currency} (Balance: ${balanceAmount})`;
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

    handleTokenSelection(value) {
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
                    tokenSupplyInput.value = '';
                    tokenSupplyInput.placeholder = `Enter total token supply (Your balance: ${balance.toLocaleString()})`;
                    console.log('📋 Token selected - balance available for reference:', balance);
                } else {
                    tokenSupplyInput.value = '';
                    tokenSupplyInput.placeholder = 'Enter total token supply';
                }
                
                // Auto-load token details if available
                this.loadTokenDetails(currency, issuer);
            } else if (value) {
                // Load token details for popular tokens
                tokenSupplyInput.value = '';
                this.loadTokenDetails(value);
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
            let tokenData;
            
            if (issuer) {
                // For owned tokens, try to get metadata
                tokenData = await this.xrplClient.getTokenMetadata(tokenSymbol, issuer);
            } else {
                // For popular tokens, use predefined data
                tokenData = this.getTokenData(tokenSymbol);
            }
            
            if (tokenData && tokenData.totalSupply) {
                document.getElementById('tokenSupply').value = tokenData.totalSupply;
            }
        } catch (error) {
            console.warn('Could not load token details:', error);
        }
    }

    getTokenData(symbol) {
        // Predefined popular XRPL tokens
        const tokens = {
            'SOLO': { supply: 400000000, issuer: 'rHZwvHEs56GCmHupwjA4RY7oPA3EoAJWuN' },
            'XLS20': { supply: 1000000000, issuer: 'rXLS20ExampleIssuerAddress...' },
            // Add more popular tokens
        };
        
        return tokens[symbol];
    }

    calculateOrders() {
        const bottomMarketCap = parseFloat(document.getElementById('bottomMarketCap').value);
        const topMarketCap = parseFloat(document.getElementById('topMarketCap').value);
        const orderCount = parseInt(document.getElementById('orderCount').value);
        const totalTokens = parseFloat(document.getElementById('totalTokens').value);
        const tokenSupply = parseFloat(document.getElementById('tokenSupply').value);

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
                tokenSupply
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

        // XLS-56 Batch transaction limits
        if (orderCount < this.MIN_ORDERS || orderCount > this.MAX_BATCH_ORDERS) {
            this.showError(`Number of orders must be between ${this.MIN_ORDERS} and ${this.MAX_BATCH_ORDERS} (XLS-56 batch limit)`);
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
        const batchFeeEl = document.getElementById('batchFee');

        // Clear previous preview
        previewBody.innerHTML = '';

        // Calculate totals
        let totalXRP = 0;

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
            
            // Enable sign button
            document.getElementById('signTransaction').disabled = false;
            
            console.log(`✅ Created ${transactions.length} transactions for batch signing`);
            
        } catch (error) {
            this.showError('Error creating orders: ' + error.message);
        }
    }

    async signTransaction() {
        console.log('🔐 Sign transaction button clicked');
        
        if (!this.walletConnector.isConnected) {
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
                    const quantity = parseFloat(cells[2].textContent);
                    const totalXrpText = cells[4].textContent.replace(' XRP', '').replace(',', '');
                    const totalXrp = parseFloat(totalXrpText);
                    
                    console.log(`📝 Order ${index + 1}: ${quantity} ${currency} for ${totalXrp} XRP`);
                    
                    // Create XRPL transaction format for SELL orders
                    // TakerPays = what we want to receive (XRP)
                    // TakerGets = what we're selling (tokens)
                    orders.push({
                        takerPays: Math.floor(totalXrp * 1000000).toString(), // XRP in drops (what we receive)
                        takerGets: {
                            currency: currency,
                            issuer: issuer,
                            value: quantity.toString()
                        }, // Tokens (what we're selling)
                        sequence: index + 1
                    });
                });
                
                console.log('🏗️ Created orders from preview:', orders);
                
                // Now create the batch transaction
                try {
                    this.showStatus(`Creating batch transaction for ${orders.length} limit orders...`);
                    console.log('📦 Creating batch transaction with wallet connector...');
                    
                    const result = await this.walletConnector.createBatchOrders(this.walletAddress, orders);
                    
                    if (result && result.uuid) {
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

    addManualOrder() {
        const container = document.getElementById('manualOrdersList');
        const currentOrders = container.querySelectorAll('.manual-order-row').length;
        
        // Check XLS-56 batch limit
        if (currentOrders >= this.MAX_BATCH_ORDERS) {
            this.showError(`Cannot add more than ${this.MAX_BATCH_ORDERS} manual orders (XLS-56 batch limit)`);
            return;
        }
        
        const orderRow = document.createElement('div');
        orderRow.className = 'manual-order-row';
        
        // Get available tokens for the dropdown
        const tokenSelect = document.getElementById('tokenSelect');
        let tokenOptions = '<option value="">Choose token...</option>';
        
        for (let option of tokenSelect.options) {
            if (option.value && option.value !== 'custom') {
                const currency = option.getAttribute('data-currency') || option.value.split(':')[0];
                const balance = option.getAttribute('data-balance') || 'Unknown';
                tokenOptions += `<option value="${option.value}" data-balance="${balance}" data-currency="${currency}">${option.textContent}</option>`;
            }
        }
        
        orderRow.innerHTML = `
            <div class="form-group">
                <label>Token to Sell</label>
                <select class="form-control order-token">
                    ${tokenOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Price (XRP per Token)</label>
                <input type="number" class="form-control order-price" placeholder="0.001" step="0.000001">
            </div>
            <div class="form-group">
                <label>Amount (Tokens)</label>
                <input type="number" class="form-control order-amount" placeholder="1000">
            </div>
            <div class="form-group">
                <label>Total XRP</label>
                <input type="text" class="form-control order-total" readonly placeholder="Calculated">
            </div>
            <button class="btn remove-order" onclick="this.parentElement.remove(); app.updateManualOrderCounter();">×</button>
        `;
        
        container.appendChild(orderRow);
        
        // Update counter
        this.updateManualOrderCounter();
        
        // Add event listeners for automatic calculations
        const tokenSelectInput = orderRow.querySelector('.order-token');
        const priceInput = orderRow.querySelector('.order-price');
        const amountInput = orderRow.querySelector('.order-amount');
        const totalInput = orderRow.querySelector('.order-total');
        
        // Update total XRP when price or amount changes
        const updateTotal = () => {
            const price = parseFloat(priceInput.value) || 0;
            const amount = parseFloat(amountInput.value) || 0;
            const total = price * amount;
            totalInput.value = total > 0 ? `${total.toLocaleString()} XRP` : '';
        };
        
        // Set max amount when token is selected
        tokenSelectInput.addEventListener('change', () => {
            const selectedOption = tokenSelectInput.selectedOptions[0];
            if (selectedOption && selectedOption.getAttribute('data-balance')) {
                const balance = parseFloat(selectedOption.getAttribute('data-balance'));
                amountInput.max = balance;
                amountInput.placeholder = `Max: ${balance.toLocaleString()}`;
                console.log('✅ Set max amount for manual order:', balance);
            }
        });
        
        priceInput.addEventListener('input', updateTotal);
        amountInput.addEventListener('input', updateTotal);
    }

    updateManualOrderCounter() {
        const container = document.getElementById('manualOrdersList');
        const currentCount = container.querySelectorAll('.manual-order-row').length;
        const counterEl = document.getElementById('manualOrderCount');
        const addButton = document.getElementById('addOrder');
        
        if (counterEl) {
            counterEl.textContent = currentCount;
            
            // Update counter color based on limit
            const counter = counterEl.parentElement;
            if (currentCount >= this.MAX_BATCH_ORDERS) {
                counter.style.background = 'rgba(220, 53, 69, 0.1)';
                counter.style.color = '#dc3545';
                counter.style.borderColor = 'rgba(220, 53, 69, 0.2)';
                addButton.disabled = true;
                addButton.textContent = 'Batch Limit Reached';
            } else {
                counter.style.background = 'rgba(255, 193, 7, 0.1)';
                counter.style.color = '#ffc107';
                counter.style.borderColor = 'rgba(255, 193, 7, 0.2)';
                addButton.disabled = false;
                addButton.textContent = '+ Add Order';
            }
        }
    }

    calculateManualOrders() {
        console.log('Calculating manual orders...');
        
        const manualOrderRows = document.querySelectorAll('.manual-order-row');
        if (manualOrderRows.length === 0) {
            this.showError('Please add at least one manual order first');
            return;
        }

        // XLS-56 batch validation
        if (manualOrderRows.length > this.MAX_BATCH_ORDERS) {
            this.showError(`Cannot create more than ${this.MAX_BATCH_ORDERS} manual orders in a single batch (XLS-56 limitation)`);
            return;
        }

        const orders = [];
        let hasErrors = false;

        manualOrderRows.forEach((row, index) => {
            const tokenSelect = row.querySelector('.order-token');
            const priceInput = row.querySelector('.order-price');
            const amountInput = row.querySelector('.order-amount');

            const token = tokenSelect.value;
            const price = parseFloat(priceInput.value);
            const amount = parseFloat(amountInput.value);

            if (!token || !price || !amount) {
                this.showError(`Order ${index + 1}: Please fill in all fields`);
                hasErrors = true;
                return;
            }

            if (price <= 0 || amount <= 0) {
                this.showError(`Order ${index + 1}: Price and amount must be greater than 0`);
                hasErrors = true;
                return;
            }

            const total = price * amount;
            orders.push({
                token,
                price,
                amount,
                total,
                index: index + 1
            });
        });

        if (hasErrors) {
            return;
        }

        console.log('✅ Manual orders calculated:', orders);

        // Show preview
        this.displayManualOrderPreview(orders);
        
        // Enable create orders button
        document.getElementById('createManualOrders').disabled = false;
        this.showStatus(`${orders.length} manual orders calculated successfully!`, 'success');
    }

    displayManualOrderPreview(orders) {
        const previewBody = document.getElementById('ordersPreviewBody');
        const previewSection = document.getElementById('previewSection');
        const totalOrdersCount = document.getElementById('totalOrdersCount');
        const totalXRPExpected = document.getElementById('totalXRPExpected');

        previewBody.innerHTML = '';
        
        let totalXRP = 0;
        
        orders.forEach(order => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${order.index}</td>
                <td>${order.price.toFixed(6)} XRP</td>
                <td>${order.amount.toLocaleString()}</td>
                <td>Manual Order</td>
                <td>${order.total.toLocaleString()} XRP</td>
            `;
            
            previewBody.appendChild(row);
            totalXRP += order.total;
        });

        totalOrdersCount.textContent = orders.length;
        totalXRPExpected.textContent = `${totalXRP.toLocaleString()} XRP`;

        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth' });
    }

    createManualOrders() {
        console.log('📝 Creating manual orders...');
        
        // Get orders from preview table
        const previewBody = document.getElementById('ordersPreviewBody');
        const orderRows = previewBody.querySelectorAll('tr');
        
        if (orderRows.length === 0) {
            this.showError('Please calculate orders first');
            return;
        }

        // Trigger the same signing flow as market cap orders
        this.signTransaction();
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
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    // Make app globally available for manual order management
    window.app = app;
});
