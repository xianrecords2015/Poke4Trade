/* ===================================
   Cart Context - Shopping Cart State (Database-backed)
   =================================== */

const CartContext = React.createContext();

const useCart = () => React.useContext(CartContext);

const CartProvider = ({ children }) => {
    const { user } = useAuth();
    const [items, setItems] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [cartData, setCartData] = React.useState({
        subtotal: 0,
        platformFee: 0,
        feePercent: 10,
        total: 0
    });

    // Load cart from database when user changes
    React.useEffect(() => {
        if (user?.id) {
            loadCart();
        } else {
            setItems([]);
            setCartData({ subtotal: 0, platformFee: 0, feePercent: 10, total: 0 });
        }
    }, [user?.id]);

    const loadCart = async () => {
        if (!user?.id) return;
        
        try {
            setLoading(true);
            const response = await fetch(`/api/cart/${user.id}`);
            const data = await response.json();
            
            if (data.success) {
                setItems(data.items || []);
                setCartData({
                    subtotal: data.subtotal || 0,
                    platformFee: data.platformFee || 0,
                    feePercent: data.feePercent || 10,
                    total: data.total || 0
                });
            }
        } catch (err) {
            console.error('Error loading cart:', err);
        } finally {
            setLoading(false);
        }
    };

    const addItem = async (itemType, itemId, quantity = 1) => {
        if (!user?.id) return { success: false, error: 'Please sign in' };
        
        try {
            const response = await fetch(`/api/cart/${user.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ item_type: itemType, item_id: itemId, quantity })
            });
            const data = await response.json();
            
            if (data.success) {
                await loadCart();
            }
            return data;
        } catch (err) {
            console.error('Error adding to cart:', err);
            return { success: false, error: 'Failed to add to cart' };
        }
    };

    const removeItem = async (cartId) => {
        if (!user?.id) return;
        
        try {
            const response = await fetch(`/api/cart/${user.id}/${cartId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                await loadCart();
            }
            return data;
        } catch (err) {
            console.error('Error removing from cart:', err);
            return { success: false, error: 'Failed to remove item' };
        }
    };

    const updateQuantity = async (cartId, quantity) => {
        if (!user?.id) return;
        
        try {
            const response = await fetch(`/api/cart/${user.id}/${cartId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ quantity })
            });
            const data = await response.json();
            
            if (data.success) {
                await loadCart();
            }
            return data;
        } catch (err) {
            console.error('Error updating cart:', err);
            return { success: false, error: 'Failed to update quantity' };
        }
    };

    const clearCart = async () => {
        if (!user?.id) return;
        
        try {
            const response = await fetch(`/api/cart/${user.id}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                setItems([]);
                setCartData({ subtotal: 0, platformFee: 0, feePercent: 10, total: 0 });
            }
            return data;
        } catch (err) {
            console.error('Error clearing cart:', err);
            return { success: false, error: 'Failed to clear cart' };
        }
    };

    const getItemCount = () => {
        return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    };

    const isInCart = (itemType, itemId) => {
        return items.some(item => item.item_type === itemType && item.item_id === itemId);
    };

    const value = {
        items,
        loading,
        cartData,
        loadCart,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        getItemCount,
        isInCart
    };

    return (
        <CartContext.Provider value={value}>
            {children}
        </CartContext.Provider>
    );
};

// Make available globally
window.CartContext = CartContext;
window.useCart = useCart;
window.CartProvider = CartProvider;
