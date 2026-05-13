/* ===================================
   Home Page
   =================================== */

const HomePage = ({ setCurrentPage }) => {
    const [heroCards, setHeroCards] = React.useState([]);
    const [hotProducts, setHotProducts] = React.useState([]);
    const [hotCards, setHotCards] = React.useState([]);
    
    React.useEffect(() => {
        loadHeroCards();
        loadHotProducts();
        loadHotCards();
    }, []);
    
    const loadHeroCards = async () => {
        try {
            const response = await fetch('/api/admin/settings/public');
            const data = await response.json();
            if (data.success && data.settings?.home_floating_cards) {
                setHeroCards(data.settings.home_floating_cards.filter(c => c !== null));
            }
        } catch (err) {
            console.error('Error loading hero cards:', err);
        }
    };
    
    const loadHotProducts = async () => {
        try {
            const response = await fetch('/api/shop/marketplace?sort=rating&limit=4');
            const data = await response.json();
            if (data.success) {
                setHotProducts(data.products);
            }
        } catch (err) {
            console.error('Error loading hot products:', err);
        }
    };
    
    const loadHotCards = async () => {
        try {
            const response = await fetch('/api/shop/cards?sort=rating&limit=4');
            const data = await response.json();
            if (data.success) {
                setHotCards(data.cards);
            }
        } catch (err) {
            console.error('Error loading hot cards:', err);
        }
    };
    
    // Default cards if none set
    const defaultCards = [
        { name: 'Pikachu VMAX', type: 'Electric', rarity: 'Rainbow Rare', emoji: '⚡' },
        { name: 'Charizard EX', type: 'Fire', rarity: 'Ultra Rare', emoji: '🔥' },
        { name: 'Blastoise V', type: 'Water', rarity: 'Full Art', emoji: '💧' }
    ];
    
    const displayCards = heroCards.length > 0 ? heroCards : defaultCards;
    
    const productIcons = {
        etb: '🎴',
        booster_box: '📦',
        single_pack: '🃏',
        collection_box: '🎁',
        tin: '🥫',
        blister: '💳',
        other: '📋'
    };

    return (
        <>
            {/* Hero Section */}
            <section className="hero">
                <div className="hero-content">
                    <div className="hero-text">
                        <h1>
                            Catch 'Em All.<br />
                            <span className="highlight">Trade 'Em All.</span>
                        </h1>
                        <p>
                            The ultimate destination for Pokémon collectors. Buy sealed products, 
                            trade singles, and connect with trainers worldwide.
                        </p>
                        <div className="hero-buttons">
                            <button 
                                className="btn btn-primary btn-lg"
                                onClick={() => setCurrentPage('trade')}
                            >
                                Start Trading
                            </button>
                            <button 
                                className="btn btn-secondary btn-lg"
                                onClick={() => setCurrentPage('sets')}
                            >
                                Browse Cards
                            </button>
                        </div>
                    </div>
                    
                    <div className="hero-cards">
                        {displayCards.map((card, index) => (
                            <div key={index} className={`floating-card card-${index + 1} ${index % 2 === 0 ? 'holo' : ''}`}>
                                {card.image ? (
                                    <img src={card.image} alt={card.name} className="hero-card-image" />
                                ) : (
                                    <div className="card-inner">
                                        <div className="card-image">{card.emoji}</div>
                                        <div className="card-name">{card.name}</div>
                                        <div className="card-type">{card.type} • {card.rarity}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <div className="stats-bar">
                <div className="stats-container">
                    <div className="stat-item">
                        <div className="stat-number">50K+</div>
                        <div className="stat-label">Active Traders</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">1M+</div>
                        <div className="stat-label">Cards Listed</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">100K+</div>
                        <div className="stat-label">Trades Completed</div>
                    </div>
                    <div className="stat-item">
                        <div className="stat-number">4.9★</div>
                        <div className="stat-label">Trust Rating</div>
                    </div>
                </div>
            </div>

            {/* Hot Products Section */}
            {hotProducts.length > 0 && (
                <section className="section">
                    <div className="section-header">
                        <h2>🔥 Hot Products</h2>
                        <p>Featured sealed products from our sellers</p>
                    </div>
                    
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                        gap: '1.5rem',
                        maxWidth: '1100px',
                        margin: '0 auto',
                        padding: '0 1rem'
                    }}>
                        {hotProducts.map(product => (
                            <div key={product.id} style={{
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.1)',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                cursor: 'pointer'
                            }}
                            onClick={() => setCurrentPage('shop')}
                            onMouseOver={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)';
                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                            >
                                <div style={{ 
                                    fontSize: '3rem', 
                                    height: '100px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(135deg, var(--poke-blue), var(--poke-dark-blue))'
                                }}>
                                    {productIcons[product.product_type] || '📋'}
                                </div>
                                <div style={{ padding: '1rem' }}>
                                    <h4 style={{ 
                                        fontSize: '1rem', 
                                        marginBottom: '0.25rem',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {product.name}
                                    </h4>
                                    {product.set_name && (
                                        <p style={{ color: 'var(--poke-yellow)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                                            {product.set_name}
                                        </p>
                                    )}
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        marginTop: '0.5rem'
                                    }}>
                                        <span className="card-price" style={{ fontSize: '1.1rem' }}>
                                            ${parseFloat(product.price).toFixed(2)}
                                        </span>
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                                            {product.seller_name} {product.seller_rating && `⭐${parseFloat(product.seller_rating).toFixed(1)}`}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => setCurrentPage('shop')}>
                            View All Products →
                        </button>
                    </div>
                </section>
            )}

            {/* Hot Single Cards Section */}
            {hotCards.length > 0 && (
                <section className="section">
                    <div className="section-header">
                        <h2>🃏 Featured Cards</h2>
                        <p>Top single cards for sale from trusted sellers</p>
                    </div>
                    
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '1rem',
                        maxWidth: '900px',
                        margin: '0 auto',
                        padding: '0 1rem'
                    }}>
                        {hotCards.map(card => {
                            const cardData = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {};
                            const imageUrl = cardData.images?.small || card.imageSmall;
                            
                            return (
                                <div key={card.id} style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                    cursor: 'pointer'
                                }}
                                onClick={() => setCurrentPage('shop')}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                    e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.3)';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'translateY(0)';
                                    e.currentTarget.style.boxShadow = 'none';
                                }}
                                >
                                    <div style={{ 
                                        position: 'relative',
                                        paddingTop: '140%',
                                        background: 'linear-gradient(135deg, var(--poke-blue), var(--poke-dark-blue))'
                                    }}>
                                        {imageUrl ? (
                                            <img 
                                                src={imageUrl}
                                                alt={card.card_name}
                                                style={{
                                                    position: 'absolute',
                                                    top: '50%',
                                                    left: '50%',
                                                    transform: 'translate(-50%, -50%)',
                                                    maxWidth: '90%',
                                                    maxHeight: '90%',
                                                    objectFit: 'contain',
                                                    borderRadius: '6px'
                                                }}
                                            />
                                        ) : (
                                            <div style={{
                                                position: 'absolute',
                                                top: '50%',
                                                left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                fontSize: '3rem'
                                            }}>🃏</div>
                                        )}
                                    </div>
                                    <div style={{ padding: '0.75rem' }}>
                                        <h4 style={{ 
                                            fontSize: '0.85rem', 
                                            marginBottom: '0.25rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}>
                                            {card.card_name}
                                        </h4>
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center'
                                        }}>
                                            <span className="card-price" style={{ fontSize: '1rem' }}>
                                                ${parseFloat(card.price).toFixed(2)}
                                            </span>
                                            {card.seller_rating && (
                                                <span style={{ fontSize: '0.7rem', color: 'var(--poke-yellow)' }}>
                                                    ⭐{parseFloat(card.seller_rating).toFixed(1)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    
                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => setCurrentPage('shop')}>
                            View All Cards →
                        </button>
                    </div>
                </section>
            )}

            {/* Features Section */}
            <section className="section">
                <div className="section-header">
                    <h2>⚡ How It Works</h2>
                    <p>Start trading in minutes with our simple process</p>
                </div>
                
                <div className="sets-grid" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    <FeatureCard 
                        icon="📝" 
                        number="1"
                        title="Create Account" 
                        description="Sign up free and set up your trainer profile in seconds"
                    />
                    <FeatureCard 
                        icon="📸" 
                        number="2"
                        title="List Your Cards" 
                        description="Browse our database and list cards you want to trade"
                    />
                    <FeatureCard 
                        icon="🤝" 
                        number="3"
                        title="Find Matches" 
                        description="Browse trades or let our system find deals for you"
                    />
                    <FeatureCard 
                        icon="📬" 
                        number="4"
                        title="Trade Safely" 
                        description="Complete trades with our secure escrow protection"
                    />
                </div>
            </section>
        </>
    );
};

// Feature Card sub-component
const FeatureCard = ({ icon, number, title, description }) => {
    return (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ 
                position: 'relative', 
                width: '80px', 
                height: '80px', 
                margin: '0 auto 1rem',
                background: 'linear-gradient(145deg, var(--poke-blue), var(--poke-dark-blue))',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2rem',
                border: '3px solid var(--poke-yellow)'
            }}>
                {icon}
                <span style={{
                    position: 'absolute',
                    top: '-8px',
                    right: '-8px',
                    width: '28px',
                    height: '28px',
                    background: 'var(--poke-red)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-display)',
                    fontSize: '1rem',
                    border: '2px solid white'
                }}>
                    {number}
                </span>
            </div>
            <h3 style={{ 
                fontFamily: 'var(--font-display)', 
                color: 'var(--poke-yellow)',
                marginBottom: '0.5rem'
            }}>
                {title}
            </h3>
            <p style={{ color: 'var(--text-muted)' }}>{description}</p>
        </div>
    );
};

window.HomePage = HomePage;
