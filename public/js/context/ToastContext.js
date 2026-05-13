/* ===================================
   Toast Context - Notifications
   =================================== */

const ToastContext = React.createContext();

const useToast = () => React.useContext(ToastContext);

const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = React.useState([]);

    const addToast = (message, type = 'info', duration = 3000) => {
        const id = Helpers.generateId();
        
        setToasts(prev => [...prev, { id, message, type }]);
        
        setTimeout(() => {
            removeToast(id);
        }, duration);
    };

    const removeToast = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const success = (message) => addToast(message, 'success');
    const error = (message) => addToast(message, 'error');
    const info = (message) => addToast(message, 'info');

    const value = {
        toasts,
        addToast,
        removeToast,
        success,
        error,
        info
    };

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastContainer toasts={toasts} />
        </ToastContext.Provider>
    );
};

// Toast Container Component
const ToastContainer = ({ toasts }) => {
    if (toasts.length === 0) return null;

    const getIcon = (type) => {
        switch (type) {
            case 'success': return '✓';
            case 'error': return '✗';
            default: return 'ℹ';
        }
    };

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast ${toast.type}`}>
                    <span>{getIcon(toast.type)}</span>
                    <span>{toast.message}</span>
                </div>
            ))}
        </div>
    );
};

// Make available globally
window.ToastContext = ToastContext;
window.useToast = useToast;
window.ToastProvider = ToastProvider;
