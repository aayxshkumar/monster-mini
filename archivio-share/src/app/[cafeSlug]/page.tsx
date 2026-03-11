import { getCafe } from "@/lib/cafe";
import { CafeLanding } from "./cafe-landing";

export default async function CafeHome({
  params,
}: {
  params: Promise<{ cafeSlug: string }>;
}) {
  const { cafeSlug } = await params;
  const cafe = await getCafe(cafeSlug);
  return <CafeLanding cafeSlug={cafeSlug} cafeName={cafe?.name ?? null} logoUrl={cafe?.logoUrl ?? null} />;
}
