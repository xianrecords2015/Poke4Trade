/* ===================================
   Cart Page - Shopping Cart
   =================================== */

const CartPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { items, loading, cartData, removeItem, updateQuantity, clearCart, loadCart } = useCart();
    const { success, error: showError } = useToast();
    
    const productIcons = {
        etb: '🎴',
        booster_box: '📦',
        single_pack: '🃏',
        collection_box: '🎁',
        tin: '🥫',
        blister: '💳',
        other: '📋'
    };
    
    React.useEffect(() => {
        if (user?.id) {
            loadCart();
        }
    }, [user?.id]);
    
    const handleRemove = async (cartId, itemName) => {
        const result = await removeItem(cartId);
        if (result.success) {
            success(`${itemName} removed from cart`);
        } else {
            showError(result.error);
        }
    };
    
    const handleQuantityChange = async (cartId, newQuantity) => {
        if (newQuantity < 1) return;
        await updateQuantity(cartId, newQuantity);
    };
    
    const handleClearCart = async () => {
        if (!confirm('Are you sure you want to clear your cart?')) return;
        const result = await clearCart();
        if (result.success) {
            success('Cart cleared');
        }
    };
    
    if (!user) {
        return (
            <div className="section">
                <div className="section-header">
                    <h2>🛒 Shopping Cart</h2>
                    <p>Please sign in to view your cart</p>
                </div>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
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
                <h2>🛒 Shopping Cart</h2>
                <p>Review your items before checkout</p>
            </div>
            
            {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="pokeball-spinner"></div>
                    <p>Loading cart...</p>
                </div>
            ) : items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🛒</div>
                    <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>Your cart is empty</h3>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                        Browse the shop to find products and cards
                    </p>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('shop')}>
                        🏬 Go to Shop
                    </button>
                </div>
            ) : (
                <div style={{ maxWidth: '900px', margin: '0 auto', padding: '0 1rem' }}>
                    {/* Cart Items */}
                    <div style={{ marginBottom: '2rem' }}>
                        {items.map(item => (
                            <div key={item.id} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '1rem',
                                padding: '1rem',
                                background: 'rgba(255,255,255,0.05)',
                                borderRadius: '12px',
                                marginBottom: '0.75rem',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                {/* Image */}
                                <div style={{
                                    width: '80px',
                                    height: '80px',
                                    borderRadius: '8px',
                                    background: 'linear-gradient(135deg, var(--poke-blue), var(--poke-dark-blue))',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0
                                }}>
                                    {item.image ? (
                                        <img 
                                            src={item.image} 
                                            alt={item.item_name}
                                            style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain', borderRadius: '4px' }}
                                        />
                                    ) : (
                                        <span style={{ fontSize: '2rem' }}>
                                            {item.item_type === 'product' ? (productIcons[item.product_type] || '📦') : '🃏'}
                                        </span>
                                    )}
                                </div>
                                
                                {/* Info */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{ marginBottom: '0.25rem', fontSize: '1rem' }}>{item.item_name}</h4>
                                    <p style={{ color: 'var(--poke-yellow)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                        {item.set_name}
                                    </p>
                                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                                        Seller: {item.seller_name} • {item.condition_grade}
                                    </p>
                                </div>
                                
                                {/* Quantity */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                        disabled={item.quantity <= 1}
                                    >
                                        −
                                    </button>
                                    <span style={{ minWidth: '30px', textAlign: 'center' }}>{item.quantity}</span>
                                    <button
                                        className="btn btn-secondary"
                                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.9rem' }}
                                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                        disabled={item.quantity >= item.available_quantity}
                                    >
                                        +
                                    </button>
                                </div>
                                
                                {/* Price */}
                                <div style={{ textAlign: 'right', minWidth: '80px' }}>
                                    <div className="card-price" style={{ fontSize: '1.1rem' }}>
                                        ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                                    </div>
                                    {item.quantity > 1 && (
                                        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                                            ${parseFloat(item.price).toFixed(2)} each
                                        </div>
                                    )}
                                </div>
                                
                                {/* Remove */}
                                <button
                                    className="btn btn-secondary"
                                    style={{ padding: '0.5rem', color: '#dc3545' }}
                                    onClick={() => handleRemove(item.id, item.item_name)}
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                    
                    {/* Clear Cart */}
                    <div style={{ textAlign: 'right', marginBottom: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={handleClearCart}>
                            🗑️ Clear Cart
                        </button>
                    </div>
                    
                    {/* Summary */}
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>
                            Order Summary
                        </h3>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Items Subtotal</span>
                            <span>${cartData.subtotal.toFixed(2)}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.6)' }}>
                            <span>Shipping</span>
                            <span>Calculated at checkout</span>
                        </div>
                        
                        
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            paddingTop: '1rem',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            fontWeight: 'bold',
                            fontSize: '1.2rem'
                        }}>
                            <span>Total</span>
                            <span style={{ color: 'var(--poke-yellow)' }}>${cartData.total.toFixed(2)}</span>
                        </div>
                        
                        <button 
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', fontSize: '1.1rem' }}
                            onClick={() => setCurrentPage('checkout')}
                        >
                            Proceed to Checkout →
                        </button>
                    </div>
                    
                    {/* Continue Shopping */}
                    <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
                        <button className="btn btn-secondary" onClick={() => setCurrentPage('shop')}>
                            ← Continue Shopping
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

window.CartPage = CartPage;
