/* ===================================
   Admin Settings Page
   =================================== */

const AdminSettingsPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { success, error } = useToast();
    const [isAdmin, setIsAdmin] = React.useState(false);
    const [loading, setLoading] = React.useState(true);
    const [activeTab, setActiveTab] = React.useState('site-settings');
    
    // Site settings state
    const [homeCards, setHomeCards] = React.useState([null, null, null]);
    const [tradeCards, setTradeCards] = React.useState([null, null]);
    const [cardPickerOpen, setCardPickerOpen] = React.useState(null);
    
    // Reviews state
    const [reviews, setReviews] = React.useState([]);
    const [reviewsPage, setReviewsPage] = React.useState(1);
    const [reviewsTotal, setReviewsTotal] = React.useState(0);
    const [reviewSearch, setReviewSearch] = React.useState('');
    const [expandedReview, setExpandedReview] = React.useState(null);
    
    // Check admin status
    React.useEffect(() => {
        checkAdminStatus();
    }, [user]);
    
    const checkAdminStatus = async () => {
        if (!user) {
            setLoading(false);
            return;
        }
        
        try {
            const response = await fetch('/api/admin/check', {
                headers: { 'X-User-Id': user.id }
            });
            const data = await response.json();
            
            setIsAdmin(data.isAdmin);
            
            if (data.isAdmin) {
                loadSettings();
                loadReviews();
            }
        } catch (err) {
            console.error('Admin check error:', err);
        }
        setLoading(false);
    };
    
    const loadSettings = async () => {
        try {
            const response = await fetch('/api/admin/settings', {
                headers: { 'X-User-Id': user.id }
            });
            const data = await response.json();
            
            if (data.success && data.settings) {
                if (data.settings.home_floating_cards) {
                    setHomeCards(data.settings.home_floating_cards);
                }
                if (data.settings.trade_floating_cards) {
                    setTradeCards(data.settings.trade_floating_cards);
                }
            }
        } catch (err) {
            console.error('Load settings error:', err);
        }
    };
    
    const loadReviews = async (page = 1, search = '') => {
        try {
            const params = new URLSearchParams({ page, limit: 20 });
            if (search) params.append('search', search);
            
            const response = await fetch(`/api/admin/reviews?${params}`, {
                headers: { 'X-User-Id': user.id }
            });
            const data = await response.json();
            
            if (data.success) {
                setReviews(data.reviews);
                setReviewsTotal(data.pagination.total);
                setReviewsPage(page);
            }
        } catch (err) {
            console.error('Load reviews error:', err);
        }
    };
    
    const saveHomeCards = async () => {
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                },
                body: JSON.stringify({
                    key: 'home_floating_cards',
                    value: homeCards
                })
            });
            
            
            if (data.success) {
                success('Home page cards saved!');
            } else {
                error('Failed to save');
            }
        } catch (err) {
            error('Error saving settings');
        }
    };
    
    const saveTradeCards = async () => {
        try {
            const response = await fetch('/api/admin/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                },
                body: JSON.stringify({
                    key: 'trade_floating_cards',
                    value: tradeCards
                })
            });
            
            
            if (data.success) {
                success('Trade page cards saved!');
            } else {
                error('Failed to save');
            }
        } catch (err) {
            error('Error saving settings');
        }
    };
    
    const handleCardSelect = (card) => {
        if (!cardPickerOpen) return;
        
        const cardData = {
            id: card.id,
            name: card.name,
            image: card.images?.small || card.imageSmall,
            imageLarge: card.images?.large || card.imageLarge,
            rarity: card.rarity,
            number: card.number,
            setName: card.set?.name,
            setTotal: card.set?.printedTotal || card.set?.total,
            price: Helpers.getCardPrice(card)
        };
        
        if (cardPickerOpen.type === 'home') {
            const newCards = [...homeCards];
            newCards[cardPickerOpen.index] = cardData;
            setHomeCards(newCards);
        } else {
            const newCards = [...tradeCards];
            newCards[cardPickerOpen.index] = cardData;
            setTradeCards(newCards);
        }
        
        setCardPickerOpen(null);
    };
    
    const handleHideReview = async (reviewId, hidden) => {
        try {
            const response = await fetch(`/api/admin/reviews/${reviewId}/visibility`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ hidden })
            });
            
            if (response.ok) {
                success(hidden ? 'Review hidden' : 'Review visible');
                loadReviews(reviewsPage, reviewSearch);
            }
        } catch (err) {
            error('Error updating review');
        }
    };
    
    const handleDeleteReview = async (reviewId) => {
        if (!confirm('Are you sure you want to delete this review?')) return;
        
        try {
            const response = await fetch(`/api/admin/reviews/${reviewId}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': user.id }
            });
            
            if (response.ok) {
                success('Review deleted');
                loadReviews(reviewsPage, reviewSearch);
            }
        } catch (err) {
            error('Error deleting review');
        }
    };
    
    if (loading) {
        return <Loading message="Checking permissions..." />;
    }
    
    if (!user) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <h3>Sign In Required</h3>
                    <p>Please sign in to access admin settings.</p>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }
    
    if (!isAdmin) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-state-icon">⛔</div>
                    <h3>Access Denied</h3>
                    <p>You don't have permission to access admin settings.</p>
                    <button className="btn btn-secondary" onClick={() => setCurrentPage('home')}>
                        Go Home
                    </button>
                </div>
            </div>
        );
    }
    
    return (
        <div className="section">
            <div className="section-header">
                <h2>⚙️ Admin Settings</h2>
                <p>Manage site settings and moderate content</p>
            </div>
            
            <div className="tabs">
                <button 
                    className={`tab ${activeTab === 'site-settings' ? 'active' : ''}`}
                    onClick={() => setActiveTab('site-settings')}
                >
                    🎨 Site Settings
                </button>
                <button 
                    className={`tab ${activeTab === 'cards' ? 'active' : ''}`}
                    onClick={() => setActiveTab('cards')}
                >
                    🃏 Cards
                </button>
                <button 
                    className={`tab ${activeTab === 'reviews' ? 'active' : ''}`}
                    onClick={() => setActiveTab('reviews')}
                >
                    ⭐ Reviews
                </button>
                <button 
                    className={`tab ${activeTab === 'users' ? 'active' : ''}`}
                    onClick={() => setActiveTab('users')}
                >
                    👥 Users
                </button>
                <button
                    className={`tab ${activeTab === "product-images" ? "active" : ""}`}
                    onClick={() => setActiveTab("product-images")}
                >
                    📸 Product Images
                </button>
            </div>
            
            {activeTab === 'site-settings' && (
                <SiteSettingsTab 
                    homeCards={homeCards}
                    tradeCards={tradeCards}
                    onPickCard={setCardPickerOpen}
                    onSaveHome={saveHomeCards}
                    onSaveTrade={saveTradeCards}
                    onRemoveCard={(type, index) => {
                        if (type === 'home') {
                            const newCards = [...homeCards];
                            newCards[index] = null;
                            setHomeCards(newCards);
                        } else {
                            const newCards = [...tradeCards];
                            newCards[index] = null;
                            setTradeCards(newCards);
                        }
                    }}
                />
            )}
            
            {activeTab === 'cards' && (
                <CardsTab user={user} />
            )}
            
            {activeTab === 'reviews' && (
                <ReviewsTab 
                    reviews={reviews}
                    page={reviewsPage}
                    total={reviewsTotal}
                    search={reviewSearch}
                    expandedReview={expandedReview}
                    setExpandedReview={setExpandedReview}
                    onSearch={(s) => { setReviewSearch(s); loadReviews(1, s); }}
                    onPageChange={(p) => loadReviews(p, reviewSearch)}
                    onHide={handleHideReview}
                    onDelete={handleDeleteReview}
                />
            )}
            
            {activeTab === 'users' && (
                <UsersTab user={user} />
            )}
            
            {activeTab === "product-images" && (
                <ProductImagesTab user={user} />
            )}
            
            {cardPickerOpen && (
                <CardPickerModal 
                    onSelect={handleCardSelect}
                    onClose={() => setCardPickerOpen(null)}
                />
            )}
        </div>
    );
};

// Site Settings Tab
const SiteSettingsTab = ({ homeCards, tradeCards, onPickCard, onSaveHome, onSaveTrade, onRemoveCard }) => {
    return (
        <div className="admin-settings-content">
            {/* Home Page Cards */}
            <div className="settings-section">
                <h3>🏠 Home Page Floating Cards</h3>
                <p className="settings-description">Select 3 cards to display in the hero section of the home page.</p>
                
                <div className="admin-cards-grid">
                    {[0, 1, 2].map(index => (
                        <div key={index} className="admin-card-slot">
                            {homeCards[index] ? (
                                <div className="admin-card-preview">
                                    <img src={homeCards[index].image} alt={homeCards[index].name} />
                                    <div className="admin-card-info">
                                        <h4>{homeCards[index].name}</h4>
                                        <span>{homeCards[index].rarity}</span>
                                    </div>
                                    <div className="admin-card-actions">
                                        <button 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => onPickCard({ type: 'home', index })}
                                        >
                                            Change
                                        </button>
                                        <button 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => onRemoveCard('home', index)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    className="admin-card-empty"
                                    onClick={() => onPickCard({ type: 'home', index })}
                                >
                                    <span className="icon">+</span>
                                    <span>Select Card {index + 1}</span>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                
                <button className="btn btn-primary" onClick={onSaveHome}>
                    💾 Save Home Cards
                </button>
            </div>
            
            {/* Trade Page Cards */}
            <div className="settings-section">
                <h3>🔄 Trade Page Floating Cards</h3>
                <p className="settings-description">Select 2 cards to display in the trade landing page hero section.</p>
                
                <div className="admin-cards-grid">
                    {[0, 1].map(index => (
                        <div key={index} className="admin-card-slot">
                            {tradeCards[index] ? (
                                <div className="admin-card-preview">
                                    <img src={tradeCards[index].image} alt={tradeCards[index].name} />
                                    <div className="admin-card-info">
                                        <h4>{tradeCards[index].name}</h4>
                                        <span>{tradeCards[index].rarity}</span>
                                        {tradeCards[index].price && (
                                            <span className="price">${typeof tradeCards[index].price === 'number' ? tradeCards[index].price.toFixed(2) : tradeCards[index].price}</span>
                                        )}
                                    </div>
                                    <div className="admin-card-actions">
                                        <button 
                                            className="btn btn-secondary btn-sm"
                                            onClick={() => onPickCard({ type: 'trade', index })}
                                        >
                                            Change
                                        </button>
                                        <button 
                                            className="btn btn-danger btn-sm"
                                            onClick={() => onRemoveCard('trade', index)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button 
                                    className="admin-card-empty"
                                    onClick={() => onPickCard({ type: 'trade', index })}
                                >
                                    <span className="icon">+</span>
                                    <span>Select Card {index + 1}</span>
                                </button>
                            )}
                        </div>
                    ))}
                </div>
                
                <button className="btn btn-primary" onClick={onSaveTrade}>
                    💾 Save Trade Cards
                </button>
            </div>
        </div>
    );
};

// Card Picker Modal - Matching Browse Sets style
const CardPickerModal = ({ onSelect, onClose }) => {
    const [sets, setSets] = React.useState([]);
    const [selectedSet, setSelectedSet] = React.useState(null);
    const [cards, setCards] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [searchQuery, setSearchQuery] = React.useState('');
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [selectedCard, setSelectedCard] = React.useState(null);
    
    React.useEffect(() => {
        loadSets();
    }, []);
    
    const loadSets = async () => {
        setLoading(true);
        const result = await PokemonAPI.getSets();
        if (result.success) {
            setSets(result.data);
            if (result.data.length > 0) {
                const firstSet = result.data[0];
                setSelectedSet(firstSet.id);
                loadCards(firstSet.id, 1);
            }
        }
        setLoading(false);
    };
    
    const loadCards = async (setId, pageNum = 1) => {
        setLoading(true);
        const result = await PokemonAPI.getCardsFromSet(setId, pageNum, 20);
        if (result.success) {
            setCards(result.data);
            setTotalPages(Math.ceil(result.totalCount / 20));
            setPage(pageNum);
        }
        setLoading(false);
    };
    
    const searchCards = async () => {
        if (!searchQuery || searchQuery.length < 2) return;
        setLoading(true);
        setSelectedSet(null);
        const result = await PokemonAPI.searchCards(searchQuery, 1, 30);
        if (result.success) {
            setCards(result.data);
            setTotalPages(1);
        }
        setLoading(false);
    };

    const handleCardClick = (card) => {
        setSelectedCard(card);
    };

    const confirmSelection = () => {
        if (selectedCard) {
            onSelect(selectedCard);
        }
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal admin-card-picker-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Select a Card</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                
                <div className="admin-picker-layout">
                    {/* Left side - Card grid */}
                    <div className="admin-picker-left">
                        <div className="admin-picker-controls">
                            <div className="admin-picker-search">
                                <input 
                                    type="text"
                                    placeholder="Search cards..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && searchCards()}
                                />
                                <button className="btn btn-primary btn-sm" onClick={searchCards}>Search</button>
                            </div>
                            
                            <select 
                                value={selectedSet || ''}
                                onChange={e => {
                                    setSelectedSet(e.target.value);
                                    setSelectedCard(null);
                                    if (e.target.value) loadCards(e.target.value, 1);
                                }}
                                className="admin-picker-set-select"
                            >
                                <option value="">Select a set...</option>
                                {sets.map(set => (
                                    <option key={set.id} value={set.id}>
                                        {set.name} ({set.releaseDate})
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="admin-picker-cards">
                            {loading ? (
                                <div className="admin-picker-loading">
                                    <Loading message="Loading..." />
                                </div>
                            ) : cards.length > 0 ? (
                                <div className="admin-picker-grid">
                                    {cards.map(card => (
                                        <div 
                                            key={card.id} 
                                            className={`admin-picker-card ${selectedCard?.id === card.id ? 'selected' : ''}`}
                                            onClick={() => handleCardClick(card)}
                                        >
                                            <img src={card.images?.small || card.imageSmall} alt={card.name} />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="admin-picker-empty">
                                    <p>Select a set or search to browse cards</p>
                                </div>
                            )}
                        </div>
                        
                        {totalPages > 1 && (
                            <div className="admin-picker-pagination">
                                <button 
                                    className="btn btn-secondary btn-sm"
                                    disabled={page === 1}
                                    onClick={() => loadCards(selectedSet, page - 1)}
                                >
                                    ← Prev
                                </button>
                                <span>Page {page} / {totalPages}</span>
                                <button 
                                    className="btn btn-secondary btn-sm"
                                    disabled={page === totalPages}
                                    onClick={() => loadCards(selectedSet, page + 1)}
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </div>
                    
                    {/* Right side - Card preview */}
                    <div className="admin-picker-right">
                        {selectedCard ? (
                            <div className="admin-picker-preview">
                                <img 
                                    src={selectedCard.images?.large || selectedCard.imageLarge || selectedCard.images?.small || selectedCard.imageSmall} 
                                    alt={selectedCard.name} 
                                    className="admin-picker-preview-img"
                                />
                                <div className="admin-picker-preview-info">
                                    <h4>{selectedCard.name}</h4>
                                    <p className="preview-set">{selectedCard.set?.name}</p>
                                    <p className="preview-number">#{selectedCard.number}</p>
                                    <p className="preview-rarity">{selectedCard.rarity || 'Common'}</p>
                                    {Helpers.getCardPrice(selectedCard) && (
                                        <p className="preview-price">${Helpers.getCardPrice(selectedCard).toFixed(2)}</p>
                                    )}
                                </div>
                                <button className="btn btn-primary btn-lg" onClick={confirmSelection}>
                                    ✓ Select This Card
                                </button>
                            </div>
                        ) : (
                            <div className="admin-picker-no-selection">
                                <div className="no-selection-icon">🃏</div>
                                <p>Click a card to preview</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Reviews Tab
const ReviewsTab = ({ reviews, page, total, search, expandedReview, setExpandedReview, onSearch, onPageChange, onHide, onDelete }) => {
    const [searchInput, setSearchInput] = React.useState(search);
    
    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
    
    return (
        <div className="admin-reviews-content">
            <div className="reviews-controls">
                <div className="search-row">
                    <input 
                        type="text"
                        placeholder="Search reviews..."
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && onSearch(searchInput)}
                    />
                    <button className="btn btn-primary" onClick={() => onSearch(searchInput)}>
                        Search
                    </button>
                </div>
                <span className="reviews-count">{total} reviews total</span>
            </div>
            
            <div className="reviews-list-v2">
                {reviews.length === 0 ? (
                    <div className="empty-state">
                        <p>No reviews found</p>
                    </div>
                ) : (
                    reviews.map(review => (
                        <div 
                            key={review.id} 
                            className={`review-row ${review.is_hidden ? 'hidden' : ''} ${expandedReview === review.id ? 'expanded' : ''}`}
                            onClick={() => setExpandedReview(expandedReview === review.id ? null : review.id)}
                        >
                            <div className="review-row-main">
                                <div className="review-date">
                                    {formatDate(review.created_at)}
                                </div>
                                
                                <div className="review-participants">
                                    <span className="review-from">{review.from_username}</span>
                                    <span className="review-arrow">→</span>
                                    <span className="review-to">{review.to_username}</span>
                                </div>
                                
                                <div className="review-stars">
                                    {'⭐'.repeat(review.overall_rating)}
                                    <span className="review-score">({review.overall_rating}/5)</span>
                                </div>
                                
                                <div className="review-preview">
                                    {review.comment ? (
                                        review.comment.length > 50 
                                            ? `"${review.comment.substring(0, 50)}..."` 
                                            : `"${review.comment}"`
                                    ) : (
                                        <span className="no-comment">No comment</span>
                                    )}
                                </div>
                                
                                <div className="review-badges">
                                    {review.is_hidden && <span className="badge badge-warning">Hidden</span>}
                                    {review.is_flagged && <span className="badge badge-danger">Flagged</span>}
                                </div>
                                
                                <div className="review-row-actions" onClick={e => e.stopPropagation()}>
                                    <button 
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => onHide(review.id, !review.is_hidden)}
                                    >
                                        {review.is_hidden ? 'Show' : 'Hide'}
                                    </button>
                                    <button 
                                        className="btn btn-danger btn-sm"
                                        onClick={() => onDelete(review.id)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                            
                            {expandedReview === review.id && review.comment && (
                                <div className="review-expanded">
                                    <div className="review-full-comment">
                                        <strong>Full Comment:</strong>
                                        <p>"{review.comment}"</p>
                                    </div>
                                    {review.communication_rating && (
                                        <div className="review-details">
                                            <span>Communication: {'⭐'.repeat(review.communication_rating)}</span>
                                            <span>Shipping: {'⭐'.repeat(review.shipping_rating)}</span>
                                            <span>Card Condition: {'⭐'.repeat(review.card_condition_rating)}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
            
            {total > 20 && (
                <Pagination 
                    currentPage={page}
                    totalPages={Math.ceil(total / 20)}
                    onPageChange={onPageChange}
                />
            )}
        </div>
    );
};

// Users Tab - List mode with inline actions
const UsersTab = ({ user }) => {
    const [users, setUsers] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [search, setSearch] = React.useState('');
    const { success, error } = useToast();
    
    React.useEffect(() => {
        loadUsers();
    }, []);
    
    const loadUsers = async (searchTerm = '') => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ limit: '100' });
            if (searchTerm) params.append('search', searchTerm);
            
            const response = await fetch(`/api/admin/users?${params}`, {
                headers: { 'X-User-Id': String(user.id) }
            });
            const data = await response.json();
            
            if (data.success) {
                setUsers(data.users || []);
            } else {
                console.error('Failed to load users:', data.error);
                setUsers([]);
            }
        } catch (err) {
            console.error('Load users error:', err);
            setUsers([]);
        }
        setLoading(false);
    };
    
    const toggleAdmin = async (userId, currentStatus) => {
        try {
            const response = await fetch(`/api/admin/users/${userId}/admin`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': String(user.id)
                },
                body: JSON.stringify({ isAdmin: !currentStatus })
            });
            
            if (response.ok) {
                success(currentStatus ? 'Admin rights removed' : 'Admin rights granted');
                loadUsers(search);
            } else {
                error('Failed to update user');
            }
        } catch (err) {
            error('Error updating user');
        }
    };

    const toggleSuspend = async (userId, currentStatus) => {
        try {
            const response = await fetch(`/api/admin/users/${userId}/suspend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': String(user.id)
                },
                body: JSON.stringify({ suspended: !currentStatus })
            });
            
            if (response.ok) {
                success(currentStatus ? 'User unsuspended' : 'User suspended');
                loadUsers(search);
            } else {
                error('Failed to update user');
            }
        } catch (err) {
            error('Error updating user');
        }
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        });
    };
    
    return (
        <div className="admin-users-content">
            <div className="users-controls">
                <div className="search-row">
                    <input 
                        type="text"
                        placeholder="Search users by name or email..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && loadUsers(search)}
                    />
                    <button className="btn btn-primary" onClick={() => loadUsers(search)}>
                        Search
                    </button>
                </div>
                <span className="users-count">{users.length} users</span>
            </div>
            
            {loading ? (
                <Loading message="Loading users..." />
            ) : users.length === 0 ? (
                <div className="empty-state">
                    <p>No users found</p>
                </div>
            ) : (
                <div className="users-list">
                    <div className="users-list-header">
                        <div className="col-num">#</div>
                        <div className="col-user">User</div>
                        <div className="col-email">Email</div>
                        <div className="col-stats">Trades</div>
                        <div className="col-stats">Rating</div>
                        <div className="col-date">Joined</div>
                        <div className="col-status">Status</div>
                        <div className="col-actions">Actions</div>
                    </div>
                    {users.map((u) => (
                        <div key={u.id} className={`users-list-row ${u.is_suspended === 1 || u.is_suspended === true ? 'suspended' : ''}`}>
                            <div className="col-num">{u.id}</div>
                            <div className="col-user">
                                <div className="user-avatar-sm">
                                    {u.profile_picture ? (
                                        <img src={u.profile_picture} alt={u.username} />
                                    ) : (
                                        <span>{u.username.substring(0, 2).toUpperCase()}</span>
                                    )}
                                </div>
                                <span className="username">{u.username}</span>
                            </div>
                            <div className="col-email">{u.email}</div>
                            <div className="col-stats">{u.trades_count || 0}</div>
                            <div className="col-stats">
                                {u.rating ? `⭐ ${parseFloat(u.rating).toFixed(1)}` : '—'}
                            </div>
                            <div className="col-date">{formatDate(u.created_at)}</div>
                            <div className="col-status">
                                {u.is_suspended === 1 || u.is_suspended === true ? <span className="badge badge-danger">Suspended</span> : null}
                                {u.is_admin === 1 || u.is_admin === true ? <span className="badge badge-admin">Admin</span> : null}
                                {(u.is_admin !== 1 && u.is_admin !== true) && (u.is_suspended !== 1 && u.is_suspended !== true) ? <span className="badge badge-user">User</span> : null}
                            </div>
                            <div className="col-actions">
                                {u.id !== user.id ? (
                                    <>
                                        <button 
                                            className={`btn btn-sm ${u.is_admin ? 'btn-warning' : 'btn-secondary'}`}
                                            onClick={() => toggleAdmin(u.id, u.is_admin)}
                                            title={u.is_admin ? 'Remove Admin' : 'Make Admin'}
                                        >
                                            {u.is_admin ? '👤 Demote' : '🛡️ Admin'}
                                        </button>
                                        <button 
                                            className={`btn btn-sm ${u.is_suspended ? 'btn-success' : 'btn-danger'}`}
                                            onClick={() => toggleSuspend(u.id, u.is_suspended)}
                                            title={u.is_suspended ? 'Unsuspend User' : 'Suspend User'}
                                        >
                                            {u.is_suspended ? '✓ Unsuspend' : '🚫 Suspend'}
                                        </button>
                                    </>
                                ) : (
                                    <span className="current-user-tag">You</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Cards Tab - Add missing cards to sets
const CardsTab = ({ user }) => {
    const [sets, setSets] = React.useState([]);
    const [selectedSet, setSelectedSet] = React.useState(null);
    const [setCards, setSetCards] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [showAddModal, setShowAddModal] = React.useState(false);
    const { success, error } = useToast();
    
    // New card form state
    const [newCard, setNewCard] = React.useState({
        name: '',
        number: '',
        rarity: 'Common',
        supertype: 'Pokémon',
        subtypes: '',
        hp: '',
        types: '',
        imageSmall: '',
        imageLarge: ''
    });
    
    React.useEffect(() => {
        loadSets();
    }, []);
    
    const loadSets = async () => {
        const result = await PokemonAPI.getSets();
        if (result.success) {
            setSets(result.data);
        }
    };
    
    const loadSetCards = async (setId) => {
        setLoading(true);
        try {
            const result = await PokemonAPI.getCardsFromSet(setId, 1, 500);
            if (result.success) {
                setSetCards(result.data.sort((a, b) => {
                    const numA = parseInt(a.number) || 0;
                    const numB = parseInt(b.number) || 0;
                    return numA - numB;
                }));
            }
        } catch (err) {
            console.error('Error loading cards:', err);
        }
        setLoading(false);
    };
    
    const handleSetChange = (setId) => {
        setSelectedSet(setId);
        if (setId) {
            loadSetCards(setId);
            // Pre-fill set info for new card
            const set = sets.find(s => s.id === setId);
            if (set) {
                setNewCard(prev => ({ ...prev, setId, setName: set.name }));
            }
        } else {
            setSetCards([]);
        }
    };
    
    const handleAddCard = async () => {
        if (!newCard.name || !newCard.number || !selectedSet) {
            error('Please fill in card name, number, and select a set');
            return;
        }
        
        try {
            const response = await fetch('/api/admin/cards', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': String(user.id)
                },
                body: JSON.stringify({
                    ...newCard,
                    setId: selectedSet
                })
            });
            
            
            
            if (data.success) {
                success(`Card "${newCard.name}" added successfully!`);
                setShowAddModal(false);
                setNewCard({
                    name: '',
                    number: '',
                    rarity: 'Common',
                    supertype: 'Pokémon',
                    subtypes: '',
                    hp: '',
                    types: '',
                    imageSmall: '',
                    imageLarge: ''
                });
                loadSetCards(selectedSet);
            } else {
                error(data.error || 'Failed to add card');
            }
        } catch (err) {
            error('Error adding card');
            console.error(err);
        }
    };
    
    const handleDeleteCard = async (cardId, cardName) => {
        if (!confirm(`Delete "${cardName}" from the database? This cannot be undone.`)) return;
        
        try {
            const response = await fetch(`/api/admin/cards/${cardId}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': String(user.id) }
            });
            
            if (response.ok) {
                success('Card deleted');
                loadSetCards(selectedSet);
            } else {
                error('Failed to delete card');
            }
        } catch (err) {
            error('Error deleting card');
        }
    };
    
    const selectedSetInfo = sets.find(s => s.id === selectedSet);
    
    return (
        <div className="admin-cards-content">
            <div className="cards-controls">
                <div className="set-select-row">
                    <label>Select Set:</label>
                    <select 
                        value={selectedSet || ''} 
                        onChange={e => handleSetChange(e.target.value)}
                        className="set-select"
                    >
                        <option value="">Choose a set...</option>
                        {sets.map(set => (
                            <option key={set.id} value={set.id}>
                                {set.name} ({set.total} cards)
                            </option>
                        ))}
                    </select>
                </div>
                
                {selectedSet && (
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        ➕ Add Missing Card
                    </button>
                )}
            </div>
            
            {selectedSet && selectedSetInfo && (
                <div className="set-info-bar">
                    <span className="set-name">{selectedSetInfo.name}</span>
                    <span className="set-stats">
                        {setCards.length} cards in database / {selectedSetInfo.total} total
                    </span>
                </div>
            )}
            
            {loading ? (
                <Loading message="Loading cards..." />
            ) : selectedSet ? (
                <div className="admin-cards-list">
                    <div className="admin-cards-grid-header">
                        <div className="col-num">#</div>
                        <div className="col-image">Image</div>
                        <div className="col-name">Name</div>
                        <div className="col-rarity">Rarity</div>
                        <div className="col-type">Type</div>
                        <div className="col-actions">Actions</div>
                    </div>
                    {setCards.map(card => (
                        <div key={card.id} className="admin-card-row">
                            <div className="col-num">{card.number}</div>
                            <div className="col-image">
                                <img src={card.images?.small || card.imageSmall} alt={card.name} />
                            </div>
                            <div className="col-name">{card.name}</div>
                            <div className="col-rarity">{card.rarity || '—'}</div>
                            <div className="col-type">{card.supertype}</div>
                            <div className="col-actions">
                                <button 
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handleDeleteCard(card.id, card.name)}
                                >
                                    🗑️
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <p>Select a set to view and manage its cards</p>
                </div>
            )}
            
            {/* Add Card Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal add-card-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>Add Missing Card to {selectedSetInfo?.name}</h3>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
                        </div>
                        
                        <div className="add-card-form">
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Card Name *</label>
                                    <input 
                                        type="text" 
                                        value={newCard.name}
                                        onChange={e => setNewCard(prev => ({ ...prev, name: e.target.value }))}
                                        placeholder="e.g., Pikachu"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Card Number *</label>
                                    <input 
                                        type="text" 
                                        value={newCard.number}
                                        onChange={e => setNewCard(prev => ({ ...prev, number: e.target.value }))}
                                        placeholder="e.g., 25 or TG15"
                                    />
                                </div>
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>Supertype</label>
                                    <select 
                                        value={newCard.supertype}
                                        onChange={e => setNewCard(prev => ({ ...prev, supertype: e.target.value }))}
                                    >
                                        <option value="Pokémon">Pokémon</option>
                                        <option value="Trainer">Trainer</option>
                                        <option value="Energy">Energy</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Rarity</label>
                                    <select 
                                        value={newCard.rarity}
                                        onChange={e => setNewCard(prev => ({ ...prev, rarity: e.target.value }))}
                                    >
                                        <option value="Common">Common</option>
                                        <option value="Uncommon">Uncommon</option>
                                        <option value="Rare">Rare</option>
                                        <option value="Rare Holo">Rare Holo</option>
                                        <option value="Rare Ultra">Rare Ultra</option>
                                        <option value="Rare Holo EX">Rare Holo EX</option>
                                        <option value="Rare Holo GX">Rare Holo GX</option>
                                        <option value="Rare Holo V">Rare Holo V</option>
                                        <option value="Rare Holo VMAX">Rare Holo VMAX</option>
                                        <option value="Rare Holo VSTAR">Rare Holo VSTAR</option>
                                        <option value="Double Rare">Double Rare</option>
                                        <option value="Illustration Rare">Illustration Rare</option>
                                        <option value="Special Illustration Rare">Special Illustration Rare</option>
                                        <option value="Ultra Rare">Ultra Rare</option>
                                        <option value="Hyper Rare">Hyper Rare</option>
                                        <option value="Shiny Rare">Shiny Rare</option>
                                        <option value="Shiny Ultra Rare">Shiny Ultra Rare</option>
                                        <option value="ACE SPEC Rare">ACE SPEC Rare</option>
                                        <option value="Promo">Promo</option>
                                    </select>
                                </div>
                            </div>
                            
                            <div className="form-row">
                                <div className="form-group">
                                    <label>HP (for Pokémon)</label>
                                    <input 
                                        type="text" 
                                        value={newCard.hp}
                                        onChange={e => setNewCard(prev => ({ ...prev, hp: e.target.value }))}
                                        placeholder="e.g., 60"
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Types (comma-separated)</label>
                                    <input 
                                        type="text" 
                                        value={newCard.types}
                                        onChange={e => setNewCard(prev => ({ ...prev, types: e.target.value }))}
                                        placeholder="e.g., Lightning, Fire"
                                    />
                                </div>
                            </div>
                            
                            <div className="form-group">
                                <label>Small Image URL</label>
                                <input 
                                    type="text" 
                                    value={newCard.imageSmall}
                                    onChange={e => setNewCard(prev => ({ ...prev, imageSmall: e.target.value }))}
                                    placeholder="https://..."
                                />
                            </div>
                            
                            <div className="form-group">
                                <label>Large Image URL</label>
                                <input 
                                    type="text" 
                                    value={newCard.imageLarge}
                                    onChange={e => setNewCard(prev => ({ ...prev, imageLarge: e.target.value }))}
                                    placeholder="https://..."
                                />
                            </div>
                            
                            {(newCard.imageSmall || newCard.imageLarge) && (
                                <div className="image-preview">
                                    <img src={newCard.imageSmall || newCard.imageLarge} alt="Preview" />
                                </div>
                            )}
                            
                            <div className="form-actions">
                                <button className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button className="btn btn-primary" onClick={handleAddCard}>
                                    ➕ Add Card
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// Product Images Tab - Admin manages product images
const ProductImagesTab = ({ user }) => {
    const { success, error } = useToast();
    const [images, setImages] = React.useState([]);
    const [pendingImages, setPendingImages] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState('all');
    const [typeFilter, setTypeFilter] = React.useState('all');
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    
    const productTypes = [
        { value: 'etb', label: 'Elite Trainer Box (ETB)' },
        { value: 'booster_box', label: 'Booster Box' },
        { value: 'single_pack', label: 'Single Pack' },
        { value: 'collection_box', label: 'Collection Box' },
        { value: 'tin', label: 'Tin' },
        { value: 'blister', label: 'Blister Pack' },
        { value: 'other', label: 'Other' }
    ];
    
    React.useEffect(() => {
        loadImages();
        loadPendingImages();
    }, [filter, typeFilter]);
    
    const loadImages = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ status: filter, product_type: typeFilter });
            const response = await fetch(`/api/admin/product-images?${params}`, {
                headers: { "X-User-Id": user.id }
            });
            const data = await response.json();
            if (data.success) {
                setImages(data.images);
            }
        } catch (err) {
            error('Failed to load images');
        } finally {
            setLoading(false);
        }
    };
    
    const loadPendingImages = async () => {
        try {
            const response = await fetch('/api/admin/product-images/pending', {
                headers: { 'X-User-Id': user.id }
            });
            
            if (data.success) {
                setPendingImages(data.images);
            }
        } catch (err) {
            console.error('Failed to load pending images:', err);
        }
    };
    
    const handleReview = async (imageId, status) => {
        try {
            const response = await fetch(`/api/admin/product-images/${imageId}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Id': user.id
                },
                body: JSON.stringify({ status })
            });
            
            if (data.success) {
                success(`Image ${status}`);
                loadPendingImages();
                loadImages();
            } else {
                error(data.error);
            }
        } catch (err) {
            error('Failed to review image');
        }
    };
    
    const handleDelete = async (imageId) => {
        if (!confirm('Are you sure you want to delete this image?')) return;
        
        try {
            const response = await fetch(`/api/admin/product-images/${imageId}`, {
                method: 'DELETE',
                headers: { 'X-User-Id': user.id }
            });
            
            if (data.success) {
                success('Image deleted');
                loadImages();
            } else {
                error(data.error);
            }
        } catch (err) {
            error('Failed to delete image');
        }
    };
    
    const getTypeLabel = (type) => {
        const pt = productTypes.find(p => p.value === type);
        return pt ? pt.label : type;
    };
    
    return (
        <div className="admin-settings-content">
            <h3>📸 Product Images</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                Upload and manage product images. User uploads require approval.
            </p>
            
            {/* Pending Review Section */}
            {pendingImages.length > 0 && (
                <div style={{ 
                    background: 'rgba(255,193,7,0.1)', 
                    border: '1px solid rgba(255,193,7,0.3)',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    marginBottom: '2rem'
                }}>
                    <h4 style={{ color: '#ffc107', marginBottom: '1rem' }}>
                        ⏳ Pending Review ({pendingImages.length})
                    </h4>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                        gap: '1rem'
                    }}>
                        {pendingImages.map(img => (
                            <div key={img.id} style={{
                                background: 'rgba(0,0,0,0.3)',
                                borderRadius: '8px',
                                overflow: 'hidden'
                            }}>
                                <img 
                                    src={img.image_path} 
                                    alt={img.product_name || 'Product'}
                                    style={{ width: '100%', height: '150px', objectFit: 'contain', background: '#1a1a2e' }}
                                />
                                <div style={{ padding: '0.75rem' }}>
                                    <p style={{ fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                        {img.product_name || 'Unnamed'}
                                    </p>
                                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                        {getTypeLabel(img.product_type)} • {img.set_name || 'No set'}
                                    </p>
                                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
                                        By: {img.uploaded_by_name || 'Unknown'}
                                    </p>
                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                                        <button 
                                            className="btn btn-primary"
                                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem' }}
                                            onClick={() => handleReview(img.id, 'approved')}
                                        >
                                            ✓ Approve
                                        </button>
                                        <button 
                                            className="btn btn-secondary"
                                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.8rem', color: '#dc3545' }}
                                            onClick={() => handleReview(img.id, 'rejected')}
                                        >
                                            ✗ Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* Controls */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <select
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white'
                        }}
                    >
                        <option value="all">All Status</option>
                        <option value="approved">Approved</option>
                        <option value="pending">Pending</option>
                    </select>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        style={{
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.2)',
                            color: 'white'
                        }}
                    >
                        <option value="all">All Types</option>
                        {productTypes.map(pt => (
                            <option key={pt.value} value={pt.value}>{pt.label}</option>
                        ))}
                    </select>
                </div>
                
                <button 
                    className="btn btn-primary"
                    onClick={() => setShowUploadModal(true)}
                >
                    ➕ Upload Image
                </button>
            </div>
            
            {/* Images Grid */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="pokeball-spinner"></div>
                    <p>Loading images...</p>
                </div>
            ) : images.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📸</div>
                    <p>No product images yet</p>
                    <button 
                        className="btn btn-primary" 
                        style={{ marginTop: '1rem' }}
                        onClick={() => setShowUploadModal(true)}
                    >
                        Upload First Image
                    </button>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '1rem'
                }}>
                    {images.map(img => (
                        <div key={img.id} style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ position: 'relative' }}>
                                <img 
                                    src={img.image_path} 
                                    alt={img.product_name || 'Product'}
                                    style={{ width: '100%', height: '160px', objectFit: 'contain', background: '#1a1a2e' }}
                                />
                                {img.is_default === 1 && (
                                    <span style={{
                                        position: 'absolute',
                                        top: '8px',
                                        right: '8px',
                                        background: 'var(--poke-yellow)',
                                        color: '#000',
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '4px',
                                        fontSize: '0.65rem',
                                        fontWeight: 'bold'
                                    }}>
                                        DEFAULT
                                    </span>
                                )}
                                <span style={{
                                    position: 'absolute',
                                    top: '8px',
                                    left: '8px',
                                    background: img.status === 'approved' ? '#28a745' : '#ffc107',
                                    color: img.status === 'approved' ? 'white' : '#000',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.65rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase'
                                }}>
                                    {img.status}
                                </span>
                            </div>
                            <div style={{ padding: '0.75rem' }}>
                                <p style={{ fontWeight: '500', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                                    {img.product_name || 'Unnamed Product'}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--poke-yellow)' }}>
                                    {getTypeLabel(img.product_type)}
                                </p>
                                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                    {img.set_name || 'No set specified'}
                                </p>
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'flex-end',
                                    marginTop: '0.75rem',
                                    gap: '0.5rem'
                                }}>
                                    <button 
                                        className="btn btn-secondary"
                                        style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', color: '#dc3545' }}
                                        onClick={() => handleDelete(img.id)}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Upload Modal */}
            {showUploadModal && (
                <ProductImageUploadModal
                    user={user}
                    productTypes={productTypes}
                    onClose={() => setShowUploadModal(false)}
                    onSuccess={() => {
                        setShowUploadModal(false);
                        loadImages();
                        success('Image uploaded successfully!');
                    }}
                />
            )}
        </div>
    );
};


// Product Image Upload Modal
const ProductImageUploadModal = ({ user, productTypes, onClose, onSuccess }) => {
    const { error } = useToast();
    const [form, setForm] = React.useState({
        product_type: 'etb',
        set_id: '',
        set_name: '',
        product_name: '',
        is_default: false
    });
    const [sets, setSets] = React.useState([]);
    const [file, setFile] = React.useState(null);
    const [preview, setPreview] = React.useState(null);
    const [uploading, setUploading] = React.useState(false);
    
    // Load sets on mount
    React.useEffect(() => {
        loadSets();
    }, []);
    
    // Auto-fill product name when set or type changes
    React.useEffect(() => {
        if (form.set_name && form.product_type) {
            const typeLabel = productTypes.find(pt => pt.value === form.product_type)?.label || '';
            // Extract short type name
            const shortType = typeLabel.replace(/\s*\(.*\)/, ''); // Remove (ETB) etc
            setForm(prev => ({
                ...prev,
                product_name: `${prev.set_name} ${shortType}`
            }));
        }
    }, [form.set_name, form.product_type]);
    
    const loadSets = async () => {
        try {
            const result = await PokemonAPI.getSets();
            
            if (result.success) {
                // Sort by release date descending (newest first)
                const sortedSets = result.data.sort((a, b) => 
                    new Date(b.releaseDate || 0) - new Date(a.releaseDate || 0)
                );
                setSets(sortedSets);
            }
        } catch (err) {
            console.error('Failed to load sets:', err);
        }
    };
    
    const handleSetChange = (e) => {
        const selectedSetId = e.target.value;
        const selectedSet = sets.find(s => s.id === selectedSetId);
        setForm(prev => ({
            ...prev,
            set_id: selectedSetId,
            set_name: selectedSet ? selectedSet.name : ''
        }));
    };
    
    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 5 * 1024 * 1024) {
                error('File too large. Max 5MB.');
                return;
            }
            setFile(selectedFile);
            setPreview(URL.createObjectURL(selectedFile));
        }
    };
    
    const handleUpload = async () => {
        if (!file) {
            error('Please select an image');
            return;
        }
        if (!form.product_name.trim()) {
            error('Product name is required');
            return;
        }
        
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            formData.append('product_type', form.product_type);
            formData.append('set_name', form.set_name);
            formData.append('product_name', form.product_name);
            formData.append('is_default', form.is_default ? '1' : '0');
            
            const response = await fetch('/api/admin/product-images/upload', {
                method: 'POST',
                headers: { 'X-User-Id': user.id },
                body: formData
            });
            const data = await response.json();
            
            
            if (data.success) {
                onSuccess();
            } else {
                error(data.error);
            }
        } catch (err) {
            error('Upload failed');
        } finally {
            setUploading(false);
        }
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>📸 Upload Product Image</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Image Upload */}
                    <div style={{
                        border: '2px dashed rgba(255,255,255,0.3)',
                        borderRadius: '12px',
                        padding: '2rem',
                        textAlign: 'center',
                        background: 'rgba(0,0,0,0.2)'
                    }}>
                        {preview ? (
                            <div>
                                <img 
                                    src={preview} 
                                    alt="Preview" 
                                    style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px' }}
                                />
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ marginTop: '1rem' }}
                                    onClick={() => { setFile(null); setPreview(null); }}
                                >
                                    Change Image
                                </button>
                            </div>
                        ) : (
                            <label style={{ cursor: 'pointer', display: 'block' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📷</div>
                                <p>Click to select image</p>
                                <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                    JPG, PNG, WebP • Max 5MB
                                </p>
                                <input 
                                    type="file" 
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handleFileChange}
                                    style={{ display: 'none' }}
                                />
                            </label>
                        )}
                    </div>
                    
                    {/* Product Type */}
                    <div className="form-group">
                        <label>Product Type *</label>
                        <select
                            value={form.product_type}
                            onChange={e => setForm({ ...form, product_type: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                        >
                            {productTypes.map(pt => (
                                <option key={pt.value} value={pt.value}>{pt.label}</option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Set Selection */}
                    <div className="form-group">
                        <label>Set/Series *</label>
                        <select
                            value={form.set_id}
                            onChange={handleSetChange}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                        >
                            <option value="">Select a set...</option>
                            {sets.map(set => (
                                <option key={set.id} value={set.id}>
                                    {set.name} {set.releaseDate ? `(${set.releaseDate.substring(0, 4)})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Product Name (auto-filled but editable) */}
                    <div className="form-group">
                        <label>Product Name *</label>
                        <input
                            type="text"
                            value={form.product_name}
                            onChange={e => setForm({ ...form, product_name: e.target.value })}
                            placeholder="e.g., Surging Sparks Elite Trainer Box"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                        />
                        <small style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                            Auto-filled based on set and type. Edit if needed.
                        </small>
                    </div>
                    
                    {/* Is Default */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                        <input
                            type="checkbox"
                            checked={form.is_default}
                            onChange={e => setForm({ ...form, is_default: e.target.checked })}
                        />
                        Set as default image for this product type + set
                    </label>
                    
                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={onClose} 
                            style={{ flex: 1 }}
                        >
                            Cancel
                        </button>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleUpload}
                            disabled={uploading || !file || !form.set_name}
                            style={{ flex: 1 }}
                        >
                            {uploading ? 'Uploading...' : '📸 Upload'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};


window.AdminSettingsPage = AdminSettingsPage;
