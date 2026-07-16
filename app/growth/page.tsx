import { GrowthDashboard } from "@/components/growth/GrowthDashboard";
import { getClientTiers, getCrossSellOpportunities, getReferralStats } from "@/lib/growth";

export const dynamic = "force-dynamic";

export default async function GrowthPage() {
  const [tiers, crossSell, referrals] = await Promise.all([
    getClientTiers(),
    getCrossSellOpportunities(),
    getReferralStats(),
  ]);

  return (
    <div className="space-y-4">
      <GrowthDashboard
        clients={tiers.clients}
        tierSummary={tiers.summary}
        crossSell={crossSell.items}
        crossSellSummary={crossSell.summary}
        referralStats={referrals}
      />
    </div>
  );
}
