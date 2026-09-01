import type { WishlistEntry } from "@bw-bikes/shared";
import type { Metadata } from "next";
import { buildColorSwatchIndex, getPublicColorSwatches } from "@/lib/api/public-catalog";
import { serverApiFetch } from "@/lib/api/server";
import { GuardadosView } from "./GuardadosView";

export const metadata: Metadata = { title: "Guardados" };

export default async function GuardadosPage() {
  const [{ data }, bikeSwatches, accessorySwatches] = await Promise.all([
    serverApiFetch<{ wishlist: WishlistEntry[] }>("/account/wishlist"),
    getPublicColorSwatches("bike"),
    getPublicColorSwatches("accessory"),
  ]);

  return (
    <GuardadosView
      initialWishlist={data.wishlist}
      colorSwatchIndex={buildColorSwatchIndex([...bikeSwatches, ...accessorySwatches])}
    />
  );
}
