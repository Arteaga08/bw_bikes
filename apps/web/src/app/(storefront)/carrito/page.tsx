import type { Metadata } from "next";
import { cloudinaryCloudName } from "@/lib/config";
import { CartPageClient } from "./CartPageClient";

export const metadata: Metadata = {
  title: "Carrito",
  robots: { index: false, follow: false },
};

export default function CarritoPage() {
  return (
    <div className="mx-auto max-w-5xl px-lg py-xl">
      <h1 className="font-display text-h2 text-negro">Tu carrito</h1>
      <div className="mt-lg">
        <CartPageClient cloudName={cloudinaryCloudName()} />
      </div>
    </div>
  );
}
