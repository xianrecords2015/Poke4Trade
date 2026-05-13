/**
 * Collection Routes
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { extractTcgPrice } = require('../utils/helpers');

// Get user collections
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const collections = await db.query(`
            SELECT 
                uc.set_id, uc.added_at, s.name, s.series, s.total, 
                s.releaseDate, s.logoImage, s.symbolImage
            FROM user_collections uc
            JOIN sets s ON uc.set_id = s.id
            WHERE uc.user_id = ?
            ORDER BY s.releaseDate DESC
        `, [userId]);
        
        for (let col of collections) {
            const owned = await db.query(
                'SELECT COUNT(DISTINCT card_id) as count FROM user_owned_cards WHERE user_id = ? AND set_id = ?',
                [userId, col.set_id]
            );
            col.owned_count = owned[0].count;
            col.missing_count = col.total - col.owned_count;
            
            const allCards = await db.query('SELECT data FROM cards WHERE setId = ?', [col.set_id]);
            let completeSetValue = 0;
            for (const card of allCards) {
                const price = extractTcgPrice(card.data);
                if (price) completeSetValue += price;
            }
            col.complete_set_value = Math.round(completeSetValue * 100) / 100;
            
            const ownedCards = await db.query(
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

// Add set to collection
router.post('/:userId/add-set', async (req, res) => {
    try {
        const { userId } = req.params;
        const { setId } = req.body;
        
        let settings = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        if (settings.length === 0) {
            settings = [{ default_language: 'English', default_condition: 'Mint', default_version: 'Non-Holo', default_edition: '2nd' }];
        }
        const defaults = settings[0];
        
        await db.query('INSERT IGNORE INTO user_collections (user_id, set_id) VALUES (?, ?)', [userId, setId]);
        const cards = await db.query('SELECT id FROM cards WHERE setId = ?', [setId]);
        for (const card of cards) {
            await db.query(`
                INSERT IGNORE INTO user_owned_cards 
                (user_id, card_id, set_id, language, condition_grade, version, edition, quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `, [userId, card.id, setId, defaults.default_language, defaults.default_condition, defaults.default_version, defaults.default_edition]);
        }
        res.json({ success: true, cardsAdded: cards.length });
    } catch (error) {
        console.error('Add set error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Remove set from collection
router.delete('/:userId/remove-set/:setId', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        await db.query('DELETE FROM user_collections WHERE user_id = ? AND set_id = ?', [userId, setId]);
        await db.query('DELETE FROM user_owned_cards WHERE user_id = ? AND set_id = ?', [userId, setId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Remove set error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get cards in collection set
router.get('/:userId/set/:setId/cards', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        const cards = await db.query(`
            SELECT c.id, c.name, c.number, c.rarity, c.types, c.supertype,
                   c.setId as set_id, c.imageSmall, c.imageLarge, c.data
            FROM cards c
            WHERE c.setId = ?
            ORDER BY CAST(c.number AS UNSIGNED), c.number
        `, [setId]);
        
        const ownedCards = await db.query(`
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

// Own a card
router.post('/:userId/own-card', async (req, res) => {
    try {
        const { userId } = req.params;
        const { cardId, setId, language, condition, version, edition, quantity } = req.body;
        await db.query(`
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

// Unown a card
router.delete('/:userId/unown-card/:cardId', async (req, res) => {
    try {
        const { userId, cardId } = req.params;
        await db.query('DELETE FROM user_owned_cards WHERE user_id = ? AND card_id = ?', [userId, cardId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Unown card error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unown all cards in set
router.delete('/:userId/unown-set/:setId', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        await db.query('DELETE FROM user_owned_cards WHERE user_id = ? AND set_id = ?', [userId, setId]);
        res.json({ success: true });
    } catch (error) {
        console.error('Unown set error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Own all cards in set
router.post('/:userId/own-set/:setId', async (req, res) => {
    try {
        const { userId, setId } = req.params;
        
        let settings = await db.query('SELECT * FROM user_settings WHERE user_id = ?', [userId]);
        if (settings.length === 0) {
            settings = [{ default_language: 'English', default_condition: 'Mint', default_version: 'Non-Holo', default_edition: '2nd' }];
        }
        const defaults = settings[0];
        
        const cards = await db.query('SELECT id FROM cards WHERE setId = ?', [setId]);
        for (const card of cards) {
            await db.query(`
                INSERT IGNORE INTO user_owned_cards 
                (user_id, card_id, set_id, language, condition_grade, version, edition, quantity)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `, [userId, card.id, setId, defaults.default_language, defaults.default_condition, defaults.default_version, defaults.default_edition]);
        }
        res.json({ success: true, cardsAdded: cards.length });
    } catch (error) {
        console.error('Own set error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get collection stats
router.get('/:userId/stats', async (req, res) => {
    try {
        const { userId } = req.params;
        const stats = await db.query(`
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
        
        const ownedCards = await db.query(
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

module.exports = router;
