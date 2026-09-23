export interface OrderScan {
  date: string;
  activity: string;
  location?: string;
  sr_status_label?: string;
}

export interface OrderTrackingInfo {
  orderId: number;
  orderNumber?: string;
  awb?: string | null;
  status?: string | null;
  statusId?: number | null;
  courier?: string | null;
  etd?: string | null;
  scans: OrderScan[];
  updatedAt?: string | null;
  hasTracking: boolean;
}
