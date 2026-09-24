import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import { getToken } from 'next-auth/jwt';
import type { JWT } from 'next-auth/jwt';
import { headers as nextHeaders } from 'next/headers';
import { isMockMode } from './env';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

declare module 'next-auth' {
  interface Session {
    // accessToken/refreshToken intentionally NOT exposed here - they stay
    // server-side only (in the JWT). Use requireSession() to read them.
    error?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: number; // seconds since epoch
    error?: string;
  }
}

async function refreshAccessToken(token: JWT): Promise<JWT> {
  try {
    if (!token.refreshToken) {
      return { ...token, error: 'NoRefreshToken' };
    }
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '',
      grant_type: 'refresh_token',
      refresh_token: token.refreshToken,
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });
    const refreshed = await res.json();
    if (!res.ok) throw refreshed;
    return {
      ...token,
      accessToken: refreshed.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + (refreshed.expires_in ?? 3600),
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (err) {
    console.error('Failed to refresh access token', err);
    return { ...token, error: 'RefreshAccessTokenError' };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  session: { strategy: 'jwt' },
  callbacks: {
    async signIn({ user }) {
      const allowed = process.env.ALLOWED_EMAIL;
      if (!allowed) return false; // no allowlist configured -> deny everyone
      const email = user.email ?? '';
      return email.toLowerCase() === allowed.toLowerCase();
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token ?? token.refreshToken;
        token.expiresAt = account.expires_at;
        token.error = undefined;
        return token;
      }
      if (token.expiresAt && Date.now() < token.expiresAt * 1000 - 60_000) {
        return token;
      }
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      // Do NOT put token.accessToken / token.refreshToken on session - the
      // session object is readable by the client (e.g. GET /api/auth/session).
      // Access tokens stay server-side only; read them via requireSession().
      session.error = token.error;
      return session;
    },
  },
});

export interface RequireSessionResult {
  email: string;
  accessToken: string;
}

export async function requireSession(): Promise<RequireSessionResult | null> {
  if (isMockMode()) {
    return {
      email: process.env.ALLOWED_EMAIL ?? 'mock@example.com',
      accessToken: 'mock',
    };
  }
  const allowed = process.env.ALLOWED_EMAIL;
  const session = await auth();
  if (!session?.user?.email || !allowed) return null;
  if (session.user.email.toLowerCase() !== allowed.toLowerCase()) return null;

  // Access token lives only in the JWT (never on the client-visible session
  // object), so read it server-side via getToken().
  const hdrs = await nextHeaders();
  const token = await getToken({
    req: { headers: hdrs },
    secret: process.env.AUTH_SECRET,
    secureCookie: process.env.NODE_ENV === 'production',
  });
  if (!token?.accessToken) return null;

  return { email: session.user.email, accessToken: token.accessToken };
}
