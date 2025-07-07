// src/subscriptions/dto/client-sub.dto.ts
export class ClientSubscriptionDto {
  client_name: string; // Partition key
  created_at: string;
  progress: number; // Profiling progress (0–100)
  run_quota: number; // Maximum runs for the org (by sub level)
  subscription_level: 'L0' | 'L1' | 'L2' | 'L3' | 'LE';
  run_number?: number; // How many runs used
  max_edits?: number; // Editable fields left
  max_apps?: number; // Applications limit
  features_access?: string[]; // Tab/features allowed
  payment_status?: 'paid' | 'unpaid';
  invoice_s3_key?: string | null;
}
