/**
 * Marketplace Routes
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { extractTcgPrice } = require('../utils/helpers');

// Get marketplace listings
router.get('/', async (req, res) => {
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
        
        const listings = await db.query(query, params);
        
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
        
        const countResult = await db.query(countQuery);
        
        res.json({ success: true, listings, total: countResult[0].total });
    } catch (error) {
        console.error('Get marketplace error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
