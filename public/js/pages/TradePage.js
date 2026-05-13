/* ===================================
   Trade Page - Browse & Create Trades
   =================================== */

// Landing page for non-authenticated users
const TradeHeroLanding = ({ setCurrentPage }) => {
    const [tradeCards, setTradeCards] = React.useState([]);
    
    React.useEffect(() => {
        loadTradeCards();
    }, []);
    
    const loadTradeCards = async () => {
        try {
            const response = await fetch('/api/admin/settings/public');
            const data = await response.json();
            if (data.success && data.settings?.trade_floating_cards) {
                setTradeCards(data.settings.trade_floating_cards.filter(c => c !== null));
            }
        } catch (err) {
            console.error('Error loading trade cards:', err);
        }
    };
    
    // Default cards if none set
    const defaultCards = [
        { 
            name: 'Mega Charizard X ex', 
            number: '125', 
            setTotal: '94',
            rarity: 'Special Illustration Rare', 
            price: 486.97,
            image: 'https://images.pokemontcg.io/me2/125_hires.png'
        },
        { 
            name: 'Mega Sharpedo ex', 
            number: '127',
            setTotal: '94', 
            rarity: 'Special Illustration Rare', 
            price: 37.67,
            image: 'https://images.pokemontcg.io/me2/127_hires.png'
        }
    ];
    
    const displayCards = tradeCards.length >= 2 ? tradeCards : defaultCards;

    const features = [
        {
            icon: '🔍',
            title: 'Smart Matching',
            description: 'Our algorithm finds traders who have cards you want AND want cards you have'
        },
        {
            icon: '💰',
            title: 'Fair Value Trading',
            description: 'Real-time TCGPlayer market prices ensure balanced trades every time'
        },
        {
            icon: '⭐',
            title: 'Trusted Community',
            description: 'User ratings and reviews help you trade with confidence'
        },
        {
            icon: '📦',
            title: 'Easy Shipping',
            description: 'Built-in tracking and confirmation keeps both parties protected'
        }
    ];

    const stats = [
        { value: '10K+', label: 'Active Traders' },
        { value: '50K+', label: 'Successful Trades' },
        { value: '500K+', label: 'Cards Listed' }
    ];

    const formatPrice = (price) => {
        if (!price) return null;
        const num = typeof price === 'number' ? price : parseFloat(price);
        return isNaN(num) ? null : num.toFixed(2);
    };

    return (
        <div className="trade-hero-landing">
            {/* Hero Section */}
            <div className="trade-hero-section">
                <div className="trade-hero-content">
                    <h1 className="trade-hero-title">
                        <span className="title-line">Trade Smarter,</span>
                        <span className="title-line highlight">Not Harder</span>
                    </h1>
                    <p className="trade-hero-subtitle">
                        Join thousands of Pokémon TCG collectors finding perfect trades every day. 
                        Our smart matching system connects you with traders who have exactly what you need.
                    </p>
                    <div className="trade-hero-buttons">
                        <button 
                            className="btn btn-primary btn-lg"
                            onClick={() => setCurrentPage('register')}
                        >
                            🚀 Start Trading Free
                        </button>
                        <button 
                            className="btn btn-secondary btn-lg"
                            onClick={() => setCurrentPage('signin')}
                        >
                            Sign In
                        </button>
                    </div>
                </div>
                
                {/* Floating Cards Animation */}
                <div className="trade-hero-visual">
                    <div className="trade-floating-cards">
                        {displayCards[0] && (
                            <div className="trade-card trade-card-1">
                                <div className="card-number-badge">
                                    {displayCards[0].number}/{displayCards[0].setTotal || '??'}
                                </div>
                                <img src={displayCards[0].image || displayCards[0].imageLarge} alt={displayCards[0].name} />
                                <div className="trade-card-info">
                                    <h4>{displayCards[0].name}</h4>
                                    <span className="rarity">{displayCards[0].rarity}</span>
                                    {formatPrice(displayCards[0].price) && (
                                        <p className="price">${formatPrice(displayCards[0].price)}</p>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="trade-arrow-big">⇄</div>
                        {displayCards[1] && (
                            <div className="trade-card trade-card-2">
                                <div className="card-number-badge">
                                    {displayCards[1].number}/{displayCards[1].setTotal || '??'}
                                </div>
                                <img src={displayCards[1].image || displayCards[1].imageLarge} alt={displayCards[1].name} />
                                <div className="trade-card-info">
                                    <h4>{displayCards[1].name}</h4>
                                    <span className="rarity">{displayCards[1].rarity}</span>
                                    {formatPrice(displayCards[1].price) && (
                                        <p className="price">${formatPrice(displayCards[1].price)}</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Bar */}
            <div className="trade-stats-bar">
                {stats.map((stat, idx) => (
                    <div key={idx} className="trade-stat">
                        <span className="stat-value">{stat.value}</span>
                        <span className="stat-label">{stat.label}</span>
                    </div>
                ))}
            </div>

            {/* Features Grid */}
            <div className="trade-features-section">
                <h2 className="section-title">Why Trade on Poke4Trade?</h2>
                <div className="trade-features-grid">
                    {features.map((feature, idx) => (
                        <div key={idx} className="trade-feature-card">
                            <div className="feature-icon">{feature.icon}</div>
                            <h3>{feature.title}</h3>
                            <p>{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* How It Works */}
            <div className="trade-how-section">
                <h2 className="section-title">How It Works</h2>
                <div className="trade-steps">
                    <div className="trade-step">
                        <div className="step-number">1</div>
                        <div className="step-content">
                            <h3>Build Your Collection</h3>
                            <p>Add sets to your collection and mark which cards you own and which you need</p>
                        </div>
                    </div>
                    <div className="step-connector"></div>
                    <div className="trade-step">
                        <div className="step-number">2</div>
                        <div className="step-content">
                            <h3>List Your Extras</h3>
                            <p>Add your duplicate cards to your trade list with condition and price details</p>
                        </div>
                    </div>
                    <div className="step-connector"></div>
                    <div className="trade-step">
                        <div className="step-number">3</div>
                        <div className="step-content">
                            <h3>Find Matches</h3>
                            <p>Our system automatically finds traders with mutual trade opportunities</p>
                        </div>
                    </div>
                    <div className="step-connector"></div>
                    <div className="trade-step">
                        <div className="step-number">4</div>
                        <div className="step-content">
                            <h3>Trade & Complete</h3>
                            <p>Negotiate, ship, and rate - building your reputation with every trade</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CTA Section */}
            <div className="trade-cta-section">
                <div className="cta-card">
                    <h2>Ready to Complete Your Collection?</h2>
                    <p>Join Poke4Trade today and start finding the perfect trades for your Pokémon cards.</p>
                    <button 
                        className="btn btn-primary btn-lg"
                        onClick={() => setCurrentPage('register')}
                    >
                        Create Free Account
                    </button>
                </div>
            </div>
        </div>
    );
};

const TradePage = ({ setCurrentPage }) => {
    // This page is only shown to non-authenticated users
    // Authenticated users are routed to TradeMatchPage by App.js
    return <TradeHeroLanding setCurrentPage={setCurrentPage} />;
};

window.TradePage = TradePage;
