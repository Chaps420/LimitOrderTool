/**
 * Standalone Wallet Connector - No Backend Required
 * Uses Xaman client-side integration and direct XRPL connections
 */

export class WalletConnectorStandalone {
    constructor() {
        this.isConnected = false;
        this.walletAddress = null;
        this.networkId = null;
        this.xrplClient = null;
        this.payloadId = null;
        
        // Load Xaman SDK
        this.loadXamanSDK();
    }

    async loadXamanSDK() {
        // Load Xaman SDK from CDN
        if (!window.xrpl || !window.XummPkce) {
            const script1 = document.createElement('script');
            script1.src = 'https://cdn.jsdelivr.net/npm/xrpl@3.0.0/dist/xrpl-latest-min.js';
            document.head.appendChild(script1);

            const script2 = document.createElement('script');
            script2.src = 'https://cdn.jsdelivr.net/npm/xumm-oauth2-pkce@2.8.1/dist/xumm-oauth2-pkce.min.js';
            document.head.appendChild(script2);

            // Wait for scripts to load
            await new Promise((resolve) => {
                let loaded = 0;
                script1.onload = script2.onload = () => {
                    loaded++;
                    if (loaded === 2) resolve();
                };
            });
        }
    }

    /**
     * Simple connect method to match the interface expected by app.js
     */
    async connect() {
        console.log('🔗 Standalone wallet connect called');
        
        // For demo purposes, show a simple prompt
        // In production, this would use proper Xaman integration
        const address = prompt('Enter your XRPL wallet address for demo purposes:\n(In production, this would connect via Xaman)');
        
        if (address && this.isValidXRPLAddress(address)) {
            this.walletAddress = address;
            this.isConnected = true;
            this.walletType = 'demo';
            
            console.log('✅ Demo wallet connected:', address);
            return address;
        } else {
            throw new Error('Invalid XRPL address or connection cancelled');
        }
    }

    /**
     * Validate XRPL address format
     */
    isValidXRPLAddress(address) {
        // Basic XRPL address validation
        return address && address.length >= 25 && address.length <= 34 && address.startsWith('r');
    }

    /**
     * Connect wallet using Xaman OAuth (no backend required)
     */
    async connectWallet() {
        try {
            console.log('🔗 Connecting wallet using client-side Xaman OAuth...');

            // Initialize Xaman OAuth
            const auth = new XummPkce('your-app-id-here', {
                redirectUrl: window.location.origin,
                rememberJwt: true
            });

            // Authorize user
            await auth.authorize();
            
            // Get user info
            const user = await auth.me();
            
            if (user && user.account) {
                this.walletAddress = user.account;
                this.isConnected = true;
                this.networkId = user.networkType || 'mainnet';

                console.log('✅ Wallet connected:', this.walletAddress);
                return {
                    success: true,
                    address: this.walletAddress,
                    networkId: this.networkId
                };
            } else {
                throw new Error('Failed to get user account information');
            }

        } catch (error) {
            console.error('❌ Wallet connection failed:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Create transaction using Xaman without backend
     */
    async createXamanPayload(transaction) {
        try {
            console.log('📝 Creating Xaman payload (client-side)...');

            // Use direct Xaman API with CORS proxy or client-side SDK
            const payload = {
                txjson: transaction,
                custom_meta: {
                    identifier: `limit-order-${Date.now()}`,
                    blob: { purpose: 'XRPL Limit Order Creation' }
                }
            };

            // For demo purposes, return a mock payload
            // In production, you'd use Xaman's client SDK or CORS proxy
            const mockPayload = {
                uuid: `mock-${Date.now()}`,
                next: {
                    always: `https://xumm.app/sign/${Date.now()}`
                },
                pushed: true,
                qr_png: null // Will be generated client-side
            };

            this.payloadId = mockPayload.uuid;
            return mockPayload;

        } catch (error) {
            console.error('❌ Failed to create Xaman payload:', error);
            throw error;
        }
    }

    /**
     * Generate QR code client-side
     */
    generateQRCode(url) {
        const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}`;
        return qrCodeURL;
    }

    /**
     * Monitor payload status (simplified for standalone)
     */
    async monitorPayloadStatus(uuid, callback) {
        console.log('👀 Monitoring payload status (standalone mode)...');
        
        // Simulate status checking for demo
        let attempts = 0;
        const maxAttempts = 60; // 5 minutes
        
        const checkStatus = async () => {
            attempts++;
            
            // In real implementation, you'd check actual Xaman status
            if (attempts > 30) {
                callback({
                    meta: { signed: true, resolved: true },
                    response: { dispatched_result: 'tesSUCCESS' }
                });
                return;
            }
            
            callback({
                meta: { signed: false, resolved: false }
            });
            
            if (attempts < maxAttempts) {
                setTimeout(checkStatus, 5000); // Check every 5 seconds
            }
        };
        
        setTimeout(checkStatus, 1000);
    }

    /**
     * Show transaction QR modal
     */
    showTransactionQR(payload) {
        const qrUrl = this.generateQRCode(payload.next.always);
        
        // Create modal HTML
        const modalHTML = `
            <div class="qr-modal-overlay" id="qrModalOverlay">
                <div class="qr-modal">
                    <div class="qr-modal-header">
                        <h3>Sign with Xaman</h3>
                        <button class="qr-modal-close" id="qrModalClose">&times;</button>
                    </div>
                    <div class="qr-modal-body">
                        <div class="qr-code-container">
                            <img src="${qrUrl}" alt="QR Code" class="qr-code-image">
                        </div>
                        <p class="qr-instructions">
                            Scan this QR code with your Xaman app to sign the transaction
                        </p>
                        <div class="qr-status" id="qrStatus">
                            <span class="status-indicator">⏳</span>
                            <span class="status-text">Waiting for signature...</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add modal to page
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Add event listeners
        const overlay = document.getElementById('qrModalOverlay');
        const closeBtn = document.getElementById('qrModalClose');
        
        const closeModal = () => {
            overlay.remove();
        };

        closeBtn.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });

        // Monitor status
        this.monitorPayloadStatus(payload.uuid, (status) => {
            const statusEl = document.getElementById('qrStatus');
            if (statusEl) {
                if (status.meta.signed) {
                    statusEl.innerHTML = `
                        <span class="status-indicator">✅</span>
                        <span class="status-text">Transaction signed successfully!</span>
                    `;
                    setTimeout(closeModal, 2000);
                }
            }
        });

        return Promise.resolve(payload);
    }

    /**
     * Create multiple orders (batch)
     */
    async createBatchOrders(orders, tokenInfo) {
        const results = [];
        
        for (let i = 0; i < orders.length; i++) {
            const order = orders[i];
            console.log(`📦 Creating order ${i + 1}/${orders.length}...`);

            try {
                // Create XRPL transaction
                const transaction = {
                    TransactionType: 'OfferCreate',
                    Account: this.walletAddress,
                    TakerGets: (parseFloat(order.totalXRP) * 1000000).toString(), // XRP in drops
                    TakerPays: {
                        currency: tokenInfo.currency,
                        issuer: tokenInfo.issuer,
                        value: order.amount.toString()
                    },
                    Fee: '12' // 12 drops fee
                };

                // Create payload
                const payload = await this.createXamanPayload(transaction);
                
                // Show QR and wait for signing
                await this.showTransactionQR(payload);
                
                results.push({
                    order: order,
                    success: true,
                    payload: payload
                });

            } catch (error) {
                console.error(`❌ Failed to create order ${i + 1}:`, error);
                results.push({
                    order: order,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Disconnect wallet
     */
    disconnect() {
        this.isConnected = false;
        this.walletAddress = null;
        this.networkId = null;
        this.payloadId = null;
        console.log('🔌 Wallet disconnected');
    }
}
