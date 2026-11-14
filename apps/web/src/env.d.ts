/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth web client ID (public). Empty disables sign-in and sync. */
  readonly VITE_GOOGLE_CLIENT_ID: string;
  /** "true" when scorecard photo reading is configured (config/app.json cardScanModelId). */
  readonly VITE_CARD_SCAN: string;
}
