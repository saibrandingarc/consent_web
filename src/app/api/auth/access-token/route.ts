import { cookies } from 'next/headers';
import { getAuth0SessionFromRequest } from '@/lib/auth0-session.server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/auth-cookies';
import {
  exchangeAuth0IdTokenForCmpTokens,
  isAccessTokenExpired,
  refreshCmpTokensFromCookie,
  setCmpTokenCookies,
} from '@/lib/cmp-auth-server';
import { NextResponse, type NextRequest } from 'next/server';

function idTokenFromSession(session: unknown): string | undefined {
  const tokenSet = (session as { tokenSet?: { idToken?: string; id_token?: string } } | null)
    ?.tokenSet;
  return tokenSet?.idToken ?? tokenSet?.id_token;
}

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const cmpToken = cookieStore.get(ACCESS_COOKIE)?.value;
  if (cmpToken && !isAccessTokenExpired(cmpToken)) {
    return NextResponse.json({ accessToken: cmpToken });
  }

  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  if (refreshToken) {
    const refreshed = await refreshCmpTokensFromCookie(refreshToken);
    if (refreshed) {
      const response = NextResponse.json({ accessToken: refreshed.accessToken });
      setCmpTokenCookies(response, refreshed);
      return response;
    }
  }

  const session = await getAuth0SessionFromRequest(request);
  const idToken = idTokenFromSession(session);
  if (!session?.user) {
    return NextResponse.json({ error: 'No Auth0 session' }, { status: 401 });
  }
  if (!idToken) {
    return NextResponse.json({ error: 'No Auth0 id token in session' }, { status: 401 });
  }

  const exchanged = await exchangeAuth0IdTokenForCmpTokens(idToken);
  if ('error' in exchanged) {
    return NextResponse.json({ error: exchanged.error }, { status: exchanged.status });
  }

  const response = NextResponse.json({ accessToken: exchanged.accessToken });
  setCmpTokenCookies(response, exchanged);
  return response;
}
