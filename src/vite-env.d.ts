/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CRMP_API_URL?: string;
  readonly VITE_CRMP_AUTO_BOOTSTRAP?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
