/* ===================================
   Trade Match Page - Find Trading Partners
   =================================== */

const TradeMatchPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { success, error } = useToast();
    const [matches, setMatches] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedMatch, setSelectedMatch] = React.useState(null);
    const [matchDetails, setMatchDetails] = React.useState(null);
    const [detailsLoading, setDetailsLoading] = React.useState(false);
    const [myWants, setMyWants] = React.useState([]);
    const [myHaves, setMyHaves] = React.useState([]);
    const [activeTab, setActiveTab] = React.useState('matches');

    React.useEffect(() => {
        if (user) {
            loadMatches();
            loadMyWantsAndHaves();
        }
    }, [user]);

    const loadMatches = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/trading/matches/${user.id}`);
            const data = await res.json();
            if (data.success) {
                setMatches(data.data);
            } else {
                error('Failed to load matches');
            }
        } catch (err) {
            error('Error loading matches: ' + err.message);
        }
        setLoading(false);
    };

    const loadMyWantsAndHaves = async () => {
        try {
            const [wantsRes, havesRes] = await Promise.all([
                fetch(`/api/trading/my-wants/${user.id}`),
                fetch(`/api/trading/my-haves/${user.id}`)
            ]);
            const wantsData = await wantsRes.json();
            const havesData = await havesRes.json();
            
            if (wantsData.success) setMyWants(wantsData.data);
            if (havesData.success) setMyHaves(havesData.data);
        } catch (err) {
            console.error('Error loading wants/haves:', err);
        }
    };

    const viewMatchDetails = async (match) => {
        setSelectedMatch(match);
        setDetailsLoading(true);
        try {
            const res = await fetch(`/api/trading/match-details/${user.id}/${match.user_id}`);
            const data = await res.json();
            if (data.success) {
                setMatchDetails(data.data);
            }
        } catch (err) {
            error('Error loading match details');
        }
        setDetailsLoading(false);
    };

    const closeDetails = () => {
        setSelectedMatch(null);
        setMatchDetails(null);
    };

    const formatPrice = (price) => {
        if (price === null || price === undefined) return '-';
        const num = typeof price === 'number' ? price : parseFloat(price);
        return isNaN(num) ? '-' : '$' + num.toFixed(2);
    };

    if (!user) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-icon">🔐</div>
                    <h3>Sign In Required</h3>
                    <p>Please sign in to find trade matches</p>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="section">
            <div className="section-header">
                <h2>🔄 Trade Matcher</h2>
                <p>Find traders who have cards you need and want cards you have</p>
            </div>

            <div className="tabs" style={{ marginBottom: '1.5rem' }}>
                <button
                    className={`tab ${activeTab === 'matches' ? 'active' : ''}`}
                    onClick={() => setActiveTab('matches')}
                >
                    Trade Matches {matches.length > 0 && `(${matches.length})`}
                </button>
                <button
                    className={`tab ${activeTab === 'wants' ? 'active' : ''}`}
                    onClick={() => setActiveTab('wants')}
                >
                    My Wants ({myWants.length})
                </button>
                <button
                    className={`tab ${activeTab === 'haves' ? 'active' : ''}`}
                    onClick={() => setActiveTab('haves')}
                >
                    My Haves ({myHaves.length})
                </button>
            </div>

            {activeTab === 'matches' && (
                <MatchesTab 
                    matches={matches} 
                    loading={loading} 
                    onViewDetails={viewMatchDetails}
                    onRefresh={loadMatches}
                    formatPrice={formatPrice}
                    setCurrentPage={setCurrentPage}
                />
            )}

            {activeTab === 'wants' && (
                <WantsHavesTab 
                    cards={myWants} 
                    type="wants"
                    emptyMessage="No missing cards in your collection. Add sets to your Collection first!"
                    formatPrice={formatPrice}
                />
            )}

            {activeTab === 'haves' && (
                <WantsHavesTab 
                    cards={myHaves} 
                    type="haves"
                    emptyMessage="No cards listed for trade. Add cards in My Cards first!"
                    formatPrice={formatPrice}
                />
            )}

            {selectedMatch && (
                <MatchDetailsModal
                    match={selectedMatch}
                    details={matchDetails}
                    loading={detailsLoading}
                    onClose={closeDetails}
                    formatPrice={formatPrice}
                    user={user}
                    onTradeProposed={() => setCurrentPage('my-trades')}
                />
            )}
        </div>
    );
};

/* Matches Tab */
const MatchesTab = ({ matches, loading, onViewDetails, onRefresh, formatPrice, setCurrentPage }) => {
    if (loading) {
        return <Loading message="Finding trade matches..." />;
    }

    if (matches.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No Matches Found</h3>
                <p>No traders found with matching cards.</p>
                <button className="btn btn-secondary" onClick={onRefresh} style={{ marginTop: '1rem' }}>
                    🔄 Refresh Matches
                </button>
            </div>
        );
    }

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                    {matches.length} match{matches.length !== 1 ? 'es' : ''} found
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setCurrentPage('my-trades')}>
                        📋 My Trades
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={onRefresh}>
                        🔄
                    </button>
                </div>
            </div>

            <div className="match-grid">
                {matches.map(match => (
                    <CompactMatchCard 
                        key={match.user_id} 
                        match={match} 
                        onViewDetails={onViewDetails} 
                        formatPrice={formatPrice} 
                    />
                ))}
            </div>
        </>
    );
};

/* Compact Match Card */
/* Compact Match Card */
const CompactMatchCard = ({ match, onViewDetails, formatPrice }) => {
    const theyHaveCount = match.they_have.length;
    const theyWantCount = match.they_want.length;
    const hasPending = match.pending_trade !== null;
    const isSender = hasPending && match.pending_trade.is_sender;

    return (
        <div 
            className={`compact-match-card ${match.mutualMatch ? 'mutual' : ''} ${hasPending ? 'has-pending' : ''}`}
            onClick={() => onViewDetails(match)}
        >
            {match.mutualMatch && !hasPending && <div className="match-ribbon mutual-ribbon">✨</div>}
            {hasPending && (
                <div className={`match-ribbon pending-ribbon ${isSender ? 'sent' : 'received'}`}>
                    {isSender ? '📤' : '📥'}
                </div>
            )}
            
            <div className="compact-match-avatar">👤</div>
            <div className="compact-match-username">{match.username}</div>
            <div className="compact-match-rating">{match.ratings_count > 0 ? `⭐ ${parseFloat(match.rating).toFixed(1)}` : "No ratings"} • {match.trades_count || 0} trades</div>
            
            {hasPending && (
                <div className={`pending-badge ${isSender ? 'sent' : 'received'}`}>
                    {isSender ? 'Offer Sent' : 'Offer Received'}
                </div>
            )}
            
            <div className="compact-match-stats">
                <div className="compact-stat get" title="Cards you can get">
                    <span className="compact-stat-label">Get</span>
                    <span className="compact-stat-count">{theyHaveCount}</span>
                    <span className="compact-stat-value">{formatPrice(match.they_have_value)}</span>
                </div>
                <div className="compact-stat give" title="Cards they want">
                    <span className="compact-stat-label">Give</span>
                    <span className="compact-stat-count">{theyWantCount}</span>
                    <span className="compact-stat-value">{formatPrice(match.they_want_value)}</span>
                </div>
            </div>
        </div>
    );
};
/* Wants/Haves Tab */
const WantsHavesTab = ({ cards, type, emptyMessage, formatPrice }) => {
    const [filter, setFilter] = React.useState('');
    
    const filteredCards = cards.filter(card => 
        card.name.toLowerCase().includes(filter.toLowerCase()) ||
        card.set_name?.toLowerCase().includes(filter.toLowerCase())
    );

    const groupedBySet = filteredCards.reduce((acc, card) => {
        const setName = card.set_name || 'Unknown Set';
        if (!acc[setName]) acc[setName] = { cards: [], totalValue: 0 };
        acc[setName].cards.push(card);
        acc[setName].totalValue += parseFloat(card.price || card.market_price) || 0;
        return acc;
    }, {});

    // Preserve the SQL sort order (Object keys reorder numeric names like "151")
    const setOrder = [];
    filteredCards.forEach(c => {
        const name = c.set_name || 'Unknown Set';
        if (!setOrder.includes(name)) setOrder.push(name);
    });
    const sortedSets = setOrder.map(name => [name, groupedBySet[name]]);

    const totalValue = filteredCards.reduce((sum, card) => sum + (parseFloat(card.price || card.market_price) || 0), 0);

    if (cards.length === 0) {
        return (
            <div className="empty-state">
                <div className="empty-icon">{type === 'wants' ? '📋' : '📦'}</div>
                <h3>No {type === 'wants' ? 'Missing Cards' : 'Cards for Trade'}</h3>
                <p>{emptyMessage}</p>
            </div>
        );
    }

    return (
        <>
            <div className="filter-bar" style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <input
                    type="text"
                    placeholder="Filter by card or set name..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ flex: 1 }}
                />
                <div style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>
                    <div>{filteredCards.length} cards</div>
                    <div style={{ color: 'var(--poke-yellow)', fontWeight: '600' }}>{formatPrice(totalValue)}</div>
                </div>
            </div>

            <div className="wants-haves-list">
                {sortedSets.map(([setName, setData]) => (
                    <div key={setName} className="set-group">
                        <h4 className="set-group-header">
                            {setName} 
                            <span style={{ float: 'right', fontSize: '0.9rem' }}>
                                {setData.cards.length} • {formatPrice(setData.totalValue)}
                            </span>
                        </h4>
                        <div className="card-preview-grid">
                            {setData.cards.map(card => (
                                <div key={card.id || card.card_id} className="mini-card" title={`${card.name} - ${formatPrice(card.price || card.market_price)}`}>
                                    <img src={card.imageSmall} alt={card.name} />
                                    <span className="mini-card-number">#{card.number}</span>
                                    {(card.price || card.market_price) > 0 && (
                                        <span className="mini-card-price">{formatPrice(card.price || card.market_price)}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

/* Match Details Modal */
const MatchDetailsModal = ({ match, details, loading, onClose, formatPrice, user, onTradeProposed }) => {
    const { success, error } = useToast();
    const [selectedToGet, setSelectedToGet] = React.useState(new Set());
    const [selectedToGive, setSelectedToGive] = React.useState(new Set());
    const [message, setMessage] = React.useState('');
    const [proposing, setProposing] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('trade');
    const [ratings, setRatings] = React.useState({ ratings: [], stats: null });
    const [loadingRatings, setLoadingRatings] = React.useState(false);

    // Load ratings when tab switches to ratings
    React.useEffect(() => {
        if (activeTab === 'ratings' && ratings.ratings.length === 0) {
            loadRatings();
        }
    }, [activeTab]);

    const loadRatings = async () => {
        setLoadingRatings(true);
        try {
            const res = await fetch(`/api/users/${match.user_id}/ratings`);
            const data = await res.json();
            if (data.success) {
                setRatings(data.data);
            }
        } catch (err) {
            console.error('Error loading ratings:', err);
        }
        setLoadingRatings(false);
    };

    const toggleCard = (cardId, type) => {
        if (type === 'get') {
            const newSet = new Set(selectedToGet);
            if (newSet.has(cardId)) newSet.delete(cardId);
            else newSet.add(cardId);
            setSelectedToGet(newSet);
        } else {
            const newSet = new Set(selectedToGive);
            if (newSet.has(cardId)) newSet.delete(cardId);
            else newSet.add(cardId);
            setSelectedToGive(newSet);
        }
    };

    const getSelectedCards = (cards, selectedIds) => {
        return cards.filter(c => selectedIds.has(c.listing_id));
    };

    const getSelectedValue = (cards, selectedIds) => {
        return cards
            .filter(c => selectedIds.has(c.listing_id))
            .reduce((sum, c) => sum + (c.market_price || 0), 0);
    };

    const selectedGetValue = details ? getSelectedValue(details.theyHave, selectedToGet) : 0;
    const selectedGiveValue = details ? getSelectedValue(details.theyWant, selectedToGive) : 0;
    const tradeDiff = selectedGetValue - selectedGiveValue;

    const handleProposeTrade = async () => {
        if (selectedToGet.size === 0 && selectedToGive.size === 0) {
            error('Please select at least one card');
            return;
        }

        setProposing(true);
        try {
            const cardsToGet = getSelectedCards(details.theyHave, selectedToGet);
            const cardsToGive = getSelectedCards(details.theyWant, selectedToGive);

            const res = await fetch('/api/trading/propose', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fromUserId: user.id,
                    toUserId: match.user_id,
                    cardsToGet,
                    cardsToGive,
                    message: message || null
                })
            });

            const data = await res.json();
            if (data.success) {
                success('Trade proposal sent!');
                onClose();
                if (onTradeProposed) onTradeProposed();
            } else {
                error(data.error || 'Failed to send trade proposal');
            }
        } catch (err) {
            error('Error: ' + err.message);
        }
        setProposing(false);
    };

    const formatTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now - date) / 86400000);
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Yesterday';
        if (diffDays < 30) return `${diffDays} days ago`;
        if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
        return `${Math.floor(diffDays / 365)} years ago`;
    };

    const renderStars = (rating) => {
        return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Trade with {match.username}</h3>
                    <div className="modal-user-rating">
                        {match.ratings_count > 0 ? `⭐ ${parseFloat(match.rating).toFixed(1)}` : "No ratings"} • {match.trades_count || 0} trades
                    </div>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {/* Tabs */}
                <div className="modal-tabs">
                    <button className={activeTab === 'trade' ? 'active' : ''} onClick={() => setActiveTab('trade')}>
                        🔄 Trade
                    </button>
                    <button className={activeTab === 'ratings' ? 'active' : ''} onClick={() => setActiveTab('ratings')}>
                        ⭐ Review{match.trades_count === 1 ? '' : 's'} ({match.trades_count || 0})
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'trade' && (
                        <>
                            {loading ? (
                                <Loading message="Loading..." />
                            ) : details ? (
                                <div className="trade-details">
                                    <div className="trade-section">
                                        <h4 className="trade-section-header get">
                                            You Get ({details.theyHave.length})
                                            <span className="section-total">{formatPrice(details.theyHaveTotal)}</span>
                                        </h4>
                                        {details.theyHave.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No matching cards</p>
                                        ) : (
                                            <div className="trade-card-list">
                                                {details.theyHave.map(card => (
                                                    <div 
                                                        key={card.listing_id} 
                                                        className={`trade-card-item ${selectedToGet.has(card.listing_id) ? 'selected' : ''}`}
                                                        onClick={() => toggleCard(card.listing_id, 'get')}
                                                    >
                                                        <img src={card.imageSmall} alt={card.name} />
                                                        <div className="trade-card-info">
                                                            <span className="card-name">{card.name}</span>
                                                            <span className="card-set">{card.set_name} #{card.number}</span>
                                                            <span className="card-details">
                                                                {card.condition_grade} • {card.version}
                                                            </span>
                                                        </div>
                                                        <div className="card-price">{formatPrice(card.market_price)}</div>
                                                        <div className="select-indicator">
                                                            {selectedToGet.has(card.listing_id) ? '✓' : '○'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="trade-section">
                                        <h4 className="trade-section-header give">
                                            You Give ({details.theyWant.length})
                                            <span className="section-total">{formatPrice(details.theyWantTotal)}</span>
                                        </h4>
                                        {details.theyWant.length === 0 ? (
                                            <p style={{ color: 'var(--text-muted)', padding: '1rem' }}>No matching cards</p>
                                        ) : (
                                            <div className="trade-card-list">
                                                {details.theyWant.map(card => (
                                                    <div 
                                                        key={card.listing_id} 
                                                        className={`trade-card-item ${selectedToGive.has(card.listing_id) ? 'selected' : ''}`}
                                                        onClick={() => toggleCard(card.listing_id, 'give')}
                                                    >
                                                        <img src={card.imageSmall} alt={card.name} />
                                                        <div className="trade-card-info">
                                                            <span className="card-name">{card.name}</span>
                                                            <span className="card-set">{card.set_name} #{card.number}</span>
                                                            <span className="card-details">
                                                                {card.condition_grade} • {card.version}
                                                            </span>
                                                        </div>
                                                        <div className="card-price">{formatPrice(card.market_price)}</div>
                                                        <div className="select-indicator">
                                                            {selectedToGive.has(card.listing_id) ? '✓' : '○'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p>Error loading details</p>
                            )}

                            {details && (selectedToGet.size > 0 || selectedToGive.size > 0) && (
                                <div style={{ marginTop: '1rem' }}>
                                    <textarea
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Add a message (optional)..."
                                        style={{ width: '100%', minHeight: '50px', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', resize: 'vertical' }}
                                    />
                                </div>
                            )}
                        </>
                    )}

                    {activeTab === 'ratings' && (
                        <div className="ratings-tab">
                            {loadingRatings ? (
                                <Loading message="Loading reviews..." />
                            ) : ratings.ratings.length === 0 ? (
                                <div className="empty-reviews">
                                    <p>No reviews yet</p>
                                </div>
                            ) : (
                                <div className="reviews-list">
                                    {ratings.ratings.map(review => (
                                        <div key={review.id} className="review-card-combined">
                                            <div className="review-card-header">
                                                <span className="review-user">{review.from_username}</span>
                                                <span className="review-date">{formatTimeAgo(review.created_at)}</span>
                                            </div>
                                            <div className="review-card-body">
                                                <div className="review-rating-left">
                                                    <span className="rating-number">{parseFloat(review.overall_rating).toFixed(1)}</span>
                                                    <span className="rating-stars">{renderStars(review.overall_rating)}</span>
                                                </div>
                                                <div className="review-breakdown">
                                                    <div className="breakdown-row"><span>Communication</span><span>{renderStars(review.communication_rating || review.overall_rating)}</span></div>
                                                    <div className="breakdown-row"><span>Shipping</span><span>{renderStars(review.shipping_rating || review.overall_rating)}</span></div>
                                                    <div className="breakdown-row"><span>Card Condition</span><span>{renderStars(review.card_condition_rating || review.overall_rating)}</span></div>
                                                </div>
                                            </div>
                                            {review.comment && (
                                                <div className="review-card-comment">"{review.comment}"</div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {activeTab === 'trade' && (
                    <div className="modal-footer">
                        <div className="trade-summary">
                            <div className="summary-row">
                                <span>Get: <strong>{selectedToGet.size}</strong></span>
                                <span className="summary-value get">{formatPrice(selectedGetValue)}</span>
                            </div>
                            <div className="summary-row">
                                <span>Give: <strong>{selectedToGive.size}</strong></span>
                                <span className="summary-value give">{formatPrice(selectedGiveValue)}</span>
                            </div>
                            <div className={`summary-row total ${tradeDiff >= 0 ? 'positive' : 'negative'}`}>
                                <span>Balance:</span>
                                <span>{tradeDiff >= 0 ? '+' : ''}{formatPrice(tradeDiff)}</span>
                            </div>
                        </div>
                        <div className="modal-actions">
                            <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                disabled={proposing || (selectedToGet.size === 0 && selectedToGive.size === 0)}
                                onClick={handleProposeTrade}
                            >
                                {proposing ? '⏳...' : '📨 Propose'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'ratings' && (
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Close</button>
                    </div>
                )}
            </div>
        </div>
    );
};

window.TradeMatchPage = TradeMatchPage;
