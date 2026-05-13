const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

const pool = mysql.createPool({
    host: '127.0.0.1',
    user: 'poke4trade',
    password: 'poke4trade123',
    database: 'poke4trade',
    waitForConnections: true,
    connectionLimit: 10
});

const API_KEY = '90797480-79df-4345-8996-4480fda0d036';
const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';

async function initDatabase() {
    const conn = await pool.getConnection();
    try {
        await conn.query(`
            CREATE TABLE IF NOT EXISTS sets (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                series VARCHAR(255),
                printedTotal INT,
                total INT,
                releaseDate VARCHAR(20),
                updatedAt VARCHAR(30),
                symbolImage TEXT,
                logoImage TEXT,
                data JSON
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS cards (
                id VARCHAR(50) PRIMARY KEY,
                name VARCHAR(255),
                setId VARCHAR(50),
                number VARCHAR(20),
                rarity VARCHAR(100),
                types VARCHAR(255),
                imageSmall TEXT,
                imageLarge TEXT,
                data JSON,
                INDEX idx_setId (setId),
                INDEX idx_name (name)
            )
        `);

        await conn.query(`
            CREATE TABLE IF NOT EXISTS sync_log (
                id INT AUTO_INCREMENT PRIMARY KEY,
                type VARCHAR(50),
                status VARCHAR(255),
                itemCount INT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        try {
            await conn.query(`ALTER TABLE cards ADD COLUMN number VARCHAR(20) AFTER setId`);
        } catch (e) {}

        console.log('Database tables initialized');
    } finally {
        conn.release();
    }
}

function fetchAPI(url, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        console.log(`Fetching (attempt ${attempt}/${retries}): ${url}`);
        try {
            const result = execSync(
                `curl -s --http1.1 --max-time 180 -H "User-Agent: ${USER_AGENT}" -H "X-Api-Key: ${API_KEY}" "${url}"`,
                { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
            );
            
            if (result.startsWith('error') || result.trim() === '') {
                throw new Error(`API returned: ${result || 'empty response'}`);
            }
            
            return JSON.parse(result);
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error.message);
            if (attempt < retries) {
                const waitTime = attempt * 15;
                console.log(`Waiting ${waitTime} seconds before retry...`);
                execSync(`sleep ${waitTime}`);
            } else {
                throw error;
            }
        }
    }
}

async function syncSets() {
    console.log('Syncing sets...');
    const response = fetchAPI('https://api.pokemontcg.io/v2/sets');
    const sets = response.data || [];

    const conn = await pool.getConnection();
    try {
        for (const set of sets) {
            await conn.query(`
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

        await conn.query(
            'INSERT INTO sync_log (type, status, itemCount) VALUES (?, ?, ?)',
            ['sets', 'success', sets.length]
        );
    } finally {
        conn.release();
    }

    console.log(`Synced ${sets.length} sets`);
    return sets.length;
}

async function syncCardsForSet(setId) {
    console.log(`Syncing cards for set: ${setId}`);
    let page = 1;
    let totalSynced = 0;
    const pageSize = 250;

    const conn = await pool.getConnection();
    try {
        while (true) {
            try {
                const response = fetchAPI(
                    `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=${pageSize}`,
                    5
                );
                const cards = response.data || [];

                if (cards.length === 0) break;

                for (const card of cards) {
                    await conn.query(`
                        INSERT INTO cards (id, name, setId, number, rarity, types, imageSmall, imageLarge, data)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON DUPLICATE KEY UPDATE
                        name=VALUES(name), setId=VALUES(setId), number=VALUES(number), rarity=VALUES(rarity),
                        types=VALUES(types), imageSmall=VALUES(imageSmall), imageLarge=VALUES(imageLarge),
                        data=VALUES(data)
                    `, [
                        card.id, card.name, card.set?.id, card.number, card.rarity,
                        JSON.stringify(card.types || []), card.images?.small,
                        card.images?.large, JSON.stringify(card)
                    ]);
                }

                totalSynced += cards.length;
                console.log(`  Page ${page}: ${cards.length} cards`);

                if (cards.length < pageSize) break;
                page++;

                execSync('sleep 5');
            } catch (error) {
                console.error(`Error syncing page ${page}:`, error.message);
                break;
            }
        }
    } finally {
        conn.release();
    }

    return totalSynced;
}

async function syncAllCards() {
    console.log('Syncing all cards...');
    const conn = await pool.getConnection();
    let totalCards = 0;

    try {
        const [sets] = await conn.query('SELECT id FROM sets ORDER BY releaseDate DESC');
        conn.release();

        for (const set of sets) {
            try {
                const count = await syncCardsForSet(set.id);
                totalCards += count;
                execSync('sleep 10');
            } catch (error) {
                console.error(`Failed to sync set ${set.id}:`, error.message);
            }
        }

        const conn2 = await pool.getConnection();
        await conn2.query(
            'INSERT INTO sync_log (type, status, itemCount) VALUES (?, ?, ?)',
            ['cards', 'success', totalCards]
        );
        conn2.release();

    } catch (error) {
        console.error('Error in syncAllCards:', error);
    }

    console.log(`Total cards synced: ${totalCards}`);
    return totalCards;
}

async function getSets() {
    const [rows] = await pool.query('SELECT data FROM sets ORDER BY releaseDate DESC');
    return rows.map(row => JSON.parse(row.data));
}

async function getCardsForSet(setId, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    
    const [cards] = await pool.query(`
        SELECT data FROM cards 
        WHERE setId = ? 
        ORDER BY 
            CAST(REGEXP_REPLACE(number, '[^0-9]', '') AS UNSIGNED),
            number
        LIMIT ? OFFSET ?
    `, [setId, pageSize, offset]);
    
    const [[{count}]] = await pool.query(
        'SELECT COUNT(*) as count FROM cards WHERE setId = ?',
        [setId]
    );

    return {
        cards: cards.map(row => JSON.parse(row.data)),
        totalCount: count,
        page,
        pageSize
    };
}

async function searchCards(query, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const searchTerm = `%${query}%`;
    
    const [cards] = await pool.query(
        'SELECT data FROM cards WHERE name LIKE ? LIMIT ? OFFSET ?',
        [searchTerm, pageSize, offset]
    );
    
    const [[{count}]] = await pool.query(
        'SELECT COUNT(*) as count FROM cards WHERE name LIKE ?',
        [searchTerm]
    );

    return {
        cards: cards.map(row => JSON.parse(row.data)),
        totalCount: count,
        page,
        pageSize
    };
}

async function getStats() {
    const [[{setCount}]] = await pool.query('SELECT COUNT(*) as setCount FROM sets');
    const [[{cardCount}]] = await pool.query('SELECT COUNT(*) as cardCount FROM cards');
    const [lastSync] = await pool.query('SELECT timestamp FROM sync_log ORDER BY timestamp DESC LIMIT 1');
    
    return {
        sets: setCount,
        cards: cardCount,
        lastSync: lastSync[0]?.timestamp || null
    };
}

module.exports = {
    pool,
    initDatabase,
    syncSets,
    syncCardsForSet,
    syncAllCards,
    getSets,
    getCardsForSet,
    searchCards,
    getStats
};

// Generic query helper for new API endpoints
async function query(sql, params = []) {
    const conn = await pool.getConnection();
    try {
        const [rows] = await conn.query(sql, params);
        return rows;
    } finally {
        conn.release();
    }
}

// Add query to exports
module.exports.query = query;
