/* ===================================
   Checkout Page - Complete Purchase with Payment
   =================================== */

const CheckoutPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { items, cartData, clearCart, loadCart } = useCart();
    const { success, error: showError } = useToast();
    
    const [loading, setLoading] = React.useState(false);
    const [shippingAddress, setShippingAddress] = React.useState({
        name: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        country: 'USA'
    });
    const [saveAddress, setSaveAddress] = React.useState(true);
    const [loadingAddress, setLoadingAddress] = React.useState(true);
    const [taxRate, setTaxRate] = React.useState(0);
    const [taxAmount, setTaxAmount] = React.useState(0);
    const [calculatingTax, setCalculatingTax] = React.useState(false);
    
    // Payment state
    const [paymentMethod, setPaymentMethod] = React.useState(null); // 'stripe' or 'paypal'
    const [paymentConfig, setPaymentConfig] = React.useState(null);
    const [stripeInstance, setStripeInstance] = React.useState(null);
    const [stripeElements, setStripeElements] = React.useState(null);
    const [cardElement, setCardElement] = React.useState(null);
    const [cardReady, setCardReady] = React.useState(false);
    const [paypalLoaded, setPaypalLoaded] = React.useState(false);
    
    const paypalContainerRef = React.useRef(null);
    const cardElementRef = React.useRef(null);

    // Load payment config on mount
    React.useEffect(() => {
        loadPaymentConfig();
    }, []);
    
    const loadPaymentConfig = async () => {
        try {
            const response = await fetch('/api/payments/config');
            const data = await response.json();
            if (data.success) {
                setPaymentConfig(data);
            }
        } catch (err) {
            console.error('Error loading payment config:', err);
        }
    };
    
    // Load user's saved address
    React.useEffect(() => {
        if (user?.id) {
            loadUserAddress();
        }
    }, [user?.id]);
    
    const loadUserAddress = async () => {
        try {
            setLoadingAddress(true);
            const response = await fetch(`/api/user/${user.id}/address`);
            const data = await response.json();
            
            if (data.success && data.address) {
                const addr = data.address;
                const fullName = addr.first_name ? (addr.first_name + ' ' + (addr.last_name || '')).trim() : '';
                
                if (addr.use_billing_as_shipping) {
                    setShippingAddress({
                        name: fullName || '',
                        address: addr.billing_address1 || '',
                        city: addr.billing_city || '',
                        state: addr.billing_state || '',
                        zip: addr.billing_postal_code || '',
                        country: addr.billing_country || 'US'
                    });
                } else {
                    setShippingAddress({
                        name: addr.shipping_name || fullName || '',
                        address: addr.shipping_address1 || addr.billing_address1 || '',
                        city: addr.shipping_city || addr.billing_city || '',
                        state: addr.shipping_state || addr.billing_state || '',
                        zip: addr.shipping_postal_code || addr.billing_postal_code || '',
                        country: addr.shipping_country || addr.billing_country || 'US'
                    });
                }
            }
        } catch (err) {
            console.error('Error loading address:', err);
        } finally {
            setLoadingAddress(false);
        }
    };
    
    // Calculate tax when address changes
    const calculateTax = async () => {
        if (!shippingAddress.state || !shippingAddress.zip || items.length === 0) {
            setTaxRate(0);
            setTaxAmount(0);
            return;
        }
        
        setCalculatingTax(true);
        try {
            const response = await fetch('/api/tax/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: items.map(item => ({
                        id: item.item_id,
                        price: item.price,
                        quantity: item.quantity
                    })),
                    shipping_address: shippingAddress
                })
            });
            const data = await response.json();
            
            if (data.success) {
                setTaxRate(data.taxRate);
                setTaxAmount(data.taxAmount);
            }
        } catch (err) {
            console.error('Tax calculation error:', err);
        } finally {
            setCalculatingTax(false);
        }
    };
    
    React.useEffect(() => {
        if (shippingAddress.state && shippingAddress.zip) {
            calculateTax();
        }
    }, [shippingAddress.state, shippingAddress.zip, items]);

    // Initialize Stripe when selected
    React.useEffect(() => {
        if (paymentMethod === 'stripe' && paymentConfig?.stripePublishableKey && window.Stripe) {
            const stripe = window.Stripe(paymentConfig.stripePublishableKey);
            setStripeInstance(stripe);
            const elements = stripe.elements();
            setStripeElements(elements);
        }
    }, [paymentMethod, paymentConfig]);

    // Mount Stripe card element
    React.useEffect(() => {
        if (stripeElements && cardElementRef.current && !cardElement) {
            const card = stripeElements.create('card', {
                style: {
                    base: {
                        color: '#ffffff',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '16px',
                        '::placeholder': { color: 'rgba(255,255,255,0.4)' }
                    },
                    invalid: { color: '#ff6b6b' }
                }
            });
            card.mount(cardElementRef.current);
            card.on('ready', () => setCardReady(true));
            card.on('change', (event) => {
                if (event.error) {
                    setCardReady(false);
                } else if (event.complete) {
                    setCardReady(true);
                }
            });
            setCardElement(card);
        }
        
        return () => {
            if (cardElement) {
                cardElement.destroy();
                setCardElement(null);
                setCardReady(false);
            }
        };
    }, [stripeElements, paymentMethod]);

    // Load PayPal SDK when selected
    React.useEffect(() => {
        if (paymentMethod === 'paypal' && paymentConfig?.paypalClientId && !paypalLoaded) {
            if (window.paypal) {
                setPaypalLoaded(true);
                return;
            }
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${paymentConfig.paypalClientId}&currency=USD`;
            script.onload = () => setPaypalLoaded(true);
            script.onerror = () => showError('Failed to load PayPal');
            document.head.appendChild(script);
        }
    }, [paymentMethod, paymentConfig]);

    // Render PayPal buttons when SDK is loaded
    React.useEffect(() => {
        if (paymentMethod === 'paypal' && paypalLoaded && window.paypal && paypalContainerRef.current) {
            paypalContainerRef.current.innerHTML = '';
            
            window.paypal.Buttons({
                style: {
                    layout: 'vertical',
                    color: 'gold',
                    shape: 'rect',
                    label: 'pay',
                    height: 45
                },
                createOrder: async () => {
                    if (!validateAddress()) throw new Error('Invalid address');
                    
                    const response = await fetch('/api/payments/paypal/create-order', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            buyer_id: user.id,
                            tax_amount: taxAmount
                        })
                    });
                    const data = await response.json();
                    if (!data.success) throw new Error(data.error);
                    return data.orderId;
                },
                onApprove: async (data) => {
                    setLoading(true);
                    try {
                        const captureRes = await fetch('/api/payments/paypal/capture-order', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ paypal_order_id: data.orderID })
                        });
                        const captureData = await captureRes.json();
                        
                        if (captureData.success) {
                            await createOrder('paypal', data.orderID);
                        } else {
                            showError('PayPal payment failed');
                        }
                    } catch (err) {
                        showError('Payment error: ' + err.message);
                    } finally {
                        setLoading(false);
                    }
                },
                onError: (err) => {
                    console.error('PayPal error:', err);
                    showError('PayPal encountered an error');
                }
            }).render(paypalContainerRef.current);
        }
    }, [paypalLoaded, paymentMethod, items, taxAmount, shippingAddress]);

    const validateAddress = () => {
        if (!shippingAddress.name.trim()) { showError('Please enter recipient name'); return false; }
        if (!shippingAddress.address.trim()) { showError('Please enter street address'); return false; }
        if (!shippingAddress.city.trim()) { showError('Please enter city'); return false; }
        if (!shippingAddress.state.trim()) { showError('Please enter state'); return false; }
        if (!shippingAddress.zip.trim()) { showError('Please enter ZIP code'); return false; }
        return true;
    };

    const getOrderTotal = () => {
        let total = cartData.subtotal;
        if (cartData.subtotal < (cartData.minThreshold || 5)) {
            total += (cartData.minFee || 0.50);
        }
        total += taxAmount;
        return total;
    };

    // Create order after successful payment
    const createOrder = async (method, paymentId) => {
        try {
            if (saveAddress) {
                await fetch(`/api/user/${user.id}/address`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shipping_name: shippingAddress.name,
                        shipping_address: shippingAddress.address,
                        shipping_city: shippingAddress.city,
                        shipping_state: shippingAddress.state,
                        shipping_zip: shippingAddress.zip,
                        shipping_country: shippingAddress.country
                    })
                });
            }
            
            const response = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyer_id: user.id,
                    shipping_address: shippingAddress,
                    payment_method: method,
                    payment_id: paymentId
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                success('Payment successful! Order placed.');
                await loadCart();
                setCurrentPage('my-orders');
            } else {
                showError(data.error || 'Failed to create order');
            }
        } catch (err) {
            console.error('Order creation error:', err);
            showError('Payment was processed but order creation failed. Please contact support.');
        }
    };

    // Handle Stripe payment
    const handleStripePayment = async () => {
        if (!validateAddress()) return;
        if (!stripeInstance || !cardElement) {
            showError('Card form not ready');
            return;
        }
        
        setLoading(true);
        try {
            const intentRes = await fetch('/api/payments/stripe/create-intent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    buyer_id: user.id,
                    tax_amount: taxAmount
                })
            });
            const intentData = await intentRes.json();
            
            if (!intentData.success) {
                showError(intentData.error || 'Failed to initialize payment');
                return;
            }
            
            const { error, paymentIntent } = await stripeInstance.confirmCardPayment(
                intentData.clientSecret,
                {
                    payment_method: {
                        card: cardElement,
                        billing_details: { name: shippingAddress.name }
                    }
                }
            );
            
            if (error) {
                showError(error.message);
            } else if (paymentIntent.status === 'succeeded') {
                await createOrder('stripe', paymentIntent.id);
            } else {
                showError('Payment was not completed. Please try again.');
            }
        } catch (err) {
            console.error('Stripe payment error:', err);
            showError('Payment failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };
    
    if (!user) {
        return (
            <div className="section">
                <div className="section-header">
                    <h2>📦 Checkout</h2>
                    <p>Please sign in to checkout</p>
                </div>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')}>Sign In</button>
                </div>
            </div>
        );
    }
    
    if (items.length === 0) {
        return (
            <div className="section">
                <div className="section-header">
                    <h2>📦 Checkout</h2>
                    <p>Your cart is empty</p>
                </div>
                <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('shop')}>🏬 Go to Shop</button>
                </div>
            </div>
        );
    }
    
    // Group items by seller
    const itemsBySeller = items.reduce((acc, item) => {
        const sellerId = item.seller_id || 'unknown';
        if (!acc[sellerId]) {
            acc[sellerId] = { sellerName: item.seller_name || 'Unknown Seller', items: [] };
        }
        acc[sellerId].items.push(item);
        return acc;
    }, {});
    
    return (
        <div className="section">
            <div className="section-header">
                <h2>📦 Checkout</h2>
                <p>Complete your purchase</p>
            </div>
            
            <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 380px', 
                gap: '2rem',
                maxWidth: '1200px',
                margin: '0 auto'
            }}>
                {/* Left Column */}
                <div>
                    {/* Shipping Address */}
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>
                            📍 Shipping Address
                        </h3>
                        
                        {loadingAddress ? (
                            <div style={{ textAlign: 'center', padding: '1rem' }}>Loading address...</div>
                        ) : (
                            <div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Full Name</label>
                                        <input type="text" value={shippingAddress.name}
                                            onChange={(e) => setShippingAddress({...shippingAddress, name: e.target.value})}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Street Address</label>
                                        <input type="text" value={shippingAddress.address}
                                            onChange={(e) => setShippingAddress({...shippingAddress, address: e.target.value})}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>City</label>
                                            <input type="text" value={shippingAddress.city}
                                                onChange={(e) => setShippingAddress({...shippingAddress, city: e.target.value})}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>State</label>
                                            <input type="text" value={shippingAddress.state}
                                                onChange={(e) => setShippingAddress({...shippingAddress, state: e.target.value})}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>ZIP</label>
                                            <input type="text" value={shippingAddress.zip}
                                                onChange={(e) => setShippingAddress({...shippingAddress, zip: e.target.value})}
                                                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.6)' }}>Country</label>
                                        <select value={shippingAddress.country}
                                            onChange={(e) => setShippingAddress({...shippingAddress, country: e.target.value})}
                                            style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
                                        >
                                            <option value="USA">United States</option>
                                            <option value="Canada">Canada</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.75rem' }}>
                                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                                    <span style={{ fontSize: '0.9rem' }}>Save as default shipping address</span>
                                </label>
                            </div>
                        )}
                    </div>
                    
                    {/* Payment Method */}
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        marginBottom: '1.5rem',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>
                            💳 Payment Method
                        </h3>
                        
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                            <button
                                onClick={() => { setPaymentMethod('stripe'); }}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    borderRadius: '10px',
                                    border: paymentMethod === 'stripe' ? '2px solid var(--poke-yellow)' : '2px solid rgba(255,255,255,0.15)',
                                    background: paymentMethod === 'stripe' ? 'rgba(255,203,5,0.1)' : 'rgba(0,0,0,0.2)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>💳</span>
                                <span style={{ fontWeight: paymentMethod === 'stripe' ? 'bold' : 'normal' }}>Credit / Debit Card</span>
                            </button>
                            
                            <button
                                onClick={() => { setPaymentMethod('paypal'); }}
                                style={{
                                    flex: 1,
                                    padding: '1rem',
                                    borderRadius: '10px',
                                    border: paymentMethod === 'paypal' ? '2px solid var(--poke-yellow)' : '2px solid rgba(255,255,255,0.15)',
                                    background: paymentMethod === 'paypal' ? 'rgba(255,203,5,0.1)' : 'rgba(0,0,0,0.2)',
                                    color: 'white',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    transition: 'all 0.2s'
                                }}
                            >
                                <span style={{ fontSize: '1.5rem' }}>🅿️</span>
                                <span style={{ fontWeight: paymentMethod === 'paypal' ? 'bold' : 'normal' }}>PayPal</span>
                            </button>
                        </div>
                        
                        {/* Stripe Card Form */}
                        {paymentMethod === 'stripe' && (
                            <div>
                                <div 
                                    ref={cardElementRef}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: '8px',
                                        background: 'rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.2)',
                                        minHeight: '44px'
                                    }}
                                />
                                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
                                    🔒 Your card details are securely processed by Stripe
                                </p>
                            </div>
                        )}
                        
                        {/* PayPal Buttons */}
                        {paymentMethod === 'paypal' && (
                            <div>
                                <div ref={paypalContainerRef} style={{ minHeight: '50px' }}>
                                    {!paypalLoaded && (
                                        <div style={{ textAlign: 'center', padding: '1rem', color: 'rgba(255,255,255,0.5)' }}>
                                            Loading PayPal...
                                        </div>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.5rem' }}>
                                    🔒 You will be redirected to PayPal to complete payment
                                </p>
                            </div>
                        )}
                        
                        {!paymentMethod && (
                            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', padding: '1rem 0' }}>
                                Please select a payment method above
                            </p>
                        )}
                    </div>
                    
                    {/* Order Items by Seller */}
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>
                            🛍️ Order Items
                        </h3>
                        
                        {Object.entries(itemsBySeller).map(([sellerId, sellerData]) => (
                            <div key={sellerId} style={{ marginBottom: '1.5rem' }}>
                                <div style={{ 
                                    background: 'rgba(0,0,0,0.2)', 
                                    padding: '0.5rem 1rem', 
                                    borderRadius: '8px',
                                    marginBottom: '0.75rem'
                                }}>
                                    <span style={{ fontSize: '0.9rem' }}>Seller: </span>
                                    <span style={{ fontWeight: 'bold' }}>{sellerData.sellerName}</span>
                                </div>
                                
                                {sellerData.items.map(item => (
                                    <div key={item.id} style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '1rem',
                                        padding: '0.75rem',
                                        borderBottom: '1px solid rgba(255,255,255,0.05)'
                                    }}>
                                        <div style={{
                                            width: '50px',
                                            height: '50px',
                                            borderRadius: '6px',
                                            background: 'linear-gradient(135deg, var(--poke-blue), var(--poke-dark-blue))',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0
                                        }}>
                                            {item.image ? (
                                                <img src={item.image} alt={item.item_name} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
                                            ) : (
                                                <span style={{ fontSize: '1.5rem' }}>{item.item_type === 'product' ? '📦' : '🃏'}</span>
                                            )}
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: '500', fontSize: '0.9rem' }}>{item.item_name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>Qty: {item.quantity}</div>
                                        </div>
                                        <div style={{ fontWeight: '600', color: 'var(--poke-yellow)' }}>
                                            ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                
                {/* Right Column - Order Summary */}
                <div>
                    <div style={{
                        background: 'rgba(255,255,255,0.05)',
                        borderRadius: '12px',
                        padding: '1.5rem',
                        border: '1px solid rgba(255,255,255,0.1)',
                        position: 'sticky',
                        top: '100px'
                    }}>
                        <h3 style={{ marginBottom: '1rem', fontFamily: 'Bangers', color: 'var(--poke-yellow)' }}>
                            Order Summary
                        </h3>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                            <span>Items ({items.reduce((sum, i) => sum + i.quantity, 0)})</span>
                            <span>${cartData.subtotal.toFixed(2)}</span>
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.6)' }}>
                            <span>Shipping</span>
                            <span>Free</span>
                        </div>
                        
                        {cartData.subtotal < (cartData.minThreshold || 5) && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.6)' }}>
                                <span>Small Order Fee</span>
                                <span>${(cartData.minFee || 0.50).toFixed(2)}</span>
                            </div>
                        )}
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', color: 'rgba(255,255,255,0.6)' }}>
                            <span>Tax {taxRate > 0 ? `(${taxRate.toFixed(2)}%)` : ''}</span>
                            <span>{calculatingTax ? 'Calculating...' : `$${taxAmount.toFixed(2)}`}</span>
                        </div>
                        
                        <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            paddingTop: '1rem',
                            marginTop: '1rem',
                            borderTop: '1px solid rgba(255,255,255,0.1)',
                            fontWeight: 'bold',
                            fontSize: '1.2rem'
                        }}>
                            <span>Total</span>
                            <span style={{ color: 'var(--poke-yellow)' }}>${getOrderTotal().toFixed(2)}</span>
                        </div>
                        
                        {/* Pay button for Stripe */}
                        {paymentMethod === 'stripe' && (
                            <button 
                                className="btn btn-primary"
                                style={{ width: '100%', marginTop: '1.5rem', padding: '1rem', fontSize: '1.1rem' }}
                                onClick={handleStripePayment}
                                disabled={loading || !cardReady}
                            >
                                {loading ? 'Processing Payment...' : `💳 Pay $${getOrderTotal().toFixed(2)}`}
                            </button>
                        )}
                        
                        {!paymentMethod && (
                            <div style={{
                                marginTop: '1.5rem',
                                padding: '1rem',
                                borderRadius: '8px',
                                background: 'rgba(255,203,5,0.1)',
                                border: '1px solid rgba(255,203,5,0.3)',
                                textAlign: 'center',
                                color: 'var(--poke-yellow)',
                                fontSize: '0.9rem'
                            }}>
                                ⬅️ Select a payment method to continue
                            </div>
                        )}
                        
                        <button 
                            className="btn btn-secondary"
                            style={{ width: '100%', marginTop: '0.75rem' }}
                            onClick={() => setCurrentPage('cart')}
                        >
                            ← Back to Cart
                        </button>
                        
                        <p style={{ 
                            fontSize: '0.75rem', 
                            color: 'rgba(255,255,255,0.4)', 
                            textAlign: 'center',
                            marginTop: '1rem'
                        }}>
                            🔒 All payments are securely processed. By placing your order, you agree to our terms of service.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

window.CheckoutPage = CheckoutPage;
