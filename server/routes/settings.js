/**
 * Settings Routes
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get user settings
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let settings = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        
        if (settings.length === 0) {
            await db.query('INSERT INTO user_settings (user_id) VALUES (?)', [userId]);
            settings = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        }
        
        res.json({ success: true, settings: settings[0] });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update user settings
router.put('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { default_language, default_condition, default_version, default_edition, pricing_method, pricing_value } = req.body;
        
        await db.query(`
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
        
        const settings = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        res.json({ success: true, settings: settings[0] });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
