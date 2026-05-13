/* ===================================
   Shop Page - Browse Products & Single Cards
   =================================== */

const ShopPage = ({ setCurrentPage }) => {
    const { user } = React.useContext(AuthContext);
    const { addItem: addToCart } = useCart();
    const { success, error: showError } = React.useContext(ToastContext);
    
    const [activeTab, setActiveTab] = React.useState('products');
    const [products, setProducts] = React.useState([]);
    const [cards, setCards] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState('all');
    const [sort, setSort] = React.useState('rating');
    const [search, setSearch] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [total, setTotal] = React.useState(0);
    
    const productTypes = [
        { value: 'all', label: 'All Products' },
        { value: 'etb', label: 'Elite Trainer Boxes' },
        { value: 'booster_box', label: 'Booster Boxes' },
        { value: 'single_pack', label: 'Single Packs' },
        { value: 'collection_box', label: 'Collection Boxes' },
        { value: 'tin', label: 'Tins' },
        { value: 'blister', label: 'Blister Packs' },
        { value: 'other', label: 'Other' }
    ];
    
    const sortOptions = [
        { value: 'rating', label: 'Seller Rating' },
        { value: 'newest', label: 'Newest First' },
        { value: 'price_asc', label: 'Price: Low to High' },
        { value: 'price_desc', label: 'Price: High to Low' }
    ];
    
    const productIcons = {
        etb: '🎴',
        booster_box: '📦',
        single_pack: '🃏',
        collection_box: '🎁',
        tin: '🥫',
        blister: '💳',
        other: '📋'
    };

    React.useEffect(() => {
        if (activeTab === 'products') {
            loadProducts();
        } else {
            loadCards();
        }
    }, [activeTab, filter, sort, page]);
    
    const loadProducts = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                type: filter,
                sort: sort,
                page: page,
                limit: 20
            });
            if (search) params.append('search', search);
            
            const response = await fetch(`/api/shop/marketplace?${params}`);
            const data = await response.json();
            
            if (data.success) {
                setProducts(data.products);
                setTotalPages(data.totalPages);
                setTotal(data.total);
            }
        } catch (err) {
            showError('Failed to load products');
        } finally {
            setLoading(false);
        }
    };
    
    const loadCards = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                sort: sort,
                page: page,
                limit: 20
            });
            if (search) params.append('search', search);
            
            const response = await fetch(`/api/shop/cards?${params}`);
            const data = await response.json();
            
            if (data.success) {
                setCards(data.cards);
                setTotalPages(data.totalPages);
                setTotal(data.total);
            }
        } catch (err) {
            showError('Failed to load cards');
        } finally {
            setLoading(false);
        }
    };
    
    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        if (activeTab === 'products') {
            loadProducts();
        } else {
            loadCards();
        }
    };
    
    
    const handleAddToCart = async (itemType, itemId, itemName) => {
        if (!user) {
            setCurrentPage("signin");
            return;
        }
        const result = await addToCart(itemType, itemId, 1);
        if (result.success) {
            success(itemName + " added to cart!");
        } else {
            showError(result.error || "Failed to add to cart");
        }
    };
    const handleTabChange = (tab) => {
        setActiveTab(tab);
        setPage(1);
        setFilter('all');
        setSearch('');
    };
    
    const getProductIcon = (type) => productIcons[type] || '📋';

    return (
        <div className="section">
            <div className="section-header">
                <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '2.5rem' }}>🏬</span> Shop
                </h2>
                <p>Browse products and single cards from our community</p>
            </div>
            
            {/* Tab Buttons */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                gap: '1rem',
                marginBottom: '2rem'
            }}>
                <button
                    className={`btn ${activeTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleTabChange('products')}
                    style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                >
                    📦 Products
                </button>
                <button
                    className={`btn ${activeTab === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handleTabChange('cards')}
                    style={{ padding: '0.75rem 2rem', fontSize: '1rem' }}
                >
                    🃏 Single Cards
                </button>
            </div>
            
            {/* Search Bar */}
            <form onSubmit={handleSearch} style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                marginBottom: '1.5rem',
                gap: '0.5rem',
                flexWrap: 'wrap'
            }}>
                <input
                    type="text"
                    placeholder={activeTab === 'products' ? 'Search products...' : 'Search cards...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: '2px solid rgba(255,255,255,0.2)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white',
                        width: '300px'
                    }}
                />
                <button type="submit" className="btn btn-primary">🔍 Search</button>
            </form>

            {/* Filters */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', gap: '0.5rem' }}>
                {activeTab === 'products' && (
                    <select
                        value={filter}
                        onChange={(e) => { setFilter(e.target.value); setPage(1); }}
                        style={{
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            border: '2px solid rgba(255,255,255,0.2)',
                            background: 'rgba(0,0,0,0.3)',
                            color: 'white'
                        }}
                    >
                        {productTypes.map(pt => (
                            <option key={pt.value} value={pt.value}>{pt.label}</option>
                        ))}
                    </select>
                )}
                <select
                    value={sort}
                    onChange={(e) => { setSort(e.target.value); setPage(1); }}
                    style={{
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: '2px solid rgba(255,255,255,0.2)',
                        background: 'rgba(0,0,0,0.3)',
                        color: 'white'
                    }}
                >
                    {sortOptions.map(so => (
                        <option key={so.value} value={so.value}>{so.label}</option>
                    ))}
                </select>
            </div>
            
            {/* Results Count */}
            {!loading && (
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
                    {total} {activeTab === 'products' ? 'product' : 'card'}{total !== 1 ? 's' : ''} found
                </p>
            )}

            {/* Loading */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="pokeball-spinner"></div>
                    <p>Loading {activeTab}...</p>
                </div>
            ) : activeTab === 'products' ? (
                /* Products Tab */
                products.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📦</div>
                        <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>No products available</h3>
                        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                            {search ? 'Try a different search term' : 'Check back later for new listings'}
                        </p>
                        {user && (
                            <button className="btn btn-primary" onClick={() => setCurrentPage('my-shop')}>
                                🏬 List Your Products
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '1.5rem',
                        maxWidth: '1200px',
                        margin: '0 auto',
                        padding: '0 1rem'
                    }}>
                        {products.map(product => (
                            <div key={product.id} style={{
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <div style={{ 
                                    fontSize: '4rem', 
                                    height: '120px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'linear-gradient(135deg, var(--poke-blue), var(--poke-dark-blue))',
                                    position: 'relative'
                                }}>
                                    {getProductIcon(product.product_type)}
                                    {product.condition_grade === 'Sealed' && (
                                        <span style={{
                                            position: 'absolute',
                                            top: '10px',
                                            right: '10px',
                                            background: '#28a745',
                                            color: 'white',
                                            padding: '0.25rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.7rem',
                                            fontWeight: 'bold'
                                        }}>Sealed</span>
                                    )}
                                </div>
                                <div style={{ padding: '1rem' }}>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>{product.name}</h3>
                                    {product.set_name && (
                                        <p style={{ color: 'var(--poke-yellow)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                                            {product.set_name}
                                        </p>
                                    )}
                                    {product.description && (
                                        <p style={{ 
                                            color: 'rgba(255,255,255,0.6)', 
                                            fontSize: '0.8rem',
                                            marginBottom: '0.75rem',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            display: '-webkit-box',
                                            WebkitLineClamp: 2,
                                            WebkitBoxOrient: 'vertical'
                                        }}>{product.description}</p>
                                    )}
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                                        <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                            {product.language}
                                        </span>
                                        {product.quantity > 1 && (
                                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                                Qty: {product.quantity}
                                            </span>
                                        )}
                                    </div>
                                    {/* Seller Info */}
                                    <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '0.5rem',
                                        marginBottom: '0.75rem',
                                        padding: '0.5rem',
                                        background: 'rgba(0,0,0,0.2)',
                                        borderRadius: '8px'
                                    }}>
                                        <div style={{
                                            width: '24px',
                                            height: '24px',
                                            borderRadius: '50%',
                                            background: 'var(--poke-blue)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.7rem'
                                        }}>
                                            {product.seller_name?.charAt(0).toUpperCase()}
                                        </div>
                                        <span style={{ fontSize: '0.85rem' }}>{product.seller_name}</span>
                                        {product.seller_rating && (
                                            <span style={{ color: 'var(--poke-yellow)', fontSize: '0.8rem', marginLeft: 'auto' }}>
                                                ⭐ {parseFloat(product.seller_rating).toFixed(1)}
                                            </span>
                                        )}
                                    </div>
                                    {/* Price */}
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        paddingTop: '0.75rem',
                                        borderTop: '1px solid rgba(255,255,255,0.1)'
                                    }}>
                                        <span style={{ fontWeight: '600', fontSize: '1.25rem', color: 'var(--poke-yellow)' }}>
                                            ${parseFloat(product.price).toFixed(2)}
                                        </span>
                                        <button
                                            className="btn btn-primary"
                                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                            onClick={() => handleAddToCart('product', product.id, product.name)}
                                            disabled={product.seller_id == user?.id}
                                        >{product.seller_id == user?.id ? 'Your Item' : '🛒 Add to Cart'}</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* Single Cards Tab */
                cards.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🃏</div>
                        <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>No cards for sale</h3>
                        <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                            {search ? 'Try a different search term' : 'Check back later for new listings'}
                        </p>
                        {user && (
                            <button className="btn btn-primary" onClick={() => setCurrentPage('my-cards')}>
                                🃏 List Your Cards
                            </button>
                        )}
                    </div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '1rem',
                        maxWidth: '1200px',
                        margin: '0 auto',
                        padding: '0 1rem'
                    }}>
                        {cards.map(card => {
                            const cardData = card.card_data ? (typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data) : {};
                            const imageUrl = cardData.images?.small || card.imageSmall;
                            
                            return (
                                <div key={card.id} style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    border: '1px solid rgba(255,255,255,0.1)'
                                }}>
                                    {/* Card Image */}
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
                                                    borderRadius: '8px'
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
                                    {/* Card Info */}
                                    <div style={{ padding: '0.75rem' }}>
                                        <h4 style={{ fontSize: '0.9rem', marginBottom: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {card.card_name}
                                        </h4>
                                        <p style={{ color: 'var(--poke-yellow)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                                            {card.set_name}
                                        </p>
                                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginBottom: '0.5rem', fontSize: '0.65rem' }}>
                                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                                {card.condition_grade}
                                            </span>
                                            <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                                                {card.language}
                                            </span>
                                        </div>
                                        {/* Seller */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginBottom: '0.5rem', fontSize: '0.75rem' }}>
                                            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{card.seller_name}</span>
                                            {card.seller_rating && (
                                                <span style={{ color: 'var(--poke-yellow)' }}>⭐ {parseFloat(card.seller_rating).toFixed(1)}</span>
                                            )}
                                        </div>
                                        {/* Price */}
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center',
                                            paddingTop: '0.5rem',
                                            borderTop: '1px solid rgba(255,255,255,0.1)'
                                        }}>
                                            <span style={{ fontWeight: '600', fontSize: '1.1rem', color: 'var(--poke-yellow)' }}>
                                                ${parseFloat(card.price).toFixed(2)}
                                            </span>
                                            <button
                                                className="btn btn-primary"
                                                style={{ padding: '0.3rem 0.5rem', fontSize: '0.7rem' }}
                                                onClick={() => handleAddToCart('card', card.id, card.card_name)}
                                                disabled={card.seller_id === user?.id}
                                            >{card.seller_id === user?.id ? '—' : '🛒'}</button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}
            
            {/* Pagination */}
            {!loading && totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '2rem' }}>
                    <button className="btn btn-secondary" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                        ← Previous
                    </button>
                    <span style={{ display: 'flex', alignItems: 'center', padding: '0 1rem', color: 'rgba(255,255,255,0.6)' }}>
                        Page {page} of {totalPages}
                    </span>
                    <button className="btn btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                        Next →
                    </button>
                </div>
            )}
            
            {/* CTA for Sellers */}
            {user && (
                <div style={{ 
                    textAlign: 'center', 
                    marginTop: '3rem',
                    padding: '2rem',
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: '12px',
                    maxWidth: '600px',
                    margin: '3rem auto 0'
                }}>
                    <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)', marginBottom: '0.5rem' }}>
                        Want to sell?
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1rem' }}>
                        List your products in My Shop or your cards in My Cards
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={() => setCurrentPage('my-shop')}>
                            🏬 My Shop
                        </button>
                        <button className="btn btn-secondary" onClick={() => setCurrentPage('my-cards')}>
                            🃏 My Cards
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

window.ShopPage = ShopPage;
