import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.PINTEREST_CLIENT_ID;
  const clientSecret = process.env.PINTEREST_CLIENT_SECRET;
  const nextauthUrl = process.env.NEXTAUTH_URL;

  const redirectUri = `${nextauthUrl}/api/auth/callback/pinterest`;

  const oauthUrl = `https://www.pinterest.com/oauth/?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=boards:read,boards:write,pins:read,pins:write,user_accounts:read`;

  return NextResponse.json({
    clientId,
    clientSecretSet: !!clientSecret,
    nextauthUrl,
    redirectUri,
    oauthUrl,
  });
}
