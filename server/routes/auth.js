/**
 * Authentication Routes
 */
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { hashPassword } = require('../utils/helpers');

// Check username availability
router.get('/check-username/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const users = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        res.json({ exists: users.length > 0 });
    } catch (error) {
        console.error('Check username error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Check email availability
router.get('/check-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const users = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        res.json({ exists: users.length > 0 });
    } catch (error) {
        console.error('Check email error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
            return res.status(400).json({ error: 'All fields required' });
        }
        
        const existingUsername = await db.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsername.length > 0) {
            return res.status(400).json({ error: 'Username already taken' });
        }
        
        const existingEmail = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingEmail.length > 0) {
            return res.status(400).json({ error: 'Email already registered' });
        }
        
        const passwordHash = hashPassword(password);
        const result = await db.query(
            'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
            [username, email, passwordHash]
        );
        
        await db.query('INSERT INTO user_settings (user_id) VALUES (?)', [result.insertId]);
        
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

// Login
router.post('/login', async (req, res) => {
    try {
        const { login, password } = req.body;
        const passwordHash = hashPassword(password);
        const isEmail = login.includes('@');
        
        let users;
        if (isEmail) {
            users = await db.query(
                'SELECT id, username, email, trades_count, rating, created_at, profile_picture, (SELECT COUNT(*) FROM trade_ratings WHERE to_user_id = users.id) as ratings_count FROM users WHERE email = ? AND password_hash = ?',
                [login, passwordHash]
            );
        } else {
            users = await db.query(
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

module.exports = router;
