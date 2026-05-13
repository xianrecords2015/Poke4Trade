/* ===================================
   My Cards Page - Manage Trade/Sale Listings
   =================================== */

const MyCardsPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { success, error } = useToast();
    const [listings, setListings] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [showAddModal, setShowAddModal] = React.useState(false);
    const [editingListing, setEditingListing] = React.useState(null);
    const [filter, setFilter] = React.useState('active');
    const [viewMode, setViewMode] = React.useState('grid');
    const [sortBy, setSortBy] = React.useState('set-number');
    const [lastSync, setLastSync] = React.useState(null);

    const LANGUAGES = ['English', 'French', 'Japanese', 'German', 'Spanish', 'Italian', 'Korean', 'Chinese'];
    const CONDITIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'];
    const VERSIONS = ['Non-Holo', 'Holo', 'Reverse', 'Pokeball', 'Masterball', 'Holographic Staff'];
    const EDITIONS = ['1st', '2nd'];

    React.useEffect(() => {
        if (user) {
            fetchListings();
            fetchSyncStatus();
        }
    }, [user, filter]);

    const fetchSyncStatus = async () => {
        try {
            const res = await fetch('/api/sync/status');
            const data = await res.json();
            if (data.success) {
                setLastSync(data.lastCardSync);
            }
        } catch (err) {
            console.error('Failed to fetch sync status');
        }
    };

    const fetchListings = async () => {
        setLoading(true);
        try {
            const url = filter === 'all' 
                ? '/api/listings/' + user.id 
                : '/api/listings/' + user.id + '?status=' + filter;
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
                setListings(data.listings);
            }
        } catch (err) {
            error('Failed to load listings');
        } finally {
            setLoading(false);
        }
    };

    // Sort listings based on current sort option
    const sortedListings = React.useMemo(() => {
        const sorted = [...listings];
        
        switch (sortBy) {
            case 'set-number':
                sorted.sort((a, b) => {
                    const dateA = a.set_release_date ? new Date(a.set_release_date) : new Date(0);
                    const dateB = b.set_release_date ? new Date(b.set_release_date) : new Date(0);
                    const dateCompare = dateB - dateA;
                    if (dateCompare !== 0) return dateCompare;
                    
                    const setIdA = a.set_id || '';
                    const setIdB = b.set_id || '';
                    const isGalleryA = /(?:gg|tg)$/i.test(setIdA);
                    const isGalleryB = /(?:gg|tg)$/i.test(setIdB);
                    
                    if (!isGalleryA && isGalleryB) return -1;
                    if (isGalleryA && !isGalleryB) return 1;
                    
                    if (setIdA !== setIdB) {
                        return (a.set_name || '').localeCompare(b.set_name || '');
                    }
                    
                    const numA = a.card_number || '';
                    const numB = b.card_number || '';
                    const isSpecialA = /^[A-Za-z]/.test(numA);
                    const isSpecialB = /^[A-Za-z]/.test(numB);
                    
                    if (!isSpecialA && isSpecialB) return -1;
                    if (isSpecialA && !isSpecialB) return 1;
                    
                    const pureNumA = parseInt(numA.replace(/[^0-9]/g, '')) || 0;
                    const pureNumB = parseInt(numB.replace(/[^0-9]/g, '')) || 0;
                    
                    if (isSpecialA && isSpecialB) {
                        const prefixA = numA.replace(/[0-9]/g, '');
                        const prefixB = numB.replace(/[0-9]/g, '');
                        if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
                    }
                    
                    return pureNumA - pureNumB;
                });
                break;
            case 'price-asc':
                sorted.sort((a, b) => (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0));
                break;
            case 'price-desc':
                sorted.sort((a, b) => (parseFloat(b.price) || 0) - (parseFloat(a.price) || 0));
                break;
            default:
                break;
        }
        
        return sorted;
    }, [listings, sortBy]);

    const handleDelete = async (listingId) => {
        if (!confirm('Remove this listing?')) return;
        try {
            const res = await fetch('/api/listings/' + user.id + '/' + listingId, { method: 'DELETE' });
            if (res.ok) {
                success('Listing removed');
                fetchListings();
            }
        } catch (err) {
            error('Failed to remove listing');
        }
    };

    const handleStatusChange = async (listingId, newStatus) => {
        try {
            const listing = listings.find(l => l.id === listingId);
            const res = await fetch('/api/listings/' + user.id + '/' + listingId, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...listing, status: newStatus })
            });
            if (res.ok) {
                success('Status updated');
                fetchListings();
            }
        } catch (err) {
            error('Failed to update status');
        }
    };

    const handleUpdateToTcgPrice = async (listing) => {
        if (!listing.tcgPrice) {
            error('No TCG price available for this card');
            return;
        }
        try {
            const res = await fetch('/api/listings/' + user.id + '/' + listing.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...listing, price: listing.tcgPrice })
            });
            if (res.ok) {
                success('Price updated to $' + listing.tcgPrice.toFixed(2));
                fetchListings();
            }
        } catch (err) {
            error('Failed to update price');
        }
    };

    if (!user) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <h3>Sign In Required</h3>
                    <p>Please sign in to manage your cards</p>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')} style={{ marginTop: '1rem' }}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="section">
            <div className="section-header">
                <h2>🃏 My Cards</h2>
                <p>Manage your cards for trade or sale</p>
                {lastSync && (
                    <p className="last-sync-info">
                        💰 TCG Prices last updated: {new Date(lastSync.timestamp).toLocaleDateString()} at {new Date(lastSync.timestamp).toLocaleTimeString()}
                    </p>
                )}
            </div>

            {listings.length > 0 && (
                <div className="my-cards-summary">
                    <div className="summary-stat">
                        <span className="summary-label">Total Cards</span>
                        <span className="summary-value">{listings.reduce((sum, l) => sum + (l.quantity || 1), 0)}</span>
                    </div>
                    <div className="summary-stat">
                        <span className="summary-label">Total Value</span>
                        <span className="summary-value summary-price">${listings.reduce((sum, l) => sum + (parseFloat(l.price) || 0) * (l.quantity || 1), 0).toFixed(2)}</span>
                    </div>
                    <div className="summary-stat">
                        <span className="summary-label">Unique Cards</span>
                        <span className="summary-value">{listings.length}</span>
                    </div>
                </div>
            )}

            <div className="my-cards-controls">
                <div className="filter-tabs">
                    <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>Active</button>
                    <button className={filter === 'sold' ? 'active' : ''} onClick={() => setFilter('sold')}>Sold</button>
                    <button className={filter === 'traded' ? 'active' : ''} onClick={() => setFilter('traded')}>Traded</button>
                    <button className={filter === 'inactive' ? 'active' : ''} onClick={() => setFilter('inactive')}>Inactive</button>
                    <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
                </div>
                <div className="controls-right">
                    <div className="sort-control">
                        <label>Sort:</label>
                        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
                            <option value="set-number">Set & Number</option>
                            <option value="price-desc">Price (High → Low)</option>
                            <option value="price-asc">Price (Low → High)</option>
                        </select>
                    </div>
                    <div className="view-toggle">
                        <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid View">
                            <span>▦</span>
                        </button>
                        <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List View">
                            <span>☰</span>
                        </button>
                    </div>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        + Add Card
                    </button>
                </div>
            </div>

            {loading ? (
                <Loading message="Loading listings..." />
            ) : listings.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📭</div>
                    <h3>No Cards Listed</h3>
                    <p>Add cards you want to trade or sell</p>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)} style={{ marginTop: '1rem' }}>
                        + Add Your First Card
                    </button>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="listings-grid">
                    {sortedListings.map(listing => (
                        <div key={listing.id} className={'listing-card status-' + listing.status}>
                            <div className="listing-image">
                                <img src={listing.images?.small} alt={listing.card_name} />
                                <div className="listing-type-badge">
                                    {listing.listing_type === 'trade' && '🔄 Trade'}
                                    {listing.listing_type === 'sale' && '💰 Sale'}
                                    {listing.listing_type === 'both' && '🔄💰 Both'}
                                </div>
                                {listing.quantity > 1 && (
                                    <div className="listing-qty-badge">×{listing.quantity}</div>
                                )}
                            </div>
                            <div className="listing-info">
                                <h4>{listing.card_name}</h4>
                                <p className="listing-set">#{listing.card_number} • {listing.set_name}</p>
                                <div className="listing-details">
                                    <span>{listing.condition_grade}</span>
                                    <span>{listing.language}</span>
                                    <span>{listing.version}</span>
                                </div>
                                <div className="listing-prices">
                                    {listing.price ? (
                                        <div className="listing-price">
                                            Your Price: ${parseFloat(listing.price).toFixed(2)}
                                            {listing.quantity > 1 && <span className="price-each"> each</span>}
                                        </div>
                                    ) : (
                                        <div className="listing-price no-price">No price set</div>
                                    )}
                                    {listing.tcgPrice && (
                                        <button 
                                            className="tcg-price-btn"
                                            onClick={() => handleUpdateToTcgPrice(listing)}
                                            title="Click to use this price"
                                        >
                                            TCG: ${listing.tcgPrice.toFixed(2)} ↗
                                        </button>
                                    )}
                                </div>
                                {listing.notes && (
                                    <p className="listing-notes">{listing.notes}</p>
                                )}
                                <div className="listing-status">
                                    Status: <span className={'status-' + listing.status}>{listing.status}</span>
                                </div>
                            </div>
                            <div className="listing-actions">
                                <button className="btn-sm" onClick={() => setEditingListing(listing)} title="Edit">✏️</button>
                                {listing.status === 'active' && (
                                    <>
                                        <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'sold')} title="Mark Sold">💰</button>
                                        <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'traded')} title="Mark Traded">🔄</button>
                                        <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'inactive')} title="Deactivate">⏸️</button>
                                    </>
                                )}
                                {listing.status === 'inactive' && (
                                    <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'active')} title="Reactivate">▶️</button>
                                )}
                                <button className="btn-sm btn-danger" onClick={() => handleDelete(listing.id)} title="Delete">🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="listings-table-wrapper">
                    <table className="listings-table">
                        <thead>
                            <tr>
                                <th>Card</th>
                                <th>Set</th>
                                <th>Qty</th>
                                <th>Type</th>
                                <th>Condition</th>
                                <th>Language</th>
                                <th>Your Price</th>
                                <th>TCG Price</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedListings.map(listing => (
                                <tr key={listing.id} className={'status-row-' + listing.status}>
                                    <td className="card-cell">
                                        <img src={listing.images?.small} alt="" className="table-card-img" />
                                        <div>
                                            <strong>{listing.card_name}</strong>
                                            <span className="card-number">#{listing.card_number}</span>
                                        </div>
                                    </td>
                                    <td>{listing.set_name}</td>
                                    <td className="qty-cell">
                                        <span className={listing.quantity > 1 ? 'qty-highlight' : ''}>{listing.quantity}</span>
                                    </td>
                                    <td>
                                        <span className="type-badge">
                                            {listing.listing_type === 'trade' && '🔄 Trade'}
                                            {listing.listing_type === 'sale' && '💰 Sale'}
                                            {listing.listing_type === 'both' && '🔄💰 Both'}
                                        </span>
                                    </td>
                                    <td>{listing.condition_grade}</td>
                                    <td>{listing.language}</td>
                                    <td className="price-cell">
                                        {listing.price ? (
                                            <strong>${parseFloat(listing.price).toFixed(2)}</strong>
                                        ) : (
                                            <span className="no-price">—</span>
                                        )}
                                    </td>
                                    <td className="tcg-cell">
                                        {listing.tcgPrice ? (
                                            <button 
                                                className="tcg-price-btn-sm"
                                                onClick={() => handleUpdateToTcgPrice(listing)}
                                                title="Click to use this price"
                                            >
                                                ${listing.tcgPrice.toFixed(2)} ↗
                                            </button>
                                        ) : '—'}
                                    </td>
                                    <td>
                                        <span className={'status-badge status-' + listing.status}>{listing.status}</span>
                                    </td>
                                    <td className="actions-cell">
                                        <button className="btn-sm" onClick={() => setEditingListing(listing)} title="Edit">✏️</button>
                                        {listing.status === 'active' && (
                                            <>
                                                <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'sold')} title="Mark Sold">💰</button>
                                                <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'traded')} title="Mark Traded">🔄</button>
                                                <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'inactive')} title="Deactivate">⏸️</button>
                                            </>
                                        )}
                                        {listing.status === 'inactive' && (
                                            <button className="btn-sm" onClick={() => handleStatusChange(listing.id, 'active')} title="Reactivate">▶️</button>
                                        )}
                                        <button className="btn-sm btn-danger" onClick={() => handleDelete(listing.id)} title="Delete">🗑️</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {showAddModal && (
                <AddListingModal
                    user={user}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => { fetchListings(); }}
                    languages={LANGUAGES}
                    conditions={CONDITIONS}
                    versions={VERSIONS}
                    editions={EDITIONS}
                />
            )}

            {editingListing && (
                <EditListingModal
                    user={user}
                    listing={editingListing}
                    onClose={() => setEditingListing(null)}
                    onSuccess={() => { setEditingListing(null); fetchListings(); }}
                    languages={LANGUAGES}
                    conditions={CONDITIONS}
                    versions={VERSIONS}
                    editions={EDITIONS}
                />
            )}
        </div>
    );
};

// Add Listing Modal - Multi-select with checkboxes
const AddListingModal = ({ user, onClose, onSuccess, languages, conditions, versions, editions }) => {
    const { success, error } = useToast();
    const [allSets, setAllSets] = React.useState([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [expandedSets, setExpandedSets] = React.useState({});
    const [setCards, setSetCards] = React.useState({});
    const [loadingCards, setLoadingCards] = React.useState({});
    const [loading, setLoading] = React.useState(true);
    const [submitting, setSubmitting] = React.useState(false);
    const [selectedCards, setSelectedCards] = React.useState(new Set());
    const [cardData, setCardData] = React.useState({});
    const [userSettings, setUserSettings] = React.useState(null);

    const defaultCardValues = {
        language: 'English',
        condition: 'Mint',
        version: 'Non-Holo',
        edition: '2nd',
        quantity: 1,
        price: ''
    };

    React.useEffect(() => {
        fetchAllSets();
        fetchUserSettings();
    }, []);

    const fetchUserSettings = async () => {
        try {
            const res = await fetch('/api/settings/' + user.id);
            const data = await res.json();
            if (data.success) {
                setUserSettings(data.settings);
            }
        } catch (err) {
            console.error('Failed to load user settings');
        }
    };

    const fetchAllSets = async () => {
        setLoading(true);
        try {
            const res = await fetch('/pokemon-api/sets');
            const data = await res.json();
            if (data.data) {
                const sorted = data.data.sort((a, b) => 
                    new Date(b.releaseDate) - new Date(a.releaseDate)
                );
                setAllSets(sorted);
            }
        } catch (err) {
            error('Failed to load sets');
        } finally {
            setLoading(false);
        }
    };

    const fetchSetCards = async (setId) => {
        if (setCards[setId]) return;
        
        setLoadingCards(prev => ({ ...prev, [setId]: true }));
        try {
            const res = await fetch('/pokemon-api/cards?q=set.id:' + setId + '&pageSize=500');
            const data = await res.json();
            if (data.data) {
                const sorted = data.data.sort((a, b) => {
                    const numA = parseInt(a.number) || 0;
                    const numB = parseInt(b.number) || 0;
                    return numA - numB;
                });
                setSetCards(prev => ({ ...prev, [setId]: sorted }));
                
                // Build card data for all cards in the set
                const newCardData = {};
                sorted.forEach(card => {
                    const tcgPrice = Helpers.getCardPrice(card);
                    newCardData[card.id] = {
                        ...defaultCardValues,
                        price: tcgPrice ? tcgPrice.toFixed(2) : '',
                        card: card,
                        setId: setId
                    };
                });
                setCardData(prev => ({ ...prev, ...newCardData }));
            }
        } catch (err) {
            error('Failed to load cards');
        } finally {
            setLoadingCards(prev => ({ ...prev, [setId]: false }));
        }
    };

    const toggleSetExpand = async (setId) => {
        const isExpanded = expandedSets[setId];
        setExpandedSets(prev => ({ ...prev, [setId]: !isExpanded }));
        
        if (!isExpanded && !setCards[setId]) {
            await fetchSetCards(setId);
        }
    };

    const toggleCardSelection = (cardId) => {
        setSelectedCards(prev => {
            const newSet = new Set(prev);
            if (newSet.has(cardId)) {
                newSet.delete(cardId);
            } else {
                newSet.add(cardId);
            }
            return newSet;
        });
    };

    const selectAllInSet = (setId) => {
        const cards = setCards[setId] || [];
        const cardIds = cards.map(c => c.id);
        const allSelected = cardIds.every(id => selectedCards.has(id));
        
        setSelectedCards(prev => {
            const newSet = new Set(prev);
            if (allSelected) {
                cardIds.forEach(id => newSet.delete(id));
            } else {
                cardIds.forEach(id => newSet.add(id));
            }
            return newSet;
        });
    };

    const handleCardDataChange = (cardId, field, value) => {
        setCardData(prev => ({
            ...prev,
            [cardId]: {
                ...prev[cardId],
                [field]: value
            }
        }));
    };

    const getCardData = (cardId) => {
        return cardData[cardId] || defaultCardValues;
    };

    const handleAddSelected = async () => {
        console.log('handleAddSelected called');
        console.log('selectedCards:', selectedCards);
        console.log('selectedCards.size:', selectedCards.size);
        
        if (selectedCards.size === 0) {
            error('No cards selected');
            return;
        }

        setSubmitting(true);
        let successCount = 0;
        let failCount = 0;

        for (const cardId of selectedCards) {
            console.log('Processing cardId:', cardId);
            const data = cardData[cardId];
            console.log('cardData for this card:', data);
            if (!data || !data.card) {
                console.log('Skipping - no data or no card');
                continue;
            }
            
            try {
                const res = await fetch('/api/listings/' + user.id, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        card_id: cardId,
                        set_id: data.setId,
                        listing_type: 'both',
                        language: data.language,
                        condition_grade: data.condition,
                        version: data.version,
                        edition: data.edition,
                        quantity: parseInt(data.quantity) || 1,
                        price: data.price ? parseFloat(data.price) : null,
                        notes: ''
                    })
                });
                if (res.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }

        setSubmitting(false);
        
        if (successCount > 0) {
            success('Added ' + successCount + ' card' + (successCount > 1 ? 's' : '') + ' to listings!');
            setSelectedCards(new Set());
            onSuccess();
        }
        if (failCount > 0) {
            error('Failed to add ' + failCount + ' card' + (failCount > 1 ? 's' : ''));
        }
    };

    const selectedCount = selectedCards.size;

    const filteredSets = searchTerm
        ? allSets.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.series?.toLowerCase().includes(searchTerm.toLowerCase())
          )
        : allSets;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal add-listing-modal-wide" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                
                <div className="modal-header-sticky">
                    <h2>Add Cards to My Listings</h2>
                    <input
                        type="text"
                        placeholder="Search sets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                        autoFocus
                    />
                </div>
                
                {loading ? (
                    <Loading message="Loading sets..." />
                ) : (
                    <div className="add-card-sets-list">
                        {filteredSets.map(set => {
                            const cards = setCards[set.id] || [];
                            const selectedInSet = cards.filter(c => selectedCards.has(c.id)).length;
                            const allSelectedInSet = cards.length > 0 && cards.every(c => selectedCards.has(c.id));
                            
                            return (
                                <div key={set.id} className="add-card-set">
                                    <div className="add-card-set-header" onClick={() => toggleSetExpand(set.id)}>
                                        <span className="expand-icon">{expandedSets[set.id] ? '▼' : '▶'}</span>
                                        {set.images?.symbol && <img src={set.images.symbol} alt="" className="set-symbol-tiny" />}
                                        <span className="set-name">{set.name}</span>
                                        <span className="set-meta">{set.series} • {set.total} cards</span>
                                        {selectedInSet > 0 && (
                                            <span className="selected-badge">{selectedInSet} selected</span>
                                        )}
                                    </div>
                                    
                                    {expandedSets[set.id] && (
                                        <div className="add-card-set-cards">
                                            {loadingCards[set.id] ? (
                                                <div className="loading-inline">Loading cards...</div>
                                            ) : (
                                                <>
                                                    <div className="select-all-row">
                                                        <label className="checkbox-label">
                                                            <input
                                                                type="checkbox"
                                                                checked={allSelectedInSet}
                                                                onChange={() => selectAllInSet(set.id)}
                                                            />
                                                            Select All in {set.name}
                                                        </label>
                                                    </div>
                                                    <table className="add-card-table">
                                                        <thead>
                                                            <tr>
                                                                <th style={{width: '40px'}}>☑</th>
                                                                <th style={{width: '60px'}}>#</th>
                                                                <th>Name</th>
                                                                <th style={{width: '90px'}}>Price</th>
                                                                <th style={{width: '100px'}}>Language</th>
                                                                <th style={{width: '100px'}}>Condition</th>
                                                                <th style={{width: '100px'}}>Version</th>
                                                                <th style={{width: '70px'}}>Edition</th>
                                                                <th style={{width: '60px'}}>Qty</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {cards.map(card => {
                                                                const isSelected = selectedCards.has(card.id);
                                                                const data = getCardData(card.id);
                                                                const tcgPrice = Helpers.getCardPrice(card);
                                                                
                                                                return (
                                                                    <tr key={card.id} className={isSelected ? 'row-selected' : ''}>
                                                                        <td onClick={() => toggleCardSelection(card.id)} style={{cursor: 'pointer'}}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isSelected}
                                                                                onChange={() => {}}
                                                                            />
                                                                        </td>
                                                                        <td className="card-num">#{card.number}</td>
                                                                        <td className="card-name-cell">
                                                                            {card.name}
                                                                            {tcgPrice && (
                                                                                <span className="tcg-price-hint">
                                                                                    TCG: ${tcgPrice.toFixed(2)}
                                                                                </span>
                                                                            )}
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                type="number"
                                                                                step="0.01"
                                                                                min="0"
                                                                                placeholder="$"
                                                                                value={data.price}
                                                                                onChange={e => handleCardDataChange(card.id, 'price', e.target.value)}
                                                                                className="input-sm"
                                                                            />
                                                                        </td>
                                                                        <td>
                                                                            <select 
                                                                                value={data.language} 
                                                                                onChange={e => handleCardDataChange(card.id, 'language', e.target.value)}
                                                                                className="select-sm"
                                                                            >
                                                                                {languages.map(l => <option key={l} value={l}>{l}</option>)}
                                                                            </select>
                                                                        </td>
                                                                        <td>
                                                                            <select 
                                                                                value={data.condition} 
                                                                                onChange={e => handleCardDataChange(card.id, 'condition', e.target.value)}
                                                                                className="select-sm"
                                                                            >
                                                                                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                                                                            </select>
                                                                        </td>
                                                                        <td>
                                                                            <select 
                                                                                value={data.version} 
                                                                                onChange={e => handleCardDataChange(card.id, 'version', e.target.value)}
                                                                                className="select-sm"
                                                                            >
                                                                                {versions.map(v => <option key={v} value={v}>{v}</option>)}
                                                                            </select>
                                                                        </td>
                                                                        <td>
                                                                            <select 
                                                                                value={data.edition} 
                                                                                onChange={e => handleCardDataChange(card.id, 'edition', e.target.value)}
                                                                                className="select-sm"
                                                                            >
                                                                                {editions.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                                                                            </select>
                                                                        </td>
                                                                        <td>
                                                                            <input
                                                                                type="number"
                                                                                min="1"
                                                                                value={data.quantity}
                                                                                onChange={e => handleCardDataChange(card.id, 'quantity', e.target.value)}
                                                                                className="input-sm input-qty"
                                                                            />
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </tbody>
                                                    </table>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
                
                <div className="modal-footer-sticky">
                    <div className="footer-left">
                        {selectedCount > 0 && (
                            <span className="selected-count">{selectedCount} card{selectedCount > 1 ? 's' : ''} selected</span>
                        )}
                    </div>
                    <div className="footer-right">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button 
                            className="btn btn-primary" 
                            onClick={handleAddSelected}
                            disabled={selectedCount === 0 || submitting}
                        >
                            {submitting ? 'Adding...' : 'Add ' + (selectedCount > 0 ? selectedCount : '') + ' Card' + (selectedCount !== 1 ? 's' : '')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Edit Listing Modal
const EditListingModal = ({ user, listing, onClose, onSuccess, languages, conditions, versions, editions }) => {
    const { success, error } = useToast();
    const [loading, setLoading] = React.useState(false);
    const [formData, setFormData] = React.useState({
        listing_type: listing.listing_type,
        price: listing.price || '',
        language: listing.language,
        condition_grade: listing.condition_grade,
        version: listing.version,
        edition: listing.edition,
        quantity: listing.quantity || 1,
        notes: listing.notes || '',
        status: listing.status,
        price_override: listing.price_override || false
    });

    const handleSubmit = async () => {
        if (formData.quantity < 1) {
            error('Quantity must be at least 1');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/listings/' + user.id + '/' + listing.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    quantity: parseInt(formData.quantity) || 1,
                    price: formData.price ? parseFloat(formData.price) : null
                })
            });
            if (res.ok) {
                success('Listing updated!');
                onSuccess();
            } else {
                error('Failed to update listing');
            }
        } catch (err) {
            error('Failed to update listing');
        } finally {
            setLoading(false);
        }
    };

    const applyTcgPrice = () => {
        if (listing.tcgPrice) {
            setFormData(prev => ({ ...prev, price: listing.tcgPrice.toFixed(2) }));
        }
    };

    const handleOverrideChange = (checked) => {
        setFormData(prev => ({ 
            ...prev, 
            price_override: checked,
            price: checked ? prev.price : ''
        }));
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal edit-listing-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                <h2>Edit Listing</h2>
                
                <div className="listing-form-preview">
                    <img src={listing.images?.small} alt={listing.card_name} />
                    <div>
                        <h4>{listing.card_name}</h4>
                        <p>#{listing.card_number} • {listing.set_name}</p>
                        {listing.tcgPrice && (
                            <p className="tcg-price-info">TCG Price: ${listing.tcgPrice.toFixed(2)}</p>
                        )}
                    </div>
                </div>

                <div className="form">
                    <div className="form-row-2">
                        <div className="form-group">
                            <label>Listing Type</label>
                            <select value={formData.listing_type} onChange={e => setFormData({...formData, listing_type: e.target.value})}>
                                <option value="both">Trade & Sale</option>
                                <option value="trade">Trade Only</option>
                                <option value="sale">Sale Only</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Quantity</label>
                            <input 
                                type="number" 
                                min="1" 
                                value={formData.quantity} 
                                onChange={e => setFormData({...formData, quantity: e.target.value})}
                            />
                        </div>
                    </div>

                    {(formData.listing_type === 'sale' || formData.listing_type === 'both') && (
                        <>
                            <div className="form-group">
                                <label className="checkbox-label-inline">
                                    <input 
                                        type="checkbox" 
                                        checked={formData.price_override}
                                        onChange={e => handleOverrideChange(e.target.checked)}
                                    />
                                    <span>Set custom price (override pricing algorithm)</span>
                                </label>
                            </div>

                            {formData.price_override && (
                                <div className="form-group">
                                    <label>Custom Price per card ($)</label>
                                    <div className="price-input-group">
                                        <input type="number" step="0.01" min="0" value={formData.price} 
                                               onChange={e => setFormData({...formData, price: e.target.value})}
                                               placeholder="Enter your price" />
                                        {listing.tcgPrice && (
                                            <button type="button" className="tcg-apply-btn" onClick={applyTcgPrice}>
                                                Use TCG ${listing.tcgPrice.toFixed(2)}
                                            </button>
                                        )}
                                    </div>
                                    {formData.quantity > 1 && formData.price && (
                                        <span className="price-total">Total: ${(parseFloat(formData.price) * parseInt(formData.quantity)).toFixed(2)}</span>
                                    )}
                                </div>
                            )}

                            {!formData.price_override && (
                                <div className="form-group">
                                    <div className="algorithm-price-info">
                                        <span>💡 Price will be calculated automatically from TCG price using your pricing settings.</span>
                                        {listing.price && (
                                            <span className="current-algo-price">Current: ${parseFloat(listing.price).toFixed(2)}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="form-row-2">
                        <div className="form-group">
                            <label>Language</label>
                            <select value={formData.language} onChange={e => setFormData({...formData, language: e.target.value})}>
                                {languages.map(l => <option key={l} value={l}>{l}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Condition</label>
                            <select value={formData.condition_grade} onChange={e => setFormData({...formData, condition_grade: e.target.value})}>
                                {conditions.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-row-2">
                        <div className="form-group">
                            <label>Version</label>
                            <select value={formData.version} onChange={e => setFormData({...formData, version: e.target.value})}>
                                {versions.map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Edition</label>
                            <select value={formData.edition} onChange={e => setFormData({...formData, edition: e.target.value})}>
                                {editions.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                            <option value="sold">Sold</option>
                            <option value="traded">Traded</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Notes (optional)</label>
                        <textarea value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})}
                                  placeholder="Any additional info about the card..." rows="2" />
                    </div>

                    <button className="btn btn-primary btn-block" onClick={handleSubmit} disabled={loading}>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

window.MyCardsPage = MyCardsPage;
window.AddListingModal = AddListingModal;
window.EditListingModal = EditListingModal;
