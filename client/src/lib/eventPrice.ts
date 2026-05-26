/**
 * Smart event pricing helpers.
 *
 * The `isPaid` flag on scraped/external events is often unreliable — it may
 * stay `false` even when the event clearly has a non-zero price or a paid
 * ticket link. These helpers derive the real pricing state from all available
 * signals so every card and detail page shows the correct information.
 */

export interface EventPriceInfo {
  isPaid: boolean;
  label: string;
  shortLabel: string;
  ctaLabel: string;
}

/**
 * Returns `true` if any available signal indicates the event costs money.
 */
export function deriveIsPaid(event: {
  isPaid?: boolean | null;
  price?: number | null;
  adultPrice?: number | null;
  kidsPrice?: number | null;
  familyPrice?: number | null;
  priceModel?: string | null;
}): boolean {
  if (event.isPaid) return true;
  if ((event.price ?? 0) > 0) return true;
  if ((event.adultPrice ?? 0) > 0) return true;
  if ((event.kidsPrice ?? 0) > 0) return true;
  if ((event.familyPrice ?? 0) > 0) return true;
  if (event.priceModel === "paid" || event.priceModel === "from" || event.priceModel === "ticketed") return true;
  return false;
}

/**
 * Returns the lowest known price in cents across all price tiers.
 * Returns null when no price information is available.
 */
function lowestPrice(event: {
  price?: number | null;
  adultPrice?: number | null;
  kidsPrice?: number | null;
  familyPrice?: number | null;
}): number | null {
  const candidates = [event.price, event.adultPrice, event.kidsPrice, event.familyPrice]
    .filter((v): v is number => v != null && v > 0);
  return candidates.length > 0 ? Math.min(...candidates) : null;
}

function fmtEur(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

/**
 * Returns a complete price info object for rendering.
 */
export function getEventPriceInfo(
  event: {
    isPaid?: boolean | null;
    price?: number | null;
    adultPrice?: number | null;
    kidsPrice?: number | null;
    familyPrice?: number | null;
    priceModel?: string | null;
    externalTicketLink?: string | null;
    source?: string | null;
  },
  freeLabel = "Gratis",
  paidLabel = "Betaald",
): EventPriceInfo {
  const paid = deriveIsPaid(event);
  const lowest = lowestPrice(event);
  const isExternal = !!(event.externalTicketLink) || (!!event.source && event.source !== "manual");

  if (!paid) {
    return {
      isPaid: false,
      label: freeLabel,
      shortLabel: freeLabel,
      ctaLabel: "Meer info",
    };
  }

  // priceModel='ticketed' means: definitely requires a ticket but no price data available
  if (event.priceModel === "ticketed" && lowest === null) {
    return {
      isPaid: true,
      label: "Tickets",
      shortLabel: "Tickets",
      ctaLabel: isExternal ? "Koop tickets" : "Koop ticket",
    };
  }

  const isFrom = event.priceModel === "from" || (
    lowest != null &&
    event.adultPrice != null && event.adultPrice > 0 &&
    (event.kidsPrice != null || event.familyPrice != null)
  );

  if (isFrom && lowest != null) {
    return {
      isPaid: true,
      label: `v.a. ${fmtEur(lowest)}`,
      shortLabel: `v.a. ${fmtEur(lowest)}`,
      ctaLabel: isExternal ? "Koop tickets" : "Koop ticket",
    };
  }

  if (lowest != null) {
    return {
      isPaid: true,
      label: fmtEur(lowest),
      shortLabel: fmtEur(lowest),
      ctaLabel: isExternal ? "Koop tickets" : "Koop ticket",
    };
  }

  return {
    isPaid: true,
    label: paidLabel,
    shortLabel: "Tickets",
    ctaLabel: isExternal ? "Koop tickets" : "Koop ticket",
  };
}
