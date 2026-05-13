#!/usr/bin/env node
/**
 * Update Tax Rates from TaxCloud V1 API
 * Run via cron: 0 2 * * * /usr/bin/node /home/pi/poke4trade/scripts/update_tax_rates.js
 */

const https = require('https');
const mysql = require('mysql2/promise');

const dbConfig = {
    host: '127.0.0.1',
    user: 'poke4trade',
    password: 'poke4trade123',
    database: 'poke4trade'
};

// US States with sample addresses
const US_STATES = [
    { code: 'AL', name: 'Alabama', city: 'Montgomery', zip: '36101' },
    { code: 'AK', name: 'Alaska', city: 'Juneau', zip: '99801' },
    { code: 'AZ', name: 'Arizona', city: 'Phoenix', zip: '85001' },
    { code: 'AR', name: 'Arkansas', city: 'Little Rock', zip: '72201' },
    { code: 'CA', name: 'California', city: 'Sacramento', zip: '95814' },
    { code: 'CO', name: 'Colorado', city: 'Denver', zip: '80202' },
    { code: 'CT', name: 'Connecticut', city: 'Hartford', zip: '06103' },
    { code: 'DE', name: 'Delaware', city: 'Dover', zip: '19901' },
    { code: 'FL', name: 'Florida', city: 'Tallahassee', zip: '32301' },
    { code: 'GA', name: 'Georgia', city: 'Atlanta', zip: '30303' },
    { code: 'HI', name: 'Hawaii', city: 'Honolulu', zip: '96813' },
    { code: 'ID', name: 'Idaho', city: 'Boise', zip: '83702' },
    { code: 'IL', name: 'Illinois', city: 'Springfield', zip: '62701' },
    { code: 'IN', name: 'Indiana', city: 'Indianapolis', zip: '46204' },
    { code: 'IA', name: 'Iowa', city: 'Des Moines', zip: '50309' },
    { code: 'KS', name: 'Kansas', city: 'Topeka', zip: '66603' },
    { code: 'KY', name: 'Kentucky', city: 'Frankfort', zip: '40601' },
    { code: 'LA', name: 'Louisiana', city: 'Baton Rouge', zip: '70801' },
    { code: 'ME', name: 'Maine', city: 'Augusta', zip: '04330' },
    { code: 'MD', name: 'Maryland', city: 'Annapolis', zip: '21401' },
    { code: 'MA', name: 'Massachusetts', city: 'Boston', zip: '02108' },
    { code: 'MI', name: 'Michigan', city: 'Lansing', zip: '48933' },
    { code: 'MN', name: 'Minnesota', city: 'Saint Paul', zip: '55101' },
    { code: 'MS', name: 'Mississippi', city: 'Jackson', zip: '39201' },
    { code: 'MO', name: 'Missouri', city: 'Jefferson City', zip: '65101' },
    { code: 'MT', name: 'Montana', city: 'Helena', zip: '59601' },
    { code: 'NE', name: 'Nebraska', city: 'Lincoln', zip: '68502' },
    { code: 'NV', name: 'Nevada', city: 'Carson City', zip: '89701' },
    { code: 'NH', name: 'New Hampshire', city: 'Concord', zip: '03301' },
    { code: 'NJ', name: 'New Jersey', city: 'Trenton', zip: '08608' },
    { code: 'NM', name: 'New Mexico', city: 'Santa Fe', zip: '87501' },
    { code: 'NY', name: 'New York', city: 'Albany', zip: '12207' },
    { code: 'NC', name: 'North Carolina', city: 'Raleigh', zip: '27601' },
    { code: 'ND', name: 'North Dakota', city: 'Bismarck', zip: '58501' },
    { code: 'OH', name: 'Ohio', city: 'Columbus', zip: '43215' },
    { code: 'OK', name: 'Oklahoma', city: 'Oklahoma City', zip: '73102' },
    { code: 'OR', name: 'Oregon', city: 'Salem', zip: '97301' },
    { code: 'PA', name: 'Pennsylvania', city: 'Harrisburg', zip: '17101' },
    { code: 'RI', name: 'Rhode Island', city: 'Providence', zip: '02903' },
    { code: 'SC', name: 'South Carolina', city: 'Columbia', zip: '29201' },
    { code: 'SD', name: 'South Dakota', city: 'Pierre', zip: '57501' },
    { code: 'TN', name: 'Tennessee', city: 'Nashville', zip: '37203' },
    { code: 'TX', name: 'Texas', city: 'Austin', zip: '78701' },
    { code: 'UT', name: 'Utah', city: 'Salt Lake City', zip: '84111' },
    { code: 'VT', name: 'Vermont', city: 'Montpelier', zip: '05602' },
    { code: 'VA', name: 'Virginia', city: 'Richmond', zip: '23219' },
    { code: 'WA', name: 'Washington', city: 'Olympia', zip: '98501' },
    { code: 'WV', name: 'West Virginia', city: 'Charleston', zip: '25301' },
    { code: 'WI', name: 'Wisconsin', city: 'Madison', zip: '53703' },
    { code: 'WY', name: 'Wyoming', city: 'Cheyenne', zip: '82001' },
    { code: 'DC', name: 'District of Columbia', city: 'Washington', zip: '20001' }
];

async function getTaxCloudRate(apiLoginID, apiKey, state) {
    return new Promise((resolve) => {
        // TaxCloud V1 API - Lookup endpoint
        const payload = JSON.stringify({
            apiLoginID: apiLoginID,
            apiKey: apiKey,
            customerID: 'tax_lookup',
            cartID: 'rate_check_' + state.code,
            cartItems: [{
                Index: 0,
                ItemID: 'test',
                TIC: '00000',
                Price: 100.00,
                Qty: 1
            }],
            origin: {
                Address1: '1033 Bartlett Pl',
                City: 'Pleasanton',
                State: 'CA',
                Zip5: '94566',
                Zip4: ''
            },
            destination: {
                Address1: '100 Main St',
                City: state.city,
                State: state.code,
                Zip5: state.zip,
                Zip4: ''
            }
        });

        const options = {
            hostname: 'api.taxcloud.net',
            port: 443,
            path: '/1.0/TaxCloud/Lookup',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    if (result.CartItemsResponse && result.CartItemsResponse.length > 0) {
                        const taxAmount = result.CartItemsResponse[0].TaxAmount || 0;
                        console.log(`${state.code}: $${taxAmount} tax on $100 = ${taxAmount}%`);
                        resolve(taxAmount);
                    } else if (result.ResponseType === 3 || result.Messages) {
                        console.log(`${state.code} error:`, result.Messages ? result.Messages[0]?.Message : 'Unknown error');
                        resolve(null);
                    } else {
                        console.log(`${state.code} unexpected response:`, JSON.stringify(result).substring(0, 150));
                        resolve(null);
                    }
                } catch (e) {
                    console.log(`${state.code} parse error:`, e.message, 'Data:', data.substring(0, 100));
                    resolve(null);
                }
            });
        });

        req.on('error', (e) => {
            console.log(`${state.code} request error:`, e.message);
            resolve(null);
        });
        
        req.setTimeout(15000, () => {
            req.destroy();
            console.log(`${state.code} timeout`);
            resolve(null);
        });

        req.write(payload);
        req.end();
    });
}

async function updateTaxRates() {
    console.log('Starting tax rate update at', new Date().toISOString());
    
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        
        // Get TaxCloud credentials
        const [loginRows] = await connection.execute(
            "SELECT setting_value FROM site_settings WHERE setting_key = 'taxcloud_login_id'"
        );
        const [keyRows] = await connection.execute(
            "SELECT setting_value FROM site_settings WHERE setting_key = 'taxcloud_api_key'"
        );
        
        if (!loginRows.length || !loginRows[0].setting_value) {
            console.log('No TaxCloud login_id configured, skipping update');
            return;
        }
        if (!keyRows.length || !keyRows[0].setting_value) {
            console.log('No TaxCloud api_key configured, skipping update');
            return;
        }
        
        let apiLoginID = loginRows[0].setting_value;
        let apiKey = keyRows[0].setting_value;
        
        // Remove JSON quotes if present
        if (apiLoginID.startsWith('"') && apiLoginID.endsWith('"')) {
            apiLoginID = apiLoginID.slice(1, -1);
        }
        if (apiKey.startsWith('"') && apiKey.endsWith('"')) {
            apiKey = apiKey.slice(1, -1);
        }
        
        console.log('Using Login ID:', apiLoginID);
        console.log('Using API Key:', apiKey.substring(0, 20) + '...');
        console.log('');
        
        let updated = 0;
        let failed = 0;
        
        for (const state of US_STATES) {
            const taxRate = await getTaxCloudRate(apiLoginID, apiKey, state);
            
            if (taxRate !== null) {
                await connection.execute(
                    `INSERT INTO tax_rates (country, state, state_code, tax_rate) 
                     VALUES ('US', ?, ?, ?) 
                     ON DUPLICATE KEY UPDATE tax_rate = ?, updated_at = NOW()`,
                    [state.name, state.code, taxRate, taxRate]
                );
                updated++;
            } else {
                failed++;
            }
            
            // Delay to avoid rate limiting
            await new Promise(r => setTimeout(r, 500));
        }
        
        console.log('');
        console.log(`Update complete: ${updated} updated, ${failed} failed`);
        
        // Log the update time
        await connection.execute(
            `INSERT INTO site_settings (setting_key, setting_value) 
             VALUES ('tax_rates_last_updated', ?) 
             ON DUPLICATE KEY UPDATE setting_value = ?`,
            [JSON.stringify(new Date().toISOString()), JSON.stringify(new Date().toISOString())]
        );
        
    } catch (error) {
        console.error('Error updating tax rates:', error);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

updateTaxRates();
