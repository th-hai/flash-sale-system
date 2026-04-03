import { useSaleStatus, usePurchase } from './hooks/useSaleApi';
import { SaleStatus } from './components/SaleStatus';
import { PurchaseForm } from './components/PurchaseForm';
import { ResultMessage } from './components/ResultMessage';

export function App() {
  const { saleStatus, error, refetch } = useSaleStatus(3000);
  const { purchase, loading, result } = usePurchase();

  const handlePurchase = async (userId: string) => {
    await purchase(userId);
    refetch();
  };

  return (
    <div style={styles.app}>
      <div style={styles.card}>
        <h1 style={styles.title}>Flash Sale</h1>
        <SaleStatus saleStatus={saleStatus} error={error} />
        <ResultMessage result={result} />
        <PurchaseForm
          saleStatus={saleStatus?.status}
          loading={loading}
          onPurchase={handlePurchase}
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  app: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    margin: 0,
    padding: '1rem',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '0.75rem',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    padding: '2rem 0',
    width: '100%',
    maxWidth: '480px',
  },
  title: {
    textAlign: 'center',
    fontSize: '1.5rem',
    margin: '0 0 1rem',
  },
};
