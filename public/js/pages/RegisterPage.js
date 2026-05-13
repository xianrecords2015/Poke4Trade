/* ===================================
   Register Page
   =================================== */

const RegisterPage = ({ setCurrentPage }) => {
    const { register } = useAuth();
    const { success, error } = useToast();
    const [formData, setFormData] = React.useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [loading, setLoading] = React.useState(false);
    const [usernameError, setUsernameError] = React.useState('');
    const [emailError, setEmailError] = React.useState('');

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        if (e.target.name === 'username') setUsernameError('');
        if (e.target.name === 'email') setEmailError('');
    };

    const checkUsername = async () => {
        if (!formData.username || formData.username.length < 3) return;
        try {
            const res = await fetch('/api/auth/check-username/' + encodeURIComponent(formData.username));
            const data = await res.json();
            if (data.exists) {
                setUsernameError('Username already taken');
            }
        } catch (err) {
            console.error('Check username error:', err);
        }
    };

    const checkEmail = async () => {
        if (!formData.email || !formData.email.includes('@')) return;
        try {
            const res = await fetch('/api/auth/check-email/' + encodeURIComponent(formData.email));
            const data = await res.json();
            if (data.exists) {
                setEmailError('Email already registered');
            }
        } catch (err) {
            console.error('Check email error:', err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (usernameError || emailError) {
            error('Please fix the errors before submitting');
            return;
        }
        
        if (formData.username.length < 3) {
            error('Username must be at least 3 characters');
            return;
        }
        
        if (formData.password !== formData.confirmPassword) {
            error('Passwords do not match');
            return;
        }
        
        if (formData.password.length < 6) {
            error('Password must be at least 6 characters');
            return;
        }
        
        setLoading(true);
        const result = await register(formData);
        setLoading(false);
        
        if (result.success) {
            success('Account created successfully!');
            setCurrentPage('home');
        } else {
            error(result.error || 'Registration failed');
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2>Create Account</h2>
                <p className="subtitle">Join the Poke4Trade community</p>

                <form onSubmit={handleSubmit} className="form">
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            name="username"
                            value={formData.username}
                            onChange={handleChange}
                            onBlur={checkUsername}
                            placeholder="Choose a username (min 3 characters)"
                            required
                            className={usernameError ? 'input-error' : ''}
                        />
                        {usernameError && <span className="field-error">{usernameError}</span>}
                    </div>

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            onBlur={checkEmail}
                            placeholder="Enter your email"
                            required
                            className={emailError ? 'input-error' : ''}
                        />
                        {emailError && <span className="field-error">{emailError}</span>}
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Create a password (min 6 characters)"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            name="confirmPassword"
                            value={formData.confirmPassword}
                            onChange={handleChange}
                            placeholder="Confirm your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn btn-primary btn-block" disabled={loading || usernameError || emailError}>
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                <p className="auth-footer">
                    Already have an account?{' '}
                    <button onClick={() => setCurrentPage('signin')}>
                        Sign in
                    </button>
                </p>
            </div>
        </div>
    );
};

window.RegisterPage = RegisterPage;
