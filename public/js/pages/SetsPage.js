/* ===================================
   Sets Page - Browse All Sets
   =================================== */

const SetsPage = ({ setCurrentPage, setSelectedSet }) => {
    const [sets, setSets] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [searchTerm, setSearchTerm] = React.useState('');
    const [selectedSeries, setSelectedSeries] = React.useState('all');
    const [series, setSeries] = React.useState([]);
    const [viewMode, setViewMode] = React.useState('grid');
    const [expandedSets, setExpandedSets] = React.useState({});
    const [setCards, setSetCards] = React.useState({});
    const [loadingCards, setLoadingCards] = React.useState({});

    const seriesOrder = [
        'Mega Evolution',
        'Scarlet & Violet',
        'Sword & Shield',
        'Sun & Moon',
        'XY',
        'Black & White',
        'HeartGold & SoulSilver',
        'Platinum',
        'Diamond & Pearl',
        'EX',
        'E-Card',
        'Neo',
        'Gym',
        'Base',
        'NP',
        'POP',
        'Other'
    ];

    const seriesIcons = {
        'Mega Evolution': '🔥',
        'Scarlet & Violet': '🔴',
        'Sword & Shield': '⚔️',
        'Sun & Moon': '☀️',
        'XY': '✨',
        'Black & White': '⚫',
        'HeartGold & SoulSilver': '💛',
        'Platinum': '💎',
        'Diamond & Pearl': '💠',
        'EX': '⭐',
        'E-Card': '📧',
        'Neo': '🌀',
        'Gym': '🏟️',
        'Base': '🎴',
        'NP': '🎮',
        'POP': '🎁',
        'Other': '📦'
    };

    React.useEffect(() => {
        fetchSets();
    }, []);

    const fetchSets = async () => {
        setLoading(true);
        const result = await PokemonAPI.getSets();
        
        if (result.success) {
            setSets(result.data);
            
            const uniqueSeries = [...new Set(result.data.map(s => s.series))];
            uniqueSeries.sort((a, b) => {
                const aIndex = seriesOrder.indexOf(a);
                const bIndex = seriesOrder.indexOf(b);
                const aOrder = aIndex === -1 ? 999 : aIndex;
                const bOrder = bIndex === -1 ? 999 : bIndex;
                return aOrder - bOrder;
            });
            setSeries(uniqueSeries);
        }
        
        setLoading(false);
    };

    const fetchSetCards = async (setId) => {
        if (setCards[setId]) return;
        
        setLoadingCards(prev => ({ ...prev, [setId]: true }));
        try {
            const result = await PokemonAPI.getCardsFromSet(setId, 1, 500);
            if (result.success) {
                const sortedCards = result.data.sort((a, b) => {
                    const numA = parseInt(a.number) || 0;
                    const numB = parseInt(b.number) || 0;
                    if (numA === numB) {
                        return (a.number || '').localeCompare(b.number || '');
                    }
                    return numA - numB;
                });
                setSetCards(prev => ({ ...prev, [setId]: sortedCards }));
            }
        } catch (err) {
            console.error('Failed to load cards:', err);
        } finally {
            setLoadingCards(prev => ({ ...prev, [setId]: false }));
        }
    };

    const toggleSetExpand = async (setId, e) => {
        e.stopPropagation();
        const isExpanded = expandedSets[setId];
        setExpandedSets(prev => ({ ...prev, [setId]: !isExpanded }));
        
        if (!isExpanded && !setCards[setId]) {
            await fetchSetCards(setId);
        }
    };

    const filteredSets = sets.filter(set => {
        const matchesSearch = set.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSeries = selectedSeries === 'all' || set.series === selectedSeries;
        return matchesSearch && matchesSeries;
    });

    const groupedSets = {};
    seriesOrder.forEach(s => {
        const setsInSeries = filteredSets.filter(set => set.series === s);
        if (setsInSeries.length > 0) {
            groupedSets[s] = setsInSeries;
        }
    });
    filteredSets.forEach(set => {
        if (!seriesOrder.includes(set.series)) {
            if (!groupedSets[set.series]) {
                groupedSets[set.series] = [];
            }
            if (!groupedSets[set.series].find(s => s.id === set.id)) {
                groupedSets[set.series].push(set);
            }
        }
    });

    const handleSetClick = (set) => {
        setSelectedSet(set);
        setCurrentPage('set-detail');
    };

    if (loading) {
        return (
            <div className="section">
                <Loading message="Loading sets from the Pokémon TCG database..." />
            </div>
        );
    }

    return (
        <div className="section">
            <div className="section-header">
                <h2>📚 Browse All Sets</h2>
                <p>Explore every Pokémon TCG set ever released</p>
            </div>

            <div className="sets-controls">
                <SearchBar
                    placeholder="Search sets..."
                    value={searchTerm}
                    onChange={setSearchTerm}
                />
                <div className="view-toggle">
                    <button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid View">
                        <span>▦</span>
                    </button>
                    <button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List View">
                        <span>☰</span>
                    </button>
                </div>
            </div>

            <div className="series-filter">
                <button
                    className={`series-btn ${selectedSeries === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedSeries('all')}
                >
                    All Series
                </button>
                {series.map(s => (
                    <button
                        key={s}
                        className={`series-btn ${selectedSeries === s ? 'active' : ''}`}
                        onClick={() => setSelectedSeries(s)}
                    >
                        {s}
                    </button>
                ))}
            </div>

            {filteredSets.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">🔍</div>
                    <h3>No Sets Found</h3>
                    <p>Try adjusting your search or filter</p>
                </div>
            ) : viewMode === 'grid' ? (
                <div className="sets-grouped">
                    {Object.entries(groupedSets).map(([seriesName, seriesSets]) => (
                        <div key={seriesName} className="series-group">
                            <div className="series-header">
                                <span className="series-icon">{seriesIcons[seriesName] || '📁'}</span>
                                <h3>{seriesName}</h3>
                                <span className="series-count">{seriesSets.length} sets</span>
                            </div>
                            <div className="sets-grid">
                                {seriesSets.map(set => (
                                    <SetCard 
                                        key={set.id} 
                                        set={set} 
                                        onClick={() => handleSetClick(set)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="sets-list-view">
                    {Object.entries(groupedSets).map(([seriesName, seriesSets]) => (
                        <div key={seriesName} className="series-group-list">
                            <div className="series-header-list">
                                <span className="series-icon">{seriesIcons[seriesName] || '📁'}</span>
                                <h3>{seriesName}</h3>
                                <span className="series-count">{seriesSets.length} sets</span>
                            </div>
                            <div className="sets-list-items">
                                {seriesSets.map(set => (
                                    <div key={set.id} className="set-list-expandable">
                                        <div className="set-list-row" onClick={(e) => toggleSetExpand(set.id, e)}>
                                            <div className="set-expand-icon">
                                                {expandedSets[set.id] ? '▼' : '▶'}
                                            </div>
                                            {set.images?.symbol && (
                                                <img src={set.images.symbol} alt="" className="set-symbol-tiny" />
                                            )}
                                            <div className="set-list-main">
                                                <strong>{set.name}</strong>
                                            </div>
                                            <div className="set-list-meta-info">
                                                <span>{set.total} cards</span>
                                                <span>{set.releaseDate}</span>
                                            </div>
                                            <button 
                                                className="btn btn-sm btn-primary"
                                                onClick={(e) => { e.stopPropagation(); handleSetClick(set); }}
                                            >
                                                View
                                            </button>
                                        </div>
                                        
                                        {expandedSets[set.id] && (
                                            <div className="set-cards-expanded">
                                                {loadingCards[set.id] ? (
                                                    <div className="loading-cards-inline">Loading cards...</div>
                                                ) : (
                                                    <table className="cards-table-compact">
                                                        <thead>
                                                            <tr>
                                                                <th>#</th>
                                                                <th>Name</th>
                                                                <th>Rarity</th>
                                                                <th>Type</th>
                                                                <th>Price</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {setCards[set.id]?.map(card => (
                                                                <tr key={card.id}>
                                                                    <td className="card-num">#{card.number}</td>
                                                                    <td className="card-name-cell">{card.name}</td>
                                                                    <td className="rarity-cell">{card.rarity || 'Common'}</td>
                                                                    <td>{card.types?.[0] || card.supertype || '-'}</td>
                                                                    <td className="price-cell">{Helpers.getCardPrice(card) ? Helpers.formatPrice(Helpers.getCardPrice(card)) : '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SetCard = ({ set, onClick }) => {
    return (
        <div className="card set-card" onClick={onClick}>
            <div className="set-card-header">
                {set.images?.logo ? (
                    <img src={set.images.logo} alt={set.name} />
                ) : (
                    <span style={{ fontSize: '2rem', color: 'var(--poke-yellow)' }}>
                        {set.name}
                    </span>
                )}
                {set.images?.symbol && (
                    <img 
                        src={set.images.symbol} 
                        alt="" 
                        className="set-symbol"
                    />
                )}
            </div>
            <div className="set-card-body">
                <h3>{set.name}</h3>
                <div className="set-meta">
                    <span>{set.total} cards</span>
                    <span>{set.releaseDate}</span>
                </div>
            </div>
        </div>
    );
};

window.SetsPage = SetsPage;
