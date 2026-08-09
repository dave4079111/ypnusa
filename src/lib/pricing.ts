export type PricingTierId = "free" | "starter" | "pro" | "elite";

export interface PricingTier {
  id: PricingTierId;
  name: string;
  price: string;
  priceMonthlyCents: number;
  cadence: string;
  tagline: string;
  features: string[];
  cta: string;
  highlight: boolean;
  zipCapacity: number | "unlimited";
  zipCapacityLabel: string;
  countyCapacityNote: string;
  capacityNote: string;
}

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    priceMonthlyCents: 0,
    cadence: "forever / no card",
    tagline: "Prove demand on your first ZIP",
    features: [
      "1 exclusive ZIP to start",
      "AI borrower intake assistant",
      "Qualification + scoring",
      "You own every lead you capture",
      "Upgrade when pull-through is real",
    ],
    cta: "Start free",
    highlight: false,
    zipCapacity: 1,
    zipCapacityLabel: "1 ZIP",
    countyCapacityNote: "No county expansion",
    capacityNote: "1 exclusive ZIP to start",
  },
  {
    id: "starter",
    name: "Starter",
    price: "$29.99",
    priceMonthlyCents: 2999,
    cadence: "/mo",
    tagline: "Lock a small exclusive footprint",
    features: [
      "Up to 3 exclusive ZIPs",
      "Branded borrower experience",
      "AI intake + follow-up",
      "Territory demand reports",
      "Cancel anytime",
    ],
    cta: "Claim Starter",
    highlight: false,
    zipCapacity: 3,
    zipCapacityLabel: "Up to 3 ZIPs",
    countyCapacityNote: "ZIP-first coverage with territory reports",
    capacityNote: "Up to 3 exclusive ZIPs",
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99.99",
    priceMonthlyCents: 9999,
    cadence: "/mo",
    tagline: "For the serious loan officer",
    features: [
      "Up to 5 exclusive ZIPs",
      "Portable MLO website",
      "SMS + email nurture ladders",
      "Calendar booking + CRM mirroring",
      "Keep leads & site if you switch",
    ],
    cta: "Claim Pro",
    highlight: true,
    zipCapacity: 5,
    zipCapacityLabel: "Up to 5 ZIPs",
    countyCapacityNote: "County demand posture for serious MLOs",
    capacityNote: "Up to 5 exclusive ZIPs",
  },
  {
    id: "elite",
    name: "Elite",
    price: "$299.99",
    priceMonthlyCents: 29999,
    cadence: "/mo",
    tagline: "Unlimited exclusive capacity",
    features: [
      "Unlimited exclusive ZIPs",
      "Priority territory expansion",
      "Advanced life-event signals",
      "White-glove onboarding",
      "Team / brokerage ready",
    ],
    cta: "Go Elite",
    highlight: false,
    zipCapacity: "unlimited",
    zipCapacityLabel: "Unlimited ZIPs",
    countyCapacityNote: "Priority county expansion for teams and brokerages",
    capacityNote: "Unlimited exclusive ZIPs plus priority territory expansion",
  },
];

export const PAID_PRICING_TIERS = PRICING_TIERS.filter((tier) => tier.priceMonthlyCents > 0);

export function getPricingTier(id: PricingTierId): PricingTier {
  const tier = PRICING_TIERS.find((candidate) => candidate.id === id);
  if (!tier) {
    throw new Error(`Unknown pricing tier: ${id}`);
  }
  return tier;
}
