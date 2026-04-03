export type SaleStatus = 'upcoming' | 'active' | 'ended';

export interface SaleStatusResponse {
  status: SaleStatus;
  startsAt: string;
  endsAt: string;
  stockRemaining: number;
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  reason?: 'ALREADY_PURCHASED' | 'OUT_OF_STOCK' | 'SALE_NOT_ACTIVE';
}