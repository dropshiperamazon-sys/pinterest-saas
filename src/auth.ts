import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + process.env.AUTH_SECRET);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("hex");
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return (await hashPassword(password)) === hash;
}

export { hashPassword };

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "pinterest",
      name: "Pinterest",
      type: "oauth",
      authorization: {
        url: "https://www.pinterest.com/oauth/",
        params: {
          scope: "boards:read,boards:write,pins:read,pins:write,user_accounts:read",
          response_type: "code",
        },
      },
      token: "https://api.pinterest.com/v5/oauth/token",
      userinfo: "https://api.pinterest.com/v5/user_account",
      clientId: process.env.PINTEREST_CLIENT_ID!,
      clientSecret: process.env.PINTEREST_CLIENT_SECRET!,
      profile(profile) {
        return {
          id: profile.username,
          name: profile.business_name || profile.username,
          email: null,
          image: profile.profile_image,
          username: profile.username,
        };
      },
    },
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const { Redis } = await import("@upstash/redis");
        const redis = new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        });
        const user = await redis.get<{ id: string; name: string; email: string; passwordHash: string; plan: string }>(
          `user:${credentials.email}`
        );
        if (!user) return null;
        const valid = await verifyPassword(credentials.password as string, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "pinterest") {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});
