/* ===================================
   Profile Page - User Profile Management
   =================================== */

const ProfilePage = ({ setCurrentPage }) => {
    const { user, updateUser } = useAuth();
    const { success, error } = useToast();
    const [profile, setProfile] = React.useState(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [uploadingPicture, setUploadingPicture] = React.useState(false);
    const fileInputRef = React.useRef(null);

    const COUNTRIES = [
        { code: 'US', name: 'United States', hasState: true, stateLabel: 'State', postalLabel: 'ZIP Code' },
        { code: 'CA', name: 'Canada', hasState: true, stateLabel: 'Province', postalLabel: 'Postal Code' },
        { code: 'GB', name: 'United Kingdom', hasState: false, stateLabel: 'County', postalLabel: 'Postcode' },
        { code: 'AU', name: 'Australia', hasState: true, stateLabel: 'State', postalLabel: 'Postcode' },
        { code: 'DE', name: 'Germany', hasState: false, stateLabel: '', postalLabel: 'PLZ' },
        { code: 'FR', name: 'France', hasState: false, stateLabel: '', postalLabel: 'Code Postal' },
        { code: 'JP', name: 'Japan', hasState: true, stateLabel: 'Prefecture', postalLabel: 'Postal Code' },
        { code: 'IT', name: 'Italy', hasState: true, stateLabel: 'Province', postalLabel: 'CAP' },
        { code: 'ES', name: 'Spain', hasState: true, stateLabel: 'Province', postalLabel: 'Código Postal' },
        { code: 'MX', name: 'Mexico', hasState: true, stateLabel: 'State', postalLabel: 'Código Postal' },
        { code: 'BR', name: 'Brazil', hasState: true, stateLabel: 'State', postalLabel: 'CEP' },
        { code: 'NZ', name: 'New Zealand', hasState: false, stateLabel: '', postalLabel: 'Postcode' },
        { code: 'SG', name: 'Singapore', hasState: false, stateLabel: '', postalLabel: 'Postal Code' },
        { code: 'KR', name: 'South Korea', hasState: true, stateLabel: 'Province', postalLabel: 'Postal Code' },
        { code: 'PH', name: 'Philippines', hasState: true, stateLabel: 'Province', postalLabel: 'ZIP Code' },
    ];

    const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'];
    const CA_PROVINCES = ['AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT'];
    const AU_STATES = ['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA'];

    React.useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        try {
            const res = await fetch('/api/profile/' + user.id);
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
                // Sync profile picture with auth context
                if (data.profile.profile_picture !== user.profile_picture) {
                    updateUser({ profile_picture: data.profile.profile_picture });
                }
            }
        } catch (err) {
            error('Failed to load profile');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field, value) => {
        setProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/profile/' + user.id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(profile)
            });
            const data = await res.json();
            if (data.success) {
                setProfile(data.profile);
                success('Profile saved!');
            } else {
                error('Failed to save profile');
            }
        } catch (err) {
            error('Failed to save profile');
        } finally {
            setSaving(false);
        }
    };

    const handlePictureClick = () => {
        fileInputRef.current?.click();
    };

    const handlePictureChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            error('Image must be less than 5MB');
            return;
        }

        // Validate file type
        if (!file.type.match(/^image\/(jpeg|jpg|png|gif|webp)$/)) {
            error('Only JPEG, PNG, GIF, or WebP images are allowed');
            return;
        }

        setUploadingPicture(true);
        try {
            const formData = new FormData();
            formData.append('picture', file);

            const res = await fetch(`/api/profile/${user.id}/picture`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();
            if (data.success) {
                const newPicturePath = data.picture + '?t=' + Date.now();
                setProfile(prev => ({ ...prev, profile_picture: newPicturePath }));
                // Update auth context so header updates
                updateUser({ profile_picture: newPicturePath });
                success('Profile picture updated!');
            } else {
                error(data.error || 'Failed to upload picture');
            }
        } catch (err) {
            error('Failed to upload picture');
        } finally {
            setUploadingPicture(false);
            // Reset file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleRemovePicture = async () => {
        if (!confirm('Remove your profile picture?')) return;

        setUploadingPicture(true);
        try {
            const res = await fetch(`/api/profile/${user.id}/picture`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (data.success) {
                setProfile(prev => ({ ...prev, profile_picture: null }));
                // Update auth context so header updates
                updateUser({ profile_picture: null });
                success('Profile picture removed');
            } else {
                error('Failed to remove picture');
            }
        } catch (err) {
            error('Failed to remove picture');
        } finally {
            setUploadingPicture(false);
        }
    };

    const getCountryConfig = () => {
        return COUNTRIES.find(c => c.code === (profile?.billing_country || 'US')) || COUNTRIES[0];
    };

    const getStateOptions = () => {
        const country = profile?.billing_country;
        if (country === 'US') return US_STATES;
        if (country === 'CA') return CA_PROVINCES;
        if (country === 'AU') return AU_STATES;
        return null;
    };

    const getInitials = () => {
        if (profile?.first_name && profile?.last_name) {
            return (profile.first_name[0] + profile.last_name[0]).toUpperCase();
        }
        if (profile?.username) {
            return profile.username.substring(0, 2).toUpperCase();
        }
        return '?';
    };

    if (!user) {
        return (
            <div className="section">
                <div className="empty-state">
                    <div className="empty-state-icon">🔒</div>
                    <h3>Sign In Required</h3>
                    <p>Please sign in to view your profile</p>
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
                <Loading message="Loading profile..." />
            </div>
        );
    }

    const countryConfig = getCountryConfig();
    const stateOptions = getStateOptions();

    return (
        <div className="section">
            <div className="section-header">
                <h2>👤 My Profile</h2>
                <p>Manage your account information</p>
            </div>

            <div className="profile-card">
                {/* Profile Picture Section */}
                <div className="profile-section profile-picture-section">
                    <h3>📷 Profile Picture</h3>
                    
                    <div className="profile-picture-container">
                        <div 
                            className={`profile-picture ${uploadingPicture ? 'uploading' : ''}`}
                            onClick={handlePictureClick}
                            title="Click to change picture"
                        >
                            {profile?.profile_picture ? (
                                <img src={profile.profile_picture} alt="Profile" />
                            ) : (
                                <div className="profile-picture-placeholder">
                                    {getInitials()}
                                </div>
                            )}
                            <div className="profile-picture-overlay">
                                {uploadingPicture ? '⏳' : '📷'}
                            </div>
                        </div>
                        
                        <div className="profile-picture-actions">
                            <button 
                                className="btn btn-secondary btn-sm" 
                                onClick={handlePictureClick}
                                disabled={uploadingPicture}
                            >
                                {uploadingPicture ? 'Uploading...' : 'Change Picture'}
                            </button>
                            {profile?.profile_picture && (
                                <button 
                                    className="btn btn-danger btn-sm" 
                                    onClick={handleRemovePicture}
                                    disabled={uploadingPicture}
                                >
                                    Remove
                                </button>
                            )}
                        </div>
                        <p className="profile-picture-hint">JPEG, PNG, GIF or WebP. Max 5MB.</p>
                        
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                            onChange={handlePictureChange}
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>

                <div className="profile-section">
                    <h3>🔐 Account Information</h3>
                    
                    <div className="profile-row">
                        <label>Username</label>
                        <input type="text" value={profile?.username || ''} disabled className="input-disabled" />
                    </div>
                    
                    <div className="profile-row">
                        <label>Email</label>
                        <input type="email" value={profile?.email || ''} disabled className="input-disabled" />
                    </div>
                </div>

                <div className="profile-section">
                    <h3>📋 Personal Information</h3>
                    
                    <div className="profile-row-group">
                        <div className="profile-row half">
                            <label>First Name</label>
                            <input type="text" value={profile?.first_name || ''} onChange={(e) => handleChange('first_name', e.target.value)} placeholder="First name" />
                        </div>
                        <div className="profile-row half">
                            <label>Last Name</label>
                            <input type="text" value={profile?.last_name || ''} onChange={(e) => handleChange('last_name', e.target.value)} placeholder="Last name" />
                        </div>
                    </div>

                    <div className="profile-row">
                        <label>Phone</label>
                        <input type="tel" value={profile?.phone || ''} onChange={(e) => handleChange('phone', e.target.value)} placeholder="Phone number" />
                    </div>
                </div>

                <div className="profile-section">
                    <h3>💳 Billing Address</h3>

                    <div className="profile-row">
                        <label>Country</label>
                        <select value={profile?.billing_country || 'US'} onChange={(e) => handleChange('billing_country', e.target.value)}>
                            {COUNTRIES.map(c => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="profile-row">
                        <label>Address Line 1</label>
                        <input type="text" value={profile?.billing_address1 || ''} onChange={(e) => handleChange('billing_address1', e.target.value)} placeholder="Street address" />
                    </div>

                    <div className="profile-row">
                        <label>Address Line 2</label>
                        <input type="text" value={profile?.billing_address2 || ''} onChange={(e) => handleChange('billing_address2', e.target.value)} placeholder="Apartment, suite, etc. (optional)" />
                    </div>

                    <div className="profile-row-group">
                        <div className="profile-row half">
                            <label>City</label>
                            <input type="text" value={profile?.billing_city || ''} onChange={(e) => handleChange('billing_city', e.target.value)} placeholder="City" />
                        </div>
                        {countryConfig.hasState && (
                            <div className="profile-row half">
                                <label>{countryConfig.stateLabel}</label>
                                {stateOptions ? (
                                    <select value={profile?.billing_state || ''} onChange={(e) => handleChange('billing_state', e.target.value)}>
                                        <option value="">Select {countryConfig.stateLabel}</option>
                                        {stateOptions.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input type="text" value={profile?.billing_state || ''} onChange={(e) => handleChange('billing_state', e.target.value)} placeholder={countryConfig.stateLabel} />
                                )}
                            </div>
                        )}
                    </div>

                    <div className="profile-row">
                        <label>{countryConfig.postalLabel}</label>
                        <input type="text" value={profile?.billing_postal_code || ''} onChange={(e) => handleChange('billing_postal_code', e.target.value)} placeholder={countryConfig.postalLabel} style={{ maxWidth: '200px' }} />
                    </div>
                </div>

                <div className="profile-section">
                    <h3>📦 Shipping Address</h3>
                    
                    <div className="profile-row">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={profile?.use_billing_as_shipping || false} 
                                onChange={(e) => handleChange('use_billing_as_shipping', e.target.checked ? 1 : 0)}
                            />
                            <span>Same as billing address</span>
                        </label>
                    </div>

                    {!profile?.use_billing_as_shipping && (
                        <>
                            <div className="profile-row">
                                <label>Recipient Name</label>
                                <input type="text" value={profile?.shipping_name || ''} onChange={(e) => handleChange('shipping_name', e.target.value)} placeholder="Full name for shipping" />
                            </div>

                            <div className="profile-row">
                                <label>Country</label>
                                <select value={profile?.shipping_country || 'US'} onChange={(e) => handleChange('shipping_country', e.target.value)}>
                                    {COUNTRIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="profile-row">
                                <label>Address Line 1</label>
                                <input type="text" value={profile?.shipping_address1 || ''} onChange={(e) => handleChange('shipping_address1', e.target.value)} placeholder="Street address" />
                            </div>

                            <div className="profile-row">
                                <label>Address Line 2</label>
                                <input type="text" value={profile?.shipping_address2 || ''} onChange={(e) => handleChange('shipping_address2', e.target.value)} placeholder="Apartment, suite, etc. (optional)" />
                            </div>

                            <div className="profile-row-group">
                                <div className="profile-row half">
                                    <label>City</label>
                                    <input type="text" value={profile?.shipping_city || ''} onChange={(e) => handleChange('shipping_city', e.target.value)} placeholder="City" />
                                </div>
                                <div className="profile-row half">
                                    <label>State</label>
                                    <input type="text" value={profile?.shipping_state || ''} onChange={(e) => handleChange('shipping_state', e.target.value)} placeholder="State" />
                                </div>
                            </div>

                            <div className="profile-row">
                                <label>ZIP/Postal Code</label>
                                <input type="text" value={profile?.shipping_postal_code || ''} onChange={(e) => handleChange('shipping_postal_code', e.target.value)} placeholder="ZIP code" style={{ maxWidth: '200px' }} />
                            </div>
                        </>
                    )}
                </div>

                <div className="profile-actions">
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Profile'}
                    </button>
                </div>
            </div>
        </div>
    );
};

window.ProfilePage = ProfilePage;
