/** Scorecard photo reading ships switched off until a Bedrock model is configured (FR-CARD-06). */
export const cardScanEnabled = (): boolean => import.meta.env.VITE_CARD_SCAN === 'true';
