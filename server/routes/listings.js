/**
 * Listings Routes (My Cards)
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { extractTcgPrice, calculateAdjustedPrice } = require('../utils/helpers');

// Get user listings
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { status } = req.query;
        
        let userSettings = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
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
        
        query += ' ORDER BY l.created_at DESC';
        
        const listings = await db.query(query, params);
        
        for (let listing of listings) {
            listing.images = { small: listing.imageSmall, large: listing.imageLarge };
            listing.tcgPrice = extractTcgPrice(listing.card_data);
            
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

// Create listing
router.post('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { card_id, set_id, listing_type, price, language, condition_grade, version, edition, quantity, notes } = req.body;
        
        const result = await db.query(`
            INSERT INTO user_listings 
            (user_id, card_id, set_id, listing_type, price, language, condition_grade, version, edition, quantity, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [userId, card_id, set_id, listing_type || 'both', price, language || 'English', 
            condition_grade || 'Mint', version || 'Non-Holo', edition || '2nd', quantity || 1, notes]);
        
        res.json({ success: true, listingId: result.insertId });
    } catch (error) {
        console.error('Add listing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update listing
router.put('/:userId/:listingId', async (req, res) => {
    try {
        const { userId, listingId } = req.params;
        const { listing_type, price, language, condition_grade, version, edition, quantity, notes, status, price_override } = req.body;
        
        await db.query(`
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

// Delete listing
router.delete('/:userId/:listingId', async (req, res) => {
    try {
        const { userId, listingId } = req.params;
        await db.query('DELETE FROM user_listings WHERE id = ? AND user_id = ?', [listingId, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete listing error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
