/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APPS_SCRIPT_URL: string;
  readonly VITE_GOOGLE_SHEETS_BASE_URL: string;
  readonly VITE_SHEET_ID: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_NODE_ENV: string;
  readonly [key: string]: any;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
