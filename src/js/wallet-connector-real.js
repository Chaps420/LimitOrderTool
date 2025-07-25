// Real wallet connector with production API only - NO MOCK DATA
export class WalletConnector {
    constructor() {
        this.walletAddress = null;
        this.isConnected = false;
        this.wallet = null;
        this.walletType = null; // For compatibility with app.js
        this.onConnect = null;
        this.onDisconnect = null;
    }

    // Compatibility method for app.js
    async connect() {
        const result = await this.connectWallet('xaman');
        return this.walletAddress;
    }

    async connectWallet(walletType = 'xaman') {
        try {
            switch (walletType) {
                case 'xaman':
                    return await this.connectXaman();
                case 'gem':
                    return await this.connectGemWallet();
                case 'crossmark':
                    return await this.connectCrossmark();
                default:
                    throw new Error('Unsupported wallet type');
            }
        } catch (error) {
            console.error('Wallet connection error:', error);
            throw error;
        }
    }

    async connectXaman() {
        try {
            const payload = await this.createXamanPayload();
            if (!payload) {
                throw new Error('Failed to create Xaman payload');
            }

            this.showQRModal(payload);
            return payload;
        } catch (error) {
            console.error('Xaman connection error:', error);
            throw error;
        }
    }

    async createXamanPayload() {
        try {
            const response = await fetch('http://localhost:3002/create-payload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txjson: {
                        TransactionType: 'SignIn'
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend response error:', response.status, errorText);
                throw new Error(`Backend error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('Payload created successfully:', data);
            return data;
        } catch (error) {
            console.error('Error creating Xaman payload:', error);
            throw error;
        }
    }

    showQRModal(payload, title = 'Connect with Xaman') {
        // Remove existing modal if present
        const existingModal = document.getElementById('qr-modal');
        if (existingModal) {
            existingModal.remove();
        }

        // Create modal HTML
        const modalHTML = `
            <div id="qr-modal" class="modal-overlay" style="
                position: fixed; 
                top: 0; 
                left: 0; 
                width: 100%; 
                height: 100%; 
                background: rgba(0,0,0,0.8); 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                z-index: 10000;
            ">
                <div class="modal-content" style="
                    background: #1a1a1a; 
                    padding: 2rem; 
                    border-radius: 12px; 
                    text-align: center; 
                    max-width: 400px; 
                    border: 2px solid #ffc107;
                ">
                    <h3 style="color: #ffc107; margin-bottom: 1rem;">${title}</h3>
                    <div id="qr-code" style="margin: 1rem 0;"></div>
                    <p style="color: #fff; margin: 1rem 0;">Scan with Xaman app or tap the button below</p>
                    <div style="margin: 1rem 0;">
                        <a href="${payload.next.always}" 
                           style="
                               display: inline-block; 
                               background: #ffc107; 
                               color: #000; 
                               padding: 0.75rem 1.5rem; 
                               text-decoration: none; 
                               border-radius: 6px; 
                               font-weight: bold;
                               margin: 0.5rem;
                           ">
                           Open in Xaman
                        </a>
                    </div>
                    <button onclick="document.getElementById('qr-modal').remove()" 
                            style="
                                background: #666; 
                                color: #fff; 
                                border: none; 
                                padding: 0.5rem 1rem; 
                                border-radius: 4px; 
                                cursor: pointer;
                            ">
                        Close
                    </button>
                </div>
            </div>
        `;

        // Add modal to document
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        // Generate QR code
        this.generateQRCode(payload.next.always, 'qr-code');

        // Start monitoring payload status
        this.monitorPayloadStatus(payload.uuid);
    }

    generateQRCode(url, elementId) {
        try {
            // Clear existing content
            const qrElement = document.getElementById(elementId);
            if (qrElement) {
                qrElement.innerHTML = '<div style="color: #fff; padding: 1rem;">Loading QR code...</div>';
                
                // Function to create QR code
                const createQR = () => {
                    if (typeof QRCode !== 'undefined') {
                        qrElement.innerHTML = ''; // Clear loading message
                        new QRCode(qrElement, {
                            text: url,
                            width: 200,
                            height: 200,
                            colorDark: "#000000",
                            colorLight: "#ffffff",
                        });
                        console.log('QR code generated successfully');
                    } else {
                        // Create QR code using inline canvas method
                        console.log('Using fallback QR code generation');
                        this.createFallbackQRCode(url, qrElement);
                    }
                };

                // Try immediately
                createQR();
                
                // If QR code wasn't created, try again after delays
                if (typeof QRCode === 'undefined') {
                    console.log('QRCode library not ready, using fallback...');
                    setTimeout(createQR, 500);
                }
            }
        } catch (error) {
            console.error('QR code generation error:', error);
            // Fallback: show URL
            const qrElement = document.getElementById(elementId);
            if (qrElement) {
                this.createFallbackQRCode(url, qrElement);
            }
        }
    }

    createFallbackQRCode(url, element) {
        // Create a simple QR code using Google Charts API as backup
        const qrCodeURL = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`;
        
        element.innerHTML = `
            <div style="text-align: center;">
                <img src="${qrCodeURL}" 
                     alt="QR Code" 
                     style="width: 200px; height: 200px; border: 2px solid #ffc107; border-radius: 8px;"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
                <div style="display: none; color: #fff; word-break: break-all; font-size: 0.8rem; margin: 1rem; padding: 1rem; background: #333; border-radius: 8px;">
                    ${url}
                </div>
            </div>
        `;
        console.log('Fallback QR code created using QR Server API');
    }

    async monitorPayloadStatus(uuid) {
        const maxAttempts = 60; // 5 minutes
        let attempts = 0;

        const checkStatus = async () => {
            try {
                if (attempts >= maxAttempts) {
                    console.log('Monitoring timeout reached');
                    return;
                }

                const response = await fetch(`http://localhost:3002/payload-status/${uuid}`);
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.meta && result.meta.signed) {
                        console.log('Transaction signed successfully:', result);
                        this.handleSuccessfulConnection(result);
                        return;
                    }
                }

                attempts++;
                setTimeout(checkStatus, 5000); // Check every 5 seconds
            } catch (error) {
                console.error('Status monitoring error:', error);
                attempts++;
                setTimeout(checkStatus, 5000);
            }
        };

        checkStatus();
    }

    handleSuccessfulConnection(result) {
        // Extract wallet address from the result
        if (result.response && result.response.account) {
            this.walletAddress = result.response.account;
            this.isConnected = true;
            this.wallet = 'xaman';
            this.walletType = 'xaman'; // For compatibility with app.js

            // Close modal
            const modal = document.getElementById('qr-modal');
            if (modal) {
                modal.remove();
            }

            // Trigger connection callback with the actual address
            if (this.onConnect) {
                this.onConnect(this.walletAddress);
            }

            console.log('Wallet connected:', this.walletAddress);
            
            // Also trigger any app-level wallet connected events
            if (window.app && window.app.onWalletConnected) {
                window.app.onWalletConnected(this.walletAddress);
            }
        }
    }

    async connectGemWallet() {
        try {
            if (!window.gemWallet) {
                throw new Error('GemWallet not detected');
            }

            const result = await window.gemWallet.connect();
            
            if (result && result.wallet && result.wallet.publicAddress) {
                this.walletAddress = result.wallet.publicAddress;
                this.isConnected = true;
                this.wallet = 'gem';
                this.walletType = 'gem'; // For compatibility with app.js

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

            const result = await window.crossmark.signIn();
            
            if (result && result.response && result.response.address) {
                this.walletAddress = result.response.address;
                this.isConnected = true;
                this.wallet = 'crossmark';
                this.walletType = 'crossmark'; // For compatibility with app.js

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

    async submitTransaction(transaction) {
        if (!this.isConnected) {
            throw new Error('No wallet connected');
        }

        try {
            switch (this.wallet) {
                case 'xaman':
                    return await this.submitXamanTransaction(transaction);
                case 'gem':
                    return await this.submitGemTransaction(transaction);
                case 'crossmark':
                    return await this.submitCrossmarkTransaction(transaction);
                default:
                    throw new Error('Unknown wallet type');
            }
        } catch (error) {
            console.error('Transaction submission error:', error);
            throw error;
        }
    }

    async submitXamanTransaction(transaction, title = 'Sign Transaction') {
        try {
            const response = await fetch('http://localhost:3002/create-payload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txjson: transaction
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend response error:', response.status, errorText);
                throw new Error(`Backend error: ${response.status} - ${errorText}`);
            }

            const payload = await response.json();
            this.showQRModal(payload, title);
            return payload;
        } catch (error) {
            console.error('Xaman transaction error:', error);
            throw error;
        }
    }

    async submitGemTransaction(transaction) {
        try {
            if (!window.gemWallet) {
                throw new Error('GemWallet not available');
            }

            const result = await window.gemWallet.submitTransaction(transaction);
            return result;
        } catch (error) {
            console.error('GemWallet transaction error:', error);
            throw error;
        }
    }

    async submitCrossmarkTransaction(transaction) {
        try {
            if (!window.crossmark) {
                throw new Error('Crossmark not available');
            }

            const result = await window.crossmark.signAndSubmitTransaction(transaction);
            return result;
        } catch (error) {
            console.error('Crossmark transaction error:', error);
            throw error;
        }
    }

    disconnect() {
        this.walletAddress = null;
        this.isConnected = false;
        this.wallet = null;

        if (this.onDisconnect) {
            this.onDisconnect();
        }

        console.log('Wallet disconnected');
    }

    getWalletAddress() {
        return this.walletAddress;
    }

    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            walletType: this.wallet,
            address: this.walletAddress
        };
    }

    // Additional methods expected by app.js
    async createBatchOrders(walletAddress, orders) {
        try {
            console.log('🔧 Raw orders received:', orders);
            
            // Create multiple OfferCreate transactions
            const transactions = orders.map((order, index) => {
                // Handle both lowercase (from app.js) and uppercase (XRPL standard) field names
                const takerGets = order.takerGets || order.TakerGets;
                const takerPays = order.takerPays || order.TakerPays;
                
                console.log(`🔨 Processing order ${index + 1}:`, { takerGets, takerPays });
                
                // Keep the original hex format for XRPL transactions - Xaman expects hex format
                let processedTakerGets = takerGets;
                
                // Just log for debugging but don't convert for the actual transaction
                if (takerGets && typeof takerGets === 'object' && takerGets.currency) {
                    if (takerGets.currency.length === 40 && takerGets.currency.match(/^[0-9A-F]+$/i)) {
                        try {
                            let ascii = '';
                            for (let i = 0; i < takerGets.currency.length; i += 2) {
                                const hex = takerGets.currency.substr(i, 2);
                                const charCode = parseInt(hex, 16);
                                if (charCode !== 0) {
                                    ascii += String.fromCharCode(charCode);
                                }
                            }
                            console.log(`� Currency ${takerGets.currency} represents: ${ascii}`);
                        } catch (e) {
                            console.log('⚠️ Could not decode hex currency');
                        }
                    }
                }
                
                const transaction = {
                    TransactionType: 'OfferCreate',
                    Account: walletAddress,
                    TakerGets: processedTakerGets,
                    TakerPays: takerPays
                    // Sequence will be set automatically by XRPL
                };
                
                // Validate transaction structure
                if (processedTakerGets && typeof processedTakerGets === 'object') {
                    if (!processedTakerGets.currency || !processedTakerGets.issuer || !processedTakerGets.value) {
                        console.error(`❌ Invalid TakerGets structure for order ${index + 1}:`, processedTakerGets);
                        throw new Error(`Invalid token data: missing currency, issuer, or value`);
                    }
                }
                
                if (!takerPays || (typeof takerPays !== 'string' && typeof takerPays !== 'object')) {
                    console.error(`❌ Invalid TakerPays structure for order ${index + 1}:`, takerPays);
                    throw new Error(`Invalid TakerPays: must be XRP amount in drops or IOU object`);
                }
                
                console.log(`✅ XRPL transaction ${index + 1}:`, transaction);
                return transaction;
            });

            // Process orders sequentially - show transaction details with QR code
            const signedTransactions = [];
            
            for (let i = 0; i < transactions.length; i++) {
                const transaction = transactions[i];
                console.log(`📤 Showing order ${i + 1} of ${transactions.length}:`, transaction);
                
                try {
                    // Show simple QR code for transaction signing
                    const result = await this.showTransactionQR(transaction, `Order ${i + 1} of ${transactions.length}`);
                    
                    if (result.signed) {
                        signedTransactions.push(result);
                        console.log(`✅ Order ${i + 1} completed successfully`);
                    } else {
                        console.log(`❌ Order ${i + 1} was cancelled`);
                        
                        // Ask user if they want to continue with remaining orders
                        const shouldContinue = confirm(`Order ${i + 1} was cancelled.\n\nDo you want to continue with the remaining ${transactions.length - i - 1} orders?`);
                        
                        if (!shouldContinue) {
                            console.log(`🛑 User chose to stop after order ${i + 1}`);
                            break;
                        } else {
                            console.log(`➡️ User chose to continue after order ${i + 1}`);
                        }
                    }
                    
                } catch (error) {
                    console.error(`❌ Error with order ${i + 1}:`, error);
                    
                    // Ask user if they want to continue with remaining orders
                    const shouldContinue = confirm(`Order ${i + 1} failed: ${error.message}\n\nDo you want to continue with the remaining ${transactions.length - i - 1} orders?`);
                    
                    if (!shouldContinue) {
                        console.log(`🛑 User chose to stop after order ${i + 1} failed`);
                        break;
                    } else {
                        console.log(`➡️ User chose to continue after order ${i + 1} failed`);
                    }
                }
            }
            
            // Return result indicating sequential processing
            return {
                success: true,
                signedTransactions: signedTransactions,
                totalRequested: transactions.length,
                totalSigned: signedTransactions.length,
                sequential: true
            };
        } catch (error) {
            console.error('Batch order creation error:', error);
            throw error;
        }
    }

    // Simple QR modal for transactions - just like wallet connection
    async showTransactionQR(transaction, title) {
        try {
            // Create Xaman payload for this transaction
            const response = await fetch('http://localhost:3002/create-payload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    txjson: transaction
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Backend response error:', response.status, errorText);
                throw new Error(`Backend error: ${response.status} - ${errorText}`);
            }

            const payload = await response.json();
            console.log('Transaction payload created successfully:', payload);
            
            // Show QR modal using the same method as wallet connection
            return new Promise((resolve) => {
                // Remove existing modal if present
                const existingModal = document.getElementById('qr-modal');
                if (existingModal) {
                    existingModal.remove();
                }

                // Create modal HTML - same as wallet connection but for transaction
                const modalHTML = `
                    <div id="qr-modal" class="modal-overlay" style="
                        position: fixed; 
                        top: 0; 
                        left: 0; 
                        width: 100%; 
                        height: 100%; 
                        background: rgba(0,0,0,0.8); 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        z-index: 10000;
                    ">
                        <div class="modal-content" style="
                            background: #1a1a1a; 
                            padding: 2rem; 
                            border-radius: 12px; 
                            text-align: center; 
                            max-width: 400px; 
                            border: 2px solid #ffc107;
                        ">
                            <h3 style="color: #ffc107; margin-bottom: 1rem;">${title}</h3>
                            <div id="qr-code" style="margin: 1rem 0;"></div>
                            <p style="color: #fff; margin: 1rem 0;">Scan with Xaman app to sign this limit order</p>
                            <div style="margin: 1rem 0;">
                                <a href="${payload.next.always}" 
                                   style="
                                       display: inline-block; 
                                       background: #ffc107; 
                                       color: #000; 
                                       padding: 0.75rem 1.5rem; 
                                       text-decoration: none; 
                                       border-radius: 6px; 
                                       font-weight: bold;
                                       margin: 0.5rem;
                                   ">
                                   Open in Xaman
                                </a>
                            </div>
                            <div style="margin: 1rem 0; display: flex; gap: 1rem; justify-content: center;">
                                <button id="transaction-signed-btn" style="
                                    background: #28a745; 
                                    color: #fff; 
                                    border: none; 
                                    padding: 0.5rem 1rem; 
                                    border-radius: 4px; 
                                    cursor: pointer;
                                ">
                                    ✅ Signed
                                </button>
                                <button onclick="document.getElementById('qr-modal').remove(); resolve({ signed: false, transaction })" 
                                        style="
                                            background: #dc3545; 
                                            color: #fff; 
                                            border: none; 
                                            padding: 0.5rem 1rem; 
                                            border-radius: 4px; 
                                            cursor: pointer;
                                        ">
                                    ❌ Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                `;

                // Add modal to document
                document.body.insertAdjacentHTML('beforeend', modalHTML);

                // Generate QR code
                this.generateQRCode(payload.next.always, 'qr-code');

                // Add button event listener
                document.getElementById('transaction-signed-btn').addEventListener('click', () => {
                    document.getElementById('qr-modal').remove();
                    resolve({ signed: true, transaction });
                });

                // Auto-monitor payload status and resolve when signed
                this.monitorTransactionStatus(payload.uuid, resolve, transaction);
            });

        } catch (error) {
            console.error('Transaction QR error:', error);
            throw error;
        }
    }

    async monitorTransactionStatus(uuid, resolve, transaction) {
        const maxAttempts = 60; // 5 minutes
        let attempts = 0;

        const checkStatus = async () => {
            try {
                if (attempts >= maxAttempts) {
                    console.log('Transaction monitoring timeout reached');
                    return;
                }

                const response = await fetch(`http://localhost:3002/payload-status/${uuid}`);
                if (response.ok) {
                    const result = await response.json();
                    
                    if (result.meta && result.meta.signed) {
                        console.log('Transaction signed successfully:', result);
                        
                        // Close modal
                        const modal = document.getElementById('qr-modal');
                        if (modal) {
                            modal.remove();
                        }
                        
                        // Resolve with signed result
                        resolve({ signed: true, transaction });
                        return;
                    }
                }

                attempts++;
                setTimeout(checkStatus, 5000); // Check every 5 seconds
            } catch (error) {
                console.error('Transaction status monitoring error:', error);
                attempts++;
                setTimeout(checkStatus, 5000);
            }
        };

        checkStatus();
    }

    async waitForXamanResult(uuid) {
        return new Promise((resolve, reject) => {
            const maxAttempts = 60; // 5 minutes
            let attempts = 0;

            const checkStatus = async () => {
                try {
                    if (attempts >= maxAttempts) {
                        reject(new Error('Timeout waiting for Xaman result'));
                        return;
                    }

                    const response = await fetch(`http://localhost:3002/payload-status/${uuid}`);
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result.meta && result.meta.signed) {
                            resolve(result);
                            return;
                        }
                        
                        if (result.meta && result.meta.signed === false) {
                            reject(new Error('Transaction was rejected'));
                            return;
                        }
                    }

                    attempts++;
                    setTimeout(checkStatus, 5000); // Check every 5 seconds
                } catch (error) {
                    attempts++;
                    if (attempts >= maxAttempts) {
                        reject(error);
                    } else {
                        setTimeout(checkStatus, 5000);
                    }
                }
            };

            checkStatus();
        });
    }

    testQRModal() {
        // Create a test payload for demonstration
        const testPayload = {
            uuid: 'test-uuid-12345',
            next: {
                always: 'https://xumm.app/sign/test-uuid-12345'
            }
        };
        
        this.showQRModal(testPayload);
        console.log('Test QR modal displayed');
        
        // Test if QR library is available
        setTimeout(() => {
            console.log('QRCode library available:', typeof QRCode !== 'undefined');
            if (typeof QRCode !== 'undefined') {
                console.log('QRCode version:', QRCode.toString().substring(0, 100));
            }
        }, 1000);
    }
}