import type { PurchaseResponse } from '../types';

interface Props {
  result: PurchaseResponse | null;
}

export function ResultMessage({ result }: Props) {
  if (!result) return null;

  const bgColor = result.success ? '#dcfce7' : '#fee2e2';
  const textColor = result.success ? '#166534' : '#991b1b';
  const borderColor = result.success ? '#86efac' : '#fca5a5';

  return (
    <div
      style={{
        margin: '1rem 1.5rem',
        padding: '1rem',
        borderRadius: '0.375rem',
        backgroundColor: bgColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        textAlign: 'center',
        fontWeight: 500,
      }}
    >
      {result.message}
    </div>
  );
}
