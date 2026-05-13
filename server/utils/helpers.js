/**
 * Utility Helpers
 */
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Password hashing
const hashPassword = (password) => {
    return crypto.createHash('sha256').update(password).digest('hex');
};

// Extract TCG price from card data
const extractTcgPrice = (dataJson) => {
    try {
        const data = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
        if (data?.tcgplayer?.prices) {
            const prices = data.tcgplayer.prices;
            const priceTypes = ['holofoil', 'reverseHolofoil', 'normal', '1stEditionHolofoil', '1stEditionNormal'];
            for (const type of priceTypes) {
                if (prices[type]?.market) {
                    return prices[type].market;
                }
            }
            for (const type of Object.keys(prices)) {
                if (prices[type]?.market) {
                    return prices[type].market;
                }
            }
        }
        return null;
    } catch (e) {
        return null;
    }
};

// Get card market price with version support
const getCardMarketPrice = (cardData, version = 'normal') => {
    try {
        const data = typeof cardData === 'string' ? JSON.parse(cardData) : cardData;
        const prices = data?.tcgplayer?.prices;
        if (!prices) return null;
        
        const versionMap = {
            'Non-Holo': 'normal',
            'Holo': 'holofoil',
            'Reverse': 'reverseHolofoil',
            'Pokeball': 'normal',
            'Masterball': 'normal',
            'Holographic Staff': 'holofoil'
        };
        
        const priceType = versionMap[version] || 'normal';
        
        if (prices[priceType]?.market) return prices[priceType].market;
        if (prices.normal?.market) return prices.normal.market;
        if (prices.holofoil?.market) return prices.holofoil.market;
        if (prices.reverseHolofoil?.market) return prices.reverseHolofoil.market;
        
        for (const type of Object.keys(prices)) {
            if (prices[type]?.market) return prices[type].market;
        }
        return null;
    } catch (e) {
        return null;
    }
};

// Calculate adjusted price based on settings
const calculateAdjustedPrice = (tcgPrice, settings) => {
    if (!settings || !tcgPrice || settings.pricing_method === 'none') {
        return tcgPrice;
    }
    
    const value = parseFloat(settings.pricing_value) || 0;
    let result = tcgPrice;
    
    switch (settings.pricing_method) {
        case 'ceil':
            if (value > 0) result = Math.ceil(tcgPrice / value) * value;
            break;
        case 'floor':
            if (value > 0) result = Math.floor(tcgPrice / value) * value;
            break;
        case 'round':
            if (value > 0) result = Math.round(tcgPrice / value) * value;
            break;
        case 'addition':
            result = tcgPrice + value;
            break;
        case 'subtraction':
            result = tcgPrice - value;
            break;
        case 'up_percent':
            result = tcgPrice * (1 + value / 100);
            break;
        case 'down_percent':
            result = tcgPrice * (1 - value / 100);
            break;
    }
    
    return Math.max(0, Math.round(result * 100) / 100);
};

// Email transporter
const emailTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
    }
});

// Send trade email notification
async function sendTradeEmail(toEmail, subject, htmlContent) {
    if (!process.env.SMTP_USER) {
        console.log('Email not configured, skipping email notification');
        return false;
    }
    
    try {
        await emailTransporter.sendMail({
            from: `"Poke4Trade" <${process.env.SMTP_USER}>`,
            to: toEmail,
            subject: subject,
            html: htmlContent
        });
        console.log(`Email sent to ${toEmail}`);
        return true;
    } catch (err) {
        console.error('Email error:', err);
        return false;
    }
}

module.exports = {
    hashPassword,
    extractTcgPrice,
    getCardMarketPrice,
    calculateAdjustedPrice,
    sendTradeEmail
};
