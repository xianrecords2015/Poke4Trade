/* ===================================
   My Shop Page - Manage Products for Sale
   =================================== */

const MyShopPage = ({ setCurrentPage }) => {
    const { user } = React.useContext(AuthContext);
    const { success, error: showError } = React.useContext(ToastContext);
    
    const [products, setProducts] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [showAddModal, setShowAddModal] = React.useState(false);
    const [editingProduct, setEditingProduct] = React.useState(null);
    const [filter, setFilter] = React.useState('all');
    
    // Product types
    const productTypes = [
        { value: 'etb', label: 'Elite Trainer Box (ETB)', icon: '🎴' },
        { value: 'booster_box', label: 'Booster Box', icon: '📦' },
        { value: 'single_pack', label: 'Single Pack', icon: '🃏' },
        { value: 'collection_box', label: 'Collection Box', icon: '🎁' },
        { value: 'tin', label: 'Tin', icon: '🥫' },
        { value: 'blister', label: 'Blister Pack', icon: '💳' },
        { value: 'other', label: 'Other', icon: '📋' }
    ];
    
    const conditions = ['Sealed', 'Opened-Complete', 'Opened-Incomplete', 'Damaged'];
    const languages = ['English', 'Japanese', 'Korean', 'Chinese', 'French', 'German', 'Spanish', 'Italian', 'Portuguese'];
    
    // Load products
    React.useEffect(() => {
        if (user?.id) {
            loadProducts();
        }
    }, [user, filter]);
    
    const loadProducts = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/shop/products/${user.id}?status=${filter}`);
            const data = await response.json();
            if (data.success) {
                setProducts(data.products);
            }
        } catch (err) {
            showError('Failed to load products');
        } finally {
            setLoading(false);
        }
    };
    
    const handleDelete = async (productId) => {
        if (!confirm('Are you sure you want to delete this product?')) return;
        
        try {
            const response = await fetch(`/api/shop/products/${user.id}/${productId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            if (data.success) {
                success('Product deleted');
                loadProducts();
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError('Failed to delete product');
        }
    };
    
    const handleStatusChange = async (product, newStatus) => {
        try {
            const response = await fetch(`/api/shop/products/${user.id}/${product.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...product, status: newStatus })
            });
            const data = await response.json();
            if (data.success) {
                success(`Product marked as ${newStatus}`);
                loadProducts();
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError('Failed to update status');
        }
    };
    
    const getProductIcon = (type) => {
        const pt = productTypes.find(p => p.value === type);
        return pt ? pt.icon : '📋';
    };
    
    const getProductLabel = (type) => {
        const pt = productTypes.find(p => p.value === type);
        return pt ? pt.label : type;
    };
    
    const getStatusBadge = (status) => {
        const styles = {
            active: { bg: '#28a745', text: 'Active' },
            sold: { bg: '#dc3545', text: 'Sold' },
            reserved: { bg: '#ffc107', text: 'Reserved' },
            inactive: { bg: '#6c757d', text: 'Inactive' }
        };
        const s = styles[status] || styles.inactive;
        return (
            <span style={{
                background: s.bg,
                color: status === 'reserved' ? '#000' : '#fff',
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                fontSize: '0.75rem',
                fontWeight: 'bold'
            }}>
                {s.text}
            </span>
        );
    };
    
    // Calculate stats
    const stats = React.useMemo(() => {
        const active = products.filter(p => p.status === 'active');
        const sold = products.filter(p => p.status === 'sold');
        const totalValue = active.reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0);
        const soldValue = sold.reduce((sum, p) => sum + parseFloat(p.price) * p.quantity, 0);
        return {
            total: products.length,
            active: active.length,
            sold: sold.length,
            totalValue,
            soldValue
        };
    }, [products]);
    
    if (!user) {
        return (
            <div className="section">
                <div className="section-header">
                    <h2>🏬 My Shop</h2>
                    <p>Please sign in to manage your shop</p>
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
            {/* Centered Page Header - matching Collection style */}
            <div className="section-header">
                <h2>🏬 My Shop</h2>
                <p>Manage your Pokemon products for sale</p>
            </div>
            
            {/* Stats Row - using same CSS classes as Collection */}
            <div className="collection-stats" style={{ justifyContent: "center" }}>
                <div className="stat-item">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">Products</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value" style={{ color: '#28a745' }}>{stats.active}</span>
                    <span className="stat-label">Active</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value" style={{ color: '#dc3545' }}>{stats.sold}</span>
                    <span className="stat-label">Sold</span>
                </div>
                <div className="stat-item stat-value-highlight">
                    <span className="stat-value">${stats.totalValue.toFixed(2)}</span>
                    <span className="stat-label">Listed Value</span>
                </div>
                <div className="stat-item">
                    <span className="stat-value" style={{ color: '#28a745' }}>${stats.soldValue.toFixed(2)}</span>
                    <span className="stat-label">Sold Value</span>
                </div>
            </div>
            
            {/* Add Product Button - centered like Collection */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <button 
                    className="btn btn-primary"
                    onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
                >
                    ➕ Add Product
                </button>
            </div>
            
            {/* Filter Tabs */}
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center',
                gap: '0.5rem', 
                flexWrap: 'wrap',
                marginBottom: '1.5rem'
            }}>
                {['all', 'active', 'sold', 'reserved', 'inactive'].map(f => (
                    <button
                        key={f}
                        className={`btn ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter(f)}
                        style={{ textTransform: 'capitalize' }}
                    >
                        {f}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            {loading ? (
                <div className="loading-container" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="pokeball-spinner"></div>
                    <p>Loading products...</p>
                </div>
            ) : products.length === 0 ? (
                <div className="empty-state" style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🏬</div>
                    <h3 style={{ fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>No products yet</h3>
                    <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>
                        Start selling by adding your first product
                    </p>
                    <button 
                        className="btn btn-primary"
                        onClick={() => { setEditingProduct(null); setShowAddModal(true); }}
                    >
                        ➕ Add Your First Product
                    </button>
                </div>
            ) : (
                <div className="products-grid" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '1rem',
                    maxWidth: '1200px',
                    margin: '0 auto',
                    padding: '0 1rem'
                }}>
                    {products.map(product => (
                        <div key={product.id} className="product-card" style={{
                            background: 'rgba(255,255,255,0.05)',
                            borderRadius: '12px',
                            padding: '1.25rem',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ fontSize: '1.5rem' }}>{getProductIcon(product.product_type)}</span>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)' }}>
                                        {getProductLabel(product.product_type)}
                                    </span>
                                </div>
                                {getStatusBadge(product.status)}
                            </div>
                            
                            <h3 style={{ marginBottom: '0.5rem', fontSize: '1.1rem' }}>{product.name}</h3>
                            
                            {product.set_name && (
                                <p style={{ color: 'var(--poke-yellow)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                                    {product.set_name}
                                </p>
                            )}
                            
                            <div style={{ 
                                display: 'flex', 
                                gap: '0.5rem', 
                                flexWrap: 'wrap',
                                marginBottom: '0.75rem',
                                fontSize: '0.8rem'
                            }}>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                    {product.condition_grade}
                                </span>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                    {product.language}
                                </span>
                                <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                                    Qty: {product.quantity}
                                </span>
                            </div>
                            
                            {product.description && (
                                <p style={{ 
                                    color: 'rgba(255,255,255,0.6)', 
                                    fontSize: '0.85rem',
                                    marginBottom: '0.75rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical'
                                }}>
                                    {product.description}
                                </p>
                            )}
                            
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                marginTop: 'auto',
                                paddingTop: '0.75rem',
                                borderTop: '1px solid rgba(255,255,255,0.1)'
                            }}>
                                <span className="card-price" style={{ fontSize: '1.25rem' }}>
                                    ${parseFloat(product.price).toFixed(2)}
                                </span>
                                
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    {product.status === 'active' && (
                                        <button 
                                            className="btn btn-secondary"
                                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                            onClick={() => handleStatusChange(product, 'sold')}
                                            title="Mark as Sold"
                                        >
                                            ✓ Sold
                                        </button>
                                    )}
                                    {product.status === 'sold' && (
                                        <button 
                                            className="btn btn-secondary"
                                            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                            onClick={() => handleStatusChange(product, 'active')}
                                            title="Relist"
                                        >
                                            ↩ Relist
                                        </button>
                                    )}
                                    <button 
                                        className="btn btn-secondary"
                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                                        onClick={() => { setEditingProduct(product); setShowAddModal(true); }}
                                        title="Edit"
                                    >
                                        ✏️
                                    </button>
                                    <button 
                                        className="btn btn-secondary"
                                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: '#dc3545' }}
                                        onClick={() => handleDelete(product.id)}
                                        title="Delete"
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            {/* Add/Edit Product Modal */}
            {showAddModal && (
                <ProductModal
                    product={editingProduct}
                    productTypes={productTypes}
                    conditions={conditions}
                    languages={languages}
                    userId={user.id}
                    onClose={() => { setShowAddModal(false); setEditingProduct(null); }}
                    onSave={() => { setShowAddModal(false); setEditingProduct(null); loadProducts(); success(editingProduct ? 'Product updated!' : 'Product added!'); }}
                    showError={showError}
                />
            )}
        </div>
    );
};

// Product Add/Edit Modal
const ProductModal = ({ product, productTypes, conditions, languages, userId, onClose, onSave, showError }) => {
    const [form, setForm] = React.useState({
        product_type: product?.product_type || 'etb',
        name: product?.name || '',
        set_name: product?.set_name || '',
        description: product?.description || '',
        price: product?.price || '',
        quantity: product?.quantity || 1,
        condition_grade: product?.condition_grade || 'Sealed',
        language: product?.language || 'English',
        status: product?.status || 'active'
    });
    const [saving, setSaving] = React.useState(false);
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!form.name.trim()) {
            showError('Product name is required');
            return;
        }
        if (!form.price || parseFloat(form.price) <= 0) {
            showError('Valid price is required');
            return;
        }
        
        setSaving(true);
        try {
            const url = product 
                ? `/api/shop/products/${userId}/${product.id}`
                : `/api/shop/products/${userId}`;
            
            const response = await fetch(url, {
                method: product ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...form,
                    price: parseFloat(form.price),
                    quantity: parseInt(form.quantity) || 1
                })
            });
            
            const data = await response.json();
            if (data.success) {
                onSave();
            } else {
                showError(data.error);
            }
        } catch (err) {
            showError('Failed to save product');
        } finally {
            setSaving(false);
        }
    };
    
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                <div className="modal-header">
                    <h2>{product ? '✏️ Edit Product' : '➕ Add Product'}</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                
                <form onSubmit={handleSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="form-group">
                        <label>Product Type *</label>
                        <select
                            value={form.product_type}
                            onChange={e => setForm({ ...form, product_type: e.target.value })}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                        >
                            {productTypes.map(pt => (
                                <option key={pt.value} value={pt.value}>
                                    {pt.icon} {pt.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    <div className="form-group">
                        <label>Product Name *</label>
                        <input
                            type="text"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            placeholder="e.g., Surging Sparks Elite Trainer Box"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Set/Series Name</label>
                        <input
                            type="text"
                            value={form.set_name}
                            onChange={e => setForm({ ...form, set_name: e.target.value })}
                            placeholder="e.g., Scarlet & Violet - Surging Sparks"
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                        />
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Price ($) *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={form.price}
                                onChange={e => setForm({ ...form, price: e.target.value })}
                                placeholder="0.00"
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                            />
                        </div>
                        
                        <div className="form-group">
                            <label>Quantity</label>
                            <input
                                type="number"
                                min="1"
                                value={form.quantity}
                                onChange={e => setForm({ ...form, quantity: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                            />
                        </div>
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label>Condition</label>
                            <select
                                value={form.condition_grade}
                                onChange={e => setForm({ ...form, condition_grade: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                            >
                                {conditions.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        
                        <div className="form-group">
                            <label>Language</label>
                            <select
                                value={form.language}
                                onChange={e => setForm({ ...form, language: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                            >
                                {languages.map(l => (
                                    <option key={l} value={l}>{l}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="form-group">
                        <label>Description</label>
                        <textarea
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            placeholder="Any additional details about the product..."
                            rows={3}
                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', resize: 'vertical' }}
                        />
                    </div>
                    
                    {product && (
                        <div className="form-group">
                            <label>Status</label>
                            <select
                                value={form.status}
                                onChange={e => setForm({ ...form, status: e.target.value })}
                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                            >
                                <option value="active">Active</option>
                                <option value="sold">Sold</option>
                                <option value="reserved">Reserved</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1 }}>
                            {saving ? 'Saving...' : (product ? 'Save Changes' : 'Add Product')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

window.MyShopPage = MyShopPage;
