/* ===================================
   Footer Component
   =================================== */

const Footer = ({ setCurrentPage }) => {
    return (
        <footer>
            <div className="footer-content">
                <div className="footer-section">
                    <h4>POKE4TRADE</h4>
                    <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                        Your trusted marketplace for Pokémon cards. Buy, sell, and trade with confidence.
                    </p>
                </div>
                
                <div className="footer-section">
                    <h4>Shop</h4>
                    <ul>
                        <li><button onClick={() => setCurrentPage('shop')}>Booster Boxes</button></li>
                        <li><button onClick={() => setCurrentPage('shop')}>Elite Trainer Boxes</button></li>
                        <li><button onClick={() => setCurrentPage('sets')}>Single Cards</button></li>
                        <li><button onClick={() => setCurrentPage('shop')}>Accessories</button></li>
                    </ul>
                </div>
                
                <div className="footer-section">
                    <h4>Trading</h4>
                    <ul>
                        <li><button onClick={() => setCurrentPage('trade')}>Browse Trades</button></li>
                        <li><button onClick={() => setCurrentPage('trade')}>Create Listing</button></li>
                        <li><button onClick={() => setCurrentPage('sets')}>Price Guide</button></li>
                    </ul>
                </div>
                
                <div className="footer-section">
                    <h4>Support</h4>
                    <ul>
                        <li><a href="#">Help Center</a></li>
                        <li><a href="#">Shipping Info</a></li>
                        <li><a href="#">Contact Us</a></li>
                        <li><a href="#">Terms of Service</a></li>
                    </ul>
                </div>
            </div>
            
            <div className="footer-bottom">
                <p>© 2025 Poke4Trade. All rights reserved. Not affiliated with Nintendo, The Pokémon Company, or Creatures Inc.</p>
            </div>
        </footer>
    );
};

// Make available globally
window.Footer = Footer;
