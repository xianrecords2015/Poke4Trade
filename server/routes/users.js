/**
 * Users Routes (public user info, ratings)
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get user ratings
router.get('/:userId/ratings', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const ratings = await db.query(`
            SELECT tr.*, u.username as from_username, u.profile_picture as from_picture
            FROM trade_ratings tr
            JOIN users u ON tr.from_user_id = u.id
            WHERE tr.to_user_id = ?
            ORDER BY tr.created_at DESC
            LIMIT 50
        `, [userId]);
        
        const stats = await db.query(`
            SELECT 
                COUNT(*) as total_ratings,
                AVG(overall_rating) as avg_overall,
                AVG(communication_rating) as avg_communication,
                AVG(shipping_rating) as avg_shipping,
                AVG(card_condition_rating) as avg_condition
            FROM trade_ratings WHERE to_user_id = ?
        `, [userId]);
        
        res.json({ success: true, data: { ratings, stats: stats[0] } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
