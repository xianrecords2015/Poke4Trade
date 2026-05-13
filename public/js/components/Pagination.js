/* ===================================
   Pagination Component
   =================================== */

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;

    const pages = Helpers.getPagination(currentPage, totalPages, 5);

    return (
        <div className="pagination">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
            >
                ← Prev
            </button>
            
            {pages[0] > 1 && (
                <>
                    <button onClick={() => onPageChange(1)}>1</button>
                    {pages[0] > 2 && <span style={{ padding: '0.75rem' }}>...</span>}
                </>
            )}
            
            {pages.map(page => (
                <button
                    key={page}
                    className={currentPage === page ? 'active' : ''}
                    onClick={() => onPageChange(page)}
                >
                    {page}
                </button>
            ))}
            
            {pages[pages.length - 1] < totalPages && (
                <>
                    {pages[pages.length - 1] < totalPages - 1 && (
                        <span style={{ padding: '0.75rem' }}>...</span>
                    )}
                    <button onClick={() => onPageChange(totalPages)}>{totalPages}</button>
                </>
            )}
            
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
            >
                Next →
            </button>
        </div>
    );
};

window.Pagination = Pagination;
