import { getAuth0SessionFromRequest } from '@/lib/auth0-session.server';
import {
  exchangeAuth0IdTokenForCmpTokens,
  setCmpTokenCookies,
} from '@/lib/cmp-auth-server';
import { NextResponse, type NextRequest } from 'next/server';

export async function POST(request: NextRequest) {
  const session = await getAuth0SessionFromRequest(request);
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
  }

  const idToken =
    (session as { tokenSet?: { idToken?: string; id_token?: string } }).tokenSet?.idToken ??
    (session as { tokenSet?: { id_token?: string } }).tokenSet?.id_token;
  if (!idToken) {
    return NextResponse.json({ ok: false, error: 'No id token' }, { status: 401 });
  }

  const exchanged = await exchangeAuth0IdTokenForCmpTokens(idToken);
  if ('error' in exchanged) {
    return NextResponse.json(
      { ok: false, error: { message: exchanged.error } },
      { status: exchanged.status },
    );
  }

  const response = NextResponse.json({ ok: true, data: exchanged });
  setCmpTokenCookies(response, exchanged);
  return response;
}
