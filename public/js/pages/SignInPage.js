/* ===================================
   Sign In Page
   =================================== */

const SignInPage = ({ setCurrentPage }) => {
    const { login } = useAuth();
    const { success, error } = useToast();
    const [formData, setFormData] = React.useState({
        login: '',
        password: ''
    });
    const [loading, setLoading] = React.useState(false);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        const result = await login(formData.login, formData.password);
        setLoading(false);
        
        if (result.success) {
            success('Welcome back!');
            setCurrentPage('home');
        } else {
            error(result.error || 'Login failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Welcome Back</h2>
                <p className="subtitle">Sign in to your account</p>

                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label>Username or Email</label>
                        <input
                            type="text"
                            name="login"
                            value={formData.login}
                            onChange={handleChange}
                            placeholder="Enter your username or email"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <p className="auth-footer">
                    Don't have an account?{' '}
                    <button onClick={() => setCurrentPage('register')}>
                        Create one
                    </button>
                </p>
            </div>
        </div>
    );
};

window.SignInPage = SignInPage;
