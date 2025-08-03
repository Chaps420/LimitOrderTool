/**
 * GitHub Pages Wallet Connector
 * Uses Xaman JavaScript SDK for direct browser integration (CORS-friendly)
 */

export class WalletConnectorGitHub {
    constructor() {
        this.isConnected = false;
        this.walletAddress = null;
        this.walletType = null;
        this.onConnect = null;
        this.xumm = null;
        
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
            
            // Initialize Xaman SDK
            this.xumm = new window.Xumm(this.xamanApiKey);
            
            // Set up event listeners
            this.xumm.on("ready", () => {
                console.log("✅ Xaman SDK ready");
            });
            
            this.xumm.on("success", async () => {
                console.log("🎉 Xaman user authenticated");
                const account = await this.xumm.user.account;
                if (account) {
                    this.isConnected = true;
                    this.walletAddress = account;
                    this.walletType = 'xaman';
                    
                    if (this.onConnect) {
                        this.onConnect(this.walletAddress);
                    }
                }
            });
            
            this.xumm.on("logout", () => {
                console.log("👋 Xaman user logged out");
                this.disconnect();
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize Xaman SDK:', error);
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
        try {
            // Check if Xaman is available in the environment (mobile app)
            if (!window.ReactNativeWebView && !this.isXamanEnvironment()) {
                // Use Xaman SDK for web-based connection
                return await this.connectXamanWeb();
            }
            
            throw new Error('Xaman wallet not detected');
        } catch (error) {
            console.error('Xaman connection error:', error);
            throw error;
        }
    }

    isXamanEnvironment() {
        return !!(window.ReactNativeWebView || 
                 navigator.userAgent.includes('Xaman') ||
                 window.xaman);
    }

    async connectXamanWeb() {
        try {
            if (!this.xumm) {
                throw new Error('Xaman SDK not initialized');
            }
            
            console.log('🔐 Starting Xaman SDK authorization...');
            
            // Use Xaman SDK authorize method - this handles QR codes and mobile redirects automatically
            await this.xumm.authorize();
            
            // If we get here, authorization was successful
            // The SDK will trigger the "success" event and handle account connection
            return { success: true, address: this.walletAddress };
            
        } catch (error) {
            console.error('Xaman web connection error:', error);
            throw error;
        }
    }

    async signWithXaman(transaction) {
        try {
            if (!this.xumm) {
                throw new Error('Xaman SDK not initialized');
            }
            
            console.log('📝 Creating transaction payload with Xaman SDK...');
            
            // Create payload using Xaman SDK
            const payload = await this.xumm.payload.create({
                txjson: transaction,
                options: {
                    submit: true,
                    multisign: false,
                    expire: 5
                }
            });
            
            if (payload.uuid) {
                console.log('✅ Payload created:', payload.uuid);
                
                // Subscribe to payload updates
                const result = await this.xumm.payload.subscribe(payload.uuid, (event) => {
                    console.log('📡 Payload update:', event);
                });
                
                return { success: !!result.signed, transaction: result };
            }
            
            throw new Error('Failed to create transaction payload');
            
        } catch (error) {
            console.error('❌ Xaman signing error:', error);
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
                transactions: []
            };

            // Sign orders one by one using Xaman SDK
            for (let i = 0; i < orders.length; i++) {
                const order = orders[i];
                
                try {
                    const signResult = await this.signTransaction(order);
                    
                    if (signResult.success) {
                        results.totalSigned++;
                        results.transactions.push(signResult);
                    }
                    
                } catch (error) {
                    console.error(`❌ Failed to sign order ${i + 1}:`, error);
                    // Continue with next order
                }
            }

            results.success = results.totalSigned > 0;
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
        this.isConnected = false;
        this.walletAddress = null;
        this.walletType = null;
        
        // Logout from Xaman SDK if available
        if (this.xumm) {
            this.xumm.logout();
        }
    }
}
