/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Google OAuth web client ID (public). Empty disables sign-in and sync. */
  readonly VITE_GOOGLE_CLIENT_ID: string;
}
