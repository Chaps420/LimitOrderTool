export class XRPLClient {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.serverUrl = 'wss://xrplcluster.com/';
    }

    async connect() {
        try {
            console.log('🔗 Connecting to XRPL...');
            
            // Check if XRPL library is available
            if (!window.xrpl) {
                throw new Error('XRPL library not loaded');
            }

            // Debug: Log what's actually available in window.xrpl
            console.log('🔍 Available XRPL methods:', Object.keys(window.xrpl));
            console.log('🔍 window.xrpl structure:', window.xrpl);

            // Try to create a client with various approaches
            let client = null;
            let clientType = null;
            
            // Method 1: Check for xrpl.Client (standard XRPL.js pattern)
            if (window.xrpl && window.xrpl.Client && typeof window.xrpl.Client === 'function') {
                try {
                    client = new window.xrpl.Client(this.serverUrl);
                    clientType = 'xrpl.Client';
                    console.log('✅ Created client using window.xrpl.Client');
                } catch (e) {
                    console.log('❌ window.xrpl.Client failed:', e.message);
                }
            }
            
            // Method 2: Check for the library inside js property (common in CDN builds)
            if (!client && window.xrpl && window.xrpl.js && window.xrpl.js.Client && typeof window.xrpl.js.Client === 'function') {
                try {
                    client = new window.xrpl.js.Client(this.serverUrl);
                    clientType = 'xrpl.js.Client';
                    console.log('✅ Created client using window.xrpl.js.Client');
                } catch (e) {
                    console.log('❌ window.xrpl.js.Client failed:', e.message);
                }
            }
            
            // Method 3: Direct xrpl.js object pattern
            if (!client && window.xrpl && window.xrpl.js && typeof window.xrpl.js === 'object') {
                // Try common XRPL.js exports
                const possibleClients = ['Client', 'XrplApi', 'default'];
                for (const clientName of possibleClients) {
                    if (window.xrpl.js[clientName] && typeof window.xrpl.js[clientName] === 'function') {
                        try {
                            client = new window.xrpl.js[clientName](this.serverUrl);
                            clientType = `xrpl.js.${clientName}`;
                            console.log(`✅ Created client using window.xrpl.js.${clientName}`);
                            break;
                        } catch (e) {
                            console.log(`❌ window.xrpl.js.${clientName} failed:`, e.message);
                        }
                    }
                }
            }
            
            // Method 4: ES6 module default export
            if (!client && window.xrpl && window.xrpl.default && typeof window.xrpl.default.Client === 'function') {
                try {
                    client = new window.xrpl.default.Client(this.serverUrl);
                    clientType = 'xrpl.default.Client';
                    console.log('✅ Created client using window.xrpl.default.Client');
                } catch (e) {
                    console.log('❌ window.xrpl.default.Client failed:', e.message);
                }
            }

            if (!client) {
                console.error('❌ Could not create XRPL client with any available constructor');
                console.log('Available window.xrpl properties:', window.xrpl);
                throw new Error('Could not find any working XRPL client constructor');
            }

            console.log(`🎯 Successfully created client using: ${clientType}`);
            this.client = client;
            
            // Connect to the XRPL network
            await this.client.connect();
            this.isConnected = true;
            
            console.log('✅ Connected to XRPL network');
            return true;
            
        } catch (error) {
            console.error('❌ Failed to connect to XRPL:', error);
            this.isConnected = false;
            throw error;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.disconnect();
            this.isConnected = false;
            console.log('🔌 Disconnected from XRPL');
        }
    }

    async getAccountInfo(address) {
        if (!this.isConnected || !this.client) {
            throw new Error('Not connected to XRPL');
        }
        
        try {
            const accountInfo = await this.client.request({
                command: 'account_info',
                account: address,
                ledger_index: 'validated'
            });
            
            return accountInfo.result.account_data;
        } catch (error) {
            console.error('Error getting account info:', error);
            throw error;
        }
    }

    async getTokenBalances(address) {
        if (!this.isConnected || !this.client) {
            throw new Error('Not connected to XRPL');
        }
        
        try {
            const response = await this.client.request({
                command: 'account_lines',
                account: address,
                ledger_index: 'validated'
            });
            
            return response.result.lines || [];
        } catch (error) {
            console.error('Error getting token balances:', error);
            throw error;
        }
    }

    async getTokenInfo(currency, issuer) {
        if (!this.isConnected || !this.client) {
            throw new Error('Not connected to XRPL');
        }

        try {
            console.log('🔍 Getting token info for currency:', currency, 'issuer:', issuer);
            
            // Get account lines to find token supply information
            const accountLinesRequest = {
                command: 'account_lines',
                account: issuer,
                ledger_index: 'validated'
            };

            const response = await this.client.request(accountLinesRequest);
            
            if (!response.result || !response.result.lines) {
                console.warn('⚠️ No account lines found for issuer:', issuer);
                return {
                    currency: currency,
                    issuer: issuer,
                    totalSupply: null
                };
            }

            // Calculate total supply by summing all outstanding balances for this currency
            let totalSupply = 0;
            let foundCurrency = false;
            
            for (const line of response.result.lines) {
                if (line.currency === currency) {
                    foundCurrency = true;
                    // Balance represents what the issuer owes (negative) or what others owe (positive)
                    // For tokens, the issuer typically has negative balances (tokens they've issued)
                    const balance = parseFloat(line.balance);
                    if (balance < 0) {
                        // Negative balance means tokens issued by this issuer
                        totalSupply += Math.abs(balance);
                    }
                }
            }

            if (!foundCurrency) {
                console.warn('⚠️ Currency not found in issuer account lines:', currency);
                return {
                    currency: currency,
                    issuer: issuer,
                    totalSupply: null
                };
            }

            console.log('📊 Calculated total supply for', currency, ':', totalSupply);
            
            return {
                currency: currency,
                issuer: issuer,
                totalSupply: totalSupply > 0 ? totalSupply : null
            };

        } catch (error) {
            console.error('❌ Error getting token info:', error);
            return {
                currency: currency,
                issuer: issuer,
                totalSupply: null
            };
        }
    }

    async submitTransaction(transaction) {
        if (!this.isConnected || !this.client) {
            throw new Error('Not connected to XRPL');
        }
        
        try {
            const response = await this.client.submitAndWait(transaction);
            return response;
        } catch (error) {
            console.error('Error submitting transaction:', error);
            throw error;
        }
    }

    async autofill(transaction) {
        if (!this.isConnected || !this.client) {
            throw new Error('Not connected to XRPL');
        }
        
        try {
            const autofilled = await this.client.autofill(transaction);
            return autofilled;
        } catch (error) {
            console.error('Error autofilling transaction:', error);
            throw error;
        }
    }
}
