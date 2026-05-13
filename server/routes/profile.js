/**
 * Profile Routes
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('../config/database');

// Configure multer for profile picture uploads
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../../uploads/profiles');
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
    limits: { fileSize: 5 * 1024 * 1024 },
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

// Get profile
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const users = await db.query(
            `SELECT id, username, email, first_name, last_name, phone, 
                    address1, address2, city, state, postal_code, country,
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

// Update profile
router.put('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { first_name, last_name, phone, address1, address2, city, state, postal_code, country } = req.body;
        
        await db.query(
            `UPDATE users SET 
                first_name = ?, last_name = ?, phone = ?,
                address1 = ?, address2 = ?, city = ?, 
                state = ?, postal_code = ?, country = ?
             WHERE id = ?`,
            [first_name, last_name, phone, address1, address2, city, state, postal_code, country, userId]
        );
        
        const users = await db.query(
            `SELECT id, username, email, first_name, last_name, phone, 
                    address1, address2, city, state, postal_code, country,
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

// Upload profile picture
router.post('/:userId/picture', profileUpload.single('picture'), async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const picturePath = `/uploads/profiles/${req.file.filename}`;
        
        const users = await db.query('SELECT profile_picture FROM users WHERE id = ?', [userId]);
        if (users.length > 0 && users[0].profile_picture) {
            const oldPath = path.join(__dirname, '../..', users[0].profile_picture);
            if (oldPath !== path.join(__dirname, '../..', picturePath) && fs.existsSync(oldPath)) {
                fs.unlinkSync(oldPath);
            }
        }
        
        await db.query('UPDATE users SET profile_picture = ? WHERE id = ?', [picturePath, userId]);
        
        res.json({ success: true, picture: picturePath });
    } catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete profile picture
router.delete('/:userId/picture', async (req, res) => {
    try {
        const { userId } = req.params;
        
        const users = await db.query('SELECT profile_picture FROM users WHERE id = ?', [userId]);
        if (users.length > 0 && users[0].profile_picture) {
            const picPath = path.join(__dirname, '../..', users[0].profile_picture);
            if (fs.existsSync(picPath)) {
                fs.unlinkSync(picPath);
            }
        }
        
        await db.query('UPDATE users SET profile_picture = NULL WHERE id = ?', [userId]);
        
        res.json({ success: true });
    } catch (error) {
        console.error('Delete profile picture error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
