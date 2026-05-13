/* ===================================
   Settings Page - User Preferences
   =================================== */

const SettingsPage = ({ setCurrentPage }) => {
    const { user } = useAuth();
    const { success, error } = useToast();
    const [settings, setSettings] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    const LANGUAGES = ['English', 'French', 'Japanese', 'German', 'Spanish', 'Italian', 'Korean', 'Chinese'];
    const CONDITIONS = ['Mint', 'Near Mint', 'Very Good', 'Good', 'Fair', 'Poor'];
    const VERSIONS = ['Non-Holo', 'Holo', 'Reverse', 'Pokeball', 'Masterball', 'Holographic Staff'];
    const EDITIONS = ['1st', '2nd'];
    
    const PRICING_METHODS = [
        { value: 'none', label: 'None (Use TCG Price as-is)' },
        { value: 'ceil', label: 'Round Up (Ceil)' },
        { value: 'floor', label: 'Round Down (Floor)' },
        { value: 'round', label: 'Round (Nearest)' },
        { value: 'addition', label: 'Add Amount (+$)' },
        { value: 'subtraction', label: 'Subtract Amount (-$)' },
        { value: 'up_percent', label: 'Add Percentage (+%)' },
        { value: 'down_percent', label: 'Subtract Percentage (-%)' }
    ];

    React.useEffect(() => {
        if (user) {
            fetchSettings();
        }
    }, [user]);

    const fetchSettings = async () => {
        try {
            const res = await fetch(`/api/settings/${user.id}`);
            const data = await res.json();
            if (data.success) {
                setSettings(data.settings);
            }
            
        } catch (err) {
            error('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setSettings(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/settings/${user.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            
            if (data.success) {
                setSettings(data.settings);
                success('Settings saved!');
            } else {
                error('Failed to save settings');
            }
        } catch (err) {
            error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    // Calculate example price based on current settings
    const getExamplePrice = (tcgPrice) => {
        if (!settings || settings.pricing_method === 'none' || !tcgPrice) {
            return tcgPrice;
        }
        
        const value = parseFloat(settings.pricing_value) || 0;
        let result = tcgPrice;
        
        switch (settings.pricing_method) {
            case 'ceil':
                if (value > 0) {
                    result = Math.ceil(tcgPrice / value) * value;
                }
                break;
            case 'floor':
                if (value > 0) {
                    result = Math.floor(tcgPrice / value) * value;
                }
                break;
            case 'round':
                if (value > 0) {
                    result = Math.round(tcgPrice / value) * value;
                }
                break;
            case 'addition':
                result = tcgPrice + value;
                break;
            case 'subtraction':
                result = tcgPrice - value;
                break;
            case 'up_percent':
                result = tcgPrice * (1 + value / 100);
                break;
            case 'down_percent':
                result = tcgPrice * (1 - value / 100);
                break;
        }
        
        return Math.max(0, result); // Never go below 0
    };

    const getValueLabel = () => {
        const method = settings?.pricing_method;
        if (!method || method === 'none') return 'Value';
        if (method === 'ceil' || method === 'floor' || method === 'round') return 'Round to nearest';
        if (method === 'addition' || method === 'subtraction') return 'Amount ($)';
        if (method === 'up_percent' || method === 'down_percent') return 'Percentage (%)';
        return 'Value';
    };

    const getValuePlaceholder = () => {
        const method = settings?.pricing_method;
        if (method === 'ceil' || method === 'floor' || method === 'round') return 'e.g., 0.5 or 1';
        if (method === 'addition' || method === 'subtraction') return 'e.g., 0.50';
        if (method === 'up_percent' || method === 'down_percent') return 'e.g., 10';
        return '0';
    };

    if (!user) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <h3>Sign In Required</h3>
                    <p>Please sign in to access settings</p>
                    <button className="btn btn-primary" onClick={() => setCurrentPage('signin')} style={{ marginTop: '1rem' }}>
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="section">
                <Loading message="Loading settings..." />
            </div>
        );
    }

    const exampleTcgPrice = 4.73;
    const exampleYourPrice = getExamplePrice(exampleTcgPrice);

    return (
        <div className="section">
            <div className="section-header">
                <h2>⚙️ Settings</h2>
                <p>Configure your default preferences</p>
            </div>

            <div className="settings-card">
                <h3>📦 Collection Defaults</h3>
                <p className="settings-description">
                    These defaults will be applied when adding new sets or cards to your collection.
                </p>

                <div className="settings-form">
                    <div className="settings-row">
                        <label>Default Language</label>
                        <select value={settings?.default_language || 'English'} onChange={(e) => handleChange('default_language', e.target.value)}>
                            {LANGUAGES.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                        </select>
                    </div>

                    <div className="settings-row">
                        <label>Default Condition</label>
                        <select value={settings?.default_condition || 'Mint'} onChange={(e) => handleChange('default_condition', e.target.value)}>
                            {CONDITIONS.map(cond => <option key={cond} value={cond}>{cond}</option>)}
                        </select>
                    </div>

                    <div className="settings-row">
                        <label>Default Version</label>
                        <select value={settings?.default_version || 'Non-Holo'} onChange={(e) => handleChange('default_version', e.target.value)}>
                            {VERSIONS.map(ver => <option key={ver} value={ver}>{ver}</option>)}
                        </select>
                    </div>

                    <div className="settings-row">
                        <label>Default Edition</label>
                        <select value={settings?.default_edition || '2nd'} onChange={(e) => handleChange('default_edition', e.target.value)}>
                            {EDITIONS.map(ed => <option key={ed} value={ed}>{ed}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="settings-card">
                <h3>💰 Pricing Algorithm</h3>
                <p className="settings-description">
                    Configure how your selling price is calculated from the TCG market price.
                </p>

                <div className="settings-form">
                    <div className="settings-row">
                        <label>Pricing Method</label>
                        <select value={settings?.pricing_method || 'none'} onChange={(e) => handleChange('pricing_method', e.target.value)}>
                            {PRICING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                        </select>
                    </div>

                    {settings?.pricing_method && settings.pricing_method !== 'none' && (
                        <div className="settings-row">
                            <label>{getValueLabel()}</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                min="0"
                                value={settings?.pricing_value || ''} 
                                onChange={(e) => handleChange('pricing_value', e.target.value)}
                                placeholder={getValuePlaceholder()}
                            />
                        </div>
                    )}

                    {settings?.pricing_method && settings.pricing_method !== 'none' && (
                        <div className="pricing-example">
                            <h4>Example</h4>
                            <div className="pricing-example-row">
                                <span>TCG Price:</span>
                                <span className="price-tcg">${exampleTcgPrice.toFixed(2)}</span>
                            </div>
                            <div className="pricing-example-row">
                                <span>Your Price:</span>
                                <span className="price-yours">${exampleYourPrice.toFixed(2)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="settings-actions">
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Settings'}
                </button>
            </div>
        </div>
    );
};

window.SettingsPage = SettingsPage;
