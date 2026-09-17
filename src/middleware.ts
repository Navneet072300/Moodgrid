import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabase, supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/database.types";

export async function middleware(request: NextRequest) {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  const backend = hasSupabase() ? new URL(supabaseConfig().url).origin : "";
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self' ${backend}${process.env.NODE_ENV === "development" ? " ws: wss:" : ""}; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`;
  request.headers.set("Content-Security-Policy", csp);
  request.headers.set("x-nonce", nonce);
  const secure = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    return response;
  };
  const protectedPage = /^\/(today|calendar|insights|account|stickers)(\/|$)/.test(request.nextUrl.pathname);
  if (!hasSupabase()) {
    return secure(protectedPage ? NextResponse.redirect(new URL("/login", request.url)) : NextResponse.next({ request }));
  }
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  if (protectedPage && !user) {
    const redirect = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set("Cache-Control", "private, no-store");
    return secure(redirect);
  }
  // Per-request pages and refreshed session cookies must never be CDN cached.
  response.headers.set("Cache-Control", "private, no-store");
  return secure(response);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"] };
