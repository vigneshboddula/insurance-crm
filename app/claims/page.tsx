import { getClaims, getEndorsements } from "@/lib/service";
import { ClaimsPanel } from "@/components/service/ClaimsPanel";
import { EndorsementsPanel } from "@/components/service/EndorsementsPanel";
import { ClientCardSearch } from "@/components/service/ClientCardSearch";

export const dynamic = "force-dynamic";

export default async function Page() {
  const [claims, endorsements] = await Promise.all([getClaims(), getEndorsements()]);

  return (
    <div className="space-y-6">
      <ClientCardSearch />
      <ClaimsPanel rows={claims.rows} summary={claims.summary} />
      <EndorsementsPanel rows={endorsements.rows} summary={endorsements.summary} />
    </div>
  );
}
