/**
 * Trading Routes
 * Complete trading functionality
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { getCardMarketPrice, sendTradeEmail } = require('../utils/helpers');

// Get cards user wants
router.get('/my-wants/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const wants = await db.query(\`
            SELECT c.id, c.name, c.number, c.setId, c.imageSmall, c.data, s.name as set_name
            FROM cards c
            JOIN user_collections uc ON c.setId = uc.set_id AND uc.user_id = ?
            JOIN sets s ON c.setId = s.id
            LEFT JOIN user_owned_cards uoc ON c.id = uoc.card_id AND uoc.user_id = ?
            WHERE uoc.id IS NULL
            ORDER BY s.releaseDate DESC, CAST(c.number AS UNSIGNED)
        \`, [userId, userId]);
        
        const wantsWithPrices = wants.map(card => ({
            ...card, price: getCardMarketPrice(card.data), data: undefined
        }));
        res.json({ success: true, data: wantsWithPrices });
    } catch (error) {
        console.error('Error getting wants:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get cards user has for trade
router.get('/my-haves/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const haves = await db.query(\`
            SELECT ul.*, c.name, c.number, c.imageSmall, c.data, s.name as set_name
            FROM user_listings ul
            JOIN cards c ON ul.card_id = c.id
            JOIN sets s ON ul.set_id = s.id
            WHERE ul.user_id = ? AND ul.status = 'active' AND ul.listing_type IN ('trade', 'both')
            ORDER BY s.releaseDate DESC, CAST(c.number AS UNSIGNED)
        \`, [userId]);
        
        const havesWithPrices = haves.map(card => ({
            ...card, market_price: getCardMarketPrice(card.data, card.version), data: undefined
        }));
        res.json({ success: true, data: havesWithPrices });
    } catch (error) {
        console.error('Error getting haves:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Respond to trade (accept/decline)
router.post('/respond/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, action } = req.body;
        
        if (!['accepted', 'declined'].includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid action' });
        }
        
        const tradeResult = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (tradeResult.length === 0) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        const trade = tradeResult[0];
        
        if (trade.to_user_id !== parseInt(userId)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        if (trade.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Trade already processed' });
        }
        
        await db.query('UPDATE trade_requests SET status = ? WHERE id = ?', [action, tradeId]);
        
        const fromUserResult = await db.query('SELECT username, email, email_notifications FROM users WHERE id = ?', [trade.from_user_id]);
        const toUserResult = await db.query('SELECT username FROM users WHERE id = ?', [trade.to_user_id]);
        const fromUser = fromUserResult[0];
        const toUser = toUserResult[0];
        
        const notifType = action === 'accepted' ? 'trade_accepted' : 'trade_declined';
        const notifTitle = action === 'accepted' 
            ? `${toUser.username} accepted your trade!`
            : `${toUser.username} declined your trade`;
        
        await db.query(`
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
        
        if (fromUser.email && fromUser.email_notifications !== 0) {
            const emoji = action === 'accepted' ? '✅' : '❌';
            const color = action === 'accepted' ? '#7CB518' : '#CC0000';
            
            const emailHtml = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                    <h2 style="color:${color};">${emoji} Trade ${action === 'accepted' ? 'Accepted' : 'Declined'}</h2>
                    <p><strong>${toUser.username}</strong> has ${action} your trade proposal.</p>
                    ${action === 'accepted' ? `
                        <p>Great news! You can now arrange the exchange with ${toUser.username}.</p>
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

// Cancel trade
router.post('/cancel/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.body;
        
        const tradeResult = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (tradeResult.length === 0) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        const trade = tradeResult[0];
        
        if (trade.from_user_id !== parseInt(userId)) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        if (trade.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'Trade already processed' });
        }
        
        await db.query('UPDATE trade_requests SET status = "cancelled" WHERE id = ?', [tradeId]);
        
        const fromUserResult = await db.query('SELECT username FROM users WHERE id = ?', [trade.from_user_id]);
        
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'trade_cancelled', ?, ?, ?, ?)
        `, [
            trade.to_user_id,
            `Trade cancelled by ${fromUserResult[0].username}`,
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

// Get trade messages
router.get('/messages/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.query;
        
        const tradeResult = await db.query(
            'SELECT * FROM trade_requests WHERE id = ? AND (from_user_id = ? OR to_user_id = ?)',
            [tradeId, userId, userId]
        );
        
        if (tradeResult.length === 0) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        await db.query(
            'UPDATE trade_messages SET is_read = TRUE WHERE trade_id = ? AND user_id != ?',
            [tradeId, userId]
        );
        
        const messages = await db.query(`
            SELECT tm.*, u.username, u.profile_picture
            FROM trade_messages tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.trade_id = ?
            ORDER BY tm.created_at ASC
        `, [tradeId]);
        
        res.json({ success: true, data: messages });
    } catch (error) {
        console.error('Error getting messages:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Send trade message
router.post('/messages/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, message } = req.body;
        
        const tradeResult = await db.query(
            'SELECT * FROM trade_requests WHERE id = ? AND (from_user_id = ? OR to_user_id = ?)',
            [tradeId, userId, userId]
        );
        
        if (tradeResult.length === 0) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        const trade = tradeResult[0];
        
        const result = await db.query(`
            INSERT INTO trade_messages (trade_id, user_id, message)
            VALUES (?, ?, ?)
        `, [tradeId, userId, message]);
        
        const senderResult = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        const sender = senderResult[0];
        
        const otherUserId = trade.from_user_id === parseInt(userId) ? trade.to_user_id : trade.from_user_id;
        
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'trade_message', ?, ?, ?, ?)
        `, [
            otherUserId,
            `New message from ${sender.username}`,
            message.substring(0, 100) + (message.length > 100 ? '...' : ''),
            '/my-trades',
            tradeId
        ]);
        
        const newMessage = await db.query(`
            SELECT tm.*, u.username, u.profile_picture
            FROM trade_messages tm
            JOIN users u ON tm.user_id = u.id
            WHERE tm.id = ?
        `, [result.insertId]);
        
        res.json({ success: true, data: newMessage[0] });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mark cards as shipped
router.post('/ship/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, tracking, removeFromListings } = req.body;
        
        const tradeResult = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (tradeResult.length === 0) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        const trade = tradeResult[0];
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        const isToUser = trade.to_user_id === parseInt(userId);
        
        if (!isFromUser && !isToUser) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        if (trade.status !== 'accepted' && trade.status !== 'shipping') {
            return res.status(400).json({ success: false, error: 'Trade must be accepted first' });
        }
        
        if (isFromUser) {
            await db.query(
                'UPDATE trade_requests SET from_user_shipped = 1, from_tracking = ?, status = "shipping" WHERE id = ?',
                [tracking || null, tradeId]
            );
        } else {
            await db.query(
                'UPDATE trade_requests SET to_user_shipped = 1, to_tracking = ?, status = "shipping" WHERE id = ?',
                [tracking || null, tradeId]
            );
        }
        
        if (removeFromListings) {
            const direction = isFromUser ? 'give' : 'get';
            const cards = await db.query(
                'SELECT listing_id FROM trade_request_cards WHERE trade_request_id = ? AND direction = ?',
                [tradeId, direction]
            );
            for (const card of cards) {
                if (card.listing_id) {
                    await db.query(
                        'UPDATE user_listings SET status = "traded" WHERE id = ?',
                        [card.listing_id]
                    );
                }
            }
        }
        
        const shipperResult = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        const otherUserId = isFromUser ? trade.to_user_id : trade.from_user_id;
        
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'trade_shipped', ?, ?, ?, ?)
        `, [
            otherUserId,
            `${shipperResult[0].username} shipped their cards!`,
            tracking ? `Tracking: ${tracking}` : 'Cards are on the way!',
            '/my-trades',
            tradeId
        ]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error marking shipped:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Undo ship
router.post('/unship/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.body;
        
        const tradeResult = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (tradeResult.length === 0) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        const trade = tradeResult[0];
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        
        if (isFromUser) {
            await db.query('UPDATE trade_requests SET from_user_shipped = 0, from_tracking = NULL WHERE id = ?', [tradeId]);
        } else {
            await db.query('UPDATE trade_requests SET to_user_shipped = 0, to_tracking = NULL WHERE id = ?', [tradeId]);
        }
        
        const updated = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (!updated[0].from_user_shipped && !updated[0].to_user_shipped) {
            await db.query('UPDATE trade_requests SET status = "accepted" WHERE id = ?', [tradeId]);
        }
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error undoing ship:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Confirm receipt
router.post('/receive/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, addToCollection } = req.body;
        
        const tradeResult = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (tradeResult.length === 0) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        const trade = tradeResult[0];
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        const isToUser = trade.to_user_id === parseInt(userId);
        
        if (!isFromUser && !isToUser) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        if (isFromUser) {
            await db.query('UPDATE trade_requests SET from_user_received = 1 WHERE id = ?', [tradeId]);
        } else {
            await db.query('UPDATE trade_requests SET to_user_received = 1 WHERE id = ?', [tradeId]);
        }
        
        const updated = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (updated[0].from_user_received && updated[0].to_user_received) {
            await db.query('UPDATE trade_requests SET status = "completed" WHERE id = ?', [tradeId]);
            
            await db.query('UPDATE users SET trades_count = trades_count + 1 WHERE id IN (?, ?)', 
                [trade.from_user_id, trade.to_user_id]);
        }
        
        if (addToCollection) {
            const direction = isFromUser ? 'get' : 'give';
            const cards = await db.query(
                'SELECT card_id FROM trade_request_cards WHERE trade_request_id = ? AND direction = ?',
                [tradeId, direction]
            );
            
            for (const card of cards) {
                const cardInfo = await db.query('SELECT setId FROM cards WHERE id = ?', [card.card_id]);
                if (cardInfo.length > 0) {
                    await db.query(`
                        INSERT IGNORE INTO user_owned_cards (user_id, card_id, set_id)
                        VALUES (?, ?, ?)
                    `, [userId, card.card_id, cardInfo[0].setId]);
                }
            }
        }
        
        res.json({ success: true, completed: updated[0].from_user_received && updated[0].to_user_received });
    } catch (error) {
        console.error('Error confirming receipt:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get full trade details
router.get('/full/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId } = req.query;
        
        const tradeResult = await db.query(`
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
        
        if (tradeResult.length === 0) {
            return res.status(404).json({ success: false, error: 'Trade not found' });
        }
        const trade = tradeResult[0];
        
        const showAddresses = ['accepted', 'shipping', 'delivered', 'completed'].includes(trade.status);
        
        if (!showAddresses) {
            delete trade.from_address1; delete trade.from_address2; delete trade.from_city;
            delete trade.from_state; delete trade.from_postal; delete trade.from_country;
            delete trade.to_address1; delete trade.to_address2; delete trade.to_city;
            delete trade.to_state; delete trade.to_postal; delete trade.to_country;
        }
        
        const cards = await db.query(`
            SELECT trc.*, c.number as card_number, c.setId as set_id, s.name as set_name, c.data as card_data
            FROM trade_request_cards trc
            LEFT JOIN cards c ON trc.card_id = c.id
            LEFT JOIN sets s ON c.setId = s.id
            WHERE trc.trade_request_id = ?
        `, [tradeId]);
        
        const userRating = await db.query(
            'SELECT * FROM trade_ratings WHERE trade_id = ? AND from_user_id = ?',
            [tradeId, userId]
        );
        
        res.json({ 
            success: true, 
            data: { 
                trade, 
                cards,
                hasRated: userRating.length > 0,
                userRating: userRating[0] || null
            } 
        });
    } catch (error) {
        console.error('Error getting full trade:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Submit rating
router.post('/rate/:tradeId', async (req, res) => {
    try {
        const { tradeId } = req.params;
        const { userId, overallRating, communicationRating, shippingRating, cardConditionRating, comment } = req.body;
        
        if (!overallRating || overallRating < 1 || overallRating > 5) {
            return res.status(400).json({ success: false, error: 'Invalid rating' });
        }
        
        const tradeResult = await db.query('SELECT * FROM trade_requests WHERE id = ?', [tradeId]);
        if (tradeResult.length === 0 || tradeResult[0].status !== 'completed') {
            return res.status(400).json({ success: false, error: 'Can only rate completed trades' });
        }
        const trade = tradeResult[0];
        
        const isFromUser = trade.from_user_id === parseInt(userId);
        const isToUser = trade.to_user_id === parseInt(userId);
        
        if (!isFromUser && !isToUser) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }
        
        const toUserId = isFromUser ? trade.to_user_id : trade.from_user_id;
        
        const existing = await db.query(
            'SELECT id FROM trade_ratings WHERE trade_id = ? AND from_user_id = ?',
            [tradeId, userId]
        );
        
        if (existing.length > 0) {
            return res.status(400).json({ success: false, error: 'Already rated this trade' });
        }
        
        await db.query(`
            INSERT INTO trade_ratings (trade_id, from_user_id, to_user_id, overall_rating, communication_rating, shipping_rating, card_condition_rating, comment)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [tradeId, userId, toUserId, overallRating, communicationRating || null, shippingRating || null, cardConditionRating || null, comment || null]);
        
        const avgResult = await db.query(
            'SELECT AVG(overall_rating) as avg_rating FROM trade_ratings WHERE to_user_id = ?',
            [toUserId]
        );
        
        await db.query(
            'UPDATE users SET rating = ? WHERE id = ?',
            [avgResult[0].avg_rating || 5.0, toUserId]
        );
        
        const raterResult = await db.query('SELECT username FROM users WHERE id = ?', [userId]);
        
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link, related_id)
            VALUES (?, 'system', ?, ?, ?, ?)
        `, [
            toUserId,
            `${raterResult[0].username} left you a rating`,
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

module.exports = router;
