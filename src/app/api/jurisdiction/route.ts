import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { mapJurisdictions, type BusinessTrait, type Market } from "@/lib/jurisdiction";

export const dynamic = "force-dynamic";

const MARKETS: Market[] = ["us", "eu", "uk", "ca-on", "au"];
const TRAITS: BusinessTrait[] = [
  "private-business",
  "public-sector",
  "sells-to-us-federal",
  "banking-ecommerce-transport",
];

/**
 * POST /api/jurisdiction — markets in, applicable regimes out.
 *
 * Pure logic, no database. Unknown values are dropped rather than rejected: a new
 * option in the UI should degrade to "not selected", not a 400.
 */
export async function POST(request: Request): Promise<Response> {
  const limit = await rateLimit(request, "jurisdiction", 60, 60 * 60);
  if (!limit.allowed) return tooManyRequests(limit);

  let body: { markets?: unknown; traits?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const markets = (Array.isArray(body.markets) ? body.markets : []).filter(
    (m): m is Market => MARKETS.includes(m as Market),
  );
  const traits = (Array.isArray(body.traits) ? body.traits : []).filter(
    (t): t is BusinessTrait => TRAITS.includes(t as BusinessTrait),
  );

  return Response.json(mapJurisdictions(markets, traits));
}
