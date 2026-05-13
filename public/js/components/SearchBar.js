/* ===================================
   SearchBar Component
   =================================== */

const SearchBar = ({ placeholder, value, onChange, onSearch }) => {
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && onSearch) {
            onSearch(value);
        }
    };

    return (
        <div className="search-container">
            <span className="search-icon">🔍</span>
            <input
                type="text"
                className="search-input"
                placeholder={placeholder || 'Search...'}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyPress={handleKeyPress}
            />
        </div>
    );
};

window.SearchBar = SearchBar;
