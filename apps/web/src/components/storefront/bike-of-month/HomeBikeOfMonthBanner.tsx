import type { PublicBikeOfMonth } from "@bw-bikes/shared";
import Image from "next/image";
import { PromoBanner } from "@/components/storefront/shared/PromoBanner";

export interface HomeBikeOfMonthBannerProps {
  bikeOfMonth: PublicBikeOfMonth;
}

/**
 * The home's single-bike spotlight (M12). All of the layout lives in
 * `PromoBanner`, extracted when the comparator section needed the same
 * banner mirrored — this component is now only the mapping from
 * `PublicBikeOfMonth` onto it.
 *
 * The rhino on the eyebrow is passed from here rather than living in
 * `PromoBanner`: DESIGN_SYSTEM.md §5.1 caps the home at two rhino
 * appearances (hero and footer already spend them elsewhere on the page), so
 * it has to be the calling section's decision, never a banner default that
 * every future caller inherits.
 */
export function HomeBikeOfMonthBanner({ bikeOfMonth }: HomeBikeOfMonthBannerProps) {
  return (
    <PromoBanner
      align="left"
      image={bikeOfMonth.image}
      title={bikeOfMonth.title}
      {...(bikeOfMonth.eyebrow ? { eyebrow: bikeOfMonth.eyebrow } : {})}
      eyebrowIcon={
        // 16x7, la razón real 308:132 del asset — un tamaño cuadrado loguea warning.
        <Image src="/brand/rhino-dorado.svg" alt="" width={16} height={7} aria-hidden="true" />
      }
      {...(bikeOfMonth.subtitle ? { subtitle: bikeOfMonth.subtitle } : {})}
      actions={[
        { label: "Conocer más", href: bikeOfMonth.href, variant: "ghost" },
        { label: "Comprar", href: bikeOfMonth.href, variant: "primary" },
      ]}
    />
  );
}
