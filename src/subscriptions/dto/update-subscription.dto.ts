export class UpdateSubscriptionDto {
  tier?: 'L0' | 'L1' | 'L2' | 'L3' | 'LE';
  run_number?: number;
  // Optionally: status, limits, etc
}
