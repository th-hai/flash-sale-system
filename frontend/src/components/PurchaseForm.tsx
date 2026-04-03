import { useState } from 'react';
import type { SaleStatus } from '../types';

interface Props {
  saleStatus: SaleStatus | undefined;
  loading: boolean;
  onPurchase: (userId: string) => void;
}

export function PurchaseForm({ saleStatus, loading, onPurchase }: Props) {
  const [userId, setUserId] = useState('');

  const isDisabled = saleStatus !== 'active' || loading || userId.trim() === '';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDisabled) {
      onPurchase(userId.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <input
        type="text"
        placeholder="Enter your username or email"
        value={userId}
        onChange={(e) => setUserId(e.target.value)}
        style={styles.input}
        disabled={loading}
      />
      <button
        type="submit"
        disabled={isDisabled}
        style={{
          ...styles.button,
          opacity: isDisabled ? 0.5 : 1,
          cursor: isDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {loading ? 'Processing...' : 'Buy Now'}
      </button>
    </form>
  );
}

const styles: Record<string, React.CSSProperties> = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '0 1.5rem',
    maxWidth: '400px',
    margin: '0 auto',
  },
  input: {
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #d1d5db',
    borderRadius: '0.375rem',
    outline: 'none',
  },
  button: {
    padding: '0.75rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#2563eb',
    border: 'none',
    borderRadius: '0.375rem',
  },
};
