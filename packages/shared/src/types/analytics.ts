import type { ItemType } from "./catalog.js";

/**
 * The body of `POST /catalog/views` — an anonymous "someone looked at this
 * product" event. No `userId`, no IP, no user-agent: there is no business
 * reason to attribute a page view to a person, and privacy is a reason not
 * to. `sku`/`size` are optional because the event fires from both the
 * product page (no variant chosen yet) and a variant selector.
 */
export interface ProductViewInput {
  itemType: ItemType;
  itemId: string;
  sku?: string;
  size?: string;
}
