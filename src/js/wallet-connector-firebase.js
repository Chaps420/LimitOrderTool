/**
 * Firebase Backend Wallet Connector
 * Uses Firebase Functions for Xaman API integration
 */

export class WalletConnectorFirebase {
    constructor() {
        this.isConnected = false;
        this.walletAddress = null;
        this.walletType = null;
        this.onConnect = null;
        this.baseUrl = this.getFirebaseUrl();
    }

    getFirebaseUrl() {
        // Use the actual Firebase project ID we created
        const projectId = 'xrpl-limit-order-tool';
        
        // For local development, use Firebase emulator
        if (window.location.hostname === 'localhost') {
            return `http://localhost:5001/${projectId}/us-central1/api`;
        }
        
        // For production (GitHub Pages), use Firebase Functions URL
        return `https://us-central1-${projectId}.cloudfunctions.net/api`;
    }

    async connect() {
        console.log('🔗 Firebase wallet connect called');
        
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
            // Check if Xaman is available in the environment
            if (!window.ReactNativeWebView && !this.isXamanEnvironment()) {
                // Use Firebase backend for web-based Xaman connection
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
            // Create sign-in payload for Xaman
            const payload = {
                txjson: {
                    TransactionType: 'SignIn'
                },
                options: {
                    submit: false,
                    multisign: false,
                    expire: 5
                },
                custom_meta: {
                    identifier: 'xrpl-limit-order-tool',
                    blob: {
                        purpose: 'Connect wallet to XRPL Limit Order Tool'
                    }
                }
            };

            // Show QR modal for Xaman connection
            const result = await this.showXamanQRModal(payload);
            
            if (result.signed && result.account) {
                this.isConnected = true;
                this.walletAddress = result.account;
                this.walletType = 'xaman';
                
                if (this.onConnect) {
                    this.onConnect(this.walletAddress);
                }
                
                return { success: true, address: this.walletAddress };
            }
            
            throw new Error('Xaman connection cancelled or failed');
            
        } catch (error) {
            console.error('Xaman web connection error:', error);
            throw error;
        }
    }

    async showXamanQRModal(payload) {
        return new Promise(async (resolve, reject) => {
            try {
                // Create modal HTML
                const modalHTML = `
                    <div id="xamanModal" class="qr-modal-overlay">
                        <div class="qr-modal-content">
                            <div class="qr-modal-header">
                                <h3>🔗 Connect with Xaman</h3>
                                <button class="qr-modal-close" onclick="this.closest('.qr-modal-overlay').remove()">&times;</button>
                            </div>
                            <div class="qr-modal-body">
                                <div class="qr-instructions">
                                    <p>1. Open Xaman app on your mobile device</p>
                                    <p>2. Tap the scan button</p>
                                    <p>3. Scan this QR code to connect</p>
                                </div>
                                <div id="xamanQRContainer" class="qr-container">
                                    <div class="loading">Creating connection...</div>
                                </div>
                                <div class="qr-status" id="xamanStatus">
                                    Connecting to Xaman...
                                </div>
                            </div>
                            <div class="qr-modal-footer">
                                <button class="btn btn-secondary" onclick="this.closest('.qr-modal-overlay').remove()">Cancel</button>
                            </div>
                        </div>
                    </div>
                `;

                // Add modal to page
                document.body.insertAdjacentHTML('beforeend', modalHTML);
                
                // Create Xaman payload via Firebase
                const payloadResult = await this.createXamanPayload(payload);
                
                if (payloadResult.uuid && payloadResult.next) {
                    // Use Xaman's proper QR code that opens directly in the app
                    const xamanUrl = payloadResult.next.always;
                    
                    const qrContainer = document.getElementById('xamanQRContainer');
                    if (qrContainer) {
                        qrContainer.innerHTML = `
                            <div class="xaman-qr-wrapper">
                                <div class="xaman-logo">📱 Xaman</div>
                                <img src="https://xumm.app/api/v1/platform/qr/${payloadResult.uuid}" 
                                     alt="Xaman QR Code" 
                                     style="width: 256px; height: 256px; border: 2px solid #ffc107; border-radius: 8px; background: white; padding: 8px;">
                                <div class="xaman-instructions">
                                    <p>Scan with Xaman app to connect</p>
                                    <a href="${xamanUrl}" target="_blank" style="color: #ffc107; text-decoration: none; font-size: 14px;">
                                        Or tap here on mobile →
                                    </a>
                                </div>
                            </div>
                        `;
                    }
                    
                    // Poll for result
                    this.pollXamanResult(payloadResult.uuid, resolve, reject);
                } else {
                    reject(new Error('Failed to create Xaman payload'));
                }
                
            } catch (error) {
                const qrContainer = document.getElementById('xamanQRContainer');
                if (qrContainer) {
                    qrContainer.innerHTML = `
                        <div class="error">Failed to create connection: ${error.message}</div>
                    `;
                }
                reject(error);
            }
        });
    }

    async createXamanPayload(payload) {
        try {
            console.log('📝 Creating Xaman payload via Firebase...');
            
            const response = await fetch(`${this.baseUrl}/xaman/payload`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`Firebase API error: ${response.status}`);
            }

            const data = await response.json();
            console.log('✅ Xaman payload created:', data.uuid);
            return data;
            
        } catch (error) {
            console.error('Firebase payload creation error:', error);
            throw new Error(`Failed to create connection: ${error.message}`);
        }
    }

    async pollXamanResult(uuid, resolve, reject) {
        const maxAttempts = 60; // 5 minutes
        let attempts = 0;

        const poll = async () => {
            attempts++;
            
            try {
                // Check payload status via Firebase
                const response = await fetch(`${this.baseUrl}/xaman/payload/${uuid}`);
                
                if (!response.ok) {
                    throw new Error(`Status check failed: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Update status
                const statusElement = document.getElementById('xamanStatus');
                if (statusElement) {
                    if (data.meta?.signed) {
                        statusElement.textContent = 'Connection successful!';
                    } else if (data.meta?.cancelled) {
                        statusElement.textContent = 'Connection cancelled';
                    } else {
                        statusElement.textContent = `Waiting for signature... (${60 - attempts}s remaining)`;
                    }
                }
                
                // Check if signed
                if (data.meta?.signed && data.response?.account) {
                    const modal = document.getElementById('xamanModal');
                    if (modal) modal.remove();
                    
                    resolve({
                        signed: true,
                        account: data.response.account
                    });
                    return;
                }
                
                // Check if cancelled
                if (data.meta?.cancelled) {
                    const modal = document.getElementById('xamanModal');
                    if (modal) modal.remove();
                    reject(new Error('Connection cancelled by user'));
                    return;
                }
                
                // Check timeout
                if (attempts >= maxAttempts) {
                    const modal = document.getElementById('xamanModal');
                    if (modal) modal.remove();
                    reject(new Error('Connection timeout'));
                    return;
                }

                // Continue polling
                setTimeout(poll, 5000);
                
            } catch (error) {
                const modal = document.getElementById('xamanModal');
                if (modal) modal.remove();
                reject(error);
            }
        };

        poll();
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
            console.log(`🔄 Creating ${orders.length} orders via Firebase...`);
            
            const results = {
                success: false,
                totalRequested: orders.length,
                totalSigned: 0,
                transactions: []
            };

            // Sign orders one by one using Firebase backend
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

    async signWithXaman(transaction) {
        // Create Xaman signing payload via Firebase
        const payload = {
            txjson: transaction,
            options: {
                submit: true,
                multisign: false,
                expire: 5
            }
        };

        const result = await this.showXamanQRModal(payload);
        return { success: result.signed, transaction: result };
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
    }
}
