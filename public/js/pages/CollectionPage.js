/* ===================================
   Collection Page - Manage Your Pokemon Card Collection
   =================================== */

const CollectionPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { success, error } = useToast();
    const [collections, setCollections] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedSets, setExpandedSets] = React.useState({});
    const [setCards, setSetCards] = React.useState({});
    const [loadingCards, setLoadingCards] = React.useState({});
    const [showAddSet, setShowAddSet] = React.useState(false);
    const [allSets, setAllSets] = React.useState([]);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [stats, setStats] = React.useState(null);
    const [editingCard, setEditingCard] = React.useState(null);
    const [addingSet, setAddingSet] = React.useState(false);
    const [viewMode, setViewMode] = React.useState('list');
    const [selectedSet, setSelectedSet] = React.useState(null);
    const [userDefaults, setUserDefaults] = React.useState({
        language: 'English',
        condition: 'Mint',
        version: 'Non-Holo',
        edition: '2nd'
    });

    const LANGUAGES = ['English', 'French', 'Japanese', 'German', 'Spanish', 'Italian', 'Korean', 'Chinese'];
    const CONDITIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'];
    const VERSIONS = ['Non-Holo', 'Holo', 'Reverse', 'Pokeball', 'Masterball', 'Holographic Staff'];
    const EDITIONS = ['1st', '2nd'];

    React.useEffect(() => {
        if (user) {
            fetchCollection();
            fetchStats();
            fetchUserDefaults();
        }
    }, [user]);

    const fetchUserDefaults = async () => {
        try {
            const res = await fetch(`/api/settings/${user.id}`);
            const data = await res.json();
            if (data.success && data.settings) {
                setUserDefaults({
                    language: data.settings.default_language || 'English',
                    condition: data.settings.default_condition || 'Mint',
                    version: data.settings.default_version || 'Non-Holo',
                    edition: data.settings.default_edition || '2nd'
                });
            }
        } catch (err) {
            console.error('Failed to load user defaults:', err);
        }
    };

    const fetchCollection = async () => {
        try {
            const res = await fetch(`/api/collection/${user.id}`);
            const data = await res.json();
            if (data.success) {
                setCollections(data.collections);
            }
        } catch (err) {
            error('Failed to load collection');
        } finally {
            setLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch(`/api/collection/${user.id}/stats`);
            const data = await res.json();
            if (data.success) {
                setStats(data.stats);
            }
        } catch (err) {
            console.error('Failed to load stats:', err);
        }
    };

    const fetchAllSets = async () => {
        try {
            const res = await fetch('/pokemon-api/sets');
            const data = await res.json();
            setAllSets(data.data || []);
        } catch (err) {
            error('Failed to load sets');
        }
    };

    const fetchSetCards = async (setId) => {
        if (setCards[setId]) return;
        
        setLoadingCards(prev => ({ ...prev, [setId]: true }));
        try {
            const res = await fetch(`/api/collection/${user.id}/set/${setId}/cards`);
            const data = await res.json();
            if (data.success) {
                setSetCards(prev => ({ ...prev, [setId]: data.cards }));
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

    const openSetGrid = async (col) => {
        setSelectedSet(col);
        if (!setCards[col.set_id]) {
            await fetchSetCards(col.set_id);
        }
    };

    const handleUpdateCard = async (card, ownership) => {
        try {
            const res = await fetch(`/api/collection/${user.id}/own-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardId: card.id,
                    setId: card.set_id,
                    language: ownership.language,
                    condition: ownership.condition,
                    version: ownership.version,
                    edition: ownership.edition,
                    quantity: ownership.quantity || 1
                })
            });
            if (res.ok) {
                setSetCards(prev => ({
                    ...prev,
                    [card.set_id]: prev[card.set_id].map(c =>
                        c.id === card.id ? { ...c, owned: true, ownership } : c
                    )
                }));
                fetchCollection();
                fetchStats();
                setEditingCard(null);
                success('Card updated!');
            }
        } catch (err) {
            error('Failed to update card');
        }
    };

    const handleRemoveCard = async (card) => {
        if (!confirm(`Mark "${card.name}" as missing?`)) return;
        try {
            const res = await fetch(`/api/collection/${user.id}/unown-card/${card.id}`, { method: 'DELETE' });
            if (res.ok) {
                setSetCards(prev => ({
                    ...prev,
                    [card.set_id]: prev[card.set_id].map(c =>
                        c.id === card.id ? { ...c, owned: false, ownership: null } : c
                    )
                }));
                fetchCollection();
                fetchStats();
                success('Card marked as missing');
            }
        } catch (err) {
            error('Failed to remove card');
        }
    };

    const handleAddCard = async (card) => {
        const defaultOwnership = { 
            language: userDefaults.language, 
            condition: userDefaults.condition, 
            version: userDefaults.version, 
            edition: userDefaults.edition, 
            quantity: 1 
        };
        try {
            const res = await fetch(`/api/collection/${user.id}/own-card`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cardId: card.id, setId: card.set_id, ...defaultOwnership })
            });
            if (res.ok) {
                setSetCards(prev => ({
                    ...prev,
                    [card.set_id]: prev[card.set_id].map(c =>
                        c.id === card.id ? { ...c, owned: true, ownership: defaultOwnership } : c
                    )
                }));
                fetchCollection();
                fetchStats();
                success('Card added!');
            }
        } catch (err) {
            error('Failed to add card');
        }
    };

    const handleMarkAllMissing = async (setId, setName) => {
        if (!confirm(`Mark ALL cards in "${setName}" as missing?`)) return;
        try {
            const res = await fetch(`/api/collection/${user.id}/unown-set/${setId}`, { method: 'DELETE' });
            if (res.ok) {
                setSetCards(prev => ({
                    ...prev,
                    [setId]: prev[setId]?.map(c => ({ ...c, owned: false, ownership: null }))
                }));
                fetchCollection();
                fetchStats();
                success('All cards marked as missing');
            }
        } catch (err) {
            error('Failed to mark cards as missing');
        }
    };

    const handleMarkAllOwned = async (setId, setName) => {
        if (!confirm(`Mark ALL cards in "${setName}" as owned?`)) return;
        try {
            const res = await fetch(`/api/collection/${user.id}/own-set/${setId}`, { method: 'POST' });
            if (res.ok) {
                const defaultOwnership = { 
                    language: userDefaults.language, 
                    condition: userDefaults.condition, 
                    version: userDefaults.version, 
                    edition: userDefaults.edition, 
                    quantity: 1 
                };
                setSetCards(prev => ({
                    ...prev,
                    [setId]: prev[setId]?.map(c => ({ ...c, owned: true, ownership: defaultOwnership }))
                }));
                fetchCollection();
                fetchStats();
                success('All cards marked as owned');
            }
        } catch (err) {
            error('Failed to mark cards as owned');
        }
    };

    const addSetToCollection = async (setId) => {
        setAddingSet(true);
        try {
            const res = await fetch(`/api/collection/${user.id}/add-set`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ setId })
            });
            const data = await res.json();
            if (res.ok) {
                success(`Set added with ${data.cardsAdded} cards!`);
                setShowAddSet(false);
                fetchCollection();
                fetchStats();
            }
        } catch (err) {
            error('Failed to add set');
        } finally {
            setAddingSet(false);
        }
    };

    const removeSetFromCollection = async (setId, setName, e) => {
        if (e) e.stopPropagation();
        if (!confirm(`Remove "${setName}" from your collection?`)) return;
        try {
            const res = await fetch(`/api/collection/${user.id}/remove-set/${setId}`, { method: 'DELETE' });
            if (res.ok) {
                success('Set removed');
                setCollections(prev => prev.filter(c => c.set_id !== setId));
                setSetCards(prev => { const n = { ...prev }; delete n[setId]; return n; });
                setSelectedSet(null);
                fetchStats();
            }
        } catch (err) {
            error('Failed to remove set');
        }
    };

    const openAddSetModal = () => {
        fetchAllSets();
        setShowAddSet(true);
        setSearchTerm('');
    };

    const availableSets = allSets.filter(set =>
        !collections.some(c => c.set_id === set.id) &&
        (set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
         set.series?.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    if (!user) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <h3>Sign In Required</h3>
                    <p>Please sign in to manage your collection</p>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')} style={{ marginTop: '1rem' }}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    // Grid view - showing cards for a selected set
    if (viewMode === 'grid' && selectedSet) {
        const cards = setCards[selectedSet.set_id] || [];
        const isLoading = loadingCards[selectedSet.set_id];

        return (
            <div className="section">
                <button className="btn btn-secondary" onClick={() => setSelectedSet(null)} style={{ marginBottom: '1rem' }}>
                    ← Back to Collection
                </button>

                <div className="section-header">
                    {selectedSet.images?.logo && (
                        <img src={selectedSet.images.logo} alt={selectedSet.name} style={{ maxHeight: '60px', marginBottom: '0.5rem' }} />
                    )}
                    <h2>{selectedSet.name}</h2>
                    <p>{selectedSet.owned_count}/{selectedSet.total} cards owned ({Math.round((selectedSet.owned_count / selectedSet.total) * 100)}%)</p>
                </div>

                <div className="bulk-actions" style={{ marginBottom: '1rem' }}>
                    <button className="btn btn-sm btn-success" onClick={() => handleMarkAllOwned(selectedSet.set_id, selectedSet.name)}>
                        ☑ Mark All Owned
                    </button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleMarkAllMissing(selectedSet.set_id, selectedSet.name)}>
                        ☐ Mark All Missing
                    </button>
                </div>

                {isLoading ? (
                    <Loading message="Loading cards..." />
                ) : (
                    <div className="collection-cards-grid">
                        {cards.map(card => (
                            <div 
                                key={card.id} 
                                className={`collection-card-item ${card.owned ? 'owned' : 'missing'}`}
                                onClick={() => card.owned ? setEditingCard({ ...card, set_id: selectedSet.set_id }) : handleAddCard({ ...card, set_id: selectedSet.set_id })}
                            >
                                <div className="collection-card-image">
                                    <img src={card.images?.small} alt={card.name} />
                                    {card.owned && <div className="owned-badge">✓</div>}
                                    {!card.owned && <div className="missing-overlay"></div>}
                                </div>
                                <div className="collection-card-info">
                                    <span className="card-number">#{card.number}</span>
                                    <span className="card-name">{card.name}</span>
                                    {card.tcgPrice && <span className="card-price">{Helpers.formatPrice(card.tcgPrice)}</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {editingCard && (
                    <CardEditModal
                        card={editingCard}
                        languages={LANGUAGES}
                        conditions={CONDITIONS}
                        versions={VERSIONS}
                        editions={EDITIONS}
                        userDefaults={userDefaults}
                        onSave={handleUpdateCard}
                        onClose={() => setEditingCard(null)}
                        onRemove={() => { handleRemoveCard(editingCard); setEditingCard(null); }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="section">
            <div className="section-header">
                <h2>📚 My Collection</h2>
                <p>Track your Pokemon card collection</p>
            </div>

            {stats && (
                <div className="collection-stats">
                    <div className="stat-item">
                        <span className="stat-value">{stats.total_sets}</span>
                        <span className="stat-label">Sets</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{stats.owned_cards}</span>
                        <span className="stat-label">Cards Owned</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{stats.missing_cards}</span>
                        <span className="stat-label">Missing</span>
                    </div>
                    <div className="stat-item">
                        <span className="stat-value">{stats.total_cards > 0 ? Math.round((stats.owned_cards / stats.total_cards) * 100) + '%' : '0%'}</span>
                        <span className="stat-label">Complete</span>
                    </div>
                    <div className="stat-item stat-value-highlight">
                        <span className="stat-value">${stats.total_value?.toFixed(2) || '0.00'}</span>
                        <span className="stat-label">Collection Value</span>
                    </div>
                </div>
            )}

            <div className="collection-controls">
                <button className="btn btn-primary" onClick={openAddSetModal}>
                    + Add Set to Collection
                </button>
                <div className="view-toggle">
                    <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid View">
                        <span>▦</span>
                    </button>
                    <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List View">
                        <span>☰</span>
                    </button>
                </div>
            </div>

            {loading ? (
                <Loading message="Loading collection..." />
            ) : collections.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <h3>No Sets Yet</h3>
                    <p>Add your first set to start tracking your collection!</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="collection-grid">
                    {collections.map(col => (
                        <div key={col.set_id} className="collection-set-card" onClick={() => openSetGrid(col)}>
                            <div className="collection-set-card-header">
                                {col.images?.logo ? (
                                    <img src={col.images.logo} alt={col.name} />
                                ) : (
                                    <span style={{ fontSize: '1.5rem', color: 'var(--poke-yellow)' }}>{col.name}</span>
                                )}
                            </div>
                            <div className="collection-set-card-body">
                                <h4>{col.name}</h4>
                                <div className="progress-bar">
                                    <div className="progress-fill" style={{ width: `${(col.owned_count / col.total) * 100}%` }}></div>
                                </div>
                                <span className="progress-text">{col.owned_count}/{col.total} cards ({Math.round((col.owned_count / col.total) * 100)}%)</span>
                                <div className="set-actions">
                                    <button className="btn-sm btn-danger" onClick={(e) => removeSetFromCollection(col.set_id, col.name, e)} title="Remove">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="collection-list">
                    {collections.map(col => (
                        <div key={col.set_id} className="collection-set">
                            <div className="collection-set-header" onClick={() => toggleSetExpand(col.set_id)}>
                                <div className="set-expand-icon">{expandedSets[col.set_id] ? '▼' : '▶'}</div>
                                {col.images?.logo ? (
                                    <img src={col.images.logo} alt={col.name} className="set-logo-small" />
                                ) : (
                                    <span className="set-name-text">{col.name}</span>
                                )}
                                <div className="set-progress">
                                    <div className="progress-bar">
                                        <div className="progress-fill" style={{ width: `${(col.owned_count / col.total) * 100}%` }}></div>
                                    </div>
                                    <span className="progress-text">{col.owned_count}/{col.total}</span>
                                </div>
                                <div className="set-values">
                                    <span className="owned-value" title="Value of cards you own">${col.owned_value?.toFixed(2) || "0.00"}</span>
                                    <span className="set-value-separator">/</span>
                                    <span className="complete-value" title="Complete set value">${col.complete_set_value?.toFixed(2) || "0.00"}</span>
                                </div>
                                <button
                                    className="btn-icon remove-set-btn"
                                    onClick={(e) => removeSetFromCollection(col.set_id, col.name, e)}
                                    title="Remove"
                                >
                                    🗑️
                                </button>
                            </div>

                            {expandedSets[col.set_id] && (
                                <div className="collection-cards">
                                    <div className="bulk-actions">
                                        <button className="btn btn-sm btn-success" onClick={() => handleMarkAllOwned(col.set_id, col.name)}>
                                            ☑ Mark All Owned
                                        </button>
                                        <button className="btn btn-sm btn-danger" onClick={() => handleMarkAllMissing(col.set_id, col.name)}>
                                            ☐ Mark All Missing
                                        </button>
                                    </div>

                                    {loadingCards[col.set_id] ? (
                                        <div className="loading-cards">Loading cards...</div>
                                    ) : (
                                        <div className="cards-table-container">
                                            <table className="cards-table">
                                                <thead>
                                                    <tr>
                                                        <th style={{ width: '50px' }}>Own</th>
                                                        <th style={{ width: '60px' }}>#</th>
                                                        <th>Name</th>
                                                        <th>Type</th>
                                                        <th>Rarity</th>
                                                        <th>Price</th>
                                                        <th>Language</th>
                                                        <th>Condition</th>
                                                        <th>Version</th>
                                                        <th>Edition</th>
                                                        <th style={{ width: '100px' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {setCards[col.set_id]?.map(card => (
                                                        <tr key={card.id} className={card.owned ? 'owned' : 'missing'}>
                                                            <td>
                                                                <span className={`own-checkbox ${card.owned ? 'checked' : ''}`}>
                                                                    {card.owned ? '☑' : '☐'}
                                                                </span>
                                                            </td>
                                                            <td className="card-num">#{card.number}</td>
                                                            <td className="card-name-cell">{card.name}</td>
                                                            <td className="type-cell">{(() => { const types = card.types ? (typeof card.types === "string" ? JSON.parse(card.types) : card.types) : []; const getTypeIcon = (t) => { const name = t.toLowerCase(); return name === "trainer" ? "/images/types/trainer.svg" : "/images/types/" + name + ".png"; }; if (types.length > 0) { return types.map((t, i) => <img key={i} src={getTypeIcon(t)} alt={t} title={t} className="type-icon" />); } else if (card.supertype === "Trainer") { return <img src="/images/types/trainer.svg" alt="Trainer" title="Trainer" className="type-icon" />; } else if (card.supertype === "Energy") { return <img src="/images/types/colorless.png" alt="Energy" title="Energy" className="type-icon" />; } else { return '-'; } })()}</td>
                                                            <td className="rarity-cell">{card.rarity || 'Common'}</td>
                                                            <td className="price-cell">{card.tcgPrice ? Helpers.formatPrice(card.tcgPrice) : '-'}</td>
                                                            <td>{card.ownership?.language || '-'}</td>
                                                            <td>{card.ownership?.condition || '-'}</td>
                                                            <td>{card.ownership?.version || '-'}</td>
                                                            <td>{card.ownership?.edition || '-'}</td>
                                                            <td>
                                                                {card.owned ? (
                                                                    <div className="card-actions">
                                                                        <button className="btn-sm btn-edit" onClick={() => setEditingCard({ ...card, set_id: col.set_id })} title="Edit">✏️</button>
                                                                        <button className="btn-sm btn-remove" onClick={() => handleRemoveCard({ ...card, set_id: col.set_id })} title="Remove">✖</button>
                                                                    </div>
                                                                ) : (
                                                                    <button className="btn-sm btn-add" onClick={() => handleAddCard({ ...card, set_id: col.set_id })}>+ Add</button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showAddSet && (
                <div className="modal-overlay" onClick={() => !addingSet && setShowAddSet(false)}>
                    <div className="modal add-set-modal" onClick={e => e.stopPropagation()}>
                        <button className="modal-close" onClick={() => !addingSet && setShowAddSet(false)} disabled={addingSet}>×</button>
                        <h2>Add Set to Collection</h2>
                        {addingSet ? (
                            <div className="adding-set-loading">
                                <Loading message="Adding set and all cards..." />
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    placeholder="Search sets..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="search-input"
                                    autoFocus
                                />
                                <div className="sets-list">
                                    {availableSets.length === 0 ? (
                                        <p className="no-results">No sets found</p>
                                    ) : (
                                        availableSets.slice(0, 50).map(set => (
                                            <div key={set.id} className="set-list-item" onClick={() => addSetToCollection(set.id)}>
                                                {set.images?.symbol && <img src={set.images.symbol} alt="" className="set-symbol-small" />}
                                                <div className="set-list-info">
                                                    <span className="set-list-name">{set.name}</span>
                                                    <span className="set-list-meta">{set.series} • {set.total} cards</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {editingCard && (
                <CardEditModal
                    card={editingCard}
                    languages={LANGUAGES}
                    conditions={CONDITIONS}
                    versions={VERSIONS}
                    editions={EDITIONS}
                    userDefaults={userDefaults}
                    onSave={handleUpdateCard}
                    onClose={() => setEditingCard(null)}
                    onRemove={() => { handleRemoveCard(editingCard); setEditingCard(null); }}
                />
            )}
        </div>
    );
};

const CardEditModal = ({ card, languages, conditions, versions, editions, userDefaults, onSave, onClose, onRemove }) => {
    const [ownership, setOwnership] = React.useState(card.ownership || {
        language: userDefaults?.language || 'English',
        condition: userDefaults?.condition || 'Mint',
        version: userDefaults?.version || 'Non-Holo',
        edition: userDefaults?.edition || '2nd',
        quantity: 1
    });

    const handleChange = (field, value) => setOwnership(prev => ({ ...prev, [field]: value }));

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal card-edit-modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                <div className="card-edit-header">
                    <img src={card.images?.small} alt={card.name} className="card-edit-image" />
                    <div>
                        <h2>{card.name}</h2>
                        <p className="card-edit-info">#{card.number} • {card.rarity || 'Common'}</p>
                        {card.tcgPrice && <p className="card-edit-price">{Helpers.formatPrice(card.tcgPrice)}</p>}
                    </div>
                </div>
                <div className="card-edit-form">
                    <div className="form-row">
                        <label>Language</label>
                        <select value={ownership.language} onChange={(e) => handleChange('language', e.target.value)}>
                            {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Condition</label>
                        <select value={ownership.condition} onChange={(e) => handleChange('condition', e.target.value)}>
                            {conditions.map(cond => <option key={cond} value={cond}>{cond}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Version</label>
                        <select value={ownership.version} onChange={(e) => handleChange('version', e.target.value)}>
                            {versions.map(ver => <option key={ver} value={ver}>{ver}</option>)}
                        </select>
                    </div>
                    <div className="form-row">
                        <label>Edition</label>
                        <select value={ownership.edition} onChange={(e) => handleChange('edition', e.target.value)}>
                            {editions.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                        </select>
                    </div>
                </div>
                <div className="card-edit-actions">
                    {onRemove && (
                        <button className="btn btn-danger" onClick={onRemove}>Remove</button>
                    )}
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={() => onSave(card, ownership)}>Save</button>
                </div>
            </div>
        </div>
    );
};

window.CollectionPage = CollectionPage;
window.CardEditModal = CardEditModal;
