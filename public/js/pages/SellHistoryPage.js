/* ===================================
   Sell History Page - Manage Orders & View Sales
   =================================== */

const SellHistoryPage = ({ setCurrentPage }) => {
    const { user } = React.useContext(AuthContext);
    const { success: showSuccess, error: showError } = React.useContext(ToastContext);
    
    const [soldItems, setSoldItems] = React.useState([]);
    const [sellerOrders, setSellerOrders] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [filter, setFilter] = React.useState('all');
    const [stats, setStats] = React.useState({ totalSold: 0, totalValue: 0 });
    const [expandedOrder, setExpandedOrder] = React.useState(null);
    const [activeTab, setActiveTab] = React.useState('orders'); // 'orders' or 'history'
    
    React.useEffect(() => {
        if (user?.id) {
            loadData();
        }
    }, [user, filter]);
    
    const loadData = async () => {
        try {
            setLoading(true);
            
            // Load seller orders
            const ordersRes = await fetch(`/api/orders/seller/${user.id}`);
            const ordersData = await ordersRes.json();
            if (ordersData.success) {
                setSellerOrders(ordersData.orders);
            }
            
            // Load sold items history
            const response = await fetch(`/api/shop/sell-history/${user.id}?type=${filter}`);
            const data = await response.json();
            if (data.success) {
                setSoldItems(data.items);
                setStats(data.stats);
            }
        } catch (err) {
            showError('Failed to load sell history');
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (orderId, newStatus, trackingNumber) => {
        try {
            const body = { status: newStatus };
            if (trackingNumber) body.tracking_number = trackingNumber;
            
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            
            const data = await response.json();
            if (data.success) {
                showSuccess('Order status updated');
                loadData();
            } else {
                showError(data.error || 'Failed to update order');
            }
        } catch (err) {
            showError('Failed to update order');
        }
    };
    
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#ffc107';
            case 'paid': return '#17a2b8';
            case 'shipped': return '#007bff';
            case 'delivered': return '#28a745';
            case 'cancelled': return '#dc3545';
            default: return '#ffffff';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'pending': return '⏳';
            case 'paid': return '💳';
            case 'shipped': return '📦';
            case 'delivered': return '✅';
            case 'cancelled': return '❌';
            default: return '📋';
        }
    };
    
    if (!user) {
        return (
            <div className="section">
                <div className="section-header">
                    <h2>📜 Sell History</h2>
                    <p>Please sign in to view your sell history</p>
                </div>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    const activeOrders = sellerOrders.filter(o => !['delivered', 'cancelled'].includes(o.status));
    const completedOrders = sellerOrders.filter(o => ['delivered', 'cancelled'].includes(o.status));
    const totalRevenue = sellerOrders
        .filter(o => o.status !== 'cancelled')
        .reduce((sum, o) => sum + parseFloat(o.seller_receives || 0), 0);
    
    return (
        <div className="section">
            <div className="section-header">
                <h2>📜 Sell History</h2>
                <p>Manage your orders and view sales</p>
            </div>
            
            {/* Stats */}
            <div className="collection-stats" style={{ justifyContent: 'center' }}>
                <div className="stat-item">
                    <span className="stat-value">{activeOrders.length}</span>
                    <span className="stat-label">Active Orders</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value">{sellerOrders.length}</span>
                    <span className="stat-label">Total Orders</span>
                </div>
                <div className="stat-item stat-value-highlight">
                    <span className="stat-value" style={{ color: '#28a745' }}>${totalRevenue.toFixed(2)}</span>
                    <span className="stat-label">Total Revenue</span>
                </div>
            </div>

            {/* Tabs */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                gap: '0.5rem', 
                flexWrap: 'wrap',
                marginBottom: '1.5rem'
            }}>
                <button
                    className={`btn ${activeTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('orders')}
                >
                    📋 Orders {activeOrders.length > 0 && `(${activeOrders.length})`}
                </button>
                <button
                    className={`btn ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('history')}
                >
                    📜 Item History
                </button>
            </div>
            
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="pokeball-spinner"></div>
                    <p>Loading...</p>
                </div>
            ) : activeTab === 'orders' ? (
                /* ===== ORDERS TAB ===== */
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
                    {/* Active Orders */}
                    {activeOrders.length > 0 && (
                        <div style={{ marginBottom: '2rem' }}>
                            <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)', marginBottom: '1rem' }}>
                                🔔 Needs Action
                            </h3>
                            {activeOrders.map(order => (
                                <div key={order.id} style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    borderRadius: '12px',
                                    marginBottom: '1rem',
                                    border: '1px solid rgba(255,203,5,0.2)',
                                    overflow: 'hidden'
                                }}>
                                    <div 
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: '1rem 1.5rem',
                                            background: 'rgba(0,0,0,0.2)',
                                            cursor: 'pointer'
                                        }}
                                        onClick={() => setExpandedOrder(expandedOrder === order.id ? null : order.id)}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <span style={{ 
                                                fontSize: '1.5rem', padding: '0.5rem',
                                                background: 'rgba(255,255,255,0.1)', borderRadius: '8px'
                                            }}>
                                                {getStatusIcon(order.status)}
                                            </span>
                                            <div>
                                                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{order.order_number}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                                                    Buyer: {order.buyer_name} · {formatDate(order.created_at)}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{ 
                                                padding: '0.25rem 0.75rem', borderRadius: '20px',
                                                background: getStatusColor(order.status),
                                                color: order.status === 'pending' ? '#000' : '#fff',
                                                fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase'
                                            }}>
                                                {order.status}
                                            </div>
                                            <div style={{ fontWeight: 'bold', color: '#28a745', minWidth: '70px', textAlign: 'right' }}>
                                                ${parseFloat(order.seller_receives).toFixed(2)}
                                            </div>
                                            <span style={{ 
                                                transform: expandedOrder === order.id ? 'rotate(180deg)' : 'rotate(0)',
                                                transition: 'transform 0.2s'
                                            }}>▼</span>
                                        </div>
                                    </div>
                                    
                                    {expandedOrder === order.id && (
                                        <div style={{ padding: '1.5rem' }}>
                                            {/* Items */}
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <h4 style={{ marginBottom: '0.75rem', color: 'var(--poke-yellow)' }}>Items</h4>
                                                {order.items.map(item => (
                                                    <div key={item.id} style={{
                                                        display: 'flex', alignItems: 'center', gap: '1rem',
                                                        padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)'
                                                    }}>
                                                        <div style={{
                                                            width: '40px', height: '40px', borderRadius: '6px',
                                                            background: 'linear-gradient(135deg, var(--poke-blue), var(--poke-dark-blue))',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                        }}>
                                                            {item.item_image ? (
                                                                <img src={item.item_image} alt="" style={{ maxWidth: '90%', maxHeight: '90%' }} />
                                                            ) : (
                                                                <span>{item.item_type === 'product' ? '📦' : '🃏'}</span>
                                                            )}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: '500' }}>{item.item_name}</div>
                                                            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                                                Qty: {item.quantity} × ${parseFloat(item.unit_price).toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <div style={{ fontWeight: '600' }}>${parseFloat(item.total_price).toFixed(2)}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            
                                            {/* Ship To */}
                                            <div style={{ marginBottom: '1.5rem' }}>
                                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--poke-yellow)' }}>📍 Ship To</h4>
                                                <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                                    <div>{order.shipping_name}</div>
                                                    <div>{order.shipping_address}</div>
                                                    <div>{order.shipping_city}, {order.shipping_state} {order.shipping_zip}</div>
                                                    <div>{order.shipping_country}</div>
                                                </div>
                                            </div>
                                            
                                            {/* Earnings Breakdown */}
                                            <div style={{ 
                                                background: 'rgba(0,0,0,0.2)', borderRadius: '8px', 
                                                padding: '1rem', marginBottom: '1.5rem'
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Subtotal</span>
                                                    <span>${parseFloat(order.subtotal).toFixed(2)}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                    <span style={{ color: 'rgba(255,255,255,0.6)' }}>Platform fee ({order.platform_fee_percent}%)</span>
                                                    <span style={{ color: '#dc3545' }}>-${parseFloat(order.platform_fee).toFixed(2)}</span>
                                                </div>
                                                <div style={{ 
                                                    display: 'flex', justifyContent: 'space-between', 
                                                    borderTop: '1px solid rgba(255,255,255,0.1)', 
                                                    paddingTop: '0.5rem', marginTop: '0.5rem', fontWeight: 'bold'
                                                }}>
                                                    <span>You receive</span>
                                                    <span style={{ color: '#28a745' }}>${parseFloat(order.seller_receives).toFixed(2)}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Action Buttons */}
                                            <div style={{ 
                                                display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center',
                                                paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)'
                                            }}>
                                                {(order.status === 'pending' || order.status === 'paid') && (
                                                    <button 
                                                        className="btn btn-primary"
                                                        onClick={() => {
                                                            const tracking = prompt('Enter tracking number (optional):');
                                                            handleUpdateStatus(order.id, 'shipped', tracking || null);
                                                        }}
                                                    >
                                                        📦 Mark as Shipped
                                                    </button>
                                                )}
                                                {order.status === 'shipped' && (
                                                    <div style={{
                                                        padding: '0.6rem 1.2rem', borderRadius: '8px',
                                                        background: 'rgba(0,123,255,0.1)',
                                                        border: '1px solid rgba(0,123,255,0.3)',
                                                        fontSize: '0.85rem', color: '#5b9bd5'
                                                    }}>
                                                        ⏳ Awaiting buyer confirmation of delivery
                                                    </div>
                                                )}
                                                {order.tracking_number && (
                                                    <div style={{ 
                                                        padding: '0.5rem 1rem', borderRadius: '8px',
                                                        background: 'rgba(255,255,255,0.05)',
                                                        fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)'
                                                    }}>
                                                        Tracking: <strong style={{ color: 'white' }}>{order.tracking_number}</strong>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {/* Completed/Cancelled Orders */}
                    {completedOrders.length > 0 && (
                        <div>
                            <h3 style={{ fontFamily: 'Bangers', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                                Completed Orders
                            </h3>
                            {completedOrders.map(order => (
                                <div key={order.id} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
                                    padding: '0.75rem 1rem', marginBottom: '0.5rem',
                                    opacity: order.status === 'cancelled' ? 0.5 : 0.8
                                }}>
                                    <div>
                                        <span style={{ fontWeight: '500' }}>{order.order_number}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginLeft: '1rem' }}>
                                            {order.buyer_name}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>
                                            {formatDate(order.created_at)}
                                        </span>
                                        <span style={{ 
                                            padding: '0.15rem 0.5rem', borderRadius: '12px',
                                            background: getStatusColor(order.status),
                                            color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase'
                                        }}>
                                            {order.status}
                                        </span>
                                        <span style={{ 
                                            fontWeight: 'bold', minWidth: '60px', textAlign: 'right',
                                            color: order.status === 'cancelled' ? '#dc3545' : '#28a745',
                                            textDecoration: order.status === 'cancelled' ? 'line-through' : 'none'
                                        }}>
                                            ${parseFloat(order.seller_receives).toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {sellerOrders.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📋</div>
                            <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>No orders yet</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                                Orders from buyers will appear here
                            </p>
                            <button className="btn btn-primary" onClick={() => setCurrentPage('my-shop')}>
                                🏬 My Shop
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                /* ===== ITEM HISTORY TAB ===== */
                <div>
                    {/* Filter Tabs */}
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center',
                        gap: '0.5rem', 
                        flexWrap: 'wrap',
                        marginBottom: '1.5rem'
                    }}>
                        {[
                            { value: 'all', label: 'All' },
                            { value: 'products', label: '📦 Products' },
                            { value: 'cards', label: '🃏 Cards' }
                        ].map(f => (
                            <button
                                key={f.value}
                                className={`btn ${filter === f.value ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setFilter(f.value)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    
                    {soldItems.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📜</div>
                            <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>No sales yet</h3>
                            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                                Your sold items will appear here
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
                    ) : (
                        <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 100px 120px 150px',
                                gap: '1rem',
                                padding: '0.75rem 1rem',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '8px 8px 0 0',
                                fontWeight: 'bold',
                                fontSize: '0.85rem',
                                color: 'rgba(255,255,255,0.8)'
                            }}>
                                <span>Item</span>
                                <span style={{ textAlign: 'center' }}>Type</span>
                                <span style={{ textAlign: 'right' }}>Price</span>
                                <span style={{ textAlign: 'right' }}>Sold Date</span>
                            </div>
                            
                            {soldItems.map((item, index) => (
                                <div 
                                    key={`${item.type}-${item.id}`}
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr 100px 120px 150px',
                                        gap: '1rem',
                                        padding: '1rem',
                                        background: index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                                        alignItems: 'center'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                        {item.type === 'card' && item.image ? (
                                            <img src={item.image} alt={item.name}
                                                style={{ width: '40px', height: '56px', objectFit: 'contain', borderRadius: '4px' }}
                                            />
                                        ) : (
                                            <span style={{ fontSize: '2rem' }}>
                                                {item.type === 'product' ? (
                                                    item.product_type === 'etb' ? '🎴' :
                                                    item.product_type === 'booster_box' ? '📦' :
                                                    item.product_type === 'single_pack' ? '🃏' :
                                                    item.product_type === 'collection_box' ? '🎁' :
                                                    item.product_type === 'tin' ? '🥫' :
                                                    item.product_type === 'blister' ? '💳' : '📋'
                                                ) : '🃏'}
                                            </span>
                                        )}
                                        <div>
                                            <div style={{ fontWeight: '500' }}>{item.name}</div>
                                            {item.set_name && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--poke-yellow)' }}>{item.set_name}</div>
                                            )}
                                            {item.quantity > 1 && (
                                                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Qty: {item.quantity}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <span style={{
                                            background: item.type === 'product' ? 'var(--poke-blue)' : 'var(--poke-red)',
                                            color: 'white', padding: '0.25rem 0.5rem', borderRadius: '4px',
                                            fontSize: '0.7rem', fontWeight: 'bold', textTransform: 'uppercase'
                                        }}>{item.type}</span>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className="card-price" style={{ fontSize: '1.1rem' }}>
                                            ${parseFloat(item.price).toFixed(2)}
                                        </span>
                                    </div>
                                    <div style={{ textAlign: 'right', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>
                                        {formatDate(item.sold_date)}
                                    </div>
                                </div>
                            ))}
                            
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 100px 120px 150px',
                                gap: '1rem',
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.1)',
                                borderRadius: '0 0 8px 8px',
                                fontWeight: 'bold'
                            }}>
                                <span>Total ({soldItems.length} items)</span>
                                <span></span>
                                <span style={{ textAlign: 'right', color: '#28a745', fontSize: '1.1rem' }}>
                                    ${stats.totalValue?.toFixed(2) || '0.00'}
                                </span>
                                <span></span>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

window.SellHistoryPage = SellHistoryPage;
