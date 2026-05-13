const database = require('/home/pi/poke4trade/server/database');
const fs = require('fs');
const axios = require('axios');
const https = require('https');

// Telegram config
const TELEGRAM_BOT_TOKEN = '8538006597:AAF4CmQKdT3nbLVVaii_dbnvBDeNbLYR2XI';
const TELEGRAM_CHAT_ID = '7981561452';
const POKEMON_TCG_API_KEY = 'abb9b76d-86b0-4b69-a9ef-dbaa247f190a';

const httpsAgent = new https.Agent({ 
    keepAlive: true, 
    maxSockets: 1, 
    timeout: 60000 
});

const CONFIG = {
    MAX_RETRIES: 5,
    DELAY_BETWEEN_SETS_MS: 4000,
    DELAY_BETWEEN_PAGES_MS: 2500,
    REQUEST_TIMEOUT_MS: 60000, 
    PAGE_SIZE: 100,
    DELAY_BEFORE_RETRY_PASS_MS: 30000,
    TCGCSV_DELAY_MS: 2000
};

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

let failedSetsMap = new Map();

const SUBTYPE_MAP = {
    'Normal': 'normal',
    'Holofoil': 'holofoil',
    'Reverse Holofoil': 'reverseHolofoil',
    '1st Edition Holofoil': '1stEditionHolofoil',
    '1st Edition Normal': '1stEditionNormal',
    'Unlimited Holofoil': 'unlimitedHolofoil',
    'Unlimited Normal': 'unlimitedNormal',
};

async function sendTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        }, { timeout: 10000 });
    } catch (e) {
        console.log('Telegram notification failed');
    }
}

async function fetchWithRetry(url) {
    for (let i = 0; i <= CONFIG.MAX_RETRIES; i++) {
        try {
            const response = await axios.get(url, {
                headers: {
                    'X-Api-Key': POKEMON_TCG_API_KEY,
                    'Accept': 'application/json',
                    'User-Agent': `Poke4Trade-Pi/3.2-${Math.random().toString(36).substring(7)}`
                },
                httpsAgent,
                timeout: CONFIG.REQUEST_TIMEOUT_MS
            });
            return response.data;
        } catch (err) {
            const isLast = i === CONFIG.MAX_RETRIES;
            const waitTime = (i + 1) * 15000;
            let errorMsg = err.code || err.message;
            if (err.response) errorMsg = `HTTP ${err.response.status}`;
            
            console.log(`  ⏳ Attempt ${i + 1} failed (${errorMsg}). ${isLast ? 'Aborting.' : `Waiting ${waitTime/1000}s...`}`);
            if (isLast) throw new Error(errorMsg);
            await sleep(waitTime);
        }
    }
}

async function syncCardsForSet(setId) {
    let page = 1;
    let total = 0;
    while (true) {
        console.log(`  Fetching Page ${page}...`);
        const result = await fetchWithRetry(`https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=${CONFIG.PAGE_SIZE}`);
        const cards = result.data || [];
        if (cards.length === 0) break;

        const placeholders = cards.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const values = cards.flatMap(c => [
            c.id, c.name, c.set?.id, c.number, c.rarity || 'Common', 
            JSON.stringify(c.types || []), c.images?.small, c.images?.large, JSON.stringify(c)
        ]);
        
        await database.pool.query(`
            INSERT INTO cards (id, name, setId, number, rarity, types, imageSmall, imageLarge, data) 
            VALUES ${placeholders} 
            ON DUPLICATE KEY UPDATE name=VALUES(name), data=VALUES(data)
        `, values);
        
        total += cards.length;
        console.log(`  ✅ Page ${page}: ${cards.length} cards saved.`);
        if (cards.length < CONFIG.PAGE_SIZE) break;
        page++;
        await sleep(CONFIG.DELAY_BETWEEN_PAGES_MS);
    }
    return total;
}

// ============================================================
// TCGCSV PRICE SUPPLEMENT
// ============================================================

async function fetchTCGCSV(url) {
    for (let i = 0; i < 3; i++) {
        try {
            const response = await axios.get(url, {
                timeout: 30000,
                headers: { 'User-Agent': 'Poke4Trade-PriceSync/1.0' }
            });
            return response.data;
        } catch (err) {
            if (i === 2) throw err;
            console.log(`    TCGCSV retry ${i + 1}...`);
            await sleep(3000);
        }
    }
}

let tcgcsvGroupsCache = null;

async function getTCGCSVGroups() {
    if (tcgcsvGroupsCache) return tcgcsvGroupsCache;
    console.log('  Fetching TCGCSV groups list...');
    const data = await fetchTCGCSV('https://tcgcsv.com/tcgplayer/3/groups');
    tcgcsvGroupsCache = data.results || [];
    console.log(`  ✅ ${tcgcsvGroupsCache.length} groups loaded from TCGCSV`);
    return tcgcsvGroupsCache;
}

function findGroupForSet(groups, setName) {
    const clean = (s) => (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const target = clean(setName);
    
    let bestMatch = null;
    let bestScore = 0;
    
    for (const g of groups) {
        const gName = clean(g.name);
        
        // Exact match
        if (gName === target) return g.groupId;
        
        // Check containment both ways
        if (gName.includes(target) && target.length > 5) {
            const score = target.length / gName.length;
            if (score > bestScore) { bestScore = score; bestMatch = g.groupId; }
        }
        if (target.includes(gName) && gName.length > 5) {
            const score = gName.length / target.length;
            if (score > bestScore) { bestScore = score; bestMatch = g.groupId; }
        }
    }
    
    return bestScore > 0.5 ? bestMatch : null;
}

async function fetchTCGCSVPricesForSet(setId, setName, groupId) {
    console.log(`    Fetching TCGCSV products & prices for group ${groupId}...`);
    
    const [productsData, pricesData] = await Promise.all([
        fetchTCGCSV(`https://tcgcsv.com/tcgplayer/3/${groupId}/products`),
        fetchTCGCSV(`https://tcgcsv.com/tcgplayer/3/${groupId}/prices`)
    ]);
    
    const products = productsData.results || [];
    const prices = pricesData.results || [];
    
    // Build price lookup: productId -> {subType: prices}
    const priceMap = {};
    for (const p of prices) {
        const pid = p.productId;
        if (!p.marketPrice) continue;
        const st = SUBTYPE_MAP[p.subTypeName] || (p.subTypeName || 'normal').toLowerCase().replace(/ /g, '');
        if (!priceMap[pid]) priceMap[pid] = {};
        priceMap[pid][st] = {
            low: p.lowPrice,
            mid: p.midPrice,
            high: p.highPrice,
            market: p.marketPrice,
            directLow: p.directLowPrice,
        };
    }
    
    // Match by card number
    const cardPrices = {};
    for (const prod of products) {
        const ext = prod.extendedData || [];
        let number = '';
        for (const e of ext) {
            if (e.name === 'Number') number = e.value || '';
        }
        if (number && priceMap[prod.productId]) {
            const clean = number.split('/')[0].replace(/^0+/, '') || '0';
            if (!cardPrices[clean]) cardPrices[clean] = {};
            for (const [st, pr] of Object.entries(priceMap[prod.productId])) {
                cardPrices[clean][st] = pr;
            }
        }
    }
    
    // Update database
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
    let updated = 0;
    
    for (const [num, variants] of Object.entries(cardPrices)) {
        const tcgplayer = JSON.stringify({
            url: `https://prices.pokemontcg.io/tcgplayer/${setId}-${num}`,
            updatedAt: today,
            prices: variants
        });
        
        const [result] = await database.pool.query(
            "UPDATE cards SET data = JSON_SET(data, '$.tcgplayer', JSON_COMPACT(?)) WHERE setId = ? AND JSON_UNQUOTE(JSON_EXTRACT(data, '$.number')) = ?",
            [tcgplayer, setId, num]
        );
        if (result.affectedRows > 0) updated++;
    }
    
    return { matched: Object.keys(cardPrices).length, updated };
}

async function supplementPricesFromTCGCSV() {
    console.log('\n\n=== PHASE 3: TCGCSV PRICE SUPPLEMENT ===');
    
    // Find sets where more than half the cards are missing prices
    const [setsWithMissingPrices] = await database.pool.query(`
        SELECT s.id, s.name, COUNT(c.id) as total_cards,
               SUM(CASE WHEN JSON_EXTRACT(c.data, '$.tcgplayer.prices') IS NOT NULL THEN 1 ELSE 0 END) as with_prices
        FROM sets s
        JOIN cards c ON s.id = c.setId
        GROUP BY s.id
        HAVING with_prices < total_cards * 0.5
        ORDER BY s.releaseDate DESC
    `);
    
    if (setsWithMissingPrices.length === 0) {
        console.log('✅ All sets have sufficient price data from Pokemon TCG API.');
        return { setsFixed: 0, cardsUpdated: 0 };
    }
    
    console.log(`Found ${setsWithMissingPrices.length} sets with missing prices:`);
    for (const s of setsWithMissingPrices) {
        console.log(`  ${s.name}: ${s.with_prices}/${s.total_cards} cards have prices`);
    }
    
    let groups;
    try {
        groups = await getTCGCSVGroups();
    } catch (err) {
        console.log(`❌ Failed to fetch TCGCSV groups: ${err.message}`);
        return { setsFixed: 0, cardsUpdated: 0 };
    }
    
    let setsFixed = 0;
    let totalCardsUpdated = 0;
    
    for (const set of setsWithMissingPrices) {
        console.log(`\n  [TCGCSV] Looking up: ${set.name} (${set.id})`);
        
        const groupId = findGroupForSet(groups, set.name);
        if (!groupId) {
            console.log(`    ⚠️ No TCGCSV match found for "${set.name}"`);
            continue;
        }
        
        console.log(`    ✅ Matched to TCGCSV groupId: ${groupId}`);
        
        try {
            const result = await fetchTCGCSVPricesForSet(set.id, set.name, groupId);
            console.log(`    ✅ Prices injected: ${result.updated}/${result.matched} cards updated`);
            if (result.updated > 0) {
                setsFixed++;
                totalCardsUpdated += result.updated;
            }
        } catch (err) {
            console.log(`    ❌ TCGCSV price fetch failed: ${err.message}`);
        }
        
        await sleep(CONFIG.TCGCSV_DELAY_MS);
    }
    
    console.log(`\n  TCGCSV Summary: ${setsFixed} sets fixed, ${totalCardsUpdated} cards updated`);
    return { setsFixed, cardsUpdated: totalCardsUpdated };
}

// ============================================================
// MAIN RUN
// ============================================================

async function run() {
    const startTime = Date.now();
    let totalSynced = 0;

    try {
        console.log('=== Pokémon TCG Sync: Auto-Retry Mode ===');
        await database.initDatabase();
        await sendTelegram('🔄 <b>Sync Started</b>');

        let allSets;
        console.log('Fetching set list...');
        try {
            const setResp = await fetchWithRetry('https://api.pokemontcg.io/v2/sets');
            allSets = setResp.data;
            console.log(`✅ Fetched ${allSets.length} sets from API.`);

            console.log('Updating sets table...');
            for (const set of allSets) {
                await database.pool.query(`
                    INSERT INTO sets (id, name, series, printedTotal, total, releaseDate, updatedAt, symbolImage, logoImage, data)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    name=VALUES(name), series=VALUES(series), printedTotal=VALUES(printedTotal),
                    total=VALUES(total), releaseDate=VALUES(releaseDate), updatedAt=VALUES(updatedAt),
                    symbolImage=VALUES(symbolImage), logoImage=VALUES(logoImage), data=VALUES(data)
                `, [
                    set.id, set.name, set.series, set.printedTotal, set.total,
                    set.releaseDate, set.updatedAt, set.images?.symbol, set.images?.logo,
                    JSON.stringify(set)
                ]);
            }
            console.log(`✅ ${allSets.length} sets updated in database.`);
        } catch (err) {
            console.log(`⚠️ API failed (${err.message}). Using cached sets from database...`);
            const [rows] = await database.pool.query('SELECT id, name, total FROM sets ORDER BY releaseDate DESC');
            if (rows.length === 0) {
                throw new Error('No cached sets in database and API is down');
            }
            allSets = rows;
            console.log(`✅ Loaded ${allSets.length} sets from database cache.`);
            await sendTelegram(`⚠️ API down for sets list, using ${allSets.length} cached sets`);
        }

        // PHASE 1: Initial Sync
        for (let i = 0; i < allSets.length; i++) {
            const set = allSets[i];
            console.log(`\n[${i+1}/${allSets.length}] Syncing: ${set.name}`);
            try {
                totalSynced += await syncCardsForSet(set.id);
            } catch (err) {
                console.error(`  ❌ Failed: ${err.message}. Adding to retry list.`);
                failedSetsMap.set(set.id, { name: set.name, reason: err.message });
            }
            await sleep(CONFIG.DELAY_BETWEEN_SETS_MS);
        }

        // PHASE 2: Retry Pass
        if (failedSetsMap.size > 0) {
            console.log(`\n\n=== STARTING RETRY PASS (${failedSetsMap.size} sets) ===`);
            console.log(`Waiting ${CONFIG.DELAY_BEFORE_RETRY_PASS_MS / 1000}s for API cooldown...`);
            await sleep(CONFIG.DELAY_BEFORE_RETRY_PASS_MS);

            for (const [setId, setInfo] of failedSetsMap.entries()) {
                console.log(`\n[RETRY] Syncing: ${setInfo.name}`);
                try {
                    totalSynced += await syncCardsForSet(setId);
                    console.log(`  ✅ Successfully fixed ${setInfo.name}`);
                    failedSetsMap.delete(setId);
                } catch (err) {
                    console.error(`  ❌ Failed again: ${err.message}`);
                    failedSetsMap.set(setId, { name: setInfo.name, reason: err.message });
                }
                await sleep(CONFIG.DELAY_BETWEEN_SETS_MS);
            }
        }

        // PHASE 3: TCGCSV Price Supplement
        let tcgcsvResult = { setsFixed: 0, cardsUpdated: 0 };
        try {
            tcgcsvResult = await supplementPricesFromTCGCSV();
        } catch (err) {
            console.log(`⚠️ TCGCSV price supplement failed: ${err.message}`);
        }

        // PHASE 4: FINAL SUMMARY
        const durationMin = Math.round((Date.now() - startTime) / 60000);
        const successCount = allSets.length - failedSetsMap.size;

        let summaryText = `\n=== FINAL SYNC SUMMARY ===\n`;
        summaryText += `Total Duration: ${durationMin}m\n`;
        summaryText += `Sets Completed: ${successCount}/${allSets.length}\n`;
        summaryText += `Total Cards: ${totalSynced}\n`;
        if (tcgcsvResult.cardsUpdated > 0) {
            summaryText += `TCGCSV Prices: ${tcgcsvResult.cardsUpdated} cards updated across ${tcgcsvResult.setsFixed} sets\n`;
        }

        let tgMessage = `🏁 <b>Sync Finished</b>\n`;
        tgMessage += `📦 Sets: ${successCount}/${allSets.length}\n`;
        tgMessage += `🃏 Cards: ${totalSynced}\n`;
        tgMessage += `⏱ Time: ${durationMin}m\n`;
        if (tcgcsvResult.cardsUpdated > 0) {
            tgMessage += `💰 TCGCSV: ${tcgcsvResult.cardsUpdated} prices added (${tcgcsvResult.setsFixed} sets)\n`;
        }

        if (failedSetsMap.size > 0) {
            summaryText += `\n❌ PERMANENT FAILURES:\n`;
            tgMessage += `\n❌ <b>Permanent Failures:</b>\n`;
            failedSetsMap.forEach(info => {
                const line = `• ${info.name} (${info.reason})\n`;
                summaryText += line;
                tgMessage += line;
            });
        } else {
            summaryText += `\n✅ All sets synced successfully!`;
            tgMessage += `\n✅ 100% Success Rate!`;
        }

        console.log(summaryText);
        await sendTelegram(tgMessage);
        process.exit(0);

    } catch (err) {
        console.error('FATAL ERROR:', err.message);
        await sendTelegram(`🚨 <b>Fatal Error:</b> ${err.message}`);
        process.exit(1);
    }
}

run();
