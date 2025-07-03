export class CreateSubscriptionDto {
  client_name: string;
  tier: 'L0' | 'L1' | 'L2' | 'L3' | 'LE';
  // Optionally: initial run_number, etc
}
