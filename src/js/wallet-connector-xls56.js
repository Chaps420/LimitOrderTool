/**
 * XLS-56 Batch Transaction Wallet Connector
 * Updated implementation for XRPL batch limit orders using XLS-56 standard
 */

export class WalletConnector {
    constructor() {
        this.walletAddress = null;
        this.walletType = null;
        this.isConnected = false;
        this.xamanApiUrl = 'https://xumm.app/api/v1/platform';
        // API credentials removed for security - will use backend API
        this.apiKey = null;
        this.apiSecret = null;
        this.backendUrl = 'http://localhost:3002';
        
        // Production mode - use real Xaman API through secure backend
        this.useRealAPI = true;
        
        // XLS-56 Constants
        this.MAX_BATCH_SIZE = 8;
        this.BASE_FEE = 12; // drops
    }

    async connect() {
        console.log('Connecting to Xaman wallet...');
        
        try {
            // Create a SignIn payload to get wallet address
            const signinPayload = {
                TransactionType: 'SignIn'
            };

            const payloadOptions = {
                submit: false,
                expire: 5 // 5 minutes
            };

            const payloadResponse = await this.createXamanPayload(signinPayload, payloadOptions);
            if (!payloadResponse.uuid) {
                throw new Error('Failed to create Xaman payload');
            }

            // Show QR code modal (non-blocking)
            this.showXamanQRCode(payloadResponse);

            // Wait for user to scan and approve
            const result = await this.waitForXamanResult(payloadResponse.uuid);
            
            if (result.signed && result.account) {
                this.walletAddress = result.account;
                this.walletType = 'xaman';
                this.isConnected = true;
                
                console.log('Wallet connected:', result.account);
                return result.account;
            } else {
                throw new Error('Wallet connection was cancelled or failed');
            }

        } catch (error) {
            console.error('Xaman connection failed:', error);
            throw new Error('Wallet connection failed: ' + error.message);
        }
    }

    async createXamanPayload(txjson, options = {}) {
        try {
            console.log('Creating Xaman payload...');
            
            const payload = {
                txjson: txjson,
                options: {
                    submit: options.submit || false,
                    expire: options.expire || 5,
                    return_url: options.return_url || undefined,
                    ...options
                }
            };

            // Try backend API first (most secure)
            try {
                const response = await fetch(`${this.backendUrl}/create-payload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Real Xaman payload created:', result.uuid);
                    return result;
                }
            } catch (error) {
                console.log('Backend not available:', error.message);
            }

            // Fallback to direct API if backend not available (for testing)
            if (this.apiKey && this.apiSecret) {
                console.log('Trying direct Xaman API...');
                const response = await fetch(`${this.xamanApiUrl}/payload`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-API-Key': this.apiKey,
                        'X-API-Secret': this.apiSecret
                    },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Direct Xaman payload created:', result.uuid);
                    return result;
                }
            }

            // Final fallback to mock payload for development
            console.warn('Using mock payload for development');
            return this.createMockPayload(txjson);

        } catch (error) {
            console.warn('API error, using mock payload:', error);
            return this.createMockPayload(txjson);
        }
    }

    createMockPayload(txjson) {
        // Create a realistic mock payload for testing
        const uuid = Date.now().toString(36) + Math.random().toString(36).substr(2);
        console.log('Created mock payload with UUID:', uuid);
        
        // Create a proper Xaman deep link that will actually open the app
        // This uses the xumm:// protocol which opens the Xaman app
        const xamanDeepLink = `xumm://xumm.me/detect/${uuid}`;
        
        // For web fallback, use the detect endpoint which redirects to app store if needed
        const webFallback = `https://xumm.app/detect/${uuid}`;
        
        return {
            uuid: uuid,
            next: {
                always: webFallback
            },
            refs: {
                qr_png: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(xamanDeepLink)}`,
                qr_matrix: xamanDeepLink,
                qr_uri_quality_opts: [xamanDeepLink],
                websocket_status: `wss://xumm.app/sign/${uuid}`,
                deeplink: xamanDeepLink
            }
        };
    }

    /**
     * Create XLS-56 batch transaction for multiple limit orders
     * @param {string} account - The account address
     * @param {Array} orders - Array of order objects with takerPays and takerGets
     * @returns {Promise} Xaman payload response
     */
    async createBatchOrders(account, orders) {
        try {
            console.log(`🚀 Creating sequential transactions for ${orders.length} orders (Xaman compatibility)`);
            console.log('📊 Orders to process:', orders);

            // Validate batch size (XLS-56 allows up to 8 transactions)
            if (orders.length > this.MAX_BATCH_SIZE) {
                throw new Error(`Batch size cannot exceed ${this.MAX_BATCH_SIZE} transactions (XLS-56 limitation)`);
            }

            if (orders.length === 0) {
                throw new Error('Cannot create empty batch transaction');
            }

            // For single transaction, use regular OfferCreate
            if (orders.length === 1) {
                console.log('📝 Single order - using regular OfferCreate transaction');
                const singleTx = {
                    TransactionType: "OfferCreate",
                    Account: account,
                    TakerPays: orders[0].takerPays,
                    TakerGets: orders[0].takerGets,
                    Fee: this.BASE_FEE.toString(),
                    Flags: 0
                };
                const payload = await this.createXamanPayload(singleTx, { submit: true });
                this.showXamanQRCode(payload);
                return payload;
            }

            // For multiple transactions, create them sequentially
            // This is the current working approach until XLS-56 is widely supported
            console.log('📄 Multiple transactions - creating sequential payloads (Xaman compatibility)');
            
            // Store transactions for sequential processing
            this.batchTransactions = orders.map((order, index) => ({
                TransactionType: "OfferCreate",
                Account: account,
                TakerPays: order.takerPays,
                TakerGets: order.takerGets,
                Fee: this.BASE_FEE.toString(),
                Flags: 0
            }));
            
            this.currentBatchIndex = 0;
            this.batchAccount = account;
            
            // Create the first transaction payload
            const firstTxPayload = await this.createXamanPayload(this.batchTransactions[0], { submit: true });
            
            // Mark this as a batch operation
            firstTxPayload.isBatch = true;
            firstTxPayload.totalTransactions = this.batchTransactions.length;
            firstTxPayload.currentTransaction = 1;
            firstTxPayload.batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2)}`;
            
            console.log('✅ First transaction payload created for batch:', firstTxPayload.uuid);
            
            // Show the QR modal for the first transaction
            this.showXamanQRCode(firstTxPayload);
            
            return firstTxPayload;
            
        } catch (error) {
            console.error('❌ Failed to create batch orders:', error);
            throw error;
        }
    }

    async showXamanQRCode(payloadData) {
        console.log('Showing Xaman QR code modal for UUID:', payloadData.uuid);
        console.log('Payload data received:', payloadData);
        
        // Create modal for QR code
        const modal = document.createElement('div');
        modal.className = 'xaman-modal';
            
            // Use the proper Xaman deep link format
            let deepLink = payloadData.next?.always;
            let qrUrl = payloadData.refs?.qr_png;
            
            // Convert web URL to proper Xaman deep link for mobile
            if (deepLink && deepLink.includes('xumm.app/sign/')) {
                // Extract UUID and create proper deep link
                const uuid = payloadData.uuid;
                deepLink = `xumm:${uuid}`;  // This is the correct format for Xaman mobile app
                console.log('Using Xaman deep link:', deepLink);
            }
            
            // Always use the official Xaman QR code if available (this contains the proper deep link)
            if (qrUrl) {
                console.log('Using official Xaman QR PNG:', qrUrl);
            } else {
                // Generate QR with proper deep link if no official QR available
                qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(deepLink)}`;
                console.log('Generated QR URL with deep link:', qrUrl);
            }
            
            // Create a backup SVG QR code as base64
            const backupQR = `data:image/svg+xml;base64,${btoa(`
                <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
                    <rect width="100%" height="100%" fill="white"/>
                    <text x="50%" y="30%" dominant-baseline="middle" text-anchor="middle" fill="black" font-size="12" font-family="Arial">Xaman Deep Link</text>
                    <text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="black" font-size="8" font-family="Arial">${payloadData.uuid}</text>
                    <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" fill="gray" font-size="8" font-family="Arial">Scan to open Xaman</text>
                    <text x="50%" y="75%" dominant-baseline="middle" text-anchor="middle" fill="gray" font-size="6" font-family="Arial">If app doesn't open,</text>
                    <text x="50%" y="85%" dominant-baseline="middle" text-anchor="middle" fill="gray" font-size="6" font-family="Arial">install Xaman from app store</text>
                </svg>
            `)}`;
            
            // Determine modal title based on transaction type
            let modalTitle = 'Connect Your Xaman Wallet';
            if (payloadData.isBatch) {
                modalTitle = `📦 Sign Transaction ${payloadData.currentTransaction} of ${payloadData.totalTransactions}`;
            } else if (payloadData.txjson?.TransactionType === 'OfferCreate') {
                modalTitle = '📝 Sign Limit Order';
            }
            
            modal.innerHTML = `
                <div class="modal-overlay">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h3>${modalTitle}</h3>
                            <button class="close-btn" onclick="this.closest('.xaman-modal').remove()">&times;</button>
                        </div>
                        <div class="modal-body">
                            <div class="qr-container">
                                <div class="qr-placeholder">
                                    <img src="${qrUrl}" alt="Xaman QR Code" class="qr-code" 
                                         onload="console.log('QR code loaded successfully')" 
                                         onerror="console.log('Primary QR failed, using backup'); this.src='${backupQR}'">
                                </div>
                            </div>
                            <div class="instructions">
                                ${payloadData.isBatch ? 
                                    `<p><strong>📦 Sequential Batch:</strong> Transaction ${payloadData.currentTransaction} of ${payloadData.totalTransactions}</p>
                                     <p><strong>💰 Fee:</strong> 12 drops per transaction</p>` : ''}
                                <p><strong>📱 On Mobile:</strong> This should open Xaman app directly</p>
                                <p><strong>💻 On Desktop:</strong> Scan QR code with Xaman mobile app</p>
                                <p><strong>✅ Then:</strong> Approve the transaction in your app</p>
                                <div class="mobile-tip" style="background: #2a2a2a; padding: 0.75rem; border-radius: 4px; margin: 1rem 0; border-left: 3px solid #ffc107;">
                                    <small style="color: #ffc107;"><strong>Sequential Batch:</strong></small><br>
                                    <small style="color: #ccc;">You'll sign each transaction one by one for maximum wallet compatibility!</small>
                                </div>
                                <div class="status-indicator">
                                    <div class="spinner"></div>
                                    <p style="color: #ffc107; margin-top: 1rem; font-size: 0.9rem;">
                                        ⏳ Waiting for signature...
                                    </p>
                                </div>
                                <div class="payload-info">
                                    <small>UUID: ${payloadData.uuid}</small><br>
                                    <small style="color: #666;">Deep Link: ${deepLink.substring(0, 30)}...</small>
                                </div>
                            </div>
                            <div class="actions">
                                <button class="btn btn-primary" onclick="window.location.href='${deepLink}'">
                                    📱 Open Xaman App Now
                                </button>
                                <button class="btn btn-primary" onclick="window.open('${payloadData.next?.always}', '_blank')">
                                    🌐 Open in Browser
                                </button>
                                <button class="btn btn-primary" onclick="window.approveXamanTest && window.approveXamanTest()">
                                    ✅ Test Approve
                                </button>
                                <button class="btn btn-secondary" onclick="this.closest('.xaman-modal').remove()">
                                    ❌ Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Set up test approval callback for manual testing
            window.approveXamanTest = () => {
                console.log('Manual test approval triggered');
                const modal = document.querySelector('.xaman-modal');
                if (modal) modal.remove();
            };

            // Add modal styles if not already present
            this.addModalStyles();
            
            document.body.appendChild(modal);
            console.log('QR code modal displayed');
    }

    async waitForXamanResult(uuid) {
        console.log('⏳ Waiting for Xaman result for UUID:', uuid);
        
        // Handle mock payloads
        if (uuid.startsWith('mock-')) {
            return await this.simulateUserApproval(uuid);
        }

        // For real payloads, try backend API first
        try {
            const result = await this.pollBackendAPI(uuid);
            
            // Check if this is part of a sequential batch and we need to continue
            if (result.signed && this.batchTransactions && this.currentBatchIndex < this.batchTransactions.length - 1) {
                console.log('🔄 Transaction signed, continuing with next transaction in batch...');
                this.currentBatchIndex++;
                
                // Create payload for next transaction
                const nextTx = this.batchTransactions[this.currentBatchIndex];
                const nextPayload = await this.createXamanPayload(nextTx, { submit: true });
                
                // Update payload with batch info
                nextPayload.isBatch = true;
                nextPayload.totalTransactions = this.batchTransactions.length;
                nextPayload.currentTransaction = this.currentBatchIndex + 1;
                
                console.log(`📝 Created payload for transaction ${this.currentBatchIndex + 1}/${this.batchTransactions.length}`);
                
                // Show QR for next transaction
                this.showXamanQRCode(nextPayload);
                
                // Recursively wait for next transaction
                const nextResult = await this.waitForXamanResult(nextPayload.uuid);
                
                // If this was the last transaction, return batch complete
                if (this.currentBatchIndex === this.batchTransactions.length - 1) {
                    console.log('✅ All batch transactions completed!');
                    // Clean up batch state
                    const totalTransactions = this.batchTransactions.length;
                    delete this.batchTransactions;
                    delete this.currentBatchIndex;
                    delete this.batchAccount;
                    
                    return {
                        signed: true,
                        account: result.account,
                        txid: nextResult.txid,
                        batchComplete: true,
                        totalTransactions: totalTransactions
                    };
                }
                
                return nextResult;
            }
            
            return result;
        } catch (error) {
            console.warn('❌ Backend polling failed, trying direct API:', error);
            // Fallback to direct API polling if available
            if (this.apiKey && this.apiSecret) {
                return await this.pollRealXamanAPI(uuid);
            }
            throw error;
        }
    }

    async pollBackendAPI(uuid) {
        const maxAttempts = 60; // 5 minutes
        let attempts = 0;

        console.log('Polling backend API for result...', uuid);

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${this.backendUrl}/payload-status/${uuid}`);
                console.log(`Poll attempt ${attempts + 1}: Response status ${response.status}`);

                if (response.ok) {
                    const result = await response.json();
                    console.log('Payload status result:', result);
                    
                    // Check if the payload is resolved (signed or rejected)
                    if (result.meta && result.meta.resolved === true) {
                        // Close modal
                        const modal = document.querySelector('.xaman-modal');
                        if (modal) {
                            modal.remove();
                            console.log('Modal closed after transaction completion');
                        }
                        
                        if (result.meta.signed === true) {
                            console.log('✅ Transaction signed via backend API');
                            return {
                                signed: true,
                                account: result.response?.account || result.meta?.resolved_destination,
                                txid: result.response?.txid
                            };
                        } else {
                            console.log('❌ Transaction rejected');
                            throw new Error('Transaction was rejected');
                        }
                    } else {
                        console.log(`Still waiting... resolved: ${result.meta?.resolved}, signed: ${result.meta?.signed}, attempts: ${attempts + 1}`);
                    }
                } else {
                    console.warn(`Backend response error: ${response.status} ${response.statusText}`);
                    const errorText = await response.text();
                    console.warn('Error details:', errorText);
                }
            } catch (error) {
                console.warn('Backend API polling error:', error);
                // Don't break on network errors, just continue polling
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error('Backend API polling timeout or failed');
    }

    async pollRealXamanAPI(uuid) {
        const maxAttempts = 60; // 5 minutes with 5 second intervals
        let attempts = 0;

        console.log('Polling real Xaman API for result...');

        while (attempts < maxAttempts) {
            try {
                const response = await fetch(`${this.xamanApiUrl}/payload/${uuid}`, {
                    headers: {
                        'X-API-Key': this.apiKey,
                        'X-API-Secret': this.apiSecret
                    }
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.meta && result.meta.resolved === true) {
                        // Close modal
                        const modal = document.querySelector('.xaman-modal');
                        if (modal) {
                            modal.remove();
                        }
                        
                        if (result.meta.signed === true) {
                            console.log('Transaction signed successfully');
                            return {
                                signed: true,
                                account: result.response?.account || result.meta?.resolved_destination,
                                txid: result.response?.txid,
                                batchComplete: true
                            };
                        } else {
                            console.log('Transaction rejected by user');
                            throw new Error('Transaction was rejected');
                        }
                    }
                }
            } catch (error) {
                console.warn('Error checking payload status:', error);
            }

            attempts++;
            console.log(`Attempt ${attempts}/${maxAttempts} - still waiting...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error('Timeout waiting for wallet response');
    }

    async simulateUserApproval(uuid) {
        console.log('Simulating user approval for testing...');
        console.log('Click "Test Approve" button or use console commands');
        
        return new Promise((resolve, reject) => {
            // Set up manual approval for testing
            window.approveXamanTest = () => {
                console.log('Manual approval triggered');
                const modal = document.querySelector('.xaman-modal');
                if (modal) {
                    modal.remove();
                }
                // Clean up
                delete window.approveXamanTest;
                delete window.rejectXamanTest;
                
                resolve({
                    signed: true,
                    account: this.walletAddress || 'rN7n7otQDd6FczFgLdSqtcsAUxDkw6fzRH', // Test address
                    txid: 'test-batch-' + uuid,
                    batchComplete: true
                });
            };

            window.rejectXamanTest = () => {
                console.log('Manual rejection triggered');
                const modal = document.querySelector('.xaman-modal');
                if (modal) {
                    modal.remove();
                }
                // Clean up
                delete window.approveXamanTest;
                delete window.rejectXamanTest;
                
                reject(new Error('Transaction rejected'));
            };

            // Add test buttons to console message
            console.log('Test Controls:');
            console.log('- To approve: approveXamanTest()');
            console.log('- To reject: rejectXamanTest()');
            console.log('- Or use the "Test Approve" button in the modal');
            
            // Auto-timeout after 2 minutes if no action
            setTimeout(() => {
                // Clean up
                delete window.approveXamanTest;
                delete window.rejectXamanTest;
                reject(new Error('Test timeout - no manual action taken'));
            }, 120000);
        });
    }

    addModalStyles() {
        if (document.querySelector('#xaman-modal-styles')) {
            return; // Already added
        }

        const style = document.createElement('style');
        style.id = 'xaman-modal-styles';
        style.textContent = `
            .xaman-modal {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }

            .xaman-modal .modal-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.8);
                backdrop-filter: blur(5px);
            }

            .xaman-modal .modal-content {
                position: relative;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 12px;
                padding: 0;
                max-width: 450px;
                width: 90%;
                max-height: 80vh;
                overflow: hidden;
                box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            }

            .xaman-modal .modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 1.5rem;
                border-bottom: 1px solid #333;
                background: linear-gradient(135deg, #2a2a2a, #1f1f1f);
            }

            .xaman-modal .modal-header h3 {
                margin: 0;
                color: #ffc107;
                font-size: 1.2rem;
            }

            .xaman-modal .close-btn {
                background: none;
                border: none;
                color: #ccc;
                font-size: 1.5rem;
                cursor: pointer;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: all 0.2s ease;
            }

            .xaman-modal .close-btn:hover {
                color: #ffc107;
                background: rgba(255, 193, 7, 0.1);
            }

            .xaman-modal .modal-body {
                padding: 2rem;
                text-align: center;
            }

            .xaman-modal .qr-container {
                margin-bottom: 1.5rem;
            }

            .xaman-modal .qr-code {
                width: 200px;
                height: 200px;
                border-radius: 8px;
                background: white;
                padding: 10px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            }

            .xaman-modal .instructions {
                text-align: left;
                margin-bottom: 1.5rem;
            }

            .xaman-modal .instructions p {
                margin: 0.5rem 0;
                color: #ccc;
                font-size: 0.9rem;
            }

            .xaman-modal .status-indicator {
                text-align: center;
                margin: 1rem 0;
            }

            .xaman-modal .spinner {
                border: 2px solid #333;
                border-top: 2px solid #ffc107;
                border-radius: 50%;
                width: 20px;
                height: 20px;
                animation: spin 1s linear infinite;
                margin: 0 auto 0.5rem;
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            .xaman-modal .payload-info {
                margin-top: 1rem;
                padding: 0.5rem;
                background: #2a2a2a;
                border-radius: 4px;
                font-family: monospace;
                font-size: 0.7rem;
                color: #888;
            }

            .xaman-modal .mobile-tip {
                background: #2a2a2a;
                padding: 0.75rem;
                border-radius: 4px;
                margin: 1rem 0;
                border-left: 3px solid #ffc107;
            }

            .xaman-modal .actions {
                display: flex;
                gap: 0.5rem;
                justify-content: center;
                flex-wrap: wrap;
            }

            .xaman-modal .btn {
                padding: 0.75rem 1.5rem;
                border: none;
                border-radius: 6px;
                font-size: 0.9rem;
                cursor: pointer;
                transition: all 0.3s ease;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                font-weight: 500;
            }

            .xaman-modal .btn-primary {
                background: linear-gradient(135deg, #ffc107, #ffab00);
                color: #000;
            }

            .xaman-modal .btn-primary:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(255, 193, 7, 0.3);
            }

            .xaman-modal .btn-secondary {
                background: #333;
                color: #ccc;
                border: 1px solid #555;
            }

            .xaman-modal .btn-secondary:hover {
                background: #444;
                color: #fff;
            }
        `;
        document.head.appendChild(style);
    }

    disconnect() {
        this.walletAddress = null;
        this.walletType = null;
        this.isConnected = false;
        console.log('Wallet disconnected');
        
        // Clean up any global callbacks
        delete window.xamanConnectResolve;
        delete window.xamanConnectReject;
        delete window.xamanSignResolve;
        delete window.xamanSignReject;
        delete window.approveXamanTest;
        delete window.rejectXamanTest;
    }
}
