export { auth as middleware } from "@/auth";

export const config = {
  matcher: ["/((?!api/cron|api/pin-image|_next/static|_next/image|favicon.ico).*)"],
};
