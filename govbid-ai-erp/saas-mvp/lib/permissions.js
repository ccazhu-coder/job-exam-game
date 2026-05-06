export const PLANS = {
  free: {
    name: 'Free',
    maxBids: 3,
    aiProposal: false,
    finance: false,
    team: false,
  },
  pro: {
    name: 'Pro',
    maxBids: 30,
    aiProposal: true,
    finance: true,
    team: false,
  },
  business: {
    name: 'Business',
    maxBids: 999,
    aiProposal: true,
    finance: true,
    team: true,
  },
  enterprise: {
    name: 'Enterprise',
    maxBids: 9999,
    aiProposal: true,
    finance: true,
    team: true,
  },
};

export function canUse(plan = 'free', feature) {
  const current = PLANS[plan] || PLANS.free;
  return Boolean(current[feature]);
}

export function getPlanLimit(plan = 'free', key = 'maxBids') {
  const current = PLANS[plan] || PLANS.free;
  return current[key];
}
