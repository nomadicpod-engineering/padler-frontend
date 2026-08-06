/** Human-readable product labels for Padler UI (technical keys stay unchanged). */

const PRODUCT_LABELS: Record<string, string> = {
  classycar: 'Npod-Auto',
  'trip-jotter': 'Trip Jotter',
  drift: 'Npod Rider',
  npod: 'Npod',
  capslocker: 'Identity',
  identity: 'Identity',
  padler: 'Padler'
};

export function productDisplayLabel(productKey?: string | null): string {
  if (!productKey) return 'Product';
  const key = productKey.trim().toLowerCase();
  return PRODUCT_LABELS[key] ?? productKey;
}

/** Canonical display name for the Classycar product key. */
export const NPOD_AUTO_LABEL = PRODUCT_LABELS.classycar;
