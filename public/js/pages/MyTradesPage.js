/* ===================================
   My Trades Page - View Trade Requests
   =================================== */

const MyTradesPage = ({ setCurrentPage, pageData }) => {
    const { user } = useAuth();
    const { success, error } = useToast();
    const [activeTab, setActiveTab] = React.useState('pending');
    const [trades, setTrades] = React.useState({ received: [], sent: [] });
    const [loading, setLoading] = React.useState(true);
    const [selectedTrade, setSelectedTrade] = React.useState(null);
    const [tradeDetails, setTradeDetails] = React.useState(null);
    const [detailsLoading, setDetailsLoading] = React.useState(false);
    const [initialOpenTab, setInitialOpenTab] = React.useState(null);

    React.useEffect(() => {
        if (user) {
            loadTrades();
        }
    }, [user]);

    // Handle deep link from notification
    React.useEffect(() => {
        if (pageData?.tradeId && trades.received.length + trades.sent.length > 0) {
            const allTrades = [
                ...trades.received.map(t => ({ ...t, direction: 'received', otherUser: t.from_username })),
                ...trades.sent.map(t => ({ ...t, direction: 'sent', otherUser: t.to_username }))
            ];
            const targetTrade = allTrades.find(t => t.id === pageData.tradeId);
            if (targetTrade && !selectedTrade) {
                setInitialOpenTab(pageData.openTab || 'details');
                viewTradeDetails(targetTrade);
                // Switch to appropriate tab based on trade status
                if (['accepted', 'shipping'].includes(targetTrade.status)) {
                    setActiveTab('active');
                } else if (targetTrade.status === 'pending') {
                    setActiveTab('pending');
                } else if (targetTrade.status === 'completed') {
                    setActiveTab('completed');
                } else {
                    setActiveTab('other');
                }
            }
        }
    }, [pageData, trades]);

    const loadTrades = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/trading/requests/${user.id}`);
            const data = await res.json();
            if (data.success) {
                setTrades(data.data);
            }
        } catch (err) {
            error('Error loading trades');
        }
        setLoading(false);
    };

    const viewTradeDetails = async (trade) => {
        setSelectedTrade(trade);
        setDetailsLoading(true);
        try {
            const res = await fetch(`/api/trading/full/${trade.id}?userId=${user.id}`);
            const data = await res.json();
            if (data.success) {
                setTradeDetails(data.data);
            }
        } catch (err) {
            error('Error loading trade details');
        }
        setDetailsLoading(false);
    };

    const respondToTrade = async (tradeId, action) => {
        try {
            const res = await fetch(`/api/trading/respond/${tradeId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, action })
            });
            const data = await res.json();
            if (data.success) {
                success(`Trade ${action}!`);
                setSelectedTrade(null);
                setTradeDetails(null);
                loadTrades();
            } else {
                error(data.error || 'Failed to respond');
            }
        } catch (err) {
            error('Error responding to trade');
        }
    };

    const cancelTrade = async (tradeId) => {
        if (!confirm('Cancel this trade proposal?')) return;
        try {
            const res = await fetch(`/api/trading/cancel/${tradeId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id })
            });
            const data = await res.json();
            if (data.success) {
                success('Trade cancelled');
                setSelectedTrade(null);
                setTradeDetails(null);
                loadTrades();
            }
        } catch (err) {
            error('Error cancelling trade');
        }
    };

    const formatPrice = (price) => {
        if (price === null || price === undefined) return '-';
        return '$' + parseFloat(price).toFixed(2);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'Pending', class: 'pending' },
            accepted: { text: 'Accepted', class: 'accepted' },
            shipping: { text: 'Shipping', class: 'shipping' },
            delivered: { text: 'Delivered', class: 'delivered' },
            completed: { text: 'Completed', class: 'completed' },
            declined: { text: 'Declined', class: 'declined' },
            cancelled: { text: 'Cancelled', class: 'cancelled' },
            disputed: { text: 'Disputed', class: 'disputed' }
        };
        return badges[status] || { text: status, class: '' };
    };

    if (!user) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-icon">🔐</div>
                    <h3>Sign In Required</h3>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')}>Sign In</button>
                </div>
            </div>
        );
    }

    // Combine and categorize trades
    const allTrades = [
        ...trades.received.map(t => ({ ...t, direction: 'received', otherUser: t.from_username })),
        ...trades.sent.map(t => ({ ...t, direction: 'sent', otherUser: t.to_username }))
    ];

    const pendingTrades = allTrades.filter(t => t.status === 'pending');
    const activeTrades = allTrades.filter(t => ['accepted', 'shipping'].includes(t.status));
    const completedTrades = allTrades.filter(t => t.status === 'completed');
    const otherTrades = allTrades.filter(t => ['declined', 'cancelled', 'disputed'].includes(t.status));

    const getTradesForTab = () => {
        switch (activeTab) {
            case 'pending': return pendingTrades;
            case 'active': return activeTrades;
            case 'completed': return completedTrades;
            case 'other': return otherTrades;
            default: return [];
        }
    };

    return (
        <div className="section">
            <div className="section-header">
                <h2>📋 My Trades</h2>
                <p>Manage your trade proposals</p>
            </div>

            <div className="tabs" style={{ marginBottom: '1.5rem' }}>
                <button className={`tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
                    ⏳ Pending {pendingTrades.length > 0 && <span className="tab-badge">{pendingTrades.length}</span>}
                </button>
                <button className={`tab ${activeTab === 'active' ? 'active' : ''}`} onClick={() => setActiveTab('active')}>
                    📦 Active {activeTrades.length > 0 && <span className="tab-badge">{activeTrades.length}</span>}
                </button>
                <button className={`tab ${activeTab === 'completed' ? 'active' : ''}`} onClick={() => setActiveTab('completed')}>
                    ✅ Completed ({completedTrades.length})
                </button>
                <button className={`tab ${activeTab === 'other' ? 'active' : ''}`} onClick={() => setActiveTab('other')}>
                    📁 Other ({otherTrades.length})
                </button>
            </div>

            {loading ? (
                <Loading message="Loading trades..." />
            ) : (
                <TradesList 
                    trades={getTradesForTab()}
                    activeTab={activeTab}
                    onViewDetails={viewTradeDetails}
                    onCancel={cancelTrade}
                    onRespond={respondToTrade}
                    formatPrice={formatPrice}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    currentUserId={user.id}
                    initialOpenTab={initialOpenTab}
                />
            )}

            {selectedTrade && tradeDetails && (
                <TradeDetailsModal
                    trade={selectedTrade}
                    details={tradeDetails}
                    loading={detailsLoading}
                    onClose={() => { setSelectedTrade(null); setTradeDetails(null); setInitialOpenTab(null); loadTrades(); setCurrentPage('my-trades', null); }}
                    onRespond={respondToTrade}
                    onCancel={cancelTrade}
                    onUpdate={() => { viewTradeDetails(selectedTrade); loadTrades(); }}
                    formatPrice={formatPrice}
                    formatDate={formatDate}
                    getStatusBadge={getStatusBadge}
                    currentUserId={user.id}
                    initialOpenTab={initialOpenTab}
                />
            )}

            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                <button className="btn btn-secondary" onClick={() => setCurrentPage('trade')}>
                    🔄 Find New Trades
                </button>
            </div>
        </div>
    );
};

/* Trades List - Compact Email Style */
const TradesList = ({ trades, activeTab, onViewDetails, onCancel, onRespond, formatPrice, formatDate, getStatusBadge, currentUserId }) => {
    if (trades.length === 0) {
        const emptyMessages = {
            pending: { icon: '⏳', title: 'No Pending Trades', msg: 'No pending proposals.' },
            active: { icon: '📦', title: 'No Active Trades', msg: 'No trades in progress.' },
            completed: { icon: '✅', title: 'No Completed Trades', msg: 'Complete some trades!' },
            other: { icon: '📁', title: 'No Other Trades', msg: 'No declined or cancelled trades.' }
        };
        const empty = emptyMessages[activeTab];
        return (
            <div className="empty-state">
                <div className="empty-icon">{empty.icon}</div>
                <h3>{empty.title}</h3>
                <p>{empty.msg}</p>
            </div>
        );
    }

    return (
        <div className="trades-table">
            <div className="trades-table-header">
                <span className="col-status">Status</span>
                <span className="col-direction"></span>
                <span className="col-user">Trader</span>
                <span className="col-cards">Cards</span>
                <span className="col-value">Value</span>
                <span className="col-msg">Msg</span>
                <span className="col-date">Date</span>
                <span className="col-actions"></span>
            </div>
            {trades.map(trade => {
                const badge = getStatusBadge(trade.status);
                const isReceived = trade.direction === 'received';
                const cardsOffer = isReceived ? trade.cards_they_offer : trade.cards_you_offer;
                const cardsWant = isReceived ? trade.cards_they_want : trade.cards_you_want;
                const hasUnread = trade.unread_messages > 0;
                
                return (
                    <div 
                        key={`${trade.direction}-${trade.id}`} 
                        className={`trades-table-row ${trade.status}`}
                        onClick={() => onViewDetails(trade)}
                    >
                        <span className="col-status">
                            <span className={`status-dot ${badge.class}`}></span>
                            <span className={`status-mini ${badge.class}`}>{badge.text}</span>
                        </span>
                        <span className="col-direction">
                            <span className={`direction-arrow ${isReceived ? 'received' : 'sent'}`} title={isReceived ? 'Received' : 'Sent'}>
                                {isReceived ? '←' : '→'}
                            </span>
                        </span>
                        <span className="col-user">
                            <span className="user-name">{trade.otherUser}</span>
                        </span>
                        <span className="col-cards">
                            <span className="cards-exchange">
                                {cardsOffer} ⇄ {cardsWant}
                            </span>
                        </span>
                        <span className="col-value">
                            <span className="value-exchange">
                                {formatPrice(trade.from_value)}
                            </span>
                        </span>
                        <span className="col-msg">
                            {hasUnread ? (
                                <span className="msg-badge unread" title={`${trade.unread_messages} unread`}>
                                    {trade.unread_messages}
                                </span>
                            ) : trade.message_count > 0 ? (
                                <span className="msg-badge read" title={`${trade.message_count} messages`}>
                                    💬
                                </span>
                            ) : (
                                <span className="msg-badge empty">-</span>
                            )}
                        </span>
                        <span className="col-date">
                            {new Date(trade.created_at).toLocaleDateString()}
                        </span>
                        <span className="col-actions" onClick={e => e.stopPropagation()}>
                            {trade.status === 'pending' && isReceived && (
                                <>
                                    <button className="btn-icon success" onClick={() => onRespond(trade.id, 'accepted')} title="Accept">✓</button>
                                    <button className="btn-icon danger" onClick={() => onRespond(trade.id, 'declined')} title="Decline">✗</button>
                                </>
                            )}
                            {trade.status === 'pending' && !isReceived && (
                                <button className="btn-icon secondary" onClick={() => onCancel(trade.id)} title="Cancel">✗</button>
                            )}
                        </span>
                    </div>
                );
            })}
        </div>
    );
};

/* Trade Details Modal */
const TradeDetailsModal = ({ trade, details, loading, onClose, onRespond, onCancel, onUpdate, formatPrice, formatDate, getStatusBadge, currentUserId, initialOpenTab }) => {
    const { success, error } = useToast();
    const [activeView, setActiveView] = React.useState(initialOpenTab || 'details');
    const [messages, setMessages] = React.useState([]);
    const [newMessage, setNewMessage] = React.useState('');
    const [sendingMessage, setSendingMessage] = React.useState(false);
    const [tracking, setTracking] = React.useState('');
    const [showRatingModal, setShowRatingModal] = React.useState(false);
    const [unreadCount, setUnreadCount] = React.useState(trade.unread_messages || 0);
    
    const tradeData = details?.trade;
    const isFromUser = tradeData?.from_user_id === currentUserId;
    const isReceived = trade.direction === 'received';
    const badge = getStatusBadge(trade.status);

    // Load messages
    React.useEffect(() => {
        if (activeView === 'messages' && tradeData) {
            loadMessages();
            const interval = setInterval(loadMessages, 10000);
            return () => clearInterval(interval);
        }
    }, [activeView, tradeData]);

    const loadMessages = async () => {
        try {
            const res = await fetch(`/api/trading/messages/${trade.id}?userId=${currentUserId}`);
            const data = await res.json();
            if (data.success) {
                setMessages(data.data);
                if (unreadCount > 0) {
                    setUnreadCount(0);
                }
            }
        } catch (err) {}
    };

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        setSendingMessage(true);
        try {
            const res = await fetch(`/api/trading/messages/${trade.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, message: newMessage })
            });
            if ((await res.json()).success) {
                setNewMessage('');
                loadMessages();
            }
        } catch (err) {
            error('Failed to send message');
        }
        setSendingMessage(false);
    };

    const markShipped = async () => {
        const removeFromListings = confirm('Mark as shipped?\n\nWould you also like to remove these cards from your "For Trade" listings?');
        
        try {
            const res = await fetch(`/api/trading/ship/${trade.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: currentUserId, 
                    tracking,
                    removeFromListings 
                })
            });
            if ((await res.json()).success) {
                success('Marked as shipped!' + (removeFromListings ? ' Cards removed from listings.' : ''));
                onUpdate();
            }
        } catch (err) {
            error('Failed to update shipping');
        }
    };

    const undoShipped = async () => {
        if (!confirm('Undo shipped status? This will mark the package as not shipped.')) return;
        
        try {
            const res = await fetch(`/api/trading/unship/${trade.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId })
            });
            if ((await res.json()).success) {
                success('Shipping status undone');
                onUpdate();
            }
        } catch (err) {
            error('Failed to undo shipping');
        }
    };

    const confirmReceived = async () => {
        const addToCollection = confirm('Confirm receipt?\n\nWould you also like to mark these cards as owned in your collection?');
        
        try {
            const res = await fetch(`/api/trading/receive/${trade.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: currentUserId,
                    addToCollection 
                })
            });
            const data = await res.json();
            if (data.success) {
                let msg = data.completed ? 'Trade completed!' : 'Receipt confirmed!';
                if (addToCollection) msg += ' Cards added to collection.';
                success(msg);
                onUpdate();
            }
        } catch (err) {
            error('Failed to confirm receipt');
        }
    };

    const getTypeColor = (type) => {
        const colors = { 'Grass': '#7CB518', 'Fire': '#FF6B35', 'Water': '#4ECDC4', 'Lightning': '#FFD93D', 'Psychic': '#9B59B6', 'Fighting': '#D56723', 'Darkness': '#5A5A6E', 'Metal': '#8A8A9E', 'Fairy': '#E93EB8', 'Dragon': '#7038F8', 'Colorless': '#A8A8A8' };
        return colors[type] || '#888';
    };

    const CardItem = ({ card }) => {
        let rarity = null, types = [];
        if (card.card_data) {
            try {
                const data = typeof card.card_data === 'string' ? JSON.parse(card.card_data) : card.card_data;
                rarity = data.rarity; types = data.types || [];
            } catch (e) {}
        }
        return (
            <div className="detail-card-item-full">
                <img src={card.card_image} alt={card.card_name} />
                <div className="detail-card-details">
                    <div className="card-name-row">
                        <span className="card-name">{card.card_name}</span>
                        <span className="card-price">{formatPrice(card.card_price)}</span>
                    </div>
                    <div className="card-meta">
                        <span className="card-set">{card.set_name}</span>
                        <span className="card-number">#{card.card_number}</span>
                    </div>
                    <div className="card-attributes">
                        {types.length > 0 && <span className="card-type" style={{ background: getTypeColor(types[0]) }}>{types[0]}</span>}
                        {rarity && <span className="card-rarity">{rarity}</span>}
                    </div>
                </div>
            </div>
        );
    };

    const cardsToGive = details?.cards?.filter(c => c.direction === 'give') || [];
    const cardsToGet = details?.cards?.filter(c => c.direction === 'get') || [];

    // Shipping status helpers
    const myShipped = isFromUser ? tradeData?.from_user_shipped : tradeData?.to_user_shipped;
    const theirShipped = isFromUser ? tradeData?.to_user_shipped : tradeData?.from_user_shipped;
    const myReceived = isFromUser ? tradeData?.from_user_received : tradeData?.to_user_received;
    const theirReceived = isFromUser ? tradeData?.to_user_received : tradeData?.from_user_received;
    const theirTracking = isFromUser ? tradeData?.to_user_tracking : tradeData?.from_user_tracking;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal modal-xl" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Trade with {trade.otherUser}</h3>
                    <span className={`status-badge ${badge.class}`}>{badge.text}</span>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {/* View Tabs */}
                <div className="modal-tabs">
                    <button className={activeView === 'details' ? 'active' : ''} onClick={() => setActiveView('details')}>📋 Details</button>
                    <button className={activeView === 'messages' ? 'active' : ''} onClick={() => setActiveView('messages')}>
                        💬 Messages {unreadCount > 0 && <span className="tab-badge-red">{unreadCount}</span>}
                    </button>
                    {['accepted', 'shipping', 'completed'].includes(tradeData?.status) && (
                        <button className={activeView === 'shipping' ? 'active' : ''} onClick={() => setActiveView('shipping')}>📦 Shipping</button>
                    )}
                </div>

                <div className="modal-body">
                    {loading ? <Loading /> : (
                        <>
                            {/* Details View */}
                            {activeView === 'details' && (
                                <>
                                    <div className="trade-detail-date">Created: {formatDate(tradeData?.created_at)}</div>
                                    
                                    <div className="trade-details-grid">
                                        <div className="trade-detail-section">
                                            <h4 className="detail-section-header offer">
                                                {isReceived ? 'They Offer' : 'You Offer'} ({cardsToGive.length})
                                                <span className="section-total">{formatPrice(tradeData?.from_value)}</span>
                                            </h4>
                                            <div className="detail-card-list">
                                                {cardsToGive.map(card => <CardItem key={card.id} card={card} />)}
                                            </div>
                                        </div>
                                        <div className="trade-detail-section">
                                            <h4 className="detail-section-header want">
                                                {isReceived ? 'They Want' : 'You Want'} ({cardsToGet.length})
                                                <span className="section-total">{formatPrice(tradeData?.to_value)}</span>
                                            </h4>
                                            <div className="detail-card-list">
                                                {cardsToGet.map(card => <CardItem key={card.id} card={card} />)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="trade-value-summary">
                                        <div className="value-row">
                                            <span>You {isReceived ? 'receive' : 'offer'}:</span>
                                            <span>{formatPrice(tradeData?.from_value)}</span>
                                        </div>
                                        <div className="value-row">
                                            <span>You {isReceived ? 'give' : 'receive'}:</span>
                                            <span>{formatPrice(tradeData?.to_value)}</span>
                                        </div>
                                        <div className="value-row total">
                                            <span>Balance:</span>
                                            <span className={(isReceived ? tradeData?.from_value - tradeData?.to_value : tradeData?.to_value - tradeData?.from_value) >= 0 ? 'positive' : 'negative'}>
                                                {(isReceived ? tradeData?.from_value - tradeData?.to_value : tradeData?.to_value - tradeData?.from_value) >= 0 ? '+' : ''}
                                                {formatPrice(Math.abs(isReceived ? tradeData?.from_value - tradeData?.to_value : tradeData?.to_value - tradeData?.from_value))}
                                            </span>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Messages View */}
                            {activeView === 'messages' && (
                                <div className="messages-container">
                                    <div className="messages-list">
                                        {messages.length === 0 ? (
                                            <div className="empty-messages">No messages yet. Start the conversation!</div>
                                        ) : (
                                            messages.map(msg => (
                                                <div key={msg.id} className={`message ${msg.user_id === currentUserId ? 'mine' : 'theirs'}`}>
                                                    <div className="message-header">
                                                        <span className="message-user">{msg.username}</span>
                                                        <span className="message-time">{formatDate(msg.created_at)}</span>
                                                    </div>
                                                    <div className="message-body">{msg.message}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    <div className="message-input">
                                        <input 
                                            type="text" 
                                            value={newMessage} 
                                            onChange={e => setNewMessage(e.target.value)}
                                            onKeyPress={e => e.key === 'Enter' && sendMessage()}
                                            placeholder="Type a message..."
                                        />
                                        <button className="btn btn-primary" onClick={sendMessage} disabled={sendingMessage}>
                                            {sendingMessage ? '...' : 'Send'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Shipping View */}
                            {activeView === 'shipping' && (
                                <div className="shipping-container">
                                    {/* Addresses */}
                                    <div className="shipping-addresses">
                                        <div className="address-card">
                                            <h4>📤 Ship To: {isReceived ? tradeData?.from_username : tradeData?.to_username}</h4>
                                            <div className="address-details">
                                                {isReceived ? (
                                                    <>
                                                        <p>{tradeData?.from_address1}</p>
                                                        {tradeData?.from_address2 && <p>{tradeData?.from_address2}</p>}
                                                        <p>{tradeData?.from_city}, {tradeData?.from_state} {tradeData?.from_postal}</p>
                                                        <p>{tradeData?.from_country}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p>{tradeData?.to_address1}</p>
                                                        {tradeData?.to_address2 && <p>{tradeData?.to_address2}</p>}
                                                        <p>{tradeData?.to_city}, {tradeData?.to_state} {tradeData?.to_postal}</p>
                                                        <p>{tradeData?.to_country}</p>
                                                    </>
                                                )}
                                                {!tradeData?.to_address1 && !tradeData?.from_address1 && (
                                                    <p className="no-address">⚠️ Address not provided. Ask in messages.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Shipping Status */}
                                    <div className="shipping-status">
                                        <h4>Shipping Status</h4>
                                        <div className="status-grid">
                                            <div className={`status-item ${myShipped ? 'done' : ''}`}>
                                                <span className="status-icon">{myShipped ? '✅' : '⏳'}</span>
                                                <span>You shipped</span>
                                            </div>
                                            <div className={`status-item ${theirShipped ? 'done' : ''}`}>
                                                <span className="status-icon">{theirShipped ? '✅' : '⏳'}</span>
                                                <span>They shipped</span>
                                                {theirTracking && <span className="tracking">Tracking: {theirTracking}</span>}
                                            </div>
                                            <div className={`status-item ${theirReceived ? 'done' : ''}`}>
                                                <span className="status-icon">{theirReceived ? '✅' : '⏳'}</span>
                                                <span>They received</span>
                                            </div>
                                            <div className={`status-item ${myReceived ? 'done' : ''}`}>
                                                <span className="status-icon">{myReceived ? '✅' : '⏳'}</span>
                                                <span>You received</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="shipping-actions">
                                        {!!myShipped && !theirReceived && (
                                            <button className="btn btn-secondary btn-sm" onClick={undoShipped}>
                                                ↩️ Undo Shipped
                                            </button>
                                        )}
                                        {!myShipped && (
                                            <div className="ship-form">
                                                <input 
                                                    type="text" 
                                                    placeholder="Tracking # (optional)"
                                                    value={tracking}
                                                    onChange={e => setTracking(e.target.value)}
                                                />
                                                <button className="btn btn-primary" onClick={markShipped}>
                                                    📦 Mark as Shipped
                                                </button>
                                            </div>
                                        )}
                                        {!!theirShipped && !myReceived && (
                                            <button className="btn btn-success" onClick={confirmReceived}>
                                                ✅ Confirm Receipt
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Close</button>
                    
                    {trade.status === 'pending' && isReceived && (
                        <>
                            <button className="btn btn-danger" onClick={() => onRespond(trade.id, 'declined')}>❌ Decline</button>
                            <button className="btn btn-success" onClick={() => onRespond(trade.id, 'accepted')}>✅ Accept</button>
                        </>
                    )}
                    
                    {trade.status === 'pending' && !isReceived && (
                        <button className="btn btn-danger" onClick={() => onCancel(trade.id)}>Cancel</button>
                    )}

                    {trade.status === 'completed' && !details?.hasRated && (
                        <button className="btn btn-primary" onClick={() => setShowRatingModal(true)}>⭐ Rate Trade</button>
                    )}
                </div>

                {/* Rating Modal */}
                {showRatingModal && (
                    <RatingModal 
                        tradeId={trade.id}
                        userId={currentUserId}
                        otherUser={trade.otherUser}
                        onClose={() => setShowRatingModal(false)}
                        onSubmit={() => { setShowRatingModal(false); onUpdate(); }}
                    />
                )}
            </div>
        </div>
    );
};

/* Rating Modal */
const RatingModal = ({ tradeId, userId, otherUser, onClose, onSubmit }) => {
    const { success, error } = useToast();
    const [overall, setOverall] = React.useState(5);
    const [communication, setCommunication] = React.useState(5);
    const [shipping, setShipping] = React.useState(5);
    const [condition, setCondition] = React.useState(5);
    const [comment, setComment] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);

    const StarRating = ({ value, onChange, label }) => (
        <div className="star-rating-row">
            <span className="rating-label">{label}</span>
            <div className="stars">
                {[1, 2, 3, 4, 5].map(star => (
                    <span 
                        key={star} 
                        className={`star ${star <= value ? 'filled' : ''}`}
                        onClick={() => onChange(star)}
                    >★</span>
                ))}
            </div>
        </div>
    );

    const handleSubmit = async () => {
        setSubmitting(true);
        try {
            const res = await fetch(`/api/trading/rate/${tradeId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    overallRating: overall,
                    communicationRating: communication,
                    shippingRating: shipping,
                    cardConditionRating: condition,
                    comment
                })
            });
            const data = await res.json();
            if (data.success) {
                success('Rating submitted!');
                onSubmit();
            } else {
                error(data.error);
            }
        } catch (err) {
            error('Failed to submit rating');
        }
        setSubmitting(false);
    };

    return (
        <div className="rating-modal-overlay" onClick={onClose}>
            <div className="rating-modal" onClick={e => e.stopPropagation()}>
                <h3>Rate {otherUser}</h3>
                
                <StarRating value={overall} onChange={setOverall} label="Overall" />
                <StarRating value={communication} onChange={setCommunication} label="Communication" />
                <StarRating value={shipping} onChange={setShipping} label="Shipping Speed" />
                <StarRating value={condition} onChange={setCondition} label="Card Condition" />
                
                <textarea 
                    placeholder="Leave a comment (optional)"
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                />
                
                <div className="rating-actions">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
                        {submitting ? 'Submitting...' : 'Submit Rating'}
                    </button>
                </div>
            </div>
        </div>
    );
};

window.MyTradesPage = MyTradesPage;
