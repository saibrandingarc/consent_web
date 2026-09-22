import { NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth-cookies';
import { getApiBaseUrl } from '@/lib/runtime-public-env';

export function setCmpTokenCookies(
  response: NextResponse,
  tokens: { accessToken: string; refreshToken: string },
) {
  const secure = process.env.NODE_ENV === 'production';
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 15 * 60,
  });
  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
}

export function isAccessTokenExpired(token: string, leewaySeconds = 30): boolean {
  try {
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1]!, 'base64url').toString('utf8'),
    ) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp <= Math.floor(Date.now() / 1000) + leewaySeconds;
  } catch {
    return true;
  }
}

const inflightExchanges = new Map<
  string,
  Promise<{ accessToken: string; refreshToken: string } | { error: string; status: number }>
>();

export async function exchangeAuth0IdTokenForCmpTokens(
  idToken: string,
): Promise<{ accessToken: string; refreshToken: string } | { error: string; status: number }> {
  const pending = inflightExchanges.get(idToken);
  if (pending) return pending;
  const run = exchangeAuth0IdTokenForCmpTokensOnce(idToken).finally(() => {
    inflightExchanges.delete(idToken);
  });
  inflightExchanges.set(idToken, run);
  return run;
}

async function exchangeAuth0IdTokenForCmpTokensOnce(
  idToken: string,
): Promise<{ accessToken: string; refreshToken: string } | { error: string; status: number }> {
  const apiUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${apiUrl}/auth/auth0/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
      cache: 'no-store',
      signal: AbortSignal.timeout(45_000),
    });
    const result = (await res.json()) as {
      ok?: boolean;
      data?: { accessToken: string; refreshToken: string };
      error?: { message?: string; code?: string };
    };
    if (result.ok && result.data?.accessToken && result.data?.refreshToken) {
      return result.data;
    }
    console.error('[cmp-web] auth0/callback failed', res.status, result.error ?? result);
    return {
      error: result.error?.message ?? `Auth0 callback failed (${res.status})`,
      status: res.status >= 400 && res.status < 600 ? res.status : 502,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' || error.name === 'AbortError');
    console.error('[cmp-web] auth0/callback unreachable', apiUrl, error);
    return {
      error: timedOut
        ? `consent_api timed out on /auth/auth0/callback (${apiUrl}). The API may be cold, blocked from Auth0 JWKS, or waiting on SQL Server.`
        : `API unreachable at ${apiUrl}. Confirm consent_api is running.`,
      status: 502,
    };
  }
}

export async function refreshCmpTokensFromCookie(
  refreshToken: string,
): Promise<{ accessToken: string; refreshToken: string } | null> {
  const apiUrl = getApiBaseUrl();
  try {
    const res = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
    const result = (await res.json()) as {
      ok: boolean;
      data?: { accessToken: string; refreshToken: string };
    };
    if (!result.ok || !result.data?.accessToken || !result.data?.refreshToken) {
      return null;
    }
    return result.data;
  } catch {
    return null;
  }
}
