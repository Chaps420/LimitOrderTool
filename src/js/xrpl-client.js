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
            
            // Method 1: Try to get from known token data first
            const knownSupply = this.getKnownTokenSupply(currency, issuer);
            if (knownSupply) {
                console.log('📊 Using known supply for', currency, ':', knownSupply);
                return {
                    currency: currency,
                    issuer: issuer,
                    totalSupply: knownSupply
                };
            }

            // Method 2: Try external API for token data
            try {
                const externalSupply = await this.getTokenSupplyFromAPI(currency, issuer);
                if (externalSupply) {
                    console.log('📊 Got supply from external API for', currency, ':', externalSupply);
                    return {
                        currency: currency,
                        issuer: issuer,
                        totalSupply: externalSupply
                    };
                }
            } catch (apiError) {
                console.warn('⚠️ External API failed:', apiError.message);
            }

            // Method 3: Calculate from XRPL data (fallback)
            const calculatedSupply = await this.calculateTokenSupplyFromXRPL(currency, issuer);
            if (calculatedSupply) {
                console.log('📊 Calculated supply from XRPL for', currency, ':', calculatedSupply);
                return {
                    currency: currency,
                    issuer: issuer,
                    totalSupply: calculatedSupply
                };
            }

            console.warn('⚠️ Could not determine supply for', currency);
            return {
                currency: currency,
                issuer: issuer,
                totalSupply: null
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

    getKnownTokenSupply(currency, issuer) {
        // Database of known XRPL token supplies (updated with accurate data)
        const knownTokens = {
            // UGA - Uganadan Gaming Association
            'UGA:rBFJGmWj6YaabVCxfsjiCM8pfYXs8xFdeC': 7900000,
            // SOLO - Sologenic
            'SOLO:rHZwvHEs56GCmHupwjA4RY7oPA3EoAJWuN': 400000000,
            // CORE - CoreDAO
            'CORE:rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D': 10000000000,
            // CSC - CasinoCoin
            'CSC:rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr': 80000000000,
            // FPT - Faucet Pay Token
            'FPT:rBXRBN9gSFE4qL6DGWYHgKCLtoMzUVL5cF': 1000000000,
            // NPS - Neos Credits
            'NPS:rMGGhcxk1cH8tRCF5cLbXCTFmUwSNYYM2G': 1000000000,
            // RUN - RUN Token
            'RUN:r9sDVHrAmGhzN9AcQLU5teWzKo8dgfPhoC': 1000000000,
            // NLK - NuLink
            'NLK:rhL39pbBQcMMcYoaiXaunuYDcCv41ZbF4f': 5000000000,
            // ROX - ROX Token
            'ROX:raaMMCq9QMYwQ6YhesV3gdpAGf1GhugCRu': 1000000000,
            // FIN - FIN Token
            'FIN:rEJqyQCiqJgqWXLMMJ8cyLwBJUvBA9xmUA': 1000000000,
            // MJK - MJK Token
            'MJK:rGMPf7iW6S6bsYfQWVBRqfhyEBfZeG3c42': 1000000000,
            // Cub - Cub Finance
            'Cub:rN5yEd16jvqcVW1UA4kZxZ3jUA9Es85QgD': 1000000000,
            // BANANA
            'BANANA:rPopnAhPWZXiWApiPM5EHQ6ksLEhvGiLqP': 21000000000,
            // IMM - Immutable
            'IMM:rH1znLFaK7wtmDGRSu4WPEqHCuofuJHdHP': 10000000000,
            // BURN token
            'BURN:rwgNTwrsZKPe7xYCy4emjFAYpgnuioHSkd': 1000000000,
            // XRP (native)
            'XRP': 100000000000,
        };

        const key = `${currency}:${issuer}`;
        return knownTokens[key] || null;
    }

    async getTokenSupplyFromAPI(currency, issuer) {
        try {
            // Try xrpscan.com API for token data
            const response = await fetch(`https://api.xrpscan.com/api/v1/account/${issuer}/tokens`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                const tokenData = data.find(token => token.currency === currency);
                if (tokenData && tokenData.totalSupply) {
                    return parseFloat(tokenData.totalSupply);
                }
            }
        } catch (error) {
            console.warn('XRPScan API failed:', error.message);
        }

        try {
            // Try alternative: XRPL.org token registry
            const response = await fetch(`https://api.xrpl.org/tokens/${currency}/${issuer}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.totalSupply) {
                    return parseFloat(data.totalSupply);
                }
            }
        } catch (error) {
            console.warn('XRPL.org API failed:', error.message);
        }

        return null;
    }

    async calculateTokenSupplyFromXRPL(currency, issuer) {
        try {
            // Get gateway balances for a more accurate calculation
            const gatewayBalancesRequest = {
                command: 'gateway_balances',
                account: issuer,
                ledger_index: 'validated'
            };

            const response = await this.client.request(gatewayBalancesRequest);
            
            if (response.result && response.result.obligations && response.result.obligations[currency]) {
                const supply = parseFloat(response.result.obligations[currency]);
                if (supply > 0) {
                    return supply;
                }
            }

            // Fallback: Calculate from account lines
            const accountLinesRequest = {
                command: 'account_lines',
                account: issuer,
                ledger_index: 'validated'
            };

            const linesResponse = await this.client.request(accountLinesRequest);
            
            if (!linesResponse.result || !linesResponse.result.lines) {
                return null;
            }

            let totalSupply = 0;
            for (const line of linesResponse.result.lines) {
                if (line.currency === currency) {
                    const balance = parseFloat(line.balance);
                    if (balance < 0) {
                        // Negative balance means tokens issued by this issuer
                        totalSupply += Math.abs(balance);
                    }
                }
            }

            return totalSupply > 0 ? totalSupply : null;

        } catch (error) {
            console.error('Error calculating supply from XRPL:', error);
            return null;
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
