import { useEffect, useState } from 'react';
import type { SaleStatusResponse } from '../types';

interface Props {
  saleStatus: SaleStatusResponse | null;
  error: string | null;
}

function Countdown({ targetTime }: { targetTime: string }) {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = new Date(targetTime).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft('Starting...');
        return;
      }
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTime]);

  return <span style={{ fontFamily: 'monospace', fontSize: '2rem' }}>{timeLeft}</span>;
}

export function SaleStatus({ saleStatus, error }: Props) {
  if (error) {
    return <div style={styles.container}><p style={styles.error}>Unable to connect to server</p></div>;
  }

  if (!saleStatus) {
    return <div style={styles.container}><p>Loading...</p></div>;
  }

  return (
    <div style={styles.container}>
      {saleStatus.status === 'upcoming' && (
        <>
          <span style={{ ...styles.badge, backgroundColor: '#f59e0b' }}>UPCOMING</span>
          <p>Sale starts in:</p>
          <Countdown targetTime={saleStatus.startsAt} />
        </>
      )}
      {saleStatus.status === 'active' && (
        <>
          <span style={{ ...styles.badge, backgroundColor: '#22c55e' }}>LIVE</span>
          <p style={styles.stock}>{saleStatus.stockRemaining} items remaining</p>
        </>
      )}
      {saleStatus.status === 'ended' && (
        <>
          <span style={{ ...styles.badge, backgroundColor: '#ef4444' }}>ENDED</span>
          <p>The sale has ended.</p>
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    textAlign: 'center',
    padding: '1.5rem',
  },
  badge: {
    display: 'inline-block',
    color: 'white',
    padding: '0.25rem 1rem',
    borderRadius: '9999px',
    fontWeight: 'bold',
    fontSize: '0.875rem',
    letterSpacing: '0.05em',
  },
  stock: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginTop: '0.5rem',
  },
  error: {
    color: '#ef4444',
  },
};
