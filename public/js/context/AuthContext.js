/* ===================================
   Auth Context - Authentication State
   =================================== */

const AuthContext = React.createContext();

const useAuth = () => React.useContext(AuthContext);

const AuthProvider = ({ children }) => {
    const [user, setUser] = React.useState(() => {
        return Helpers.storage.get('poke4trade_user', null);
    });

    const login = async (loginId, password) => {
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: loginId, password })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Login failed');
            }
            
            setUser(data.user);
            Helpers.storage.set('poke4trade_user', data.user);
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        setUser(null);
        Helpers.storage.remove('poke4trade_user');
    };

    const register = async (formData) => {
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.username,
                    email: formData.email,
                    password: formData.password
                })
            });
            
            const data = await res.json();
            
            if (!res.ok) {
                throw new Error(data.error || 'Registration failed');
            }
            
            setUser(data.user);
            Helpers.storage.set('poke4trade_user', data.user);
            return { success: true, user: data.user };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateUser = (updates) => {
        if (!user) return;
        const updatedUser = { ...user, ...updates };
        setUser(updatedUser);
        Helpers.storage.set('poke4trade_user', updatedUser);
    };

    const value = {
        user,
        isAuthenticated: !!user,
        login,
        logout,
        register,
        updateUser
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

window.AuthContext = AuthContext;
window.useAuth = useAuth;
window.AuthProvider = AuthProvider;
