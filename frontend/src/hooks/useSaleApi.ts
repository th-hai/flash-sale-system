import { useState, useEffect, useCallback } from 'react';
import type { SaleStatusResponse, PurchaseResponse } from '../types';

export function useSaleStatus(pollInterval: number = 3000) {
  const [saleStatus, setSaleStatus] = useState<SaleStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/sale/status');
      if (!res.ok) throw new Error('Failed to fetch sale status');
      const data: SaleStatusResponse = await res.json();
      setSaleStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  return { saleStatus, error, refetch: fetchStatus };
}

export function usePurchase() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PurchaseResponse | null>(null);

  const purchase = useCallback(async (userId: string) => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data: PurchaseResponse = await res.json();
      setResult(data);
    } catch {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => setResult(null), []);

  return { purchase, loading, result, reset };
}
