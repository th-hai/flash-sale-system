export type SaleStatus = 'upcoming' | 'active' | 'ended';

export interface SaleConfig {
  startTime: number; // epoch ms
  endTime: number;   // epoch ms
  totalStock: number;
}

export interface SaleStatusResponse {
  status: SaleStatus;
  startsAt: string;
  endsAt: string;
  stockRemaining: number;
}

export enum PurchaseResult {
  SUCCESS = 1,
  OUT_OF_STOCK = 0,
  ALREADY_PURCHASED = -1,
}

export interface PurchaseResponse {
  success: boolean;
  message: string;
  reason?: 'ALREADY_PURCHASED' | 'OUT_OF_STOCK' | 'SALE_NOT_ACTIVE';
}

export interface PurchaseCheckResponse {
  purchased: boolean;
}
