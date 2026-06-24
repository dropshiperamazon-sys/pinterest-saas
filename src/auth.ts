import NextAuth from "next-auth";

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
  ],
  callbacks: {
    async jwt({ token, account }) {
      // Store Pinterest access token in JWT on first sign-in
      if (account?.provider === "pinterest") {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpires = account.expires_at;
      }
      return token;
    },
    async session({ session, token }) {
      // Expose access token to the client session
      session.accessToken = token.accessToken as string;
      return session;
    },
  },
  pages: {
    signIn: "/connect",
    error: "/connect",
  },
});
