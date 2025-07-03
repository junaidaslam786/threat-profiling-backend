export type SubscriptionTier = 'L0' | 'L1' | 'L2' | 'L3' | 'LE';

export const SUBSCRIPTION_TIERS: Record<
  SubscriptionTier,
  {
    maxEdits: number;
    maxApps: number;
    allowedTabs: string[];
    runQuota: number;
  }
> = {
  L0: { maxEdits: 0, maxApps: 0, allowedTabs: [], runQuota: 0 },
  L1: { maxEdits: 1, maxApps: 1, allowedTabs: ['Basic'], runQuota: 1 },
  L2: { maxEdits: 2, maxApps: 2, allowedTabs: ['ISM', 'E8'], runQuota: 2 },
  L3: {
    maxEdits: 3,
    maxApps: 5,
    allowedTabs: ['ISM', 'E8', 'Detections'],
    runQuota: 3,
  },
  LE: {
    maxEdits: Infinity,
    maxApps: Infinity,
    allowedTabs: ['ISM', 'E8', 'Detections'],
    runQuota: Infinity,
  },
};
