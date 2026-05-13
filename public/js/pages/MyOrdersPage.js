/* ===================================
   Purchase History Page - View Purchases with Cancel
   =================================== */

const MyOrdersPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { success, error: showError } = useToast();
    
    const [purchases, setPurchases] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedOrder, setExpandedOrder] = React.useState(null);
    const [cancellingId, setCancellingId] = React.useState(null);
    const [confirmCancel, setConfirmCancel] = React.useState(null);
    
    React.useEffect(() => {
        if (user?.id) {
            loadOrders();
        }
    }, [user?.id]);
    
    const loadOrders = async () => {
        setLoading(true);
        try {
            const purchasesRes = await fetch(`/api/orders/buyer/${user.id}`);
            const purchasesData = await purchasesRes.json();
            if (purchasesData.success) {
                setPurchases(purchasesData.orders);
            }
        } catch (err) {
            console.error('Error loading orders:', err);
            showError('Failed to load orders');
        } finally {
            setLoading(false);
        }
    };
    
    const handleCancelOrder = async (orderId) => {
        setCancellingId(orderId);
        try {
            const response = await fetch(`/api/orders/${orderId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: user.id })
            });
            const data = await response.json();
            
            if (data.success) {
                success('Order cancelled and refund processed');
                loadOrders();
            } else {
                showError(data.error || 'Failed to cancel order');
            }
        } catch (err) {
            showError('Failed to cancel order');
        } finally {
            setCancellingId(null);
            setConfirmCancel(null);
        }
    };

    const [confirmingReceived, setConfirmingReceived] = React.useState(null);
    
    const handleConfirmReceived = async (orderId) => {
        try {
            const response = await fetch(`/api/orders/${orderId}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'delivered' })
            });
            const data = await response.json();
            
            if (data.success) {
                success('Order confirmed as received!');
                loadOrders();
            } else {
                showError(data.error || 'Failed to confirm delivery');
            }
        } catch (err) {
            showError('Failed to confirm delivery');
        } finally {
            setConfirmingReceived(null);
        }
    };

    const canCancel = (status) => {
        return ['pending', 'paid'].includes(status);
    };
    
    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#ffc107';
            case 'paid': return '#17a2b8';
            case 'shipped': return '#007bff';
            case 'delivered': return '#28a745';
            case 'cancelled': return '#dc3545';
            case 'refunded': return '#6c757d';
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
            case 'refunded': return '↩️';
            default: return '📋';
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
    
    if (!user) {
        return (
            <div className="section">
                <div className="section-header">
                    <h2>🛒 Purchase History</h2>
                    <p>Please sign in to view your purchases</p>
                </div>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }
    
    const activePurchases = purchases.filter(o => !['cancelled', 'refunded'].includes(o.status));
    const totalSpent = activePurchases.reduce((sum, o) => sum + parseFloat(o.total || 0), 0);
    const totalItems = activePurchases.reduce((sum, o) => sum + (o.items ? o.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0), 0);
    
    return (
        <div className="section">
            <div className="section-header">
                <h2>🛒 Purchase History</h2>
                <p>View your purchased products and cards</p>
            </div>
            
            {/* Stats */}
            <div className="collection-stats" style={{ justifyContent: 'center' }}>
                <div className="stat-item">
                    <span className="stat-value">{purchases.length}</span>
                    <span className="stat-label">Orders</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value">{totalItems}</span>
                    <span className="stat-label">Items Bought</span>
                </div>
                <div className="stat-item stat-value-highlight">
                    <span className="stat-value" style={{ color: 'var(--poke-yellow)' }}>${totalSpent.toFixed(2)}</span>
                    <span className="stat-label">Total Spent</span>
                </div>
            </div>
            
            {/* Cancel Confirmation Modal */}
            {confirmCancel && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', zIndex: 1000
                }} onClick={() => setConfirmCancel(null)}>
                    <div style={{
                        background: 'var(--poke-dark-blue)', borderRadius: '16px', padding: '2rem',
                        maxWidth: '450px', width: '90%', border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 20px 60px rgba(0,0,0,0.5)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                            <span style={{ fontSize: '3rem' }}>⚠️</span>
                            <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)', marginTop: '0.5rem' }}>
                                Cancel Order?
                            </h3>
                        </div>
                        <p style={{ textAlign: 'center', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.8)' }}>
                            Are you sure you want to cancel order <strong>{confirmCancel.order_number}</strong>?
                        </p>
                        <p style={{ textAlign: 'center', marginBottom: '1.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                            Your payment of <strong style={{ color: 'var(--poke-yellow)' }}>${parseFloat(confirmCancel.total).toFixed(2)}</strong> will be refunded to your original payment method.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <button
                                className="btn btn-secondary"
                                style={{ flex: 1 }}
                                onClick={() => setConfirmCancel(null)}
                            >
                                Keep Order
                            </button>
                            <button
                                className="btn"
                                style={{ 
                                    flex: 1, background: '#dc3545', color: 'white', border: 'none',
                                    padding: '0.75rem', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
                                }}
                                onClick={() => handleCancelOrder(confirmCancel.id)}
                                disabled={cancellingId === confirmCancel.id}
                            >
                                {cancellingId === confirmCancel.id ? 'Cancelling...' : '❌ Cancel & Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="pokeball-spinner"></div>
                    <p>Loading purchases...</p>
                </div>
            ) : purchases.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
                    <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>
                        No purchases yet
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                        Browse the shop to find items to purchase
                    </p>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('shop')}>
                        🏬 Go to Shop
                    </button>
                </div>
            ) : (
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
                    {purchases.map(order => (
                        <div key={order.id} style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            border: order.status === 'cancelled' 
                                ? '1px solid rgba(220,53,69,0.3)' 
                                : '1px solid rgba(255,255,255,0.1)',
                            overflow: 'hidden',
                            opacity: order.status === 'cancelled' ? 0.7 : 1
                        }}>
                            {/* Order Header */}
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
                                        fontSize: '1.5rem',
                                        padding: '0.5rem',
                                        background: 'rgba(255,255,255,0.1)',
                                        borderRadius: '8px'
                                    }}>
                                        {getStatusIcon(order.status)}
                                    </span>
                                    <div>
                                        <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                            {order.order_number}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                                            {formatDate(order.created_at)}
                                        </div>
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                                            Seller
                                        </div>
                                        <div style={{ fontWeight: '500' }}>
                                            {order.seller_name}
                                        </div>
                                    </div>
                                    
                                    <div style={{ 
                                        padding: '0.25rem 0.75rem',
                                        borderRadius: '20px',
                                        background: getStatusColor(order.status),
                                        color: order.status === 'pending' ? '#000' : '#fff',
                                        fontSize: '0.8rem',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase'
                                    }}>
                                        {order.status}
                                    </div>
                                    
                                    <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                        <div style={{ 
                                            fontWeight: 'bold', 
                                            fontSize: '1.1rem',
                                            color: order.status === 'cancelled' ? '#dc3545' : 'var(--poke-yellow)',
                                            textDecoration: order.status === 'cancelled' ? 'line-through' : 'none'
                                        }}>
                                            ${parseFloat(order.total).toFixed(2)}
                                        </div>
                                    </div>
                                    
                                    <span style={{ 
                                        transform: expandedOrder === order.id ? 'rotate(180deg)' : 'rotate(0)',
                                        transition: 'transform 0.2s'
                                    }}>
                                        ▼
                                    </span>
                                </div>
                            </div>
                            
                            {/* Expanded Details */}
                            {expandedOrder === order.id && (
                                <div style={{ padding: '1.5rem' }}>
                                    {/* Items */}
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ marginBottom: '0.75rem', color: 'var(--poke-yellow)' }}>Items</h4>
                                        {order.items.map(item => (
                                            <div key={item.id} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '1rem',
                                                padding: '0.5rem 0',
                                                borderBottom: '1px solid rgba(255,255,255,0.05)'
                                            }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '6px',
                                                    background: 'linear-gradient(135deg, var(--poke-blue), var(--poke-dark-blue))',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
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
                                                <div style={{ fontWeight: '600' }}>
                                                    ${parseFloat(item.total_price).toFixed(2)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/* Shipping & Tracking */}
                                    <div style={{ 
                                        display: 'grid', 
                                        gridTemplateColumns: '1fr 1fr',
                                        gap: '1.5rem'
                                    }}>
                                        <div>
                                            <h4 style={{ marginBottom: '0.5rem', color: 'var(--poke-yellow)' }}>
                                                📍 Shipping Address
                                            </h4>
                                            <div style={{ fontSize: '0.9rem', lineHeight: '1.5' }}>
                                                <div>{order.shipping_name}</div>
                                                <div>{order.shipping_address}</div>
                                                <div>{order.shipping_city}, {order.shipping_state} {order.shipping_zip}</div>
                                                <div>{order.shipping_country}</div>
                                            </div>
                                        </div>
                                        
                                        {order.tracking_number && (
                                            <div>
                                                <h4 style={{ marginBottom: '0.5rem', color: 'var(--poke-yellow)' }}>
                                                    📦 Tracking
                                                </h4>
                                                <div style={{ fontSize: '0.9rem' }}>
                                                    {order.tracking_number}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div style={{ 
                                        marginTop: '1.5rem',
                                        paddingTop: '1.5rem',
                                        borderTop: '1px solid rgba(255,255,255,0.1)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '1rem'
                                    }}>
                                        {/* Shipped - Confirm Received */}
                                        {order.status === 'shipped' && (
                                            <React.Fragment>
                                                <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)' }}>
                                                    📦 Shipped{order.shipped_at ? ` on ${formatDate(order.shipped_at)}` : ''}
                                                    {order.tracking_number && <span> · Tracking: <strong style={{ color: 'white' }}>{order.tracking_number}</strong></span>}
                                                </div>
                                                {confirmingReceived === order.id ? (
                                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                                        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>Did you receive this order?</span>
                                                        <button
                                                            style={{
                                                                background: '#28a745', color: 'white', border: 'none',
                                                                padding: '0.5rem 1rem', borderRadius: '8px',
                                                                cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem'
                                                            }}
                                                            onClick={(e) => { e.stopPropagation(); handleConfirmReceived(order.id); }}
                                                        >
                                                            ✅ Yes, Received
                                                        </button>
                                                        <button
                                                            className="btn btn-secondary"
                                                            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                                                            onClick={(e) => { e.stopPropagation(); setConfirmingReceived(null); }}
                                                        >
                                                            Not yet
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        style={{
                                                            background: 'rgba(40,167,69,0.15)', color: '#5cb85c',
                                                            border: '1px solid rgba(40,167,69,0.4)',
                                                            padding: '0.6rem 1.5rem', borderRadius: '8px',
                                                            cursor: 'pointer', fontWeight: '600', fontSize: '0.9rem'
                                                        }}
                                                        onClick={(e) => { e.stopPropagation(); setConfirmingReceived(order.id); }}
                                                    >
                                                        ✅ Confirm Received
                                                    </button>
                                                )}
                                            </React.Fragment>
                                        )}
                                        
                                        {/* Pending/Paid - Cancel */}
                                        {canCancel(order.status) && (
                                            <button
                                                style={{ 
                                                    background: 'rgba(220,53,69,0.15)',
                                                    color: '#ff6b6b',
                                                    border: '1px solid rgba(220,53,69,0.4)',
                                                    padding: '0.6rem 1.5rem',
                                                    borderRadius: '8px',
                                                    cursor: 'pointer',
                                                    fontWeight: '600',
                                                    fontSize: '0.9rem',
                                                    marginLeft: 'auto'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setConfirmCancel(order);
                                                }}
                                            >
                                                ❌ Cancel Order
                                            </button>
                                        )}
                                    </div>
                                    
                                    {/* Delivered info */}
                                    {order.status === 'delivered' && (
                                        <div style={{
                                            marginTop: '1.5rem',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            background: 'rgba(40,167,69,0.1)',
                                            border: '1px solid rgba(40,167,69,0.3)',
                                            textAlign: 'center',
                                            color: '#5cb85c',
                                            fontSize: '0.9rem'
                                        }}>
                                            ✅ Order received{order.delivered_at ? ` on ${formatDate(order.delivered_at)}` : ''}. Transaction complete.
                                        </div>
                                    )}
                                    
                                    {/* Cancelled info */}
                                    {order.status === 'cancelled' && (
                                        <div style={{
                                            marginTop: '1.5rem',
                                            padding: '1rem',
                                            borderRadius: '8px',
                                            background: 'rgba(220,53,69,0.1)',
                                            border: '1px solid rgba(220,53,69,0.3)',
                                            textAlign: 'center',
                                            color: '#ff6b6b',
                                            fontSize: '0.9rem'
                                        }}>
                                            This order was cancelled{order.cancelled_at ? ` on ${formatDate(order.cancelled_at)}` : ''}.
                                            Refund has been processed to your original payment method.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

window.MyOrdersPage = MyOrdersPage;
