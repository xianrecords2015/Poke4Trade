/* ===================================
   Helper Utilities
   =================================== */

const Helpers = {
    // Local Storage helpers
    storage: {
        get(key, defaultValue = null) {
            try {
                const item = localStorage.getItem(key);
                return item ? JSON.parse(item) : defaultValue;
            } catch (error) {
                console.error('Storage get error:', error);
                return defaultValue;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(key, JSON.stringify(value));
                return true;
            } catch (error) {
                console.error('Storage set error:', error);
                return false;
            }
        },

        remove(key) {
            try {
                localStorage.removeItem(key);
                return true;
            } catch (error) {
                console.error('Storage remove error:', error);
                return false;
            }
        },

        clear() {
            try {
                localStorage.clear();
                return true;
            } catch (error) {
                console.error('Storage clear error:', error);
                return false;
            }
        }
    },

    // Price formatting
    formatPrice(price) {
        if (price === null || price === undefined) return 'N/A';
        return `$${parseFloat(price).toFixed(2)}`;
    },

    // Get market price from card
    getCardPrice(card) {
        if (!card?.tcgplayer?.prices) return null;
        const priceTypes = Object.keys(card.tcgplayer.prices);
        if (priceTypes.length === 0) return null;
        return card.tcgplayer.prices[priceTypes[0]]?.market || null;
    },

    // Date formatting
    formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Debounce function
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Capitalize first letter
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    },

    // Truncate text
    truncate(str, maxLength = 50) {
        if (!str || str.length <= maxLength) return str;
        return str.substr(0, maxLength) + '...';
    },

    // Calculate pagination
    getPagination(currentPage, totalPages, maxVisible = 5) {
        const pages = [];
        let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        
        if (end - start + 1 < maxVisible) {
            start = Math.max(1, end - maxVisible + 1);
        }
        
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        
        return pages;
    },

    // Energy type to emoji mapping
    energyEmoji: {
        'Colorless': '⚪',
        'Darkness': '🌑',
        'Dragon': '🐉',
        'Fairy': '🧚',
        'Fighting': '👊',
        'Fire': '🔥',
        'Grass': '🌿',
        'Lightning': '⚡',
        'Metal': '⚙️',
        'Psychic': '🔮',
        'Water': '💧'
    },

    getEnergyEmoji(type) {
        return this.energyEmoji[type] || '❓';
    },

    // Rarity colors
    rarityColor: {
        'Common': '#9CA3AF',
        'Uncommon': '#10B981',
        'Rare': '#3B82F6',
        'Rare Holo': '#8B5CF6',
        'Rare Ultra': '#F59E0B',
        'Rare Secret': '#EC4899',
        'Promo': '#EF4444'
    },

    getRarityColor(rarity) {
        if (!rarity) return '#9CA3AF';
        for (const [key, color] of Object.entries(this.rarityColor)) {
            if (rarity.includes(key)) return color;
        }
        return '#9CA3AF';
    }
};

// Settings management
const DEFAULT_SETTINGS = {
    cardsPerPage: 20,
    showPrices: true,
    theme: 'dark'
};

window.getSettings = function() {
    const saved = localStorage.getItem('poke4trade_settings');
    if (saved) {
        try {
            return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
        } catch (e) {
            return DEFAULT_SETTINGS;
        }
    }
    return DEFAULT_SETTINGS;
};

window.saveSettings = function(settings) {
    localStorage.setItem('poke4trade_settings', JSON.stringify(settings));
};

// Make it available globally
window.Helpers = Helpers;
