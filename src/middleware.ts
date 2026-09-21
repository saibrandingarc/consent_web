import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  getAppBaseUrl,
  getRequestHost,
  isAuth0Configured,
  appBaseUrlMatchesHost,
} from '@cmp/auth';
import { getAuth0 } from './lib/auth0';

const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/onboarding', '/verify-email', '/websites'];

function isAuthRoute(pathname: string) {
  return pathname === '/auth' || pathname.startsWith('/auth/');
}

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function loginUrl(request: NextRequest, returnTo?: string) {
  const login = new URL('/auth/login', getAppBaseUrl());
  if (returnTo) {
    login.searchParams.set('returnTo', returnTo);
  }
  request.nextUrl.searchParams.forEach((value, key) => {
    if (key !== 'returnTo') {
      login.searchParams.set(key, value);
    }
  });
  return login;
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  try {
    if (pathname === '/auth/callback' && request.nextUrl.searchParams.has('error')) {
      const description =
        request.nextUrl.searchParams.get('error_description') ??
        request.nextUrl.searchParams.get('error') ??
        'Login failed';
      const home = new URL('/', getAppBaseUrl());
      home.searchParams.set('login_error', description);
      return NextResponse.redirect(home);
    }

    if (isAuthRoute(pathname) && !isAuth0Configured()) {
      return new NextResponse(
        'Auth0 is not configured on this App Service. Set AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, and AUTH0_SECRET.',
        { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
      );
    }

    if (!isAuth0Configured()) {
      return NextResponse.next();
    }

    if (isAuthRoute(pathname)) {
      const authResponse = await getAuth0().middleware(request);
      if (pathname === '/auth/callback' && authResponse.status >= 400) {
        return NextResponse.redirect(new URL('/', getAppBaseUrl()));
      }
      return authResponse;
    }

    const requestHost = getRequestHost(request.headers, request.nextUrl.host);
    if (!appBaseUrlMatchesHost(requestHost)) {
      return NextResponse.next();
    }

    const authResponse = await getAuth0().middleware(request);

    if (isProtectedPath(pathname)) {
      const session = await getAuth0().getSession(request);
      if (!session?.user) {
        return NextResponse.redirect(
          loginUrl(request, `${pathname}${request.nextUrl.search}`),
        );
      }
    }

    return authResponse;
  } catch (err) {
    console.error('[middleware] Fatal auth error:', err);
    if (pathname === '/auth/callback') {
      return NextResponse.redirect(new URL('/', getAppBaseUrl()));
    }
    if (isAuthRoute(pathname)) {
      return new NextResponse('Authentication is temporarily unavailable.', { status: 503 });
    }
    return NextResponse.next();
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|loading-spinner.png|sitemap.xml|robots.txt).*)'],
};
