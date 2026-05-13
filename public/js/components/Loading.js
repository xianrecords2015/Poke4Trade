/* ===================================
   Loading Component
   =================================== */

const Loading = ({ message = 'Loading...' }) => {
    return (
        <div className="loading">
            <div className="pokeball-loader"></div>
            <p>{message}</p>
        </div>
    );
};

// Make available globally
window.Loading = Loading;
