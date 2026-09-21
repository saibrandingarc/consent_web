declare global {
  interface Window {
    __CMP_PUBLIC_ENV__?: {
      apiUrl?: string;
      appUrl?: string;
    };
  }
}

/** Independent consent_api App Service — never the web/admin hostname. */
export const REMOTE_API_URL =
  'https://consentapi-abgrbph5cfccbxe0.eastus2-01.azurewebsites.net/api/v1';

export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/$/, '');
  if (!trimmed) return trimmed;
  if (trimmed.endsWith('/api/v1')) return trimmed;
  if (/\/api\/v\d+$/i.test(trimmed)) return trimmed;
  return `${trimmed}/api/v1`;
}

function configuredApiUrl(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_API_URL?.trim() || process.env.API_URL?.trim();
  return raw ? normalizeApiBaseUrl(raw) : undefined;
}

export function getRuntimePublicEnvScript(): string | null {
  const apiUrl =
    configuredApiUrl() ||
    (process.env.NODE_ENV === 'production' ? REMOTE_API_URL : 'http://localhost:4000/api/v1');
  const appUrl = process.env.APP_BASE_URL?.trim();
  if (!apiUrl && !appUrl) return null;
  const payload = JSON.stringify({ apiUrl, appUrl });
  return `window.__CMP_PUBLIC_ENV__=${payload};`;
}

export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.__CMP_PUBLIC_ENV__?.apiUrl) {
    return normalizeApiBaseUrl(window.__CMP_PUBLIC_ENV__.apiUrl);
  }

  const fromEnv = configuredApiUrl();
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    return REMOTE_API_URL;
  }

  return 'http://localhost:4000/api/v1';
}
