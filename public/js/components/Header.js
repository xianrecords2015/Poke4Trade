/* ===================================
   Header Component
   =================================== */

const Header = ({ currentPage, setCurrentPage }) => {
    const { user, logout } = useAuth();
    const { getItemCount } = useCart();
    const [showDropdown, setShowDropdown] = React.useState(false);
    const [notifications, setNotifications] = React.useState({ count: 0, items: [] });
    const [showNotifications, setShowNotifications] = React.useState(false);
    const [isAdmin, setIsAdmin] = React.useState(false);
    
    const dropdownRef = React.useRef(null);
    const notificationRef = React.useRef(null);

    // Close dropdowns when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Fetch notifications and check admin status when user is logged in
    React.useEffect(() => {
        if (user) {
            fetchNotifications();
            checkAdminStatus();
            // Poll for new notifications every 30 seconds
            const interval = setInterval(fetchNotifications, 30000);
            return () => clearInterval(interval);
        } else {
            setIsAdmin(false);
        }
    }, [user]);

    const checkAdminStatus = async () => {
        try {
            const res = await fetch('/api/admin/check', {
                headers: { 'X-User-Id': user.id }
            });
            const data = await res.json();
            setIsAdmin(data.isAdmin);
        } catch (err) {
            console.error('Error checking admin status:', err);
        }
    };

    const fetchNotifications = async () => {
        try {
            const res = await fetch(`/api/notifications/${user.id}?unreadOnly=true`);
            const data = await res.json();
            if (data.success) {
                setNotifications({ count: data.unreadCount, items: data.data });
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        }
    };

    const markAsRead = async (notifId) => {
        try {
            await fetch(`/api/notifications/read/${notifId}`, { method: 'POST' });
            fetchNotifications();
        } catch (err) {
            console.error('Error marking notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await fetch(`/api/notifications/read-all/${user.id}`, { method: 'POST' });
            fetchNotifications();
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    };

    const handleNotificationClick = (notif) => {
        markAsRead(notif.id);
        setShowNotifications(false);
        if (notif.link) {
            const page = notif.link.replace('/', '');
            if (notif.related_id && (notif.type === 'system' || notif.type === 'trade_request' || notif.type === 'trade_accepted' || notif.type === 'trade_declined')) {
                setCurrentPage(page, { 
                    tradeId: notif.related_id, 
                    openTab: notif.type === 'system' ? 'messages' : 'details' 
                });
            } else {
                setCurrentPage(page);
            }
        }
    };

    const navItems = [
        { id: 'home', label: 'Home' },
        { id: 'shop', label: 'Shop' },
        { id: 'trade', label: 'Trade' },
        { id: 'sets', label: 'Browse' },
    ];

    const handleLogout = () => {
        logout();
        setShowDropdown(false);
        setCurrentPage('home');
    };

    const getInitials = () => {
        if (user?.username) {
            return user.username.substring(0, 2).toUpperCase();
        }
        return '?';
    };

    const formatTimeAgo = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${diffDays}d ago`;
    };

    return (
        <header>
            <nav>
                <div className="logo" onClick={() => setCurrentPage('home')}>
                    POKE<span>4</span>TRADE
                </div>
                
                <ul className="nav-links">
                    {navItems.map(item => (
                        <li key={item.id}>
                            <button
                                className={currentPage === item.id ? 'active' : ''}
                                onClick={() => setCurrentPage(item.id)}
                            >
                                {item.label}
                            </button>
                        </li>
                    ))}
                </ul>
                
                <div className="nav-cta">
                    {user ? (
                        <>
                            {/* Cart Icon */}
                            <button
                                className="notification-btn"
                                onClick={() => setCurrentPage("cart")}
                                style={{ marginRight: "0.5rem" }}
                            >
                                🛒
                                {getItemCount() > 0 && (
                                    <span className="notification-badge">{getItemCount()}</span>
                                )}
                            </button>
                            <div className="notification-wrapper" ref={notificationRef}>
                                <button 
                                    className="notification-btn"
                                    onClick={() => setShowNotifications(!showNotifications)}
                                >
                                    🔔
                                    {notifications.count > 0 && (
                                        <span className="notification-badge">{notifications.count}</span>
                                    )}
                                </button>
                                
                                {showNotifications && (
                                    <div className="notification-dropdown">
                                        <div className="notification-header">
                                            <span>Notifications</span>
                                            {notifications.count > 0 && (
                                                <button className="mark-all-read" onClick={markAllAsRead}>
                                                    Mark all read
                                                </button>
                                            )}
                                        </div>
                                        <div className="notification-list">
                                            {notifications.items.length === 0 ? (
                                                <div className="notification-empty">
                                                    No new notifications
                                                </div>
                                            ) : (
                                                notifications.items.slice(0, 10).map(notif => (
                                                    <div 
                                                        key={notif.id} 
                                                        className={`notification-item ${notif.is_read ? 'read' : 'unread'}`}
                                                        onClick={() => handleNotificationClick(notif)}
                                                    >
                                                        <div className="notification-icon">
                                                            {notif.type === 'trade_request' && '📨'}
                                                            {notif.type === 'trade_accepted' && '✅'}
                                                            {notif.type === 'trade_declined' && '❌'}
                                                            {notif.type === 'trade_cancelled' && '🚫'}
                                                            {notif.type === 'system' && '📢'}
                                                        </div>
                                                        <div className="notification-content">
                                                            <div className="notification-title">{notif.title}</div>
                                                            <div className="notification-time">{formatTimeAgo(notif.created_at)}</div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                        {notifications.items.length > 0 && (
                                            <div className="notification-footer">
                                                <button onClick={() => { setCurrentPage('my-trades'); setShowNotifications(false); }}>
                                                    View All Trades
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="user-dropdown" ref={dropdownRef}>
                                <button
                                    className="user-btn"
                                    onClick={() => setShowDropdown(!showDropdown)}
                                >
                                    <div className="user-avatar-small">
                                        {user.profile_picture ? (
                                            <img src={user.profile_picture} alt={user.username} />
                                        ) : (
                                            <span className="avatar-initials">{getInitials()}</span>
                                        )}
                                    </div>
                                    <span>{user.username}</span>
                                    {<span className="user-rating">{user.ratings_count > 0 ? `⭐ ${parseFloat(user.rating).toFixed(1)}` : ""}</span>}
                                </button>
                                
                                {showDropdown && (
                                    <div className="dropdown-menu">
                                        <button onClick={() => { setCurrentPage('profile'); setShowDropdown(false); }}>
                                            👤 My Profile
                                        </button>
                                        <button onClick={() => { setCurrentPage('my-cards'); setShowDropdown(false); }}>
                                            🃏 My Cards
                                        </button>
                                        <button onClick={() => { setCurrentPage('collection'); setShowDropdown(false); }}>
                                            📦 Collection
                                        </button>
                                        <button onClick={() => { setCurrentPage('my-trades'); setShowDropdown(false); }}>
                                            🔄 My Trades
                                            {notifications.count > 0 && (
                                                <span className="menu-badge">{notifications.count}</span>
                                            )}
                                        </button>
                                        <button onClick={() => { setCurrentPage('my-shop'); setShowDropdown(false); }}>
                                            🏬 My Shop
                                        </button>
                                        <button onClick={() => { setCurrentPage('sell-history'); setShowDropdown(false); }}>
                                            📜 Sell History
                                        </button>
                                        <button onClick={() => { setCurrentPage('my-orders'); setShowDropdown(false); }}>
                                            🛒 Purchase History
                                        </button>
                                        <button onClick={() => { setCurrentPage('settings'); setShowDropdown(false); }}>
                                            ⚙️ Settings
                                        </button>
                                        {isAdmin && (
                                            <button onClick={() => { setCurrentPage('admin'); setShowDropdown(false); }}>
                                                🛡️ Admin Settings
                                            </button>
                                        )}
                                        <button onClick={handleLogout}>
                                            🚪 Sign Out
                                        </button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setCurrentPage('signin')}
                            >
                                Sign In
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={() => setCurrentPage('register')}
                            >
                                Join Now
                            </button>
                        </>
                    )}
                </div>
            </nav>
        </header>
    );
};

window.Header = Header;
