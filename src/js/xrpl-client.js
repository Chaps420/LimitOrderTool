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
            
            // Method 1: Standard XRPL.js v2 pattern
            if (window.xrpl && typeof window.xrpl.Client === 'function') {
                try {
                    client = new window.xrpl.Client(this.serverUrl);
                    clientType = 'xrpl.Client';
                    console.log('✅ Created client using window.xrpl.Client');
                } catch (e) {
                    console.log('❌ window.xrpl.Client failed:', e.message);
                }
            }
            
            // Method 2: ES6 module default export
            if (!client && window.xrpl && window.xrpl.default && typeof window.xrpl.default.Client === 'function') {
                try {
                    client = new window.xrpl.default.Client(this.serverUrl);
                    clientType = 'xrpl.default.Client';
                    console.log('✅ Created client using window.xrpl.default.Client');
                } catch (e) {
                    console.log('❌ window.xrpl.default.Client failed:', e.message);
                }
            }
            
            // Method 3: Try if xrpl itself is a constructor
            if (!client && window.xrpl && typeof window.xrpl === 'function') {
                try {
                    client = new window.xrpl(this.serverUrl);
                    clientType = 'xrpl constructor';
                    console.log('✅ Created client using window.xrpl as constructor');
                } catch (e) {
                    console.log('❌ window.xrpl constructor failed:', e.message);
                }
            }
            
            // Method 4: Alternative naming patterns
            if (!client) {
                const alternatives = [
                    ['XrplApi', 'XrplApi'],
                    ['XRPLClient', 'XRPLClient'], 
                    ['WebSocketClient', 'WebSocketClient'],
                    ['Connection', 'Connection'],
                    ['RippleAPI', 'RippleAPI']
                ];
                
                for (const [key, name] of alternatives) {
                    if (window.xrpl[key] && typeof window.xrpl[key] === 'function') {
                        try {
                            client = new window.xrpl[key](this.serverUrl);
                            clientType = `xrpl.${name}`;
                            console.log(`✅ Created client using window.xrpl.${name}`);
                            break;
                        } catch (e) {
                            console.log(`❌ window.xrpl.${name} failed:`, e.message);
                        }
                    }
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
        }
    }

    async getAccountInfo(address) {
        if (!this.isConnected) {
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

    async getNextSequence(address) {
        try {
            const accountInfo = await this.getAccountInfo(address);
            return accountInfo.Sequence;
        } catch (error) {
            console.error('Error getting sequence:', error);
            throw error;
        }
    }

    async getCurrentLedgerIndex() {
        if (!this.isConnected) {
            throw new Error('Not connected to XRPL');
        }

        try {
            const ledger = await this.client.request({
                command: 'ledger',
                ledger_index: 'validated'
            });
            
            return ledger.result.ledger_index;
        } catch (error) {
            console.error('Error getting ledger index:', error);
            throw error;
        }
    }

    async submitTransactions(signedTransactions) {
        if (!this.isConnected) {
            throw new Error('Not connected to XRPL');
        }

        const results = [];

        try {
            for (const signedTx of signedTransactions) {
                try {
                    const result = await this.client.request({
                        command: 'submit',
                        tx_blob: signedTx
                    });

                    results.push({
                        success: result.result.engine_result === 'tesSUCCESS',
                        hash: result.result.tx_json?.hash,
                        result: result.result.engine_result,
                        message: result.result.engine_result_message
                    });

                    // Add delay between submissions to avoid rate limiting
                    if (signedTransactions.length > 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                } catch (error) {
                    results.push({
                        success: false,
                        error: error.message
                    });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failCount = results.length - successCount;

            return {
                success: successCount > 0,
                results,
                summary: {
                    total: results.length,
                    successful: successCount,
                    failed: failCount
                }
            };

        } catch (error) {
            console.error('Error submitting transactions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getOrderbook(takerPays, takerGets, limit = 20) {
        if (!this.isConnected) {
            throw new Error('Not connected to XRPL');
        }

        try {
            const orderbook = await this.client.request({
                command: 'book_offers',
                taker_pays: takerPays,
                taker_gets: takerGets,
                limit: limit
            });

            return orderbook.result.offers;
        } catch (error) {
            console.error('Error getting orderbook:', error);
            throw error;
        }
    }

    async getTokenMetadata(currency, issuer) {
        // This would typically fetch token metadata from a reliable source
        // For now, return basic structure
        return {
            currency,
            issuer,
            symbol: currency,
            decimals: 6, // Most XRPL tokens use 6 decimals
            totalSupply: null // Would need to be fetched from issuer or external source
        };
    }

    formatCurrencyAmount(amount, currency, issuer = null) {
        if (currency === 'XRP') {
            // XRP is in drops (1 XRP = 1,000,000 drops)
            return (parseFloat(amount) * 1000000).toString();
        } else {
            // Other currencies
            return {
                currency: currency,
                issuer: issuer,
                value: amount.toString()
            };
        }
    }

    parseAmount(amount) {
        if (typeof amount === 'string') {
            // XRP amount in drops
            return parseFloat(amount) / 1000000;
        } else {
            // IOU amount
            return parseFloat(amount.value);
        }
    }

    async validateAddress(address) {
        try {
            // Basic validation - XRPL addresses start with 'r' and are 25-34 characters
            if (!address.startsWith('r') || address.length < 25 || address.length > 34) {
                return false;
            }

            // Try to get account info to see if address exists
            await this.getAccountInfo(address);
            return true;
        } catch (error) {
            // If account doesn't exist or other error, address might still be valid
            // but unfunded. For limit orders, this is typically fine.
            return address.match(/^r[a-zA-Z0-9]{24,33}$/);
        }
    }

    async estimateNetworkFee() {
        try {
            const serverInfo = await this.client.request({
                command: 'server_info'
            });

            const baseFee = serverInfo.result.info?.validated_ledger?.base_fee_xrp;
            const reserveBase = serverInfo.result.info?.validated_ledger?.reserve_base_xrp;
            const reserveInc = serverInfo.result.info?.validated_ledger?.reserve_inc_xrp;

            return {
                baseFee: baseFee ? parseFloat(baseFee) : 0.000012, // Default to 12 drops
                reserveBase: reserveBase ? parseFloat(reserveBase) : 10,
                reserveIncrement: reserveInc ? parseFloat(reserveInc) : 2
            };
        } catch (error) {
            console.warn('Could not get network fees, using defaults:', error);
            return {
                baseFee: 0.000012,
                reserveBase: 10,
                reserveIncrement: 2
            };
        }
    }

    async checkAccountExists(address) {
        try {
            await this.getAccountInfo(address);
            return true;
        } catch (error) {
            if (error.data?.error === 'actNotFound') {
                return false;
            }
            throw error;
        }
    }

    // Utility method to convert human-readable amounts to XRPL format
    convertToXRPLAmount(amount, currency, issuer) {
        if (currency === 'XRP') {
            return (parseFloat(amount) * 1000000).toString();
        }
        
        return {
            currency: currency.padEnd(3).substring(0, 3).toUpperCase(),
            issuer: issuer,
            value: amount.toString()
        };
    }

    async getCurrentPrice(baseCurrency, baseIssuer, quoteCurrency, quoteIssuer) {
        try {
            const takerPays = quoteCurrency === 'XRP' 
                ? 'XRP' 
                : { currency: quoteCurrency, issuer: quoteIssuer };
                
            const takerGets = baseCurrency === 'XRP' 
                ? 'XRP' 
                : { currency: baseCurrency, issuer: baseIssuer };

            const offers = await this.getOrderbook(takerPays, takerGets, 1);
            
            if (offers && offers.length > 0) {
                const topOffer = offers[0];
                const pays = this.parseAmount(topOffer.TakerPays);
                const gets = this.parseAmount(topOffer.TakerGets);
                return pays / gets;
            }
            
            return null;
        } catch (error) {
            console.error('Error getting current price:', error);
            return null;
        }
    }

    async getTokenBalances(address) {
        if (!this.isConnected) {
            throw new Error('Not connected to XRPL');
        }

        try {
            console.log('🔍 Requesting account_lines for:', address);
            const response = await this.client.request({
                command: 'account_lines',
                account: address,
                ledger_index: 'validated'
            });
            
            console.log('📋 Raw XRPL account_lines response:', response);
            console.log('📊 Lines data:', response.result.lines);
            
            return response.result.lines || [];
        } catch (error) {
            console.error('Error getting token balances:', error);
            return [];
        }
    }

    async getAccountOffers(address) {
        if (!this.isConnected) {
            throw new Error('Not connected to XRPL');
        }

        try {
            const response = await this.client.request({
                command: 'account_offers',
                account: address,
                ledger_index: 'validated'
            });
            
            return response.result.offers || [];
        } catch (error) {
            console.error('Error getting account offers:', error);
            return [];
        }
    }

    async getTokenInfo(currency, issuer) {
        try {
            // Get gateway balances to find total supply
            const gatewayResponse = await this.client.request({
                command: 'gateway_balances',
                account: issuer,
                ledger_index: 'validated'
            });
            
            // Extract total supply from obligations
            let totalSupply = 0;
            if (gatewayResponse.result.obligations && gatewayResponse.result.obligations[currency]) {
                totalSupply = parseFloat(gatewayResponse.result.obligations[currency]);
            }
            
            return {
                currency,
                issuer,
                totalSupply
            };
        } catch (error) {
            console.error('Error getting token info:', error);
            return {
                currency,
                issuer,
                totalSupply: 0
            };
        }
    }

    async getCurrentTokenPrice(currency, issuer) {
        try {
            // Get order book to find current price (XRP/Token)
            const bookResponse = await this.client.request({
                command: 'book_offers',
                taker_gets: {
                    currency: 'XRP'
                },
                taker_pays: {
                    currency,
                    issuer
                },
                limit: 1,
                ledger_index: 'validated'
            });
            
            if (bookResponse.result.offers && bookResponse.result.offers.length > 0) {
                const offer = bookResponse.result.offers[0];
                const xrpAmount = parseFloat(offer.TakerGets) / 1000000; // Convert drops to XRP
                const tokenAmount = parseFloat(offer.TakerPays.value);
                const priceInXRP = xrpAmount / tokenAmount;
                
                // Convert to USD using approximate XRP price
                // You might want to fetch current XRP price from an API
                const xrpPriceUSD = 0.60; // Approximate XRP price - consider making this dynamic
                const priceInUSD = priceInXRP * xrpPriceUSD;
                
                return {
                    priceInXRP,
                    priceInUSD,
                    marketCapUSD: 0 // Will be calculated when combined with total supply
                };
            }
            
            return {
                priceInXRP: 0,
                priceInUSD: 0,
                marketCapUSD: 0
            };
        } catch (error) {
            console.error('Error getting token price:', error);
            return {
                priceInXRP: 0,
                priceInUSD: 0,
                marketCapUSD: 0
            };
        }
    }
}
