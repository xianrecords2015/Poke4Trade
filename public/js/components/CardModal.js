/* ===================================
   Card Modal Component
   =================================== */

const CardModal = ({ card, onClose, onAddToTrade }) => {
    const { user } = useAuth();
    const { success } = useToast();

    if (!card) return null;

    const getPrice = () => {
        if (!card.tcgplayer?.prices) return null;
        const priceTypes = Object.keys(card.tcgplayer.prices);
        if (priceTypes.length === 0) return null;
        return card.tcgplayer.prices[priceTypes[0]];
    };

    const price = getPrice();

    const handleAddToTrade = () => {
        if (onAddToTrade) {
            onAddToTrade(card);
            success(`Added ${card.name} to trade`);
            onClose();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <button className="modal-close" onClick={onClose}>×</button>
                
                <div className="card-detail">
                    <div className="card-detail-image">
                        <img src={card.images.large} alt={card.name} />
                    </div>
                    
                    <div className="card-detail-info">
                        <h2>{card.name}</h2>
                        <p className="card-set">
                            {card.set.name} • {card.number}/{card.set.printedTotal}
                        </p>
                        
                        <div className="card-stats">
                            <div className="card-stat">
                                <div className="card-stat-label">Rarity</div>
                                <div className="card-stat-value">{card.rarity || 'Common'}</div>
                            </div>
                            <div className="card-stat">
                                <div className="card-stat-label">Type</div>
                                <div className="card-stat-value">
                                    {card.types?.join(', ') || 'N/A'}
                                </div>
                            </div>
                            {card.hp && (
                                <div className="card-stat">
                                    <div className="card-stat-label">HP</div>
                                    <div className="card-stat-value">{card.hp}</div>
                                </div>
                            )}
                            <div className="card-stat">
                                <div className="card-stat-label">Artist</div>
                                <div className="card-stat-value">{card.artist || 'Unknown'}</div>
                            </div>
                        </div>

                        {price && (
                            <div style={{ marginTop: '1.5rem' }}>
                                <h3 style={{ 
                                    color: 'var(--poke-yellow)', 
                                    marginBottom: '1rem',
                                    fontFamily: 'var(--font-display)'
                                }}>
                                    💰 Market Prices
                                </h3>
                                <div className="card-stats">
                                    {price.low && (
                                        <div className="card-stat">
                                            <div className="card-stat-label">Low</div>
                                            <div className="card-stat-value">
                                                {Helpers.formatPrice(price.low)}
                                            </div>
                                        </div>
                                    )}
                                    {price.market && (
                                        <div className="card-stat">
                                            <div className="card-stat-label">Market</div>
                                            <div className="card-stat-value" style={{ color: 'var(--energy-electric)' }}>
                                                {Helpers.formatPrice(price.market)}
                                            </div>
                                        </div>
                                    )}
                                    {price.high && (
                                        <div className="card-stat">
                                            <div className="card-stat-label">High</div>
                                            <div className="card-stat-value">
                                                {Helpers.formatPrice(price.high)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                            {onAddToTrade && user && (
                                <button className="btn btn-primary" onClick={handleAddToTrade}>
                                    + Add to Trade
                                </button>
                            )}
                            {card.tcgplayer?.url && (
                                <a
                                    href={card.tcgplayer.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="btn btn-secondary"
                                >
                                    Buy on TCGPlayer
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Make available globally
window.CardModal = CardModal;
