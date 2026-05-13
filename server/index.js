require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const database = require('./database');
const crypto = require('crypto');
const multer = require('multer');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

console.log('Starting Poke4Trade server...');

const app = express();
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure multer for profile picture uploads
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads/profiles');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const userId = req.params.userId;
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `user_${userId}${ext}`);
    }
});

const profileUpload = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const ext = path.extname(file.originalname).toLowerCase();
        const mimetype = file.mimetype;
        if (allowedTypes.test(ext) && allowedTypes.test(mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

app.use((req, res, next) => {
    console.log(`${req.method} ${req.url}`);
    next();
});

const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Helper to extract TCG price from card data
const extractTcgPrice = (dataJson) => {
    try {
        const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
        if (data?.tcgplayer?.prices) {
            const prices = data.tcgplayer.prices;
            const priceTypes = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', '1stEditionNormal'];
            for (const type of priceTypes) {
                if (prices[type]?.market) {
                    return prices[type].market;
                }
            }
            for (const type of Object.keys(prices)) {
                if (prices[type]?.market) {
                    return prices[type].market;
                }
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

// ============================================
// AUTH API ROUTES
// ============================================

app.get('/api/auth/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const users = await database.query('SELECT id FROM users WHERE username = ?', [username]);
        res.json({ exists: users.length > 0 });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/check-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const users = await database.query('SELECT id FROM users WHERE email = ?', [email]);
        res.json({ exists: users.length > 0 });
    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/auth/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }
        
        const existingUsername = await database.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsername.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }
        
        const existingEmail = await database.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const passwordHash = hashPassword(password);
        const result = await database.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );
        
        await database.query('INSERT INTO user_settings (user_id) VALUES (?)', [result.insertId]);
        
        const user = {
            id: result.insertId,
            username,
            email,
            trades_count: 0,
            rating: 5.0,
            created_at: new Date().toISOString()
        };
        res.json({ success: true, user });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            res.status(400).json({ error: 'Username or email already exists' });
        } else {
            console.error('Register error:', error);
            res.status(500).json({ error: error.message });
        }
    }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        const passwordHash = hashPassword(password);
        const isEmail = login.includes('@');
        
        let users;
        if (isEmail) {
            users = await database.query(
                'SELECT id, username, email, trades_count, rating, created_at, profile_picture, (SELECT COUNT(*) FROM trade_ratings WHERE to_user_id = users.id) as ratings_count FROM users WHERE email = ? AND password_hash = ?',
                [login, passwordHash]
            );
        } else {
            users = await database.query(
                'SELECT id, username, email, trades_count, rating, created_at, profile_picture, (SELECT COUNT(*) FROM trade_ratings WHERE to_user_id = users.id) as ratings_count FROM users WHERE username = ? AND password_hash = ?',
                [login, passwordHash]
            );
        }
        
        if (users.length === 0) {
            return res.status(401).json({ error: 'Invalid username/email or password' });
        }
        
        res.json({ success: true, user: users[0] });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PROFILE API ROUTES
// ============================================

app.get('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const users = await database.query(
            `SELECT id, username, email, first_name, last_name, phone, 
                    billing_address1, billing_address2, billing_city, billing_state, billing_postal_code, billing_country, shipping_name, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_postal_code, shipping_country, use_billing_as_shipping,
                    trades_count, rating, created_at, profile_picture 
             FROM users WHERE id = ?`,
            [userId]
        );
        
        if (users.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, profile: users[0] });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/profile/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { first_name, last_name, phone, billing_address1, billing_address2, billing_city, billing_state, billing_postal_code, billing_country, shipping_name, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_postal_code, shipping_country, use_billing_as_shipping } = req.body;
        
        await database.query(
            `UPDATE users SET first_name = ?, last_name = ?, phone = ?, billing_address1 = ?, billing_address2 = ?, billing_city = ?, billing_state = ?, billing_postal_code = ?, billing_country = ?, shipping_name = ?, shipping_address1 = ?, shipping_address2 = ?, shipping_city = ?, shipping_state = ?, shipping_postal_code = ?, shipping_country = ?, use_billing_as_shipping = ? WHERE id = ?`,
            [first_name, last_name, phone, billing_address1, billing_address2, billing_city, billing_state, billing_postal_code, billing_country, shipping_name, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_postal_code, shipping_country, use_billing_as_shipping ? 1 : 0, userId]
        );
        
        const users = await database.query(
            `SELECT id, username, email, first_name, last_name, phone, 
                    billing_address1, billing_address2, billing_city, billing_state, billing_postal_code, billing_country, shipping_name, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_postal_code, shipping_country, use_billing_as_shipping,
                    trades_count, rating, created_at, profile_picture 
             FROM users WHERE id = ?`,
            [userId]
        );
        
        res.json({ success: true, profile: users[0] });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Profile picture upload
app.post('/api/profile/:userId/picture', profileUpload.single('picture'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const picturePath = `/uploads/profiles/${req.file.filename}`;
        
        // Delete old profile picture if exists (different extension)
        const users = await database.query('SELECT profile_picture FROM users WHERE id = ?', [userId]);
        if (users.length > 0 && users[0].profile_picture) {
            const oldPath = path.join(__dirname, '..', users[0].profile_picture);
            if (oldPath !== path.join(__dirname, '..', picturePath) && fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        
        // Update database
        await database.query('UPDATE users SET profile_picture = ? WHERE id = ?', [picturePath, userId]);
        
        res.json({ success: true, picture: picturePath });
    } catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete profile picture
app.delete('/api/profile/:userId/picture', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const users = await database.query('SELECT profile_picture FROM users WHERE id = ?', [userId]);
        if (users.length > 0 && users[0].profile_picture) {
            const picPath = path.join(__dirname, '..', users[0].profile_picture);
            if (fs.existsSync(picPath)) {
                fs.unlinkSync(picPath);
            }
        }
        
        await database.query('UPDATE users SET profile_picture = NULL WHERE id = ?', [userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete profile picture error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// LISTINGS API ROUTES (My Cards)
// ============================================

// Helper to calculate adjusted price based on settings
const calculateAdjustedPrice = (tcgPrice, settings) => {
    if (!settings || !tcgPrice || settings.pricing_method === 'none') {
        return tcgPrice;
    }
    
    const value = parseFloat(settings.pricing_value) || 0;
    let result = tcgPrice;
    
    switch (settings.pricing_method) {
        case 'ceil':
            if (value > 0) result = Math.ceil(tcgPrice / value) * value;
            break;
        case 'floor':
            if (value > 0) result = Math.floor(tcgPrice / value) * value;
            break;
        case 'round':
            if (value > 0) result = Math.round(tcgPrice / value) * value;
            break;
        case 'addition':
            result = tcgPrice + value;
            break;
        case 'subtraction':
            result = tcgPrice - value;
            break;
        case 'up_percent':
            result = tcgPrice * (1 + value / 100);
            break;
        case 'down_percent':
            result = tcgPrice * (1 - value / 100);
            break;
    }
    
    return Math.max(0, Math.round(result * 100) / 100);
};

app.get('/api/listings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query;
        
        // Get user settings for pricing
        let userSettings = await database.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        userSettings = userSettings.length > 0 ? userSettings[0] : null;
        
        let query = `
            SELECT l.*, c.name as card_name, c.number as card_number, c.rarity,
                   c.imageSmall, c.imageLarge, c.data as card_data, s.name as set_name, s.releaseDate as set_release_date
            FROM user_listings l
            JOIN cards c ON l.card_id = c.id
            JOIN sets s ON l.set_id = s.id
            WHERE l.user_id = ?
        `;
        const params = [userId];
        
        if (status) {
            query += ' AND l.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY s.releaseDate DESC, c.name ASC';
        
        const listings = await database.query(query, params);
        
        for (let listing of listings) {
            listing.images = { small: listing.imageSmall, large: listing.imageLarge };
            listing.tcgPrice = extractTcgPrice(listing.card_data);
            
            // Calculate "Your Price" based on settings (unless override is set)
            if (!listing.price_override && listing.tcgPrice) {
                listing.price = calculateAdjustedPrice(listing.tcgPrice, userSettings);
            }
            
            delete listing.imageSmall;
            delete listing.imageLarge;
            delete listing.card_data;
        }
        
        res.json({ success: true, listings });
    } catch (error) {
        console.error('Get listings error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/listings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { card_id, set_id, listing_type, price, language, condition_grade, version, edition, quantity, notes } = req.body;
        
        // Check if this card already exists with the same attributes
        const existing = await database.query(`
            SELECT id, quantity FROM user_listings 
            WHERE user_id = ? AND card_id = ? AND language = ? AND condition_grade = ? AND version = ? AND edition = ?
            LIMIT 1
        `, [userId, card_id, language || 'English', condition_grade || 'Mint', version || 'Non-Holo', edition || '2nd']);
        
        if (existing.length > 0) {
            // Card exists - increase quantity
            const newQuantity = existing[0].quantity + (quantity || 1);
            await database.query(
                'UPDATE user_listings SET quantity = ? WHERE id = ?',
                [newQuantity, existing[0].id]
            );
            res.json({ success: true, listingId: existing[0].id, updated: true, newQuantity });
        } else {
            // Card doesn't exist - insert new
            const result = await database.query(`
                INSERT INTO user_listings 
                (user_id, card_id, set_id, listing_type, price, language, condition_grade, version, edition, quantity, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [userId, card_id, set_id, listing_type || 'both', price, language || 'English', 
                condition_grade || 'Mint', version || 'Non-Holo', edition || '2nd', quantity || 1, notes]);
            
            res.json({ success: true, listingId: result.insertId, updated: false });
        }
    } catch (error) {
        console.error('Add listing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/listings/:userId/:listingId', async (req, res) => {
    try {
        const { userId, listingId } = req.params;
        const { listing_type, price, language, condition_grade, version, edition, quantity, notes, status, price_override } = req.body;
        
        await database.query(`
            UPDATE user_listings SET
                listing_type = ?, price = ?, language = ?, condition_grade = ?,
                version = ?, edition = ?, quantity = ?, notes = ?, status = ?, price_override = ?
            WHERE id = ? AND user_id = ?
        `, [listing_type, price, language, condition_grade, version, edition, quantity, notes, status, price_override ? 1 : 0, listingId, userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update listing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/listings/:userId/:listingId', async (req, res) => {
    try {
        const { userId, listingId } = req.params;
        await database.query('DELETE FROM user_listings WHERE id = ? AND user_id = ?', [listingId, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete listing error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/marketplace', async (req, res) => {
    try {
        const { type, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT l.*, c.name as card_name, c.number as card_number, c.rarity,
                   c.imageSmall, c.imageLarge, c.data as card_data, s.name as set_name,
                   u.username, u.rating
            FROM user_listings l
            JOIN cards c ON l.card_id = c.id
            JOIN sets s ON l.set_id = s.id
            JOIN users u ON l.user_id = u.id
            WHERE l.status = 'active'
        `;
        const params = [];
        
        if (type === 'trade') {
            query += " AND l.listing_type IN ('trade', 'both')";
        } else if (type === 'sale') {
            query += " AND l.listing_type IN ('sale', 'both')";
        }
        
        if (search) {
            query += ' AND c.name LIKE ?';
            params.push('%' + search + '%');
        }
        
        query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const listings = await database.query(query, params);
        
        for (let listing of listings) {
            listing.images = { small: listing.imageSmall, large: listing.imageLarge };
            listing.tcgPrice = extractTcgPrice(listing.card_data);
            delete listing.imageSmall;
            delete listing.imageLarge;
            delete listing.card_data;
        }
        
        let countQuery = `
            SELECT COUNT(*) as total FROM user_listings l
            JOIN cards c ON l.card_id = c.id
            WHERE l.status = 'active'
        `;
        if (type === 'trade') countQuery += " AND l.listing_type IN ('trade', 'both')";
        else if (type === 'sale') countQuery += " AND l.listing_type IN ('sale', 'both')";
        
        const countResult = await database.query(countQuery);
        
        res.json({ success: true, listings, total: countResult[0].total });
    } catch (error) {
        console.error('Get marketplace error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// SETTINGS API ROUTES
// ============================================

app.get('/api/settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let settings = await database.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        
        if (settings.length === 0) {
            await database.query('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);
            settings = await database.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        }
        
        res.json({ success: true, settings: settings[0] });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/settings/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { default_language, default_condition, default_version, default_edition, pricing_method, pricing_value } = req.body;
        
        await database.query(`
            INSERT INTO user_settings (user_id, default_language, default_condition, default_version, default_edition, pricing_method, pricing_value)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                default_language = VALUES(default_language),
                default_condition = VALUES(default_condition),
                default_version = VALUES(default_version),
                default_edition = VALUES(default_edition),
                pricing_method = VALUES(pricing_method),
                pricing_value = VALUES(pricing_value)
        `, [userId, default_language, default_condition, default_version, default_edition, pricing_method || 'none', pricing_value || 0]);
        
        const settings = await database.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        res.json({ success: true, settings: settings[0] });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get last sync timestamp
app.get('/api/sync/status', async (req, res) => {
    try {
        const lastCardSync = await database.query(
            "SELECT timestamp, itemCount FROM sync_log WHERE type = 'cards' AND status = 'success' ORDER BY timestamp DESC LIMIT 1"
        );
        const lastSetSync = await database.query(
            "SELECT timestamp, itemCount FROM sync_log WHERE type = 'sets' AND status = 'success' ORDER BY timestamp DESC LIMIT 1"
        );
        
        res.json({
            success: true,
            lastCardSync: lastCardSync.length > 0 ? lastCardSync[0] : null,
            lastSetSync: lastSetSync.length > 0 ? lastSetSync[0] : null
        });
    } catch (error) {
        console.error('Get sync status error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// COLLECTION API ROUTES
// ============================================

app.get('/api/collection/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const collections = await database.query(`
            SELECT 
                uc.set_id, uc.added_at, s.name, s.series, s.total, 
                s.releaseDate, s.logoImage, s.symbolImage
            FROM user_collections uc
            JOIN sets s ON uc.set_id = s.id
            WHERE uc.user_id = ?
            ORDER BY s.releaseDate DESC
        `, [userId]);
        
        for (let col of collections) {
            // Get owned count
            const owned = await database.query(
                'SELECT COUNT(DISTINCT card_id) as count FROM user_owned_cards WHERE user_id = ? AND set_id = ?',
                [userId, col.set_id]
            );
            col.owned_count = owned[0].count;
            col.missing_count = col.total - col.owned_count;
            
            // Get complete set value (all cards in set)
            const allCards = await database.query('SELECT data FROM cards WHERE setId = ?', [col.set_id]);
            let completeSetValue = 0;
            for (const card of allCards) {
                const price = extractTcgPrice(card.data);
                if (price) completeSetValue += price;
            }
            col.complete_set_value = Math.round(completeSetValue * 100) / 100;
            
            // Get owned cards value
            const ownedCards = await database.query(
                'SELECT c.data FROM user_owned_cards uoc JOIN cards c ON uoc.card_id = c.id WHERE uoc.user_id = ? AND uoc.set_id = ?',
                [userId, col.set_id]
            );
            let ownedValue = 0;
            for (const card of ownedCards) {
                const price = extractTcgPrice(card.data);
                if (price) ownedValue += price;
            }
            col.owned_value = Math.round(ownedValue * 100) / 100;
            
            col.images = { logo: col.logoImage, symbol: col.symbolImage };
            delete col.logoImage;
            delete col.symbolImage;
        }
        res.json({ success: true, collections });
    } catch (error) {
        console.error('Get collection error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/collection/:userId/add-set', async (req, res) => {
    try {
        const { userId } = req.params;
        const { setId } = req.body;
        
        let settings = await database.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        if (settings.length === 0) {
            settings = [{ default_language: 'English', default_condition: 'Mint', default_version: 'Non-Holo', default_edition: '2nd' }];
        }
        const defaults = settings[0];
        
        await database.query('INSERT IGNORE INTO user_collections (user_id, set_id) VALUES (?, ?)', [userId, setId]);
        const cards = await database.query('SELECT id FROM cards WHERE setId = ?', [setId]);
        for (const card of cards) {
            await database.query(`
                INSERT IGNORE INTO user_owned_cards 
                (user_id, card_id, set_id, language, condition_grade, version, edition, quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [userId, card.id, setId, defaults.default_language, defaults.default_condition, defaults.default_version, defaults.default_edition]);
        }
        res.json({ success: true, cardsAdded: cards.length });
    } catch (error) {
        console.error('Add set error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/collection/:userId/remove-set/:setId', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        await database.query('DELETE FROM user_collections WHERE user_id = ? AND set_id = ?', [userId, setId]);
        await database.query('DELETE FROM user_owned_cards WHERE user_id = ? AND set_id = ?', [userId, setId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Remove set error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/collection/:userId/set/:setId/cards', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        const cards = await database.query(`
            SELECT c.id, c.name, c.number, c.rarity, c.types, c.supertype,
                   c.setId as set_id, c.imageSmall, c.imageLarge, c.data
            FROM cards c
            WHERE c.setId = ?
            ORDER BY CAST(c.number AS UNSIGNED), c.number
        `, [setId]);
        
        const ownedCards = await database.query(`
            SELECT card_id, language, condition_grade, version, edition, quantity
            FROM user_owned_cards WHERE user_id = ? AND set_id = ?
        `, [userId, setId]);
        
        const ownedMap = {};
        for (const oc of ownedCards) {
            ownedMap[oc.card_id] = {
                language: oc.language,
                condition: oc.condition_grade,
                version: oc.version,
                edition: oc.edition,
                quantity: oc.quantity
            };
        }
        
        for (let card of cards) {
            card.images = { small: card.imageSmall, large: card.imageLarge };
            card.tcgPrice = extractTcgPrice(card.data);
            delete card.imageSmall;
            delete card.imageLarge;
            delete card.data;
            if (ownedMap[card.id]) {
                card.owned = true;
                card.ownership = ownedMap[card.id];
            } else {
                card.owned = false;
                card.ownership = null;
            }
        }
        res.json({ success: true, cards });
    } catch (error) {
        console.error('Get collection cards error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/collection/:userId/own-card', async (req, res) => {
    try {
        const { userId } = req.params;
        const { cardId, setId, language, condition, version, edition, quantity } = req.body;
        await database.query(`
            INSERT INTO user_owned_cards (user_id, card_id, set_id, language, condition_grade, version, edition, quantity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                language = VALUES(language),
                condition_grade = VALUES(condition_grade),
                version = VALUES(version),
                edition = VALUES(edition),
                quantity = VALUES(quantity)
        `, [userId, cardId, setId, language || 'English', condition || 'Mint', version || 'Non-Holo', edition || '2nd', quantity || 1]);
        res.json({ success: true });
    } catch (error) {
        console.error('Own card error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/collection/:userId/unown-card/:cardId', async (req, res) => {
    try {
        const { userId, cardId } = req.params;
        await database.query('DELETE FROM user_owned_cards WHERE user_id = ? AND card_id = ?', [userId, cardId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Unown card error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/collection/:userId/unown-set/:setId', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        await database.query('DELETE FROM user_owned_cards WHERE user_id = ? AND set_id = ?', [userId, setId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Unown set error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/collection/:userId/own-set/:setId', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        
        let settings = await database.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        if (settings.length === 0) {
            settings = [{ default_language: 'English', default_condition: 'Mint', default_version: 'Non-Holo', default_edition: '2nd' }];
        }
        const defaults = settings[0];
        
        const cards = await database.query('SELECT id FROM cards WHERE setId = ?', [setId]);
        for (const card of cards) {
            await database.query(`
                INSERT IGNORE INTO user_owned_cards 
                (user_id, card_id, set_id, language, condition_grade, version, edition, quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
            `, [userId, card.id, setId, defaults.default_language, defaults.default_condition, defaults.default_version, defaults.default_edition]);
        }
        res.json({ success: true, cardsAdded: cards.length });
    } catch (error) {
        console.error('Own set error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/collection/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const stats = await database.query(`
            SELECT 
                COUNT(DISTINCT uc.set_id) as total_sets,
                COALESCE(SUM(s.total), 0) as total_cards,
                COALESCE((SELECT COUNT(DISTINCT card_id) FROM user_owned_cards WHERE user_id = ?), 0) as owned_cards
            FROM user_collections uc
            JOIN sets s ON uc.set_id = s.id
            WHERE uc.user_id = ?
        `, [userId, userId]);
        const result = stats[0];
        result.missing_cards = result.total_cards - result.owned_cards;
        
        // Calculate total collection value
        const ownedCards = await database.query(
            'SELECT c.data FROM user_owned_cards uoc JOIN cards c ON uoc.card_id = c.id WHERE uoc.user_id = ?',
            [userId]
        );
        let totalValue = 0;
        for (const card of ownedCards) {
            const price = extractTcgPrice(card.data);
            if (price) totalValue += price;
        }
        result.total_value = Math.round(totalValue * 100) / 100;
        
        res.json({ success: true, stats: result });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// POKEMON API ROUTES
// ============================================

app.get('/pokemon-api/sets', async (req, res) => {
    try {
        const sets = await database.getSets();
        res.json({ data: sets, totalCount: sets.length });
    } catch (error) {
        console.error('Error getting sets:', error);
        res.status(500).json({ error: error.message, data: [] });
    }
});

app.get('/pokemon-api/cards', async (req, res) => {
    try {
        const setMatch = req.query.q?.match(/set\.id:(\w+)/);
        const nameMatch = req.query.q?.match(/name:([^*]+)/);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        if (setMatch) {
            const result = await database.getCardsForSet(setMatch[1], page, pageSize);
            res.json({ data: result.cards, totalCount: result.totalCount, page, pageSize });
        } else if (nameMatch) {
            const result = await database.searchCards(nameMatch[1], page, pageSize);
            res.json({ data: result.cards, totalCount: result.totalCount, page, pageSize });
        } else {
            res.json({ data: [], totalCount: 0 });
        }
    } catch (error) {
        console.error('Error getting cards:', error);
        res.status(500).json({ error: error.message, data: [] });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        res.json(await database.getStats());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});



// ============================================
// TRADING MATCH SYSTEM
// ============================================

// Helper function to extract market price from card data
function getCardMarketPrice(cardData, version = 'normal') {
    try {
        const data = typeof cardData === 'string' ? JSON.parse(cardData) : cardData;
        const prices = data?.tcgplayer?.prices;
        if (!prices) return null;
        
        // Try to match version to price type
        const versionMap = {
            'Non-Holo': 'normal',
            'Holo': 'holofoil',
            'Reverse': 'reverseHolofoil',
            'Pokeball': 'normal',
            'Masterball': 'normal',
            'Holographic Staff': 'holofoil'
        };
        
        const priceType = versionMap[version] || 'normal';
        
        // Try requested type, then fallback to others
        if (prices[priceType]?.market) return prices[priceType].market;
        if (prices.normal?.market) return prices.normal.market;
        if (prices.holofoil?.market) return prices.holofoil.market;
        if (prices.reverseHolofoil?.market) return prices.reverseHolofoil.market;
        
        // Last resort: get any available market price
        for (const type of Object.keys(prices)) {
            if (prices[type]?.market) return prices[type].market;
        }
        return null;
    } catch (e) {
        return null;
    }
}

// Get cards I'm missing (from my collection sets)
app.get('/api/trading/my-wants/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Cards in my collection sets that I DON'T own
        const wants = await database.query(`
            SELECT c.id, c.name, c.number, c.setId, c.imageSmall, c.data,
                   s.name as set_name
            FROM cards c
            JOIN user_collections uc ON c.setId = uc.set_id AND uc.user_id = ?
            JOIN sets s ON c.setId = s.id
            LEFT JOIN user_owned_cards uoc ON c.id = uoc.card_id AND uoc.user_id = ?
            WHERE uoc.id IS NULL
            ORDER BY s.releaseDate DESC, CAST(c.number AS UNSIGNED)
        `, [userId, userId]);
        
        // Add prices
        const wantsWithPrices = wants.map(card => ({
            ...card,
            price: getCardMarketPrice(card.data),
            data: undefined  // Don't send full data to client
        }));
        
        res.json({ success: true, data: wantsWithPrices });
    } catch (error) {
        console.error('Error getting wants:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get cards I have for trade (my listings)
app.get('/api/trading/my-haves/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const haves = await database.query(`
            SELECT ul.*, c.name, c.number, c.imageSmall, c.data,
                   s.name as set_name
            FROM user_listings ul
            JOIN cards c ON ul.card_id = c.id
            JOIN sets s ON ul.set_id = s.id
            WHERE ul.user_id = ? 
              AND ul.status = 'active' 
              AND ul.listing_type IN ('trade', 'both')
            ORDER BY s.releaseDate DESC, CAST(c.number AS UNSIGNED)
        `, [userId]);
        
        // Add prices
        const havesWithPrices = haves.map(card => ({
            ...card,
            market_price: getCardMarketPrice(card.data, card.version),
            data: undefined
        }));
        
        res.json({ success: true, data: havesWithPrices });
    } catch (error) {
        console.error('Error getting haves:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Find trade matches - users who have cards I want AND want cards I have
// Find trade matches - users who have cards I want AND want cards I have
app.get('/api/trading/matches/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get pending trades for this user
        const pendingTrades = await database.query(`
            SELECT 
                CASE WHEN from_user_id = ? THEN to_user_id ELSE from_user_id END as other_user_id,
                id as trade_id,
                status,
                from_user_id,
                to_user_id,
                created_at
            FROM trade_requests 
            WHERE (from_user_id = ? OR to_user_id = ?) 
              AND status = 'pending'
        `, [userId, userId, userId]);
        
        // Create a map of pending trades by other user
        const pendingMap = new Map();
        for (const trade of pendingTrades) {
            pendingMap.set(trade.other_user_id, {
                trade_id: trade.trade_id,
                is_sender: trade.from_user_id === parseInt(userId),
                created_at: trade.created_at
            });
        }
        
        // Step 1: Find users who HAVE cards I'm missing (DISTINCT to avoid duplicates)
        const theyHaveIWant = await database.query(`
            SELECT DISTINCT
                ul.user_id as other_user_id,
                u.username as other_username,
                u.rating as other_rating,
                u.trades_count as other_trades_count,
                (SELECT COUNT(*) FROM trade_ratings WHERE to_user_id = u.id) as other_ratings_count,
                ul.card_id,
                c.name as card_name,
                c.number as card_number,
                c.imageSmall,
                c.data as card_data,
                s.name as set_name,
                ul.condition_grade,
                ul.language,
                ul.version,
                'they_have' as match_type
            FROM user_listings ul
            JOIN users u ON ul.user_id = u.id
            JOIN cards c ON ul.card_id = c.id
            JOIN sets s ON c.setId = s.id
            WHERE ul.user_id != ?
              AND ul.status = 'active'
              AND ul.listing_type IN ('trade', 'both')
              AND ul.card_id IN (
                  SELECT c2.id 
                  FROM cards c2
                  JOIN user_collections uc ON c2.setId = uc.set_id AND uc.user_id = ?
                  LEFT JOIN user_owned_cards uoc ON c2.id = uoc.card_id AND uoc.user_id = ?
                  WHERE uoc.id IS NULL
              )
            GROUP BY ul.user_id, ul.card_id
        `, [userId, userId, userId]);
        
        // Step 2: Find users who WANT cards I have listed (DISTINCT)
        const theyWantIHave = await database.query(`
            SELECT DISTINCT
                uc.user_id as other_user_id,
                u.username as other_username,
                u.rating as other_rating,
                u.trades_count as other_trades_count,
                (SELECT COUNT(*) FROM trade_ratings WHERE to_user_id = u.id) as other_ratings_count,
                c.id as card_id,
                c.name as card_name,
                c.number as card_number,
                c.imageSmall,
                c.data as card_data,
                s.name as set_name,
                ml.condition_grade,
                ml.language,
                ml.version,
                'they_want' as match_type
            FROM cards c
            JOIN user_collections uc ON c.setId = uc.set_id
            JOIN users u ON uc.user_id = u.id
            JOIN sets s ON c.setId = s.id
            JOIN user_listings ml ON ml.card_id = c.id AND ml.user_id = ?
            LEFT JOIN user_owned_cards uoc ON c.id = uoc.card_id AND uoc.user_id = uc.user_id
            WHERE uc.user_id != ?
              AND ml.status = 'active'
              AND ml.listing_type IN ('trade', 'both')
              AND uoc.id IS NULL
            GROUP BY uc.user_id, c.id
        `, [userId, userId]);
        
        // Step 3: Combine and group by user (deduplicate by card_id)
        const matchMap = new Map();
        
        // Process "they have what I want"
        for (const row of theyHaveIWant) {
            if (!matchMap.has(row.other_user_id)) {
                matchMap.set(row.other_user_id, {
                    user_id: row.other_user_id,
                    username: row.other_username,
                    rating: row.other_rating,
                    ratings_count: row.other_ratings_count,
                    trades_count: row.other_trades_count,
                    they_have: new Map(),
                    they_want: new Map(),
                    they_have_value: 0,
                    they_want_value: 0
                });
            }
            const match = matchMap.get(row.other_user_id);
            if (!match.they_have.has(row.card_id)) {
                const price = getCardMarketPrice(row.card_data, row.version) || 0;
                match.they_have.set(row.card_id, {
                    card_id: row.card_id,
                    name: row.card_name,
                    number: row.card_number,
                    imageSmall: row.imageSmall,
                    set_name: row.set_name,
                    condition: row.condition_grade,
                    language: row.language,
                    version: row.version,
                    price: price
                });
                match.they_have_value += price;
            }
        }
        
        // Process "they want what I have"
        for (const row of theyWantIHave) {
            if (!matchMap.has(row.other_user_id)) {
                matchMap.set(row.other_user_id, {
                    user_id: row.other_user_id,
                    username: row.other_username,
                    rating: row.other_rating,
                    ratings_count: row.other_ratings_count,
                    trades_count: row.other_trades_count,
                    they_have: new Map(),
                    they_want: new Map(),
                    they_have_value: 0,
                    they_want_value: 0
                });
            }
            const match = matchMap.get(row.other_user_id);
            if (!match.they_want.has(row.card_id)) {
                const price = getCardMarketPrice(row.card_data, row.version) || 0;
                match.they_want.set(row.card_id, {
                    card_id: row.card_id,
                    name: row.card_name,
                    number: row.card_number,
                    imageSmall: row.imageSmall,
                    set_name: row.set_name,
                    condition: row.condition_grade,
                    language: row.language,
                    version: row.version,
                    price: price
                });
                match.they_want_value += price;
            }
        }
        
        // Convert to array and calculate match scores
        const matches = Array.from(matchMap.values()).map(match => {
            const theyHaveArr = Array.from(match.they_have.values());
            const theyWantArr = Array.from(match.they_want.values());
            const mutualMatch = theyHaveArr.length > 0 && theyWantArr.length > 0;
            const score = (mutualMatch ? 1000 : 0) + theyHaveArr.length * 10 + theyWantArr.length * 5;
            
            // Add pending trade info
            const pendingTrade = pendingMap.get(match.user_id);
            
            return {
                user_id: match.user_id,
                username: match.username,
                rating: match.rating,
                ratings_count: match.ratings_count,
                trades_count: match.trades_count,
                they_have: theyHaveArr,
                they_want: theyWantArr,
                they_have_value: Math.round(match.they_have_value * 100) / 100,
                they_want_value: Math.round(match.they_want_value * 100) / 100,
                score,
                mutualMatch,
                pending_trade: pendingTrade || null
            };
        });
        
        // Sort by score (best matches first)
        matches.sort((a, b) => b.score - a.score);
        
        res.json({ success: true, data: matches });
    } catch (error) {
        console.error('Error finding matches:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/trading/match-details/:userId/:otherUserId', async (req, res) => {
    try {
        const { userId, otherUserId } = req.params;
        
        // Get other user info
        const [otherUser] = await database.query(
            'SELECT id, username FROM users WHERE id = ?',
            [otherUserId]
        );
        
        if (!otherUser) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        // Cards they have that I want (DISTINCT by card_id)
        const theyHave = await database.query(`
            SELECT DISTINCT
                ul.id as listing_id,
                ul.card_id,
                c.name,
                c.number,
                c.imageSmall,
                c.data as card_data,
                s.name as set_name,
                ul.condition_grade,
                ul.language,
                ul.version,
                ul.price
            FROM user_listings ul
            JOIN cards c ON ul.card_id = c.id
            JOIN sets s ON c.setId = s.id
            WHERE ul.user_id = ?
              AND ul.status = 'active'
              AND ul.listing_type IN ('trade', 'both')
              AND ul.card_id IN (
                  SELECT c2.id 
                  FROM cards c2
                  JOIN user_collections uc ON c2.setId = uc.set_id AND uc.user_id = ?
                  LEFT JOIN user_owned_cards uoc ON c2.id = uoc.card_id AND uoc.user_id = ?
                  WHERE uoc.id IS NULL
              )
            GROUP BY ul.card_id
            ORDER BY s.releaseDate DESC, CAST(c.number AS UNSIGNED)
        `, [otherUserId, userId, userId]);
        
        // Cards they want that I have (DISTINCT by card_id)
        const theyWant = await database.query(`
            SELECT DISTINCT
                ml.id as listing_id,
                ml.card_id,
                c.name,
                c.number,
                c.imageSmall,
                c.data as card_data,
                s.name as set_name,
                ml.condition_grade,
                ml.language,
                ml.version,
                ml.price
            FROM user_listings ml
            JOIN cards c ON ml.card_id = c.id
            JOIN sets s ON c.setId = s.id
            WHERE ml.user_id = ?
              AND ml.status = 'active'
              AND ml.listing_type IN ('trade', 'both')
              AND c.id IN (
                  SELECT c2.id 
                  FROM cards c2
                  JOIN user_collections uc ON c2.setId = uc.set_id AND uc.user_id = ?
                  LEFT JOIN user_owned_cards uoc ON c2.id = uoc.card_id AND uoc.user_id = ?
                  WHERE uoc.id IS NULL
              )
            GROUP BY ml.card_id
            ORDER BY s.releaseDate DESC, CAST(c.number AS UNSIGNED)
        `, [userId, otherUserId, otherUserId]);
        
        // Add market prices
        const theyHaveWithPrices = theyHave.map(card => ({
            ...card,
            market_price: getCardMarketPrice(card.card_data, card.version),
            card_data: undefined
        }));
        
        const theyWantWithPrices = theyWant.map(card => ({
            ...card,
            market_price: getCardMarketPrice(card.card_data, card.version),
            card_data: undefined
        }));
        
        res.json({
            success: true,
            data: {
                otherUser,
                theyHave: theyHaveWithPrices,
                theyWant: theyWantWithPrices,
                theyHaveTotal: theyHaveWithPrices.reduce((sum, c) => sum + (c.market_price || 0), 0),
                theyWantTotal: theyWantWithPrices.reduce((sum, c) => sum + (c.market_price || 0), 0)
            }
        });
    } catch (error) {
        console.error('Error getting match details:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ============================================
// TRADE PROPOSALS & NOTIFICATIONS
// ============================================

const nodemailer = require('nodemailer');

// Email transporter (configure with your SMTP settings)
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
});

// Helper to send email notification
async function sendTradeEmail(toEmail, subject, htmlContent) {
    if (!process.env.SMTP_USER) {
        console.log('Email not configured, skipping email notification');
        return false;
    }
    
    try {
        await emailTransporter.sendMail({
            from: `"Poke4Trade" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: subject,
            html: htmlContent
        });
        console.log(`Email sent to ${toEmail}`);
        return true;
    } catch (err) {
        console.error('Email error:', err);
        return false;
    }
}

// Helper to send order lifecycle emails
const ORDER_ADMIN_EMAIL = 'admin@poke4trade.com';

async function sendOrderEmail(toEmail, subject, headline, bodyHtml, ctaText, ctaUrl) {
    if (!toEmail && !ORDER_ADMIN_EMAIL) return;
    const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
            <div style="background:#1D2C5E;padding:20px;text-align:center;border-radius:8px 8px 0 0;">
                <h1 style="color:#FFCB05;margin:0;font-size:24px;">Poke4Trade</h1>
            </div>
            <div style="padding:30px 20px;border:1px solid #eee;border-top:none;">
                <h2 style="color:#1D2C5E;margin-top:0;">${headline}</h2>
                ${bodyHtml}
                ${ctaText ? `
                <p style="margin-top:25px;text-align:center;">
                    <a href="${ctaUrl || 'https://poke4trade.com'}" 
                       style="background:#FFCB05;color:#1D2C5E;padding:12px 30px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
                        ${ctaText}
                    </a>
                </p>` : ''}
            </div>
            <div style="padding:15px 20px;text-align:center;color:#888;font-size:11px;">
                You received this email because you have an account on Poke4Trade.
            </div>
        </div>
    `;
    
    // Send to user
    if (toEmail) {
        sendTradeEmail(toEmail, subject, html);
    }
    // Always send copy to admin
    if (ORDER_ADMIN_EMAIL && ORDER_ADMIN_EMAIL !== toEmail) {
        sendTradeEmail(ORDER_ADMIN_EMAIL, `[Admin] ${subject}`, html);
    }
}

// Create a trade proposal
app.post('/api/trading/propose', async (req, res) => {
    try {
        const { fromUserId, toUserId, cardsToGet, cardsToGive, message } = req.body;
        
        if (!fromUserId || !toUserId) {
            return res.status(400).json({ success: false, error: 'Missing user IDs' });
        }
        
        if ((!cardsToGet || cardsToGet.length === 0) && (!cardsToGive || cardsToGive.length === 0)) {
            return res.status(400).json({ success: false, error: 'Must select at least one card' });
        }
        
        // Calculate values
        const getValue = (cards) => cards.reduce((sum, c) => sum + (c.market_price || 0), 0);
        const fromValue = getValue(cardsToGive || []);
        const toValue = getValue(cardsToGet || []);
        
        // Create trade request
        const result = await database.query(`
            INSERT INTO trade_requests (from_user_id, to_user_id, message, from_value, to_value)
            VALUES (?, ?, ?, ?, ?)
        `, [fromUserId, toUserId, message || null, fromValue, toValue]);
        
        const tradeRequestId = result.insertId;
        
        // Add cards to give (from proposer's perspective)
        for (const card of (cardsToGive || [])) {
            await database.query(`
                INSERT INTO trade_request_cards (trade_request_id, card_id, listing_id, direction, card_name, card_image, card_price)
                VALUES (?, ?, ?, 'give', ?, ?, ?)
            `, [tradeRequestId, card.card_id, card.listing_id, card.name, card.imageSmall, card.market_price]);
        }
        
        // Add cards to get
        for (const card of (cardsToGet || [])) {
            await database.query(`
                INSERT INTO trade_request_cards (trade_request_id, card_id, listing_id, direction, card_name, card_image, card_price)
                VALUES (?, ?, ?, 'get', ?, ?, ?)
            `, [tradeRequestId, card.card_id, card.listing_id, card.name, card.imageSmall, card.market_price]);
        }
        
        // Get user info for notification
        const [fromUser] = await database.query('SELECT username FROM users WHERE id = ?', [fromUserId]);
        const [toUser] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [toUserId]);
        
        // Create notification for recipient
        await database.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'trade_request', ?, ?, ?, ?)
        `, [
            toUserId,
            `New Trade Proposal from ${fromUser.username}`,
            `${fromUser.username} wants to trade ${(cardsToGive || []).length} card(s) for ${(cardsToGet || []).length} of your card(s). Value: $${fromValue.toFixed(2)} for $${toValue.toFixed(2)}`,
            '/my-trades',
            tradeRequestId
        ]);
        
        // Send email if enabled
        if (toUser.email && toUser.email_notifications !== 0) {
            const cardsToGetHtml = (cardsToGet || []).map(c => 
                `<div style="display:inline-block;margin:5px;text-align:center;">
                    <img src="${c.imageSmall}" style="height:80px;border-radius:4px;">
                    <div style="font-size:11px;">${c.name}</div>
                    <div style="font-size:10px;color:#888;">$${(c.market_price || 0).toFixed(2)}</div>
                </div>`
            ).join('');
            
            const cardsToGiveHtml = (cardsToGive || []).map(c => 
                `<div style="display:inline-block;margin:5px;text-align:center;">
                    <img src="${c.imageSmall}" style="height:80px;border-radius:4px;">
                    <div style="font-size:11px;">${c.name}</div>
                    <div style="font-size:10px;color:#888;">$${(c.market_price || 0).toFixed(2)}</div>
                </div>`
            ).join('');
            
            const emailHtml = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:#1D2C5E;">🔄 New Trade Proposal!</h2>
                    <p><strong>${fromUser.username}</strong> wants to trade with you on Poke4Trade.</p>
                    
                    <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:15px 0;">
                        <h3 style="color:#CC0000;margin-top:0;">Cards they want from you ($${toValue.toFixed(2)})</h3>
                        ${cardsToGetHtml || '<p>No cards selected</p>'}
                    </div>
                    
                    <div style="background:#f5f5f5;padding:15px;border-radius:8px;margin:15px 0;">
                        <h3 style="color:#7CB518;margin-top:0;">Cards they're offering ($${fromValue.toFixed(2)})</h3>
                        ${cardsToGiveHtml || '<p>No cards selected</p>'}
                    </div>
                    
                    ${message ? `<p><strong>Message:</strong> ${message}</p>` : ''}
                    
                    <p style="margin-top:20px;">
                        <a href="https://poke4trade.com/my-trades" style="background:#FFCB05;color:#1D2C5E;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">
                            View Trade Proposal
                        </a>
                    </p>
                    
                    <p style="color:#888;font-size:12px;margin-top:30px;">
                        You received this email because you have email notifications enabled on Poke4Trade.
                    </p>
                </div>
            `;
            
            sendTradeEmail(toUser.email, `🔄 Trade Proposal from ${fromUser.username}`, emailHtml);
        }
        
        res.json({ success: true, tradeRequestId });
    } catch (error) {
        console.error('Error creating trade proposal:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user's trade requests (sent and received)
app.get('/api/trading/requests/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get received trade requests with message counts
        const received = await database.query(`
            SELECT tr.*, u.username as from_username,
                   (SELECT COUNT(*) FROM trade_request_cards WHERE trade_request_id = tr.id AND direction = 'get') as cards_they_want,
                   (SELECT COUNT(*) FROM trade_request_cards WHERE trade_request_id = tr.id AND direction = 'give') as cards_they_offer,
                   (SELECT COUNT(*) FROM trade_messages WHERE trade_id = tr.id) as message_count,
                   (SELECT COUNT(*) FROM trade_messages WHERE trade_id = tr.id AND user_id != ? AND is_read = FALSE) as unread_messages
            FROM trade_requests tr
            JOIN users u ON tr.from_user_id = u.id
            WHERE tr.to_user_id = ?
            ORDER BY tr.created_at DESC
        `, [userId, userId]);
        
        // Get sent trade requests with message counts
        const sent = await database.query(`
            SELECT tr.*, u.username as to_username,
                   (SELECT COUNT(*) FROM trade_request_cards WHERE trade_request_id = tr.id AND direction = 'give') as cards_you_offer,
                   (SELECT COUNT(*) FROM trade_request_cards WHERE trade_request_id = tr.id AND direction = 'get') as cards_you_want,
                   (SELECT COUNT(*) FROM trade_messages WHERE trade_id = tr.id) as message_count,
                   (SELECT COUNT(*) FROM trade_messages WHERE trade_id = tr.id AND user_id != ? AND is_read = FALSE) as unread_messages
            FROM trade_requests tr
            JOIN users u ON tr.to_user_id = u.id
            WHERE tr.from_user_id = ?
            ORDER BY tr.created_at DESC
        `, [userId, userId]);
        
        res.json({ success: true, data: { received, sent } });
    } catch (error) {
        console.error('Error getting trade requests:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.get('/api/trading/request/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        
        const [trade] = await database.query(`
            SELECT tr.*, 
                   fu.username as from_username, fu.email as from_email,
                   tu.username as to_username, tu.email as to_email
            FROM trade_requests tr
            JOIN users fu ON tr.from_user_id = fu.id
            JOIN users tu ON tr.to_user_id = tu.id
            WHERE tr.id = ?
        `, [tradeId]);
        
        if (!trade) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        
        // Get cards with full details from cards table
        const cards = await database.query(`
            SELECT trc.*, 
                   c.number as card_number, 
                   c.setId as set_id,
                   s.name as set_name,
                   c.data as card_data
            FROM trade_request_cards trc
            LEFT JOIN cards c ON trc.card_id = c.id
            LEFT JOIN sets s ON c.setId = s.id
            WHERE trc.trade_request_id = ?
        `, [tradeId]);
        
        // Parse card data to get rarity, type, etc.
        const enrichedCards = cards.map(card => {
            let rarity = null;
            let types = [];
            let supertype = null;
            
            if (card.card_data) {
                try {
                    const data = typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data;
                    rarity = data.rarity || null;
                    types = data.types || [];
                    supertype = data.supertype || null;
                } catch (e) {}
            }
            
            return {
                id: card.id,
                card_id: card.card_id,
                listing_id: card.listing_id,
                direction: card.direction,
                card_name: card.card_name,
                card_image: card.card_image,
                card_price: card.card_price,
                card_number: card.card_number,
                set_id: card.set_id,
                set_name: card.set_name,
                rarity: rarity,
                types: types,
                supertype: supertype
            };
        });
        
        const cardsToGive = enrichedCards.filter(c => c.direction === 'give');
        const cardsToGet = enrichedCards.filter(c => c.direction === 'get');
        
        res.json({ success: true, data: { trade, cardsToGive, cardsToGet } });
    } catch (error) {
        console.error('Error getting trade request:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
app.post('/api/trading/respond/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, action } = req.body;
        
        if (!['accepted', 'declined'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }
        
        // Get trade details
        const [trade] = await database.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        
        if (!trade) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        
        if (trade.to_user_id !== parseInt(userId)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        if (trade.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Trade already processed' });
        }
        
        // Update trade status
        await database.query('UPDATE trade_requests SET status = ? WHERE id = ?', [action, tradeId]);
        
        // Get user info
        const [fromUser] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [trade.from_user_id]);
        const [toUser] = await database.query('SELECT username FROM users WHERE id = ?', [trade.to_user_id]);
        
        // Create notification for proposer
        const notifType = action === 'accepted' ? 'trade_accepted' : 'trade_declined';
        const notifTitle = action === 'accepted' 
            ? `${toUser.username} accepted your trade!`
            : `${toUser.username} declined your trade`;
        
        await database.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [
            trade.from_user_id,
            notifType,
            notifTitle,
            action === 'accepted' 
                ? 'Your trade proposal has been accepted! You can now arrange the exchange.'
                : 'Unfortunately, your trade proposal was declined.',
            '/my-trades',
            tradeId
        ]);
        
        // Send email if enabled
        if (fromUser.email && fromUser.email_notifications !== 0) {
            const emoji = action === 'accepted' ? '✅' : '❌';
            const color = action === 'accepted' ? '#7CB518' : '#CC0000';
            
            const emailHtml = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:${color};">${emoji} Trade ${action === 'accepted' ? 'Accepted' : 'Declined'}</h2>
                    <p><strong>${toUser.username}</strong> has ${action} your trade proposal.</p>
                    
                    ${action === 'accepted' ? `
                        <p>Great news! You can now arrange the exchange with ${toUser.username}.</p>
                        <p><a href="https://poke4trade.com/my-trades" style="background:#FFCB05;color:#1D2C5E;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">
                            View Trade Details
                        </a></p>
                    ` : `
                        <p>Don't worry, there are other traders out there! Keep looking for matches.</p>
                    `}
                </div>
            `;
            
            sendTradeEmail(fromUser.email, `${emoji} Trade ${action === 'accepted' ? 'Accepted' : 'Declined'} - Poke4Trade`, emailHtml);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error responding to trade:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Cancel a trade request (by proposer)
app.post('/api/trading/cancel/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, addToCollection } = req.body;
        
        const [trade] = await database.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        
        if (!trade) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        
        if (trade.from_user_id !== parseInt(userId)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        if (trade.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Trade already processed' });
        }
        
        await database.query('UPDATE trade_requests SET status = "cancelled" WHERE id = ?', [tradeId]);
        
        // Notify the other user
        const [fromUser] = await database.query('SELECT username FROM users WHERE id = ?', [trade.from_user_id]);
        
        await database.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'trade_cancelled', ?, ?, ?, ?)
        `, [
            trade.to_user_id,
            `Trade cancelled by ${fromUser.username}`,
            'The trade proposal has been cancelled.',
            '/my-trades',
            tradeId
        ]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error cancelling trade:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user notifications
app.get('/api/notifications/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { unreadOnly } = req.query;
        
        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        if (unreadOnly === 'true') {
            query += ' AND is_read = FALSE';
        }
        query += ' ORDER BY created_at DESC LIMIT 50';
        
        const notifications = await database.query(query, [userId]);
        const unreadCount = await database.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        
        res.json({ success: true, data: notifications, unreadCount: unreadCount[0].count });
    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark notification as read
app.post('/api/notifications/read/:notifId', async (req, res) => {
    try {
        const { notifId } = req.params;
        await database.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [notifId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark all notifications as read
app.post('/api/notifications/read-all/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        await database.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// ============================================
// TRADE MESSAGING & RATINGS
// ============================================

// Get messages for a trade
app.get('/api/trading/messages/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.query;
        
        // Verify user is part of this trade
        const [trade] = await database.query(
            'SELECT * FROM trade_requests WHERE id = ? AND (from_user_id = ? OR to_user_id = ?)',
            [tradeId, userId, userId]
        );
        
        if (!trade) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        const messages = await database.query(`
            SELECT tm.*, u.username, u.profile_picture
            FROM trade_messages tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.trade_id = ?
            ORDER BY tm.created_at ASC
        `, [tradeId]);
        
        // Mark messages as read
        await database.query(
            'UPDATE trade_messages SET is_read = TRUE WHERE trade_id = ? AND user_id != ?',
            [tradeId, userId]
        );
        
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send a message
app.post('/api/trading/messages/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, message } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, error: 'Message cannot be empty' });
        }
        
        // Verify user is part of this trade
        const [trade] = await database.query(
            'SELECT * FROM trade_requests WHERE id = ? AND (from_user_id = ? OR to_user_id = ?)',
            [tradeId, userId, userId]
        );
        
        if (!trade) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        await database.query(
            'INSERT INTO trade_messages (trade_id, user_id, message) VALUES (?, ?, ?)',
            [tradeId, userId, message.trim()]
        );
        
        // Create notification for other user
        const otherUserId = trade.from_user_id === parseInt(userId) ? trade.to_user_id : trade.from_user_id;
        const [sender] = await database.query('SELECT username FROM users WHERE id = ?', [userId]);
        
        await database.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'system', ?, ?, ?, ?)
        `, [
            otherUserId,
            `New message from ${sender.username}`,
            message.trim().substring(0, 100) + (message.length > 100 ? '...' : ''),
            '/my-trades',
            tradeId
        ]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get unread message count for a trade
app.get('/api/trading/messages/:tradeId/unread', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.query;
        
        const [result] = await database.query(
            'SELECT COUNT(*) as count FROM trade_messages WHERE trade_id = ? AND user_id != ? AND is_read = FALSE',
            [tradeId, userId]
        );
        
        res.json({ success: true, count: result.count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update shipping status
app.post('/api/trading/ship/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, tracking, removeFromListings } = req.body;
        
        const [trade] = await database.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        
        if (!trade) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        
        if (trade.status !== 'accepted' && trade.status !== 'shipping') {
            return res.status(400).json({ success: false, error: 'Trade must be accepted first' });
        }
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        const isToUser = trade.to_user_id === parseInt(userId);
        
        if (!isFromUser && !isToUser) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        // Update shipping status
        if (isFromUser) {
            await database.query(
                'UPDATE trade_requests SET from_user_shipped = TRUE, from_user_shipped_at = NOW(), from_user_tracking = ?, status = "shipping" WHERE id = ?',
                [tracking || null, tradeId]
            );
        } else {
            await database.query(
                'UPDATE trade_requests SET to_user_shipped = TRUE, to_user_shipped_at = NOW(), to_user_tracking = ?, status = "shipping" WHERE id = ?',
                [tracking || null, tradeId]
            );
        }
        
        // Notify other user
        const otherUserId = isFromUser ? trade.to_user_id : trade.from_user_id;
        const [shipper] = await database.query('SELECT username FROM users WHERE id = ?', [userId]);
        
        await database.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'system', ?, ?, ?, ?)
        `, [
            otherUserId,
            `${shipper.username} has shipped!`,
            tracking ? `Tracking: ${tracking}` : 'Cards are on the way!',
            '/my-trades',
            tradeId
        ]);
        
        // Remove cards from listings if requested
        if (removeFromListings) {
            // Get the cards this user is giving in this trade
            const cardsToRemove = await database.query(
                `SELECT card_id FROM trade_request_cards WHERE trade_request_id = ? AND direction = ?`,
                [tradeId, isFromUser ? "give" : "get"]
            );
            
            for (const card of cardsToRemove) {
                await database.query(
                    `UPDATE user_listings SET status = "traded" WHERE user_id = ? AND card_id = ? AND status = "active"`,
                    [userId, card.card_id]
                );
            }
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating shipping:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Confirm receipt

// Undo ship
app.post("/api/trading/unship/:tradeId", async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.body;
        
        const [trade] = await database.query("SELECT * FROM trade_requests WHERE id = ?", [tradeId]);
        
        if (!trade) {
            return res.status(404).json({ success: false, error: "Trade not found" });
        }
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        const isToUser = trade.to_user_id === parseInt(userId);
        
        if (!isFromUser && !isToUser) {
            return res.status(403).json({ success: false, error: "Not authorized" });
        }
        
        // Update shipping status
        if (isFromUser) {
            await database.query(
                "UPDATE trade_requests SET from_user_shipped = FALSE, from_user_shipped_at = NULL, from_user_tracking = NULL WHERE id = ?",
                [tradeId]
            );
        } else {
            await database.query(
                "UPDATE trade_requests SET to_user_shipped = FALSE, to_user_shipped_at = NULL, to_user_tracking = NULL WHERE id = ?",
                [tradeId]
            );
        }
        
        // Check if neither has shipped - revert to accepted status
        const [updated] = await database.query("SELECT * FROM trade_requests WHERE id = ?", [tradeId]);
        if (!updated.from_user_shipped && !updated.to_user_shipped) {
            await database.query("UPDATE trade_requests SET status = \"accepted\" WHERE id = ?", [tradeId]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error("Error undoing ship:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/trading/receive/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, addToCollection } = req.body;
        
        const [trade] = await database.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        
        if (!trade) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        const isToUser = trade.to_user_id === parseInt(userId);
        
        if (!isFromUser && !isToUser) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        // Update received status
        if (isFromUser) {
            await database.query(
                'UPDATE trade_requests SET from_user_received = TRUE, from_user_received_at = NOW() WHERE id = ?',
                [tradeId]
            );
        } else {
            await database.query(
                'UPDATE trade_requests SET to_user_received = TRUE, to_user_received_at = NOW() WHERE id = ?',
                [tradeId]
            );
        }
        
        // Check if both received - complete the trade
        const [updated] = await database.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        
        if (updated.from_user_received && updated.to_user_received) {
            await database.query('UPDATE trade_requests SET status = "completed" WHERE id = ?', [tradeId]);
            
            // Update trade counts for both users
            await database.query('UPDATE users SET trades_count = trades_count + 1 WHERE id IN (?, ?)', 
                [trade.from_user_id, trade.to_user_id]);
            
            // Notify both users
            const [fromUser] = await database.query('SELECT username FROM users WHERE id = ?', [trade.from_user_id]);
            const [toUser] = await database.query('SELECT username FROM users WHERE id = ?', [trade.to_user_id]);
            
            await database.query(`
                INSERT INTO notifications (user_id, type, title, message, link, related_id)
                VALUES (?, 'system', ?, ?, ?, ?), (?, 'system', ?, ?, ?, ?)
            `, [
                trade.from_user_id, 'Trade Completed! 🎉', `Your trade with ${toUser.username} is complete. Don't forget to leave a rating!`, '/my-trades', tradeId,
                trade.to_user_id, 'Trade Completed! 🎉', `Your trade with ${fromUser.username} is complete. Don't forget to leave a rating!`, '/my-trades', tradeId
            ]);
        } else {
            // Notify the other user
            const otherUserId = isFromUser ? trade.to_user_id : trade.from_user_id;
            const [receiver] = await database.query('SELECT username FROM users WHERE id = ?', [userId]);
            
            await database.query(`
                INSERT INTO notifications (user_id, type, title, message, link, related_id)
                VALUES (?, 'system', ?, ?, ?, ?)
            `, [
                otherUserId,
                `${receiver.username} received the cards!`,
                'Waiting for you to confirm receipt.',
                '/my-trades',
                tradeId
            ]);
        }
        
        // Add cards to collection if requested
        if (addToCollection) {
            // Get the cards this user received in this trade
            const cardsToAdd = await database.query(
                `SELECT trc.card_id, c.setId FROM trade_request_cards trc JOIN cards c ON trc.card_id = c.id WHERE trc.trade_request_id = ? AND trc.direction = ?`,
                [tradeId, isFromUser ? "get" : "give"]
            );
            
            for (const card of cardsToAdd) {
                // Check if already owned
                const [existing] = await database.query(
                    `SELECT id FROM user_owned_cards WHERE user_id = ? AND card_id = ?`,
                    [userId, card.card_id]
                );
                
                if (!existing) {
                    await database.query(
                        `INSERT INTO user_owned_cards (user_id, card_id) VALUES (?, ?)`,
                        [userId, card.card_id]
                    );
                }
            }
        }

        res.json({ success: true, completed: updated.from_user_received && updated.to_user_received });
    } catch (error) {
        console.error('Error confirming receipt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit a rating
app.post('/api/trading/rate/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, overallRating, communicationRating, shippingRating, cardConditionRating, comment } = req.body;
        
        if (!overallRating || overallRating < 1 || overallRating > 5) {
            return res.status(400).json({ success: false, error: 'Invalid rating' });
        }
        
        const [trade] = await database.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        
        if (!trade || trade.status !== 'completed') {
            return res.status(400).json({ success: false, error: 'Can only rate completed trades' });
        }
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        const isToUser = trade.to_user_id === parseInt(userId);
        
        if (!isFromUser && !isToUser) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        const toUserId = isFromUser ? trade.to_user_id : trade.from_user_id;
        
        // Check if already rated
        const [existing] = await database.query(
            'SELECT id FROM trade_ratings WHERE trade_id = ? AND from_user_id = ?',
            [tradeId, userId]
        );
        
        if (existing) {
            return res.status(400).json({ success: false, error: 'Already rated this trade' });
        }
        
        // Insert rating
        await database.query(`
            INSERT INTO trade_ratings (trade_id, from_user_id, to_user_id, overall_rating, communication_rating, shipping_rating, card_condition_rating, comment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [tradeId, userId, toUserId, overallRating, communicationRating || null, shippingRating || null, cardConditionRating || null, comment || null]);
        
        // Update user's average rating
        const [avgResult] = await database.query(
            'SELECT AVG(overall_rating) as avg_rating FROM trade_ratings WHERE to_user_id = ?',
            [toUserId]
        );
        
        await database.query(
            'UPDATE users SET rating = ? WHERE id = ?',
            [avgResult.avg_rating || 5.0, toUserId]
        );
        
        // Notify the rated user
        const [rater] = await database.query('SELECT username FROM users WHERE id = ?', [userId]);
        
        await database.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'system', ?, ?, ?, ?)
        `, [
            toUserId,
            `${rater.username} left you a rating`,
            `You received ${overallRating} stars!`,
            '/profile',
            tradeId
        ]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error submitting rating:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user ratings
app.get('/api/users/:userId/ratings', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const ratings = await database.query(`
            SELECT tr.*, u.username as from_username, u.profile_picture as from_picture
            FROM trade_ratings tr
            JOIN users u ON tr.from_user_id = u.id
            WHERE tr.to_user_id = ?
            ORDER BY tr.created_at DESC
            LIMIT 50
        `, [userId]);
        
        const [stats] = await database.query(`
            SELECT 
                COUNT(*) as total_ratings,
                AVG(overall_rating) as avg_overall,
                AVG(communication_rating) as avg_communication,
                AVG(shipping_rating) as avg_shipping,
                AVG(card_condition_rating) as avg_condition
            FROM trade_ratings WHERE to_user_id = ?
        `, [userId]);
        
        res.json({ success: true, data: { ratings, stats } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get full trade details including shipping status
app.get('/api/trading/full/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.query;
        
        const [trade] = await database.query(`
            SELECT tr.*, 
                   fu.username as from_username, fu.email as from_email, fu.rating as from_rating,
                   fu.address1 as from_address1, fu.address2 as from_address2, fu.city as from_city,
                   fu.state as from_state, fu.postal_code as from_postal, fu.country as from_country,
                   tu.username as to_username, tu.email as to_email, tu.rating as to_rating,
                   tu.address1 as to_address1, tu.address2 as to_address2, tu.city as to_city,
                   tu.state as to_state, tu.postal_code as to_postal, tu.country as to_country
            FROM trade_requests tr
            JOIN users fu ON tr.from_user_id = fu.id
            JOIN users tu ON tr.to_user_id = tu.id
            WHERE tr.id = ?
        `, [tradeId]);
        
        if (!trade) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        
        // Only show addresses if trade is accepted or beyond
        const showAddresses = ['accepted', 'shipping', 'delivered', 'completed'].includes(trade.status);
        
        if (!showAddresses) {
            delete trade.from_address1; delete trade.from_address2; delete trade.from_city;
            delete trade.from_state; delete trade.from_postal; delete trade.from_country;
            delete trade.to_address1; delete trade.to_address2; delete trade.to_city;
            delete trade.to_state; delete trade.to_postal; delete trade.to_country;
        }
        
        // Get cards
        const cards = await database.query(`
            SELECT trc.*, c.number as card_number, c.setId as set_id, s.name as set_name, c.data as card_data
            FROM trade_request_cards trc
            LEFT JOIN cards c ON trc.card_id = c.id
            LEFT JOIN sets s ON c.setId = s.id
            WHERE trc.trade_request_id = ?
        `, [tradeId]);
        
        // Check if user has rated
        const [userRating] = await database.query(
            'SELECT * FROM trade_ratings WHERE trade_id = ? AND from_user_id = ?',
            [tradeId, userId]
        );
        
        res.json({ 
            success: true, 
            data: { 
                trade, 
                cards,
                hasRated: !!userRating,
                userRating
            } 
        });
    } catch (error) {
        console.error('Error getting full trade:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// Admin Routes
// ==========================================

// Initialize admin tables
async function initAdminTables() {
    try {
        // Add is_admin column to users if not exists
        await database.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) DEFAULT 0
        `).catch(() => {});
        
        // Add is_suspended column to users if not exists
        await database.query(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended TINYINT(1) DEFAULT 0
        `).catch(() => {});
        
        // Create site_settings table
        await database.query(`
            CREATE TABLE IF NOT EXISTS site_settings (
                id INT AUTO_INCREMENT PRIMARY KEY,
                setting_key VARCHAR(100) UNIQUE NOT NULL,
                setting_value JSON,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        
        // Add moderation columns to trade_ratings if not exists
        await database.query(`ALTER TABLE trade_ratings ADD COLUMN IF NOT EXISTS is_flagged TINYINT(1) DEFAULT 0`).catch(() => {});
        await database.query(`ALTER TABLE trade_ratings ADD COLUMN IF NOT EXISTS flag_reason VARCHAR(255)`).catch(() => {});
        await database.query(`ALTER TABLE trade_ratings ADD COLUMN IF NOT EXISTS flagged_at DATETIME`).catch(() => {});
        await database.query(`ALTER TABLE trade_ratings ADD COLUMN IF NOT EXISTS is_hidden TINYINT(1) DEFAULT 0`).catch(() => {});
        await database.query(`ALTER TABLE trade_ratings ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) DEFAULT 0`).catch(() => {});
        await database.query(`ALTER TABLE trade_ratings ADD COLUMN IF NOT EXISTS deleted_at DATETIME`).catch(() => {});
        
        // Add moderation columns to trade_messages if not exists
        await database.query(`ALTER TABLE trade_messages ADD COLUMN IF NOT EXISTS is_deleted TINYINT(1) DEFAULT 0`).catch(() => {});
        await database.query(`ALTER TABLE trade_messages ADD COLUMN IF NOT EXISTS deleted_at DATETIME`).catch(() => {});
        
        // Add dispute columns to trades if not exists
        await database.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS has_dispute TINYINT(1) DEFAULT 0`).catch(() => {});
        await database.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS dispute_status VARCHAR(50)`).catch(() => {});
        await database.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS dispute_resolution VARCHAR(255)`).catch(() => {});
        await database.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS dispute_notes TEXT`).catch(() => {});
        await database.query(`ALTER TABLE trades ADD COLUMN IF NOT EXISTS dispute_resolved_at DATETIME`).catch(() => {});
        
        console.log('Admin tables initialized');
    } catch (error) {
        console.error('Error initializing admin tables:', error);
    }
}


// ============================================
// SHOP PRODUCTS API ROUTES
// ============================================

// Get user's shop products
app.get('/api/shop/products/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query;
        
        let query = `
            SELECT sp.*, u.username as seller_name, u.rating as seller_rating
            FROM shop_products sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.user_id = ?
        `;
        const params = [userId];
        
        if (status && status !== 'all') {
            query += ' AND sp.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY u.rating DESC, sp.created_at DESC';
        
        const products = await database.query(query, params);
        res.json({ success: true, products });
    } catch (error) {
        console.error('Get shop products error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all active shop products (marketplace)
app.get('/api/shop/marketplace', async (req, res) => {
    try {
        const { type, sort, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT sp.*, u.username as seller_name, u.rating as seller_rating,
                   u.profile_picture as seller_picture
            FROM shop_products sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.status = 'active' AND sp.quantity > 0
        `;
        const params = [];
        
        if (type && type !== 'all') {
            query += ' AND sp.product_type = ?';
            params.push(type);
        }
        
        if (search) {
            query += ' AND (sp.name LIKE ? OR sp.set_name LIKE ? OR sp.description LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }
        
        // Sorting
        switch (sort) {
            case 'price_asc':
                query += ' ORDER BY sp.price ASC';
                break;
            case 'price_desc':
                query += ' ORDER BY sp.price DESC';
                break;
            case 'newest':
                query += ' ORDER BY u.rating DESC, sp.created_at DESC';
                break;
            default:
                query += ' ORDER BY u.rating DESC, sp.created_at DESC';
        }
        
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const products = await database.query(query, params);
        
        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total FROM shop_products sp
            WHERE sp.status = 'active' AND sp.quantity > 0
        `;
        const countParams = [];
        
        if (type && type !== 'all') {
            countQuery += ' AND sp.product_type = ?';
            countParams.push(type);
        }
        
        if (search) {
            countQuery += ' AND (sp.name LIKE ? OR sp.set_name LIKE ? OR sp.description LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm, searchTerm);
        }
        
        const countResult = await database.query(countQuery, countParams);
        
        res.json({ 
            success: true, 
            products,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit)
        });
    } catch (error) {
        console.error('Get marketplace error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add a new shop product
app.post('/api/shop/products/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { product_type, name, set_name, description, price, quantity, condition_grade, language } = req.body;
        
        if (!product_type || !name || !price) {
            return res.status(400).json({ success: false, error: 'Product type, name, and price are required' });
        }
        
        const result = await database.query(`
            INSERT INTO shop_products 
            (user_id, product_type, name, set_name, description, price, quantity, condition_grade, language)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, product_type, name, set_name || null, description || null, 
            price, quantity || 1, condition_grade || 'Sealed', language || 'English']);
        
        res.json({ success: true, productId: result.insertId });
    } catch (error) {
        console.error('Add shop product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update a shop product
app.put('/api/shop/products/:userId/:productId', async (req, res) => {
    try {
        const { userId, productId } = req.params;
        const { product_type, name, set_name, description, price, quantity, condition_grade, language, status } = req.body;
        
        // Verify ownership
        const existing = await database.query('SELECT * FROM shop_products WHERE id = ? AND user_id = ?', [productId, userId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found or not owned by user' });
        }
        
        await database.query(`
            UPDATE shop_products 
            SET product_type = ?, name = ?, set_name = ?, description = ?, 
                price = ?, quantity = ?, condition_grade = ?, language = ?, status = ?
            WHERE id = ? AND user_id = ?
        `, [product_type, name, set_name || null, description || null, 
            price, quantity || 1, condition_grade || 'Sealed', language || 'English',
            status || 'active', productId, userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update shop product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a shop product
app.delete('/api/shop/products/:userId/:productId', async (req, res) => {
    try {
        const { userId, productId } = req.params;
        
        // Verify ownership
        const existing = await database.query('SELECT * FROM shop_products WHERE id = ? AND user_id = ?', [productId, userId]);
        if (existing.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found or not owned by user' });
        }
        
        await database.query('DELETE FROM shop_products WHERE id = ? AND user_id = ?', [productId, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete shop product error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get single product details
app.get('/api/shop/product/:productId', async (req, res) => {
    try {
        const { productId } = req.params;
        
        const products = await database.query(`
            SELECT sp.*, u.username as seller_name, u.rating as seller_rating,
                   u.profile_picture as seller_picture, u.id as seller_id
            FROM shop_products sp
            JOIN users u ON sp.user_id = u.id
            WHERE sp.id = ?
        `, [productId]);
        
        if (products.length === 0) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }
        
        res.json({ success: true, product: products[0] });
    } catch (error) {
        console.error('Get product details error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Get all single cards for sale (marketplace)
app.get('/api/shop/cards', async (req, res) => {
    try {
        const { sort, search, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;
        
        let query = `
            SELECT ul.*, 
                   u.username as seller_name, 
                   u.rating as seller_rating,
                   u.profile_picture as seller_picture,
                   c.name as card_name,
                   c.imageSmall,
                   c.data as card_data,
                   s.name as set_name
            FROM user_listings ul
            JOIN users u ON ul.user_id = u.id
            JOIN cards c ON ul.card_id = c.id
            JOIN sets s ON ul.set_id = s.id
            WHERE ul.listing_type IN ('sale', 'both') 
            AND ul.status = 'active'
            AND ul.quantity > 0
        `;
        const params = [];
        
        if (search) {
            query += ' AND (c.name LIKE ? OR s.name LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm);
        }
        
        // Sorting - default by seller rating
        switch (sort) {
            case 'price_asc':
                query += ' ORDER BY ul.price ASC';
                break;
            case 'price_desc':
                query += ' ORDER BY ul.price DESC';
                break;
            case 'newest':
                query += ' ORDER BY ul.created_at DESC';
                break;
            case 'rating':
            default:
                query += ' ORDER BY u.rating DESC, ul.created_at DESC';
        }
        
        query += ' LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));
        
        const cards = await database.query(query, params);
        
        // Get total count
        let countQuery = `
            SELECT COUNT(*) as total 
            FROM user_listings ul
            JOIN cards c ON ul.card_id = c.id
            JOIN sets s ON ul.set_id = s.id
            WHERE ul.listing_type IN ('sale', 'both') 
            AND ul.status = 'active'
            AND ul.quantity > 0
        `;
        const countParams = [];
        
        if (search) {
            countQuery += ' AND (c.name LIKE ? OR s.name LIKE ?)';
            const searchTerm = `%${search}%`;
            countParams.push(searchTerm, searchTerm);
        }
        
        const countResult = await database.query(countQuery, countParams);
        
        // Apply seller pricing settings to each card
        const cardsWithPrices = await Promise.all(cards.map(async (card) => {
            const settingsResult = await database.query("SELECT * FROM user_settings WHERE user_id = ?", [card.user_id]);
            const userSettings = settingsResult.length > 0 ? settingsResult[0] : null;
            const tcgPrice = extractTcgPrice(card.card_data);
            let price = parseFloat(card.price);
            if (!card.price_override && tcgPrice && userSettings) {
                price = calculateAdjustedPrice(tcgPrice, userSettings);
            } else if (!card.price && tcgPrice) {
                price = tcgPrice;
            }
            return { ...card, price: price, tcgPrice: tcgPrice, card_data: undefined };
        }));
        
        res.json({
            success: true,
            cards: cardsWithPrices,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / limit)
        });
    } catch (error) {
        console.error('Get cards marketplace error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// Get sell history (sold products and cards)
app.get('/api/shop/sell-history/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { type } = req.query; // all, products, cards
        
        let items = [];
        
        // Get sold products
        if (type === 'all' || type === 'products') {
            const products = await database.query(`
                SELECT 
                    id, 
                    'product' as type,
                    product_type,
                    name, 
                    set_name,
                    price, 
                    quantity,
                    updated_at as sold_date
                FROM shop_products 
                WHERE user_id = ? AND status = 'sold'
                ORDER BY updated_at DESC
            `, [userId]);
            items = items.concat(products);
        }
        
        // Get sold cards
        if (type === 'all' || type === 'cards') {
            const cards = await database.query(`
                SELECT 
                    ul.id,
                    'card' as type,
                    NULL as product_type,
                    c.name,
                    s.name as set_name,
                    ul.price,
                    ul.quantity,
                    ul.updated_at as sold_date,
                    c.imageSmall as image
                FROM user_listings ul
                JOIN cards c ON ul.card_id = c.id
                JOIN sets s ON ul.set_id = s.id
                WHERE ul.user_id = ? AND ul.status = 'sold'
                ORDER BY ul.updated_at DESC
            `, [userId]);
            items = items.concat(cards);
        }
        
        // Sort all items by sold_date descending
        items.sort((a, b) => new Date(b.sold_date) - new Date(a.sold_date));
        
        // Calculate stats
        const totalSold = items.length;
        const totalValue = items.reduce((sum, item) => sum + parseFloat(item.price) * (item.quantity || 1), 0);
        
        res.json({ 
            success: true, 
            items,
            stats: { totalSold, totalValue }
        });
    } catch (error) {
        console.error('Get sell history error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ============================================

// ============================================
// SHOPPING CART & CHECKOUT API ROUTES
// ============================================

// Get cart items for user
app.get('/api/cart/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Get cart items with product/card details
        const cartItems = await database.query(`
            SELECT sc.*, 
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.name
                    WHEN sc.item_type = 'card' THEN c.name
                END as item_name,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.price
                    WHEN sc.item_type = 'card' THEN ul.price
                END as price,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.set_name
                    WHEN sc.item_type = 'card' THEN s.name
                END as set_name,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.product_type
                    ELSE NULL
                END as product_type,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.condition_grade
                    WHEN sc.item_type = 'card' THEN ul.condition_grade
                END as condition_grade,
                CASE 
                    WHEN sc.item_type = 'product' THEN pi.image_path
                    WHEN sc.item_type = 'card' THEN c.imageSmall
                END as image,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.user_id
                    WHEN sc.item_type = 'card' THEN ul.user_id
                END as seller_id,
                CASE 
                    WHEN sc.item_type = 'product' THEN pu.username
                    WHEN sc.item_type = 'card' THEN cu.username
                END as seller_name,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.quantity
                    WHEN sc.item_type = 'card' THEN ul.quantity
                END as available_quantity
            FROM shopping_cart sc
            LEFT JOIN shop_products sp ON sc.item_type = 'product' AND sc.item_id = sp.id
            LEFT JOIN product_images pi ON sp.product_type = pi.product_type AND sp.set_name = pi.set_name AND pi.is_default = 1
            LEFT JOIN users pu ON sp.user_id = pu.id
            LEFT JOIN user_listings ul ON sc.item_type = 'card' AND sc.item_id = ul.id
            LEFT JOIN cards c ON ul.card_id = c.id
            LEFT JOIN sets s ON ul.set_id = s.id
            LEFT JOIN users cu ON ul.user_id = cu.id
            WHERE sc.user_id = ?
            ORDER BY sc.added_at DESC
        `, [userId]);
        
        // Calculate totals
        const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        
        // Get platform fee settings
        const feeResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'platform_fee_percent'");
        const minFeeResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_platform_fee'");
        const minThresholdResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_fee_threshold'");
        
        const feePercent = feeResult.length > 0 ? parseFloat(feeResult[0].setting_value) : 10;
        const minFee = minFeeResult.length > 0 ? parseFloat(minFeeResult[0].setting_value.replace(/"/g, '')) : 0.50;
        const minThreshold = minThresholdResult.length > 0 ? parseFloat(minThresholdResult[0].setting_value.replace(/"/g, '')) : 5.00;
        
        // Apply minimum fee if subtotal is below threshold
        let platformFee = subtotal * (feePercent / 100);
        if (subtotal < minThreshold && platformFee < minFee) {
            platformFee = minFee;
        }
        
        res.json({
            success: true,
            items: cartItems,
            subtotal,
            platformFee,
            feePercent,
            minFee,
            minThreshold,
            total: subtotal
        });
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add item to cart
app.post('/api/cart/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { item_type, item_id, quantity = 1 } = req.body;
        
        // Check if item exists and is available
        if (item_type === 'product') {
            const product = await database.query('SELECT * FROM shop_products WHERE id = ? AND status = "active"', [item_id]);
            if (product.length === 0) {
                return res.status(400).json({ success: false, error: 'Product not available' });
            }
            // Can't buy your own product
            if (product[0].user_id == userId) {
                return res.status(400).json({ success: false, error: 'You cannot buy your own product' });
            }
        } else if (item_type === 'card') {
            const card = await database.query('SELECT * FROM user_listings WHERE id = ? AND status = "active" AND listing_type IN ("sale", "both")', [item_id]);
            if (card.length === 0) {
                return res.status(400).json({ success: false, error: 'Card not available for sale' });
            }
            // Can't buy your own card
            if (card[0].user_id == userId) {
                return res.status(400).json({ success: false, error: 'You cannot buy your own card' });
            }
        }
        
        // Add to cart (update quantity if already exists)
        await database.query(`
            INSERT INTO shopping_cart (user_id, item_type, item_id, quantity)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
        `, [userId, item_type, item_id, quantity]);
        
        res.json({ success: true, message: 'Added to cart' });
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update cart item quantity
app.put('/api/cart/:userId/:cartId', async (req, res) => {
    try {
        const { userId, cartId } = req.params;
        const { quantity } = req.body;
        
        if (quantity <= 0) {
            await database.query('DELETE FROM shopping_cart WHERE id = ? AND user_id = ?', [cartId, userId]);
        } else {
            await database.query('UPDATE shopping_cart SET quantity = ? WHERE id = ? AND user_id = ?', [quantity, cartId, userId]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update cart error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remove item from cart
app.delete('/api/cart/:userId/:cartId', async (req, res) => {
    try {
        const { userId, cartId } = req.params;
        await database.query('DELETE FROM shopping_cart WHERE id = ? AND user_id = ?', [cartId, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Remove from cart error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Clear entire cart
app.delete('/api/cart/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        await database.query('DELETE FROM shopping_cart WHERE user_id = ?', [userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get cart count
app.get('/api/cart/:userId/count', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await database.query('SELECT SUM(quantity) as count FROM shopping_cart WHERE user_id = ?', [userId]);
        res.json({ success: true, count: result[0].count || 0 });
    } catch (error) {
        console.error('Get cart count error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user shipping address
app.get('/api/user/:userId/address', async (req, res) => {
    try {
        const { userId } = req.params;
        const user = await database.query(`
            SELECT shipping_name, shipping_address1, shipping_address2, shipping_city, shipping_state, shipping_postal_code, shipping_country, use_billing_as_shipping, first_name, last_name, billing_address1, billing_address2, billing_city, billing_state, billing_postal_code, billing_country
            FROM users WHERE id = ?
        `, [userId]);
        
        if (user.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        
        res.json({ success: true, address: user[0] });
    } catch (error) {
        console.error('Get address error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update user shipping address
app.put('/api/user/:userId/address', async (req, res) => {
    try {
        const { userId } = req.params;
        const { shipping_name, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country } = req.body;
        
        await database.query(`
            UPDATE users SET 
                shipping_name = ?,
                shipping_address = ?,
                shipping_city = ?,
                shipping_state = ?,
                shipping_zip = ?,
                shipping_country = ?
            WHERE id = ?
        `, [shipping_name, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country || 'USA', userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update address error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================
// PAYMENT API ROUTES (Stripe + PayPal)
// ============================================

const PAYPAL_BASE_URL = process.env.PAYPAL_MODE === 'live' 
    ? 'https://api-m.paypal.com' 
    : 'https://api-m.sandbox.paypal.com';

// Get payment config for frontend
app.get('/api/payments/config', (req, res) => {
    res.json({ 
        success: true, 
        stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
        paypalClientId: process.env.PAYPAL_CLIENT_ID,
        paypalMode: process.env.PAYPAL_MODE || 'sandbox'
    });
});

// Create Stripe PaymentIntent
app.post('/api/payments/stripe/create-intent', async (req, res) => {
    try {
        const { buyer_id, tax_amount } = req.body;
        
        const cartItems = await database.query(`
            SELECT sc.*, 
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.price
                    WHEN sc.item_type = 'card' THEN ul.price
                END as price
            FROM shopping_cart sc
            LEFT JOIN shop_products sp ON sc.item_type = 'product' AND sc.item_id = sp.id
            LEFT JOIN user_listings ul ON sc.item_type = 'card' AND sc.item_id = ul.id
            WHERE sc.user_id = ?
        `, [buyer_id]);
        
        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Cart is empty' });
        }
        
        const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        
        const minFeeResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_platform_fee'");
        const minThresholdResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_fee_threshold'");
        const minFee = minFeeResult.length > 0 ? parseFloat(minFeeResult[0].setting_value.replace(/"/g, '')) : 0.50;
        const minThreshold = minThresholdResult.length > 0 ? parseFloat(minThresholdResult[0].setting_value.replace(/"/g, '')) : 5.00;
        
        let total = subtotal;
        if (subtotal < minThreshold) total += minFee;
        total += parseFloat(tax_amount) || 0;
        
        const amountInCents = Math.round(total * 100);
        
        const paymentIntent = await stripe.paymentIntents.create({
            amount: amountInCents,
            currency: 'usd',
            metadata: { buyer_id: String(buyer_id), item_count: String(cartItems.length) }
        });
        
        res.json({ 
            success: true, 
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            amount: total
        });
    } catch (error) {
        console.error('Stripe create intent error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PayPal access token helper
async function getPayPalAccessToken() {
    const auth = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });
    const data = await response.json();
    return data.access_token;
}

// Create PayPal order
app.post('/api/payments/paypal/create-order', async (req, res) => {
    try {
        const { buyer_id, tax_amount } = req.body;
        
        const cartItems = await database.query(`
            SELECT sc.*, 
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.price
                    WHEN sc.item_type = 'card' THEN ul.price
                END as price
            FROM shopping_cart sc
            LEFT JOIN shop_products sp ON sc.item_type = 'product' AND sc.item_id = sp.id
            LEFT JOIN user_listings ul ON sc.item_type = 'card' AND sc.item_id = ul.id
            WHERE sc.user_id = ?
        `, [buyer_id]);
        
        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Cart is empty' });
        }
        
        const subtotal = cartItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        const minFeeResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_platform_fee'");
        const minThresholdResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_fee_threshold'");
        const minFee = minFeeResult.length > 0 ? parseFloat(minFeeResult[0].setting_value.replace(/"/g, '')) : 0.50;
        const minThreshold = minThresholdResult.length > 0 ? parseFloat(minThresholdResult[0].setting_value.replace(/"/g, '')) : 5.00;
        
        let total = subtotal;
        if (subtotal < minThreshold) total += minFee;
        total += parseFloat(tax_amount) || 0;
        
        const accessToken = await getPayPalAccessToken();
        
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                intent: 'CAPTURE',
                purchase_units: [{
                    amount: { currency_code: 'USD', value: total.toFixed(2) },
                    description: `Poke4Trade Order - ${cartItems.length} item(s)`
                }]
            })
        });
        
        const order = await response.json();
        res.json({ success: true, orderId: order.id });
    } catch (error) {
        console.error('PayPal create order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Capture PayPal order
app.post('/api/payments/paypal/capture-order', async (req, res) => {
    try {
        const { paypal_order_id } = req.body;
        const accessToken = await getPayPalAccessToken();
        
        const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${paypal_order_id}/capture`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const capture = await response.json();
        
        if (capture.status === 'COMPLETED') {
            res.json({ success: true, captureId: capture.purchase_units[0].payments.captures[0].id });
        } else {
            res.status(400).json({ success: false, error: 'Payment not completed' });
        }
    } catch (error) {
        console.error('PayPal capture error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create order (checkout)
app.post('/api/orders', async (req, res) => {
    try {
        const { buyer_id, shipping_address, payment_method, payment_id } = req.body;
        
        // Get cart items
        const cartItems = await database.query(`
            SELECT sc.*, 
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.name
                    WHEN sc.item_type = 'card' THEN c.name
                END as item_name,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.price
                    WHEN sc.item_type = 'card' THEN ul.price
                END as price,
                CASE 
                    WHEN sc.item_type = 'product' THEN pi.image_path
                    WHEN sc.item_type = 'card' THEN c.imageSmall
                END as image,
                CASE 
                    WHEN sc.item_type = 'product' THEN sp.user_id
                    WHEN sc.item_type = 'card' THEN ul.user_id
                END as seller_id
            FROM shopping_cart sc
            LEFT JOIN shop_products sp ON sc.item_type = 'product' AND sc.item_id = sp.id
            LEFT JOIN product_images pi ON sp.product_type = pi.product_type AND sp.set_name = pi.set_name AND pi.is_default = 1
            LEFT JOIN user_listings ul ON sc.item_type = 'card' AND sc.item_id = ul.id
            LEFT JOIN cards c ON ul.card_id = c.id
            WHERE sc.user_id = ?
        `, [buyer_id]);
        
        if (cartItems.length === 0) {
            return res.status(400).json({ success: false, error: 'Cart is empty' });
        }
        
        // Group items by seller
        const ordersBySeller = {};
        cartItems.forEach(item => {
            if (!ordersBySeller[item.seller_id]) {
                ordersBySeller[item.seller_id] = [];
            }
            ordersBySeller[item.seller_id].push(item);
        });
        
        // Get platform fee settings
        const feeResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'platform_fee_percent'");
        const minFeeResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_platform_fee'");
        const minThresholdResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'minimum_fee_threshold'");
        
        const feePercent = feeResult.length > 0 ? parseFloat(feeResult[0].setting_value) : 10;
        const minFee = minFeeResult.length > 0 ? parseFloat(minFeeResult[0].setting_value.replace(/"/g, '')) : 0.50;
        const minThreshold = minThresholdResult.length > 0 ? parseFloat(minThresholdResult[0].setting_value.replace(/"/g, '')) : 5.00;
        
        const createdOrders = [];
        
        // Create separate order for each seller
        for (const sellerId of Object.keys(ordersBySeller)) {
            const sellerItems = ordersBySeller[sellerId];
            const subtotal = sellerItems.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
            let platformFee = subtotal * (feePercent / 100);
            // Apply minimum fee if subtotal is below threshold
            if (subtotal < minThreshold && platformFee < minFee) {
                platformFee = minFee;
            }
            const total = subtotal; // Buyer pays subtotal only
            const sellerReceives = subtotal - platformFee; // Seller gets subtotal minus fee
            
            // Generate order number
            const orderNumber = 'P4T-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            
            // Create order
            const orderResult = await database.query(`
                INSERT INTO orders (order_number, buyer_id, seller_id, subtotal, platform_fee, platform_fee_percent, total, seller_receives,
                    shipping_name, shipping_address, shipping_city, shipping_state, shipping_zip, shipping_country,
                    payment_method, payment_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                orderNumber, buyer_id, sellerId, subtotal, platformFee, feePercent, total, sellerReceives,
                shipping_address.name, shipping_address.address, shipping_address.city,
                shipping_address.state, shipping_address.zip, shipping_address.country || 'USA',
                payment_method || null, payment_id || null
            ]);
            
            const orderId = orderResult.insertId;
            
            // Add order items
            for (const item of sellerItems) {
                await database.query(`
                    INSERT INTO order_items (order_id, item_type, item_id, item_name, item_image, quantity, unit_price, total_price)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `, [orderId, item.item_type, item.item_id, item.item_name, item.image, item.quantity, item.price, item.price * item.quantity]);
                
                // Update product/card status or quantity
                if (item.item_type === 'product') {
                    await database.query('UPDATE shop_products SET quantity = quantity - ?, status = IF(quantity - ? <= 0, "sold", status) WHERE id = ?', 
                        [item.quantity, item.quantity, item.item_id]);
                } else {
                    await database.query('UPDATE user_listings SET quantity = quantity - ?, status = IF(quantity - ? <= 0, "sold", status) WHERE id = ?', 
                        [item.quantity, item.quantity, item.item_id]);
                }
            }
            
            createdOrders.push({ orderId, orderNumber, sellerId, total });
            
            // Notify seller of new order
            const [buyer] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [buyer_id]);
            const [seller] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [sellerId]);
            
            await database.query(`
                INSERT INTO notifications (user_id, type, title, message, link, related_id)
                VALUES (?, 'new_order', ?, ?, '/sell-history', ?)
            `, [
                sellerId,
                '🛒 New Order!',
                `${buyer.username} purchased ${sellerItems.length} item(s) for $${total.toFixed(2)}. Order #${orderNumber}`,
                orderId
            ]);
            
            // Build items HTML for emails
            const itemsHtml = sellerItems.map(item => `
                <tr>
                    <td style="padding:8px;border-bottom:1px solid #eee;">${item.item_name}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
                    <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">$${(parseFloat(item.price) * item.quantity).toFixed(2)}</td>
                </tr>
            `).join('');
            
            const itemsTable = `
                <table style="width:100%;border-collapse:collapse;margin:15px 0;">
                    <tr style="background:#f5f5f5;">
                        <th style="padding:8px;text-align:left;">Item</th>
                        <th style="padding:8px;text-align:center;">Qty</th>
                        <th style="padding:8px;text-align:right;">Price</th>
                    </tr>
                    ${itemsHtml}
                    <tr style="font-weight:bold;">
                        <td colspan="2" style="padding:8px;">Total</td>
                        <td style="padding:8px;text-align:right;color:#1D2C5E;">$${total.toFixed(2)}</td>
                    </tr>
                </table>
            `;
            
            const addressHtml = `
                <div style="background:#f9f9f9;padding:12px;border-radius:6px;margin:10px 0;">
                    <strong>Ship to:</strong><br>
                    ${shipping_address.name}<br>
                    ${shipping_address.address}<br>
                    ${shipping_address.city}, ${shipping_address.state} ${shipping_address.zip}<br>
                    ${shipping_address.country || 'USA'}
                </div>
            `;
            
            // Email to seller
            if (seller.email && seller.email_notifications !== 0) {
                sendOrderEmail(
                    seller.email,
                    `🛒 New Order #${orderNumber} from ${buyer.username}`,
                    '🛒 You have a new order!',
                    `<p><strong>${buyer.username}</strong> purchased ${sellerItems.length} item(s) from your shop.</p>
                     <p><strong>Order:</strong> ${orderNumber}</p>
                     ${itemsTable}
                     ${addressHtml}
                     <p style="color:#888;font-size:13px;">You'll receive <strong style="color:#28a745;">$${sellerReceives.toFixed(2)}</strong> after the ${feePercent}% platform fee.</p>`,
                    'View Order & Ship',
                    'https://poke4trade.com/sell-history'
                );
            }
            
            // Email to buyer
            if (buyer.email && buyer.email_notifications !== 0) {
                sendOrderEmail(
                    buyer.email,
                    `✅ Order Confirmed #${orderNumber}`,
                    '✅ Your order has been placed!',
                    `<p>Thank you for your purchase from <strong>${seller.username}</strong>!</p>
                     <p><strong>Order:</strong> ${orderNumber}</p>
                     ${itemsTable}
                     ${addressHtml}
                     <p style="color:#888;font-size:13px;">You'll receive tracking information once the seller ships your order.</p>`,
                    'View Order',
                    'https://poke4trade.com/my-orders'
                );
            }
        }
        
        // Clear cart
        await database.query('DELETE FROM shopping_cart WHERE user_id = ?', [buyer_id]);
        
        res.json({ success: true, orders: createdOrders });
    } catch (error) {
        console.error('Create order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user orders (as buyer)
app.get('/api/orders/buyer/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await database.query(`
            SELECT o.*, u.username as seller_name
            FROM orders o
            JOIN users u ON o.seller_id = u.id
            WHERE o.buyer_id = ?
            ORDER BY o.created_at DESC
        `, [userId]);
        
        // Get items for each order
        for (const order of orders) {
            order.items = await database.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
        }
        
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Get buyer orders error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get user orders (as seller)
app.get('/api/orders/seller/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await database.query(`
            SELECT o.*, u.username as buyer_name
            FROM orders o
            JOIN users u ON o.buyer_id = u.id
            WHERE o.seller_id = ?
            ORDER BY o.created_at DESC
        `, [userId]);
        
        // Get items for each order
        for (const order of orders) {
            order.items = await database.query('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
        }
        
        res.json({ success: true, orders });
    } catch (error) {
        console.error('Get seller orders error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update order status (seller)
// Cancel order with refund (buyer can cancel before shipped)
app.post('/api/orders/:orderId/cancel', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { user_id } = req.body;
        
        // Get order details
        const orders = await database.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (orders.length === 0) {
            return res.status(404).json({ success: false, error: 'Order not found' });
        }
        
        const order = orders[0];
        
        // Verify buyer owns this order
        if (String(order.buyer_id) !== String(user_id)) {
            return res.status(403).json({ success: false, error: 'Not authorized to cancel this order' });
        }
        
        // Check if cancellable (not shipped, delivered, or already cancelled)
        if (['shipped', 'delivered', 'cancelled', 'refunded'].includes(order.status)) {
            return res.status(400).json({ 
                success: false, 
                error: order.status === 'shipped' || order.status === 'delivered'
                    ? 'Cannot cancel an order that has already been shipped'
                    : 'Order is already ' + order.status
            });
        }
        
        // Process refund based on payment method
        let refundResult = { success: true, refundId: null };
        
        if (order.payment_method === 'stripe' && order.payment_id) {
            try {
                const refund = await stripe.refunds.create({
                    payment_intent: order.payment_id
                });
                refundResult.refundId = refund.id;
            } catch (stripeErr) {
                console.error('Stripe refund error:', stripeErr);
                return res.status(500).json({ success: false, error: 'Refund failed: ' + stripeErr.message });
            }
        } else if (order.payment_method === 'paypal' && order.payment_id) {
            try {
                const accessToken = await getPayPalAccessToken();
                
                // First get the capture ID from the PayPal order
                const orderDetailsRes = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${order.payment_id}`, {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                const orderDetails = await orderDetailsRes.json();
                const captureId = orderDetails.purchase_units?.[0]?.payments?.captures?.[0]?.id;
                
                if (captureId) {
                    const refundRes = await fetch(`${PAYPAL_BASE_URL}/v2/payments/captures/${captureId}/refund`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({})
                    });
                    const refundData = await refundRes.json();
                    refundResult.refundId = refundData.id;
                }
            } catch (paypalErr) {
                console.error('PayPal refund error:', paypalErr);
                return res.status(500).json({ success: false, error: 'Refund failed: ' + paypalErr.message });
            }
        }
        
        // Restore inventory for each item in the order
        const orderItems = await database.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
        for (const item of orderItems) {
            if (item.item_type === 'product') {
                await database.query(
                    'UPDATE shop_products SET quantity = quantity + ?, status = "active" WHERE id = ?',
                    [item.quantity, item.item_id]
                );
            } else if (item.item_type === 'card') {
                await database.query(
                    'UPDATE user_listings SET quantity = quantity + ?, status = "active" WHERE id = ?',
                    [item.quantity, item.item_id]
                );
            }
        }
        
        // Update order status
        await database.query(
            'UPDATE orders SET status = "cancelled", cancelled_at = NOW() WHERE id = ?',
            [orderId]
        );
        
        // Notify seller of cancellation
        const [buyer] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [user_id]);
        const [seller] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [order.seller_id]);
        
        await database.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'order_cancelled', ?, ?, '/sell-history', ?)
        `, [
            order.seller_id,
            '❌ Order Cancelled',
            `${buyer.username} cancelled order #${order.order_number}. Items have been restocked.`,
            orderId
        ]);
        
        // Email to seller
        if (seller.email && seller.email_notifications !== 0) {
            sendOrderEmail(
                seller.email,
                `❌ Order #${order.order_number} cancelled`,
                '❌ Order Cancelled',
                `<p><strong>${buyer.username}</strong> has cancelled order <strong>#${order.order_number}</strong>.</p>
                 <p><strong>Refund amount:</strong> $${parseFloat(order.total).toFixed(2)}</p>
                 <p>All items from this order have been automatically restocked in your shop.</p>`,
                'View Orders',
                'https://poke4trade.com/sell-history'
            );
        }
        
        // Email to buyer (cancellation confirmation)
        if (buyer.email && buyer.email_notifications !== 0) {
            sendOrderEmail(
                buyer.email,
                `❌ Order #${order.order_number} cancelled - Refund processed`,
                '❌ Your order has been cancelled',
                `<p>Your order <strong>#${order.order_number}</strong> from <strong>${seller.username}</strong> has been cancelled as requested.</p>
                 <p><strong>Refund amount:</strong> $${parseFloat(order.total).toFixed(2)}</p>
                 <p style="color:#888;">Your refund has been processed to your original payment method. Please allow 5-10 business days for the refund to appear.</p>`,
                'Browse Shop',
                'https://poke4trade.com/shop'
            );
        }
        
        res.json({ 
            success: true, 
            message: 'Order cancelled and refund processed',
            refundId: refundResult.refundId
        });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/api/orders/:orderId/status', async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, tracking_number } = req.body;
        
        let updateFields = 'status = ?';
        const params = [status];
        
        if (status === 'shipped' && tracking_number) {
            updateFields += ', tracking_number = ?, shipped_at = NOW()';
            params.push(tracking_number);
        } else if (status === 'delivered') {
            updateFields += ', delivered_at = NOW()';
        } else if (status === 'paid') {
            updateFields += ', paid_at = NOW()';
        }
        
        params.push(orderId);
        
        await database.query(`UPDATE orders SET ${updateFields} WHERE id = ?`, params);
        
        // Notify buyer of status change
        const [order] = await database.query('SELECT buyer_id, order_number, seller_id, total FROM orders WHERE id = ?', [orderId]);
        if (order) {
            const [seller] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [order.seller_id]);
            const [buyer] = await database.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [order.buyer_id]);
            let title, message;
            if (status === 'shipped') {
                title = '📦 Order Shipped!';
                message = `${seller.username} has shipped your order #${order.order_number}${tracking_number ? '. Tracking: ' + tracking_number : ''}`;
            } else if (status === 'delivered') {
                title = '✅ Order Delivered!';
                message = `Your order #${order.order_number} from ${seller.username} has been marked as delivered`;
            }
            if (title) {
                await database.query(`
                    INSERT INTO notifications (user_id, type, title, message, link, related_id)
                    VALUES (?, 'order_update', ?, ?, '/my-orders', ?)
                `, [order.buyer_id, title, message, orderId]);
                
                // Email to buyer
                if (buyer.email && buyer.email_notifications !== 0) {
                    if (status === 'shipped') {
                        sendOrderEmail(
                            buyer.email,
                            `📦 Order #${order.order_number} has shipped!`,
                            '📦 Your order is on its way!',
                            `<p>Great news! <strong>${seller.username}</strong> has shipped your order.</p>
                             <p><strong>Order:</strong> ${order.order_number}</p>
                             ${tracking_number ? `<div style="background:#f0f8ff;padding:12px;border-radius:6px;margin:15px 0;border-left:4px solid #007bff;">
                                 <strong>Tracking Number:</strong> ${tracking_number}
                             </div>` : '<p style="color:#888;">No tracking number provided.</p>'}`,
                            'View Order',
                            'https://poke4trade.com/my-orders'
                        );
                    } else if (status === 'delivered') {
                        sendOrderEmail(
                            buyer.email,
                            `✅ Order #${order.order_number} delivered!`,
                            '✅ Your order has been delivered!',
                            `<p>Your order from <strong>${seller.username}</strong> has been marked as delivered.</p>
                             <p><strong>Order:</strong> ${order.order_number}</p>
                             <p>If you have any issues with your order, please contact the seller.</p>`,
                            'View Order',
                            'https://poke4trade.com/my-orders'
                        );
                    }
                }
                
                // Email to seller (confirmation)
                if (seller.email && seller.email_notifications !== 0) {
                    if (status === 'shipped') {
                        sendOrderEmail(
                            seller.email,
                            `📦 Shipped: Order #${order.order_number}`,
                            '📦 Shipment confirmed',
                            `<p>You've marked order <strong>#${order.order_number}</strong> for <strong>${buyer.username}</strong> as shipped.</p>
                             ${tracking_number ? `<p><strong>Tracking:</strong> ${tracking_number}</p>` : ''}
                             <p style="color:#888;">The buyer has been notified. Mark as delivered once the package arrives.</p>`,
                            'View Orders',
                            'https://poke4trade.com/sell-history'
                        );
                    } else if (status === 'delivered') {
                        sendOrderEmail(
                            seller.email,
                            `✅ Completed: Order #${order.order_number}`,
                            '✅ Order completed!',
                            `<p>Order <strong>#${order.order_number}</strong> for <strong>${buyer.username}</strong> is now complete.</p>
                             <p style="color:#888;">This transaction is now closed.</p>`,
                            null, null
                        );
                    }
                }
            }
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get platform fee setting (public)
app.get('/api/settings/platform-fee', async (req, res) => {
    try {
        const result = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'platform_fee_percent'");
        const feePercent = result.length > 0 ? parseFloat(result[0].setting_value) : 10;
        res.json({ success: true, feePercent });
    } catch (error) {
        console.error('Get platform fee error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});


// ============================================
// TAXCLOUD TAX CALCULATION API
// ============================================

// Get tax rate for a given address
app.post('/api/tax/calculate', async (req, res) => {
    try {
        const { items, shipping_address } = req.body;
        
        // Check if tax is enabled
        const taxEnabled = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'tax_enabled'");
        if (!taxEnabled.length || taxEnabled[0].setting_value !== 'true') {
            return res.json({ success: true, taxRate: 0, taxAmount: 0, message: 'Tax disabled' });
        }
        
        // Get TaxCloud credentials
        const apiIdResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'taxcloud_api_id'");
        const apiKeyResult = await database.query("SELECT setting_value FROM site_settings WHERE setting_key = 'taxcloud_api_key'");
        
        const apiId = apiIdResult.length ? apiIdResult[0].setting_value : '';
        const apiKey = apiKeyResult.length ? apiKeyResult[0].setting_value : '';
        
        if (!apiId || !apiKey) {
            // Fall back to static tax rates
            return await calculateStaticTax(req, res, items, shipping_address);
        }
        
        // Calculate subtotal
        const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        
        // TaxCloud API v2 - Lookup tax rate
        const taxCloudPayload = {
            apiKey: apiKey,
            cartItems: items.map((item, index) => ({
                index: index,
                itemId: item.id?.toString() || index.toString(),
                tic: '00000', // General goods TIC code
                price: parseFloat(item.price),
                qty: item.quantity
            })),
            destination: {
                address1: shipping_address.address,
                address2: '',
                city: shipping_address.city,
                state: shipping_address.state,
                zip5: shipping_address.zip?.substring(0, 5) || '',
                zip4: shipping_address.zip?.length > 5 ? shipping_address.zip.substring(6, 10) : ''
            },
            origin: {
                // Your business address (seller origin)
                address1: '1033 Bartlett Pl',
                city: 'Pleasanton',
                state: 'CA',
                zip5: '94566'
            }
        };
        
        try {
            const https = require('https');
            
            const taxResponse = await new Promise((resolve, reject) => {
                const postData = JSON.stringify(taxCloudPayload);
                
                const options = {
                    hostname: 'api.taxcloud.com',
                    port: 443,
                    path: '/1.0/TaxCloud/Lookup',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(postData),
                        'x-api-key': apiKey
                    }
                };
                
                const request = https.request(options, (response) => {
                    let data = '';
                    response.on('data', chunk => data += chunk);
                    response.on('end', () => {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            resolve({ error: data });
                        }
                    });
                });
                
                request.on('error', reject);
                request.write(postData);
                request.end();
            });
            
            console.log('TaxCloud response:', JSON.stringify(taxResponse));
            
            if (taxResponse.cartItemsResponse) {
                const taxAmount = taxResponse.cartItemsResponse.reduce((sum, item) => sum + (item.taxAmount || 0), 0);
                const taxRate = subtotal > 0 ? (taxAmount / subtotal) * 100 : 0;
                
                return res.json({
                    success: true,
                    taxRate: Math.round(taxRate * 1000) / 1000,
                    taxAmount: Math.round(taxAmount * 100) / 100,
                    source: 'taxcloud'
                });
            } else {
                // TaxCloud error - fall back to static rates
                console.log('TaxCloud error, falling back to static rates:', taxResponse);
                return await calculateStaticTax(req, res, items, shipping_address);
            }
        } catch (taxCloudError) {
            console.error('TaxCloud API error:', taxCloudError);
            // Fall back to static rates
            return await calculateStaticTax(req, res, items, shipping_address);
        }
        
    } catch (error) {
        console.error('Tax calculation error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fallback static tax calculation
async function calculateStaticTax(req, res, items, shipping_address) {
    try {
        const subtotal = items.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0);
        
        // Get state tax rate from our table
        const stateCode = shipping_address.state?.toUpperCase();
        const taxRateResult = await database.query(
            'SELECT tax_rate FROM tax_rates WHERE state_code = ? OR state = ?',
            [stateCode, stateCode]
        );
        
        const taxRate = taxRateResult.length > 0 ? parseFloat(taxRateResult[0].tax_rate) : 0;
        const taxAmount = subtotal * (taxRate / 100);
        
        return res.json({
            success: true,
            taxRate: taxRate,
            taxAmount: Math.round(taxAmount * 100) / 100,
            source: 'static'
        });
    } catch (error) {
        console.error('Static tax calculation error:', error);
        return res.json({ success: true, taxRate: 0, taxAmount: 0, source: 'error' });
    }
}

// Get tax rate for a state (simple lookup)
app.get('/api/tax/rate/:stateCode', async (req, res) => {
    try {
        const { stateCode } = req.params;
        
        const result = await database.query(
            'SELECT tax_rate, state FROM tax_rates WHERE state_code = ? OR state = ?',
            [stateCode.toUpperCase(), stateCode]
        );
        
        if (result.length > 0) {
            res.json({ success: true, taxRate: parseFloat(result[0].tax_rate), state: result[0].state });
        } else {
            res.json({ success: true, taxRate: 0, state: stateCode });
        }
    } catch (error) {
        console.error('Tax rate lookup error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin middleware
const requireAdmin = async (req, res, next) => {
    const userId = req.headers['x-user-id'];
    if (!userId) {
        return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    const users = await database.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
    if (users.length === 0 || !users[0].is_admin) {
        return res.status(403).json({ success: false, error: 'Admin access required' });
    }
    
    next();
};

// Check if user is admin
app.get('/api/admin/check', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'];
        if (!userId) {
            return res.json({ success: true, isAdmin: false });
        }
        
        const users = await database.query('SELECT is_admin FROM users WHERE id = ?', [userId]);
        res.json({ success: true, isAdmin: users.length > 0 && users[0].is_admin === 1 });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get site settings (admin)

// ============================================
// PRODUCT IMAGE API ROUTES
// ============================================

// Multer setup for product images
const productImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../public/uploads/products'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, 'product-' + uniqueSuffix + ext);
    }
});

const productImageUpload = multer({
    storage: productImageStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPG, PNG, and WebP images are allowed'));
        }
    }
});

// Search for existing product image (public - only approved)
app.get('/api/product-images/search', async (req, res) => {
    try {
        const { product_type, set_name, product_name } = req.query;
        
        let query = `
            SELECT * FROM product_images 
            WHERE product_type = ? AND status = 'approved'
        `;
        const params = [product_type];
        
        if (set_name) {
            query += ' AND (set_name LIKE ? OR set_name IS NULL)';
            params.push(`%${set_name}%`);
        }
        
        if (product_name) {
            query += ' AND (product_name LIKE ? OR product_name IS NULL)';
            params.push(`%${product_name}%`);
        }
        
        query += ' ORDER BY is_default DESC, created_at DESC LIMIT 10';
        
        const images = await database.query(query, params);
        res.json({ success: true, images });
    } catch (error) {
        console.error('Search product images error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Upload product image (user - goes to pending)
app.post('/api/product-images/upload', productImageUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image uploaded' });
        }
        
        const { product_type, set_name, product_name, user_id } = req.body;
        const imagePath = '/uploads/products/' + req.file.filename;
        
        const result = await database.query(`
            INSERT INTO product_images (product_type, set_name, product_name, image_path, status, uploaded_by, created_by)
            VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `, [product_type, set_name || null, product_name || null, imagePath, user_id, user_id]);
        
        res.json({ 
            success: true, 
            imageId: result.insertId,
            imagePath: imagePath,
            status: 'pending',
            message: 'Image uploaded and pending admin review'
        });
    } catch (error) {
        console.error('Upload product image error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Upload product image (auto-approved)
app.post('/api/admin/product-images/upload', requireAdmin, productImageUpload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'No image uploaded' });
        }
        
        const { product_type, set_name, product_name, is_default } = req.body;
        const adminId = req.headers['x-user-id'];
        const imagePath = '/uploads/products/' + req.file.filename;
        
        // Check if an image already exists for this product
        const existing = await database.query(`
            SELECT id, image_path FROM product_images 
            WHERE product_type = ? AND product_name = ? AND (set_name = ? OR (set_name IS NULL AND ? IS NULL))
        `, [product_type, product_name, set_name || null, set_name || null]);
        
        let imageId;
        
        if (existing.length > 0) {
            // Delete old image file
            const oldPath = path.join(__dirname, '../public', existing[0].image_path);
            fs.unlink(oldPath, (err) => {
                if (err) console.error('Failed to delete old image:', err);
            });
            
            // Update existing record
            await database.query(`
                UPDATE product_images 
                SET image_path = ?, is_default = ?, reviewed_by = ?, reviewed_at = NOW()
                WHERE id = ?
            `, [imagePath, is_default ? 1 : 0, adminId, existing[0].id]);
            
            imageId = existing[0].id;
        } else {
            // Insert new record
            const result = await database.query(`
                INSERT INTO product_images (product_type, set_name, product_name, image_path, is_default, status, reviewed_by, reviewed_at, created_by)
                VALUES (?, ?, ?, ?, ?, 'approved', ?, NOW(), ?)
            `, [product_type, set_name || null, product_name || null, imagePath, is_default ? 1 : 0, adminId, adminId]);
            
            imageId = result.insertId;
        }
        
        res.json({
            success: true,
            imageId: imageId,
            imagePath: imagePath,
            status: 'approved',
            replaced: existing.length > 0
        });
    } catch (error) {
        console.error('Admin upload product image error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Get pending images for review
app.get('/api/admin/product-images/pending', requireAdmin, async (req, res) => {
    try {
        const images = await database.query(`
            SELECT pi.*, u.username as uploaded_by_name
            FROM product_images pi
            LEFT JOIN users u ON pi.uploaded_by = u.id
            WHERE pi.status = 'pending'
            ORDER BY pi.created_at ASC
        `);
        res.json({ success: true, images });
    } catch (error) {
        console.error('Get pending images error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Get all product images
app.get('/api/admin/product-images', requireAdmin, async (req, res) => {
    try {
        const { status, product_type } = req.query;
        
        let query = `
            SELECT pi.*, u.username as uploaded_by_name, r.username as reviewed_by_name
            FROM product_images pi
            LEFT JOIN users u ON pi.uploaded_by = u.id
            LEFT JOIN users r ON pi.reviewed_by = r.id
            WHERE 1=1
        `;
        const params = [];
        
        if (status && status !== 'all') {
            query += ' AND pi.status = ?';
            params.push(status);
        }
        
        if (product_type && product_type !== 'all') {
            query += ' AND pi.product_type = ?';
            params.push(product_type);
        }
        
        query += ' ORDER BY pi.created_at DESC';
        
        const images = await database.query(query, params);
        res.json({ success: true, images });
    } catch (error) {
        console.error('Get all product images error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Review product image (approve/reject)
app.post('/api/admin/product-images/:imageId/review', requireAdmin, async (req, res) => {
    try {
        const { imageId } = req.params;
        const { status } = req.body;
        const adminId = req.headers['x-user-id'];
        
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ success: false, error: 'Invalid status' });
        }
        
        await database.query(`
            UPDATE product_images 
            SET status = ?, reviewed_by = ?, reviewed_at = NOW()
            WHERE id = ?
        `, [status, adminId, imageId]);
        
        if (status === 'rejected') {
            const image = await database.query('SELECT image_path FROM product_images WHERE id = ?', [imageId]);
            if (image.length > 0) {
                const filePath = path.join(__dirname, '../public', image[0].image_path);
                fs.unlink(filePath, (err) => {
                    if (err) console.error('Failed to delete rejected image:', err);
                });
            }
            await database.query('DELETE FROM product_images WHERE id = ?', [imageId]);
        }
        
        res.json({ success: true, status });
    } catch (error) {
        console.error('Review product image error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Delete product image
app.delete('/api/admin/product-images/:imageId', requireAdmin, async (req, res) => {
    try {
        const { imageId } = req.params;
        
        const image = await database.query('SELECT image_path FROM product_images WHERE id = ?', [imageId]);
        if (image.length > 0) {
            const filePath = path.join(__dirname, '../public', image[0].image_path);
            fs.unlink(filePath, (err) => {
                if (err) console.error('Failed to delete image file:', err);
            });
        }
        
        await database.query('DELETE FROM product_images WHERE id = ?', [imageId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete product image error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin: Update product image details
app.put('/api/admin/product-images/:imageId', requireAdmin, async (req, res) => {
    try {
        const { imageId } = req.params;
        const { product_type, set_name, product_name, is_default } = req.body;
        
        await database.query(`
            UPDATE product_images 
            SET product_type = ?, set_name = ?, product_name = ?, is_default = ?
            WHERE id = ?
        `, [product_type, set_name || null, product_name || null, is_default ? 1 : 0, imageId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Update product image error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const settings = await database.query('SELECT * FROM site_settings');
        const settingsObj = {};
        settings.forEach(s => {
            try {
                settingsObj[s.setting_key] = JSON.parse(s.setting_value);
            } catch {
                settingsObj[s.setting_key] = s.setting_value;
            }
        });
        res.json({ success: true, settings: settingsObj });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Update site setting
app.post('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
        const { key, value } = req.body;
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : value;
        
        await database.query(`
            INSERT INTO site_settings (setting_key, setting_value) 
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_at = NOW()
        `, [key, valueStr]);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get public site settings (for frontend)
app.get('/api/admin/settings/public', async (req, res) => {
    try {
        const settings = await database.query(
            'SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?, ?)',
            ['home_floating_cards', 'trade_floating_cards']
        );
        
        const settingsObj = {};
        settings.forEach(s => {
            try {
                settingsObj[s.setting_key] = JSON.parse(s.setting_value);
            } catch {
                settingsObj[s.setting_key] = s.setting_value;
            }
        });
        
        res.json({ success: true, settings: settingsObj });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all reviews (admin)
app.get('/api/admin/reviews', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 20, search } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = 'tr.is_deleted = 0';
        const params = [];
        
        if (search) {
            whereClause += ' AND (tr.comment LIKE ? OR from_user.username LIKE ? OR to_user.username LIKE ?)';
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        
        const reviews = await database.query(`
            SELECT 
                tr.*,
                from_user.username as from_username,
                from_user.profile_picture as from_profile_picture,
                to_user.username as to_username,
                to_user.profile_picture as to_profile_picture
            FROM trade_ratings tr
            JOIN users from_user ON tr.from_user_id = from_user.id
            JOIN users to_user ON tr.to_user_id = to_user.id
            WHERE ${whereClause}
            ORDER BY tr.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);
        
        const countResult = await database.query(`
            SELECT COUNT(*) as total 
            FROM trade_ratings tr
            JOIN users from_user ON tr.from_user_id = from_user.id
            JOIN users to_user ON tr.to_user_id = to_user.id
            WHERE ${whereClause}
        `, params);
        
        res.json({ 
            success: true, 
            reviews,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: countResult[0]?.total || 0,
                totalPages: Math.ceil((countResult[0]?.total || 0) / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Hide/show review
app.post('/api/admin/reviews/:id/visibility', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { hidden } = req.body;
        await database.query('UPDATE trade_ratings SET is_hidden = ? WHERE id = ?', [hidden ? 1 : 0, id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete review
app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        await database.query('UPDATE trade_ratings SET is_deleted = 1, deleted_at = NOW() WHERE id = ?', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get all users (admin)
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { page = 1, limit = 50, search } = req.query;
        const offset = (page - 1) * limit;
        
        let whereClause = '1=1';
        const params = [];
        
        if (search) {
            whereClause += ' AND (username LIKE ? OR email LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        const users = await database.query(`
            SELECT 
                id, username, email, is_admin, is_suspended, trades_count, rating, 
                created_at, profile_picture,
                (SELECT COUNT(*) FROM trade_ratings WHERE to_user_id = users.id) as ratings_count
            FROM users
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, parseInt(limit), parseInt(offset)]);
        
        res.json({ success: true, users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle admin status
app.post('/api/admin/users/:id/admin', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isAdmin } = req.body;
        await database.query('UPDATE users SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Suspend/unsuspend user
app.post('/api/admin/users/:id/suspend', requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { suspended } = req.body;
        await database.query('UPDATE users SET is_suspended = ? WHERE id = ?', [suspended ? 1 : 0, id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Add a new card to a set
app.post('/api/admin/cards', requireAdmin, async (req, res) => {
    try {
        const { setId, name, number, rarity, supertype, subtypes, hp, types, imageSmall, imageLarge } = req.body;
        
        if (!setId || !name || !number) {
            return res.status(400).json({ success: false, error: 'setId, name, and number are required' });
        }
        
        // Generate card ID
        const cardId = `${setId}-${number}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
        
        // Check if card already exists
        const existing = await database.query('SELECT id FROM cards WHERE id = ?', [cardId]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Card with this ID already exists' });
        }
        
        // Get set info
        const sets = await database.query('SELECT * FROM sets WHERE id = ?', [setId]);
        if (sets.length === 0) {
            return res.status(400).json({ success: false, error: 'Set not found' });
        }
        const set = sets[0];
        
        // Build card data JSON
        const cardData = {
            id: cardId,
            name,
            supertype: supertype || 'Pokémon',
            subtypes: subtypes ? subtypes.split(',').map(s => s.trim()) : [],
            hp: hp || null,
            types: types ? types.split(',').map(t => t.trim()) : [],
            number,
            rarity: rarity || 'Common',
            set: {
                id: setId,
                name: set.name,
                series: set.series
            },
            images: {
                small: imageSmall || null,
                large: imageLarge || null
            }
        };
        
        await database.query(`
            INSERT INTO cards (id, setId, name, number, rarity, supertype, imageSmall, imageLarge, data)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [cardId, setId, name, number, rarity || 'Common', supertype || 'Pokémon', 
            imageSmall || null, imageLarge || null, JSON.stringify(cardData)]);
        
        res.json({ success: true, cardId });
    } catch (error) {
        console.error('Add card error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Delete a card
app.delete('/api/admin/cards/:cardId', requireAdmin, async (req, res) => {
    try {
        const { cardId } = req.params;
        
        // Check if card is used in any listings
        const listings = await database.query('SELECT COUNT(*) as count FROM user_listings WHERE card_id = ?', [cardId]);
        if (listings[0].count > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot delete: card is used in ${listings[0].count} listing(s)` 
            });
        }
        
        // Check if card is in any collections
        const owned = await database.query('SELECT COUNT(*) as count FROM user_owned_cards WHERE card_id = ?', [cardId]);
        if (owned[0].count > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Cannot delete: card is in ${owned[0].count} collection(s)` 
            });
        }
        
        await database.query('DELETE FROM cards WHERE id = ?', [cardId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use(express.static(path.join(__dirname, '../public')));

async function start() {
    await database.initDatabase();
    await initAdminTables();
    const stats = await database.getStats();
    console.log(`Database: ${stats.sets} sets, ${stats.cards} cards`);
    
    const HTTP_PORT = 8081;
    const HTTPS_PORT = 8443;
    
    // Start HTTP server
    http.createServer(app).listen(HTTP_PORT, '0.0.0.0', () => {
        console.log(`HTTP server running at http://0.0.0.0:${HTTP_PORT}`);
    });
    
    // Start HTTPS server if certificates exist
    const sslPath = path.join(__dirname, '../ssl');
    const keyPath = path.join(sslPath, 'key.pem');
    const certPath = path.join(sslPath, 'cert.pem');
    
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        const sslOptions = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };
        
        https.createServer(sslOptions, app).listen(HTTPS_PORT, '0.0.0.0', () => {
            console.log(`HTTPS server running at https://0.0.0.0:${HTTPS_PORT}`);
        });
    } else {
        console.log('SSL certificates not found, HTTPS server not started');
    }
}

start().catch(console.error);
