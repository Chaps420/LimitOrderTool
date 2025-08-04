/**
 * GitHub Pages Wallet Connector
 * Uses Xaman JavaScript SDK for session-based integration (CORS-friendly)
 * Session-only connection - no localStorage persistence
 */

export class WalletConnectorGitHub {
    constructor() {
        this.isConnected = false;
        this.walletAddress = null;
        this.walletType = null;
        this.onConnect = null;
        this.xumm = null;
        this.sessionConnected = false; // Session-based connection state
        
        // Xaman API key for SDK initialization
        this.xamanApiKey = '1ee24ba3-7f93-4f63-8ad3-ee605f38eb2d';
        
        // Initialize Xaman SDK
        this.initializeXamanSDK();
    }

    async initializeXamanSDK() {
        try {
            // Load Xaman SDK if not already loaded
            if (!window.Xumm) {
                console.log('📦 Loading Xaman SDK...');
                await this.loadXamanSDK();
            }
            
            // Initialize Xaman SDK with debugging
            console.log('🔧 Initializing Xaman SDK...');
            console.log('🌐 Current URL:', window.location.href);
            console.log('🔑 API Key:', this.xamanApiKey.substring(0, 8) + '...');
            
            this.xumm = new window.Xumm(this.xamanApiKey);
            
            // Set up event listeners for session-based connection
            this.xumm.on("ready", () => {
                console.log("✅ Xaman SDK ready for session-based connection");
            });
            
            this.xumm.on("error", (error) => {
                console.error("❌ Xaman SDK error:", error);
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Xaman SDK:', error);
            
            // Show user-friendly error message about redirect URL
            if (error.message && error.message.includes('redirect')) {
                throw new Error('Redirect URL not configured. Please contact the app developer to add this domain to the Xaman app configuration.');
            }
        }
    }

    async loadXamanSDK() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://xumm.app/assets/cdn/xumm.min.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async connect() {
        console.log('🔗 GitHub Pages wallet connect called');
        
        // Ensure Xaman SDK is ready
        if (!this.xumm) {
            await this.initializeXamanSDK();
        }
        
        // Only try Xaman - this is a Xaman-focused tool
        try {
            const result = await this.connectXaman();
            if (result.success) {
                return result;
            }
        } catch (error) {
            console.error('Xaman connection failed:', error.message);
            throw new Error(`Xaman wallet connection failed: ${error.message}. Please ensure you have the Xaman app installed and try again.`);
        }

        throw new Error('Unable to connect to Xaman wallet. Please install the Xaman app and try again.');
    }

    async connectXaman() {
        console.log('🔐 Starting Xaman connection...');
        
        try {
            if (!this.xumm) {
                await this.initializeXamanSDK();
            }
            
            // Use session-based SignIn approach
            return await this.connectWithSignIn();
            
        } catch (error) {
            console.error('❌ Xaman connection error:', error);
            throw error;
        }
    }

    isXamanEnvironment() {
        return !!(window.ReactNativeWebView || 
                 navigator.userAgent.includes('Xaman') ||
                 window.xaman);
    }

    async connectWithSignIn() {
        try {
            if (!this.xumm) {
                throw new Error('Xaman SDK not initialized');
            }
            
            console.log('🔐 Creating SignIn payload for session-based connection...');
            
            // Create a SignIn payload for wallet connection
            const signInPayload = await this.xumm.payload.create({
                TransactionType: 'SignIn'
            });
            
            console.log('📦 SignIn payload created:', signInPayload);
            
            if (signInPayload && signInPayload.uuid) {
                console.log('✅ SignIn payload created:', signInPayload.uuid);
                console.log('🔗 QR Code URL:', signInPayload.refs?.qr_png);
                console.log('📱 Xaman Deep Link:', signInPayload.next?.always);
                
                // Show QR code modal for wallet connection
                if (signInPayload.refs?.qr_png) {
                    if (typeof window.showQRModal === 'function') {
                        console.log('📱 Showing QR modal for WALLET CONNECTION...');
                        // Update modal title to be clear this is for connection
                        const modal = document.getElementById('qrModal');
                        if (modal) {
                            const header = modal.querySelector('.qr-modal-header h3');
                            if (header) {
                                header.textContent = '🔗 Connect Wallet - Scan with Xaman App';
                            }
                        }
                        window.showQRModal(signInPayload.refs.qr_png, signInPayload.next?.always);
                    } else {
                        // Fallback: open Xaman link directly
                        window.open(signInPayload.next?.always, '_blank');
                    }
                } else {
                    console.warn('No QR code URL in SignIn payload response');
                }
                
                // Wait for user to scan and sign
                console.log('⏳ Waiting for SignIn confirmation...');
                const result = await this.xumm.payload.subscribe(signInPayload.uuid);
                
                console.log('📋 SignIn result:', result);
                
                if (result && result.signed === true) {
                    // Get the account from the SignIn result
                    const account = result.account || result.response?.account;
                    
                    if (account) {
                        console.log('🎉 SignIn successful! Account:', account);
                        
                        // Set session-based connection state
                        this.sessionConnected = true;
                        this.isConnected = true;
                        this.walletAddress = account;
                        this.walletType = 'xaman';
                        
                        // Hide QR modal after successful connection
                        if (typeof window.closeQRModal === 'function') {
                            window.closeQRModal();
                        }
                        
                        // Call connection callback
                        if (this.onConnect) {
                            this.onConnect(this.walletAddress);
                        }
                        
                        return { 
                            success: true, 
                            address: this.walletAddress,
                            type: this.walletType 
                        };
                    } else {
                        throw new Error('No account found in SignIn response');
                    }
                } else {
                    throw new Error('SignIn was not completed or was rejected');
                }
                
            } else {
                throw new Error('Failed to create SignIn payload');
            }
            
        } catch (error) {
            console.error('🚫 SignIn connection failed:', error);
            
            // Hide QR modal on error
            if (typeof window.closeQRModal === 'function') {
                window.closeQRModal();
            }
            
            throw error;
        }
    }

    async signWithXaman(transaction) {
        try {
            if (!this.xumm) {
                throw new Error('Xaman SDK not initialized');
            }
            
            console.log('📝 Creating transaction payload with Xaman SDK...');
            console.log('📋 Transaction details:', transaction);
            
            // Validate transaction has required fields
            if (!transaction.TransactionType || !transaction.Account) {
                throw new Error('Invalid transaction format - missing required fields');
            }
            
            // Create payload using Xaman SDK
            const payload = await this.xumm.payload.create({
                txjson: transaction,
                options: {
                    submit: true,
                    multisign: false,
                    expire: 10 // Increase timeout to 10 minutes
                }
            });
            
            console.log('📦 Payload creation response:', payload);
            
            if (payload && payload.uuid) {
                console.log('✅ Payload created:', payload.uuid);
                console.log('🔗 QR Code URL:', payload.refs?.qr_png);
                console.log('📱 Xaman Deep Link:', payload.next?.always);
                
                // Show QR code modal with the generated QR code
                if (payload.refs?.qr_png) {
                    // Use the global function to show QR modal
                    if (typeof window.showQRModal === 'function') {
                        window.showQRModal(payload.refs.qr_png, payload.next?.always);
                        window.updateQRStatus('🔍 QR Code ready! Scan with your phone...', 'info');
                    } else {
                        console.warn('QR modal function not available, opening in new tab as fallback');
                        window.open(payload.next?.always, '_blank');
                    }
                } else {
                    console.warn('No QR code URL in payload response');
                    // Fallback: open the deep link in a new tab
                    if (payload.next?.always) {
                        window.open(payload.next.always, '_blank');
                    }
                }
                
                // Subscribe to payload updates with QR status updates
                const result = await this.xumm.payload.subscribe(payload.uuid, (event) => {
                    console.log('📡 Payload update:', event);
                    
                    // Update QR modal status based on event
                    if (typeof window.updateQRStatus === 'function') {
                        if (event.signed === true) {
                            window.updateQRStatus('✅ Transaction signed successfully!', 'success');
                            // Don't close modal immediately - let user see success message
                            setTimeout(() => {
                                window.closeQRModal();
                            }, 3000);
                        } else if (event.signed === false) {
                            window.updateQRStatus('❌ Transaction was rejected or cancelled', 'error');
                            // Close modal after showing error
                            setTimeout(() => {
                                window.closeQRModal();
                            }, 3000);
                        } else if (event.opened === true) {
                            window.updateQRStatus('📱 Xaman app opened - please review the transaction', 'info');
                        } else if (event.dispatched === true) {
                            window.updateQRStatus('📡 Transaction dispatched to XRPL network...', 'info');
                        }
                    }
                });
                
                return { success: !!result.signed, transaction: result };
            }
            
            console.error('❌ Payload creation failed - no UUID returned');
            throw new Error('Failed to create transaction payload - no UUID returned');
            
        } catch (error) {
            console.error('❌ Xaman signing error:', error);
            console.error('❌ Error details:', error.response?.data || error.message);
            
            // Close QR modal on error
            if (typeof window.closeQRModal === 'function') {
                window.closeQRModal();
            }
            
            throw new Error(`Xaman signing failed: ${error.message}`);
        }
    }

    async connectGemWallet() {
        try {
            if (!window.gem) {
                throw new Error('GemWallet not detected');
            }

            const result = await window.gem.getAddress();
            
            if (result && result.address) {
                this.isConnected = true;
                this.walletAddress = result.address;
                this.walletType = 'gem';
                
                if (this.onConnect) {
                    this.onConnect(this.walletAddress);
                }

                return { success: true, address: this.walletAddress };
            }

            throw new Error('Failed to connect to GemWallet');
        } catch (error) {
            console.error('GemWallet connection error:', error);
            throw error;
        }
    }

    async connectCrossmark() {
        try {
            if (!window.crossmark) {
                throw new Error('Crossmark not detected');
            }

            const result = await window.crossmark.methods.signInAndWait();
            
            if (result && result.response && result.response.data && result.response.data.account) {
                this.isConnected = true;
                this.walletAddress = result.response.data.account;
                this.walletType = 'crossmark';
                
                if (this.onConnect) {
                    this.onConnect(this.walletAddress);
                }

                return { success: true, address: this.walletAddress };
            }

            throw new Error('Failed to connect to Crossmark');
        } catch (error) {
            console.error('Crossmark connection error:', error);
            throw error;
        }
    }

    async createBatchOrders(walletAddress, orders) {
        if (!this.isConnected) {
            throw new Error('Wallet not connected');
        }

        try {
            console.log(`🔄 Creating ${orders.length} orders with Xaman SDK...`);
            
            const results = {
                success: false,
                totalRequested: orders.length,
                totalSigned: 0,
                signedTransactions: [],
                transactions: []
            };

            // Sign orders one by one using Xaman SDK
            for (let i = 0; i < orders.length; i++) {
                const order = orders[i];
                console.log(`📝 Processing order ${i + 1}/${orders.length}:`, order);
                
                try {
                    // Update status for multiple orders
                    if (typeof window.updateQRStatus === 'function' && orders.length > 1) {
                        window.updateQRStatus(`📱 Signing order ${i + 1} of ${orders.length}...`, 'info');
                    }
                    
                    const signResult = await this.signTransaction(order);
                    
                    if (signResult.success) {
                        results.totalSigned++;
                        results.transactions.push(signResult);
                        results.signedTransactions.push({
                            order: i + 1,
                            transaction: signResult.transaction
                        });
                        console.log(`✅ Order ${i + 1} signed successfully`);
                        
                        // Update progress for multiple orders
                        if (typeof window.updateQRStatus === 'function' && orders.length > 1) {
                            window.updateQRStatus(`✅ Order ${i + 1} completed! (${results.totalSigned}/${orders.length})`, 'success');
                            
                            // Brief pause between orders if there are more
                            if (i < orders.length - 1) {
                                await new Promise(resolve => setTimeout(resolve, 2000));
                            }
                        }
                    } else {
                        console.log(`❌ Order ${i + 1} was not signed`);
                        
                        // Ask user if they want to continue with remaining orders
                        if (i < orders.length - 1) {
                            const continueProcess = confirm(`Order ${i + 1} was not signed. Continue with remaining ${orders.length - i - 1} orders?`);
                            if (!continueProcess) {
                                console.log('🛑 User chose to stop processing remaining orders');
                                break;
                            }
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ Failed to sign order ${i + 1}:`, error);
                    
                    // Ask user if they want to continue with remaining orders
                    if (i < orders.length - 1) {
                        const continueProcess = confirm(`Order ${i + 1} failed: ${error.message}\n\nContinue with remaining ${orders.length - i - 1} orders?`);
                        if (!continueProcess) {
                            console.log('🛑 User chose to stop processing remaining orders');
                            break;
                        }
                    }
                }
            }

            results.success = results.totalSigned > 0;
            
            // Final status update
            if (typeof window.updateQRStatus === 'function') {
                if (results.totalSigned === orders.length) {
                    window.updateQRStatus(`🎉 All ${results.totalSigned} orders completed successfully!`, 'success');
                } else if (results.totalSigned > 0) {
                    window.updateQRStatus(`⚠️ ${results.totalSigned}/${orders.length} orders completed`, 'info');
                } else {
                    window.updateQRStatus(`❌ No orders were completed`, 'error');
                }
                
                // Close modal after final message
                setTimeout(() => {
                    window.closeQRModal();
                }, 4000);
            }
            
            return results;
            
        } catch (error) {
            console.error('Batch order creation error:', error);
            throw error;
        }
    }

    async signTransaction(transaction) {
        switch (this.walletType) {
            case 'xaman':
                return await this.signWithXaman(transaction);
            case 'gem':
                return await this.signWithGem(transaction);
            case 'crossmark':
                return await this.signWithCrossmark(transaction);
            default:
                throw new Error('No wallet connected');
        }
    }

    async signWithGem(transaction) {
        try {
            const result = await window.gem.submitTransaction(transaction);
            return { success: !!result.hash, transaction: result };
        } catch (error) {
            throw new Error(`GemWallet signing failed: ${error.message}`);
        }
    }

    async signWithCrossmark(transaction) {
        try {
            const result = await window.crossmark.methods.sign(transaction);
            return { success: !!result.response, transaction: result.response };
        } catch (error) {
            throw new Error(`Crossmark signing failed: ${error.message}`);
        }
    }

    getWalletAddress() {
        return this.walletAddress;
    }

    getWalletType() {
        return this.walletType;
    }

    disconnect() {
        console.log('🔌 Disconnecting session-based wallet connection...');
        this.isConnected = false;
        this.walletAddress = null;
        this.walletType = null;
        this.sessionConnected = false; // Clear session state
        
        // No need to logout from Xaman SDK for session-based connection
        console.log('✅ Session-based wallet disconnected');
    }
}
