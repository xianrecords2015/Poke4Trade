/**
 * Pokemon API Routes
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');

// Get all sets
router.get('/sets', async (req, res) => {
    try {
        const sets = await db.getSets();
        res.json({ data: sets, totalCount: sets.length });
    } catch (error) {
        console.error('Error getting sets:', error);
        res.status(500).json({ error: error.message, data: [] });
    }
});

// Get cards (search by set or name)
router.get('/cards', async (req, res) => {
    try {
        const setMatch = req.query.q?.match(/set\.id:(\w+)/);
        const nameMatch = req.query.q?.match(/name:([^*]+)/);
        const page = parseInt(req.query.page) || 1;
        const pageSize = parseInt(req.query.pageSize) || 20;
        
        if (setMatch) {
            const result = await db.getCardsForSet(setMatch[1], page, pageSize);
            res.json({ data: result.cards, totalCount: result.totalCount, page, pageSize });
        } else if (nameMatch) {
            const result = await db.searchCards(nameMatch[1], page, pageSize);
            res.json({ data: result.cards, totalCount: result.totalCount, page, pageSize });
        } else {
            res.json({ data: [], totalCount: 0 });
        }
    } catch (error) {
        console.error('Error getting cards:', error);
        res.status(500).json({ error: error.message, data: [] });
    }
});

module.exports = router;
