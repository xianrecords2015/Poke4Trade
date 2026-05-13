/* ===================================
   Main App Component
   =================================== */

const App = () => {
    const [currentPage, setCurrentPage] = React.useState('home');
    const [selectedSet, setSelectedSet] = React.useState(null);
    const [pageData, setPageData] = React.useState(null);

    // Navigation function that can accept optional data
    const navigateTo = (page, data = null) => {
        setPageData(data);
        setCurrentPage(page);
    };

    return (
        <AuthProvider>
            <CartProvider>
                <ToastProvider>
                    <AppContent 
                        currentPage={currentPage} 
                        navigateTo={navigateTo}
                        selectedSet={selectedSet}
                        setSelectedSet={setSelectedSet}
                        pageData={pageData}
                    />
                </ToastProvider>
            </CartProvider>
        </AuthProvider>
    );
};

// Separate component to access auth context
const AppContent = ({ currentPage, navigateTo, selectedSet, setSelectedSet, pageData }) => {
    const { user } = useAuth();

    const renderPage = () => {
        switch (currentPage) {
            case 'home':
                return <HomePage setCurrentPage={navigateTo} />;
            case 'signin':
                return <SignInPage setCurrentPage={navigateTo} />;
            case 'register':
                return <RegisterPage setCurrentPage={navigateTo} />;
            case 'sets':
                return <SetsPage setCurrentPage={navigateTo} setSelectedSet={setSelectedSet} />;
            case 'set-detail':
                return <SetDetailPage set={selectedSet} setCurrentPage={navigateTo} />;
            case 'trade':
                // Show landing page if not signed in, TradeMatchPage if signed in
                return user 
                    ? <TradeMatchPage setCurrentPage={navigateTo} />
                    : <TradePage setCurrentPage={navigateTo} />;
            case 'shop':
                return <ShopPage setCurrentPage={navigateTo} />;
            case 'collection':
                return <CollectionPage setCurrentPage={navigateTo} />;
            case 'cart':
                return <CartPage setCurrentPage={navigateTo} />;
            case 'checkout':
                return <CheckoutPage setCurrentPage={navigateTo} />;
            case 'my-orders':
                return <MyOrdersPage setCurrentPage={navigateTo} />;
            case 'settings':
                return <SettingsPage setCurrentPage={navigateTo} />;
            case 'profile':
                return <ProfilePage setCurrentPage={navigateTo} />;
            case 'my-cards':
                return <MyCardsPage setCurrentPage={navigateTo} />;
            case 'my-trades':
                return <MyTradesPage setCurrentPage={navigateTo} pageData={pageData} />;
            case 'my-shop':
                return <MyShopPage setCurrentPage={navigateTo} />;
            case 'sell-history':
                return <SellHistoryPage setCurrentPage={navigateTo} />;
            case 'admin':
                return <AdminSettingsPage setCurrentPage={navigateTo} />;
            default:
                return <HomePage setCurrentPage={navigateTo} />;
        }
    };

    return (
        <>
            <Header currentPage={currentPage} setCurrentPage={navigateTo} />
            <main>
                {renderPage()}
            </main>
            <Footer />
        </>
    );
};

window.App = App;

// Render the app
ReactDOM.render(<App />, document.getElementById('root'));
