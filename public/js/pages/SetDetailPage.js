/* ===================================
   Set Detail Page - View Cards in Set
   =================================== */

const SetDetailPage = ({ set, setCurrentPage }) => {
    const [cards, setCards] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedCard, setSelectedCard] = React.useState(null);
    const [page, setPage] = React.useState(1);
    const [totalPages, setTotalPages] = React.useState(1);
    const [pageSize, setPageSize] = React.useState(() => {
        return window.getSettings().cardsPerPage;
    });
    const [totalCount, setTotalCount] = React.useState(0);

    React.useEffect(() => {
        if (set) {
            setPage(1);
        }
    }, [set, pageSize]);

    React.useEffect(() => {
        if (set) {
            fetchCards();
        }
    }, [set, page, pageSize]);

    const fetchCards = async () => {
        setLoading(true);
        const size = pageSize === 'all' ? 9999 : pageSize;
        const result = await PokemonAPI.getCardsFromSet(set.id, page, size);
        
        if (result.success) {
            const sortedCards = result.data.sort((a, b) => {
                const numA = parseInt(a.number) || 0;
                const numB = parseInt(b.number) || 0;
                if (numA === numB) {
                    return (a.number || '').localeCompare(b.number || '');
                }
                return numA - numB;
            });
            setCards(sortedCards);
            setTotalCount(result.totalCount);
            setTotalPages(pageSize === 'all' ? 1 : Math.ceil(result.totalCount / pageSize));
        }
        
        setLoading(false);
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setPage(1);
    };

    const settings = window.getSettings();

    if (!set) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-state-icon">📦</div>
                    <h3>No Set Selected</h3>
                    <p>Please select a set to view its cards</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => setCurrentPage('sets')}
                        style={{ marginTop: '1rem' }}
                    >
                        Browse Sets
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="section">
            <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage('sets')}
                style={{ marginBottom: '2rem' }}
            >
                ← Back to Sets
            </button>

            <div className="section-header">
                {set.images?.logo && (
                    <img
                        src={set.images.logo}
                        alt={set.name}
                        style={{ maxHeight: '80px', marginBottom: '1rem' }}
                    />
                )}
                <h2>{set.name}</h2>
                <p>{set.series} • {set.total} cards • Released {set.releaseDate}</p>
            </div>

            <div className="page-controls">
                <span>Cards per page:</span>
                <div className="page-size-buttons">
                    {[20, 50, 100, 'all'].map(size => (
                        <button
                            key={size}
                            className={`page-size-btn ${pageSize === size ? 'active' : ''}`}
                            onClick={() => handlePageSizeChange(size)}
                        >
                            {size === 'all' ? 'All' : size}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Loading message="Loading cards..." />
            ) : (
                <>
                    <div className="cards-grid">
                        {cards.map(card => (
                            <PokemonCard
                                key={card.id}
                                card={card}
                                onClick={() => setSelectedCard(card)}
                                totalInSet={set.total || set.printedTotal}
                                showPrice={settings.showPrices}
                            />
                        ))}
                    </div>

                    {pageSize !== 'all' && totalPages > 1 && (
                        <Pagination
                            currentPage={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                        />
                    )}
                </>
            )}

            {selectedCard && (
                <CardModal
                    card={selectedCard}
                    onClose={() => setSelectedCard(null)}
                />
            )}
        </div>
    );
};

// Pokemon Card sub-component
const PokemonCard = ({ card, onClick, totalInSet, showPrice = true }) => {
    const price = Helpers.getCardPrice(card);
    const cardNumber = card.number || '?';
    const printedTotal = card.set?.printedTotal || totalInSet || '?';

    return (
        <div className="card pokemon-card" onClick={onClick}>
            <div className="card-number-badge">
                {cardNumber}/{printedTotal}
            </div>
            <img src={card.images?.small} alt={card.name} />
            <div className="pokemon-card-info">
                <h4>{card.name}</h4>
                <span className="rarity">{card.rarity || 'Common'}</span>
                {showPrice && price && (
                    <p className="price">{Helpers.formatPrice(price)}</p>
                )}
            </div>
        </div>
    );
};

window.SetDetailPage = SetDetailPage;
window.PokemonCard = PokemonCard;
