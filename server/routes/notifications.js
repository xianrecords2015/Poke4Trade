/**
 * Notifications Routes
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get user notifications
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { unreadOnly } = req.query;
        
        let query = 'SELECT * FROM notifications WHERE user_id = ?';
        if (unreadOnly === 'true') {
            query += ' AND is_read = FALSE';
        }
        query += ' ORDER BY created_at DESC LIMIT 50';
        
        const notifications = await db.query(query, [userId]);
        const unreadCount = await db.query(
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
router.post('/read/:notifId', async (req, res) => {
    try {
        const { notifId } = req.params;
        await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [notifId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark all notifications as read
router.post('/read-all/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        await db.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [userId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
