import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

const PORTAL_COLEGIO_COOKIE = "portal_colegio_id";

function isDyneduLoginPath(pathname: string) {
  return pathname === "/dynedu" || pathname === "/dynedu/";
}

function isPortalColegiosLoginPath(pathname: string) {
  return pathname === "/portal-colegios" || pathname === "/portal-colegios/";
}

function isPublicPath(pathname: string) {
  // Public auth (compras)
  if (pathname.startsWith("/auth")) return true;

  // DynEdu + Portal login pages must be public
  if (isDyneduLoginPath(pathname)) return true;
  if (isPortalColegiosLoginPath(pathname)) return true;

  // Public website routes
  if (pathname === "/") return true;
  if (pathname.startsWith("/libros")) return true;
  if (pathname.startsWith("/carrito")) return true;
  if (pathname.startsWith("/contacto")) return true;
  if (pathname.startsWith("/nosotros")) return true;
  if (pathname.startsWith("/libro-de-reclamaciones")) return true;

  return false;
}

function isProtectedRootPath(pathname: string) {
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/perfil")) return true;
  return false;
}

function isDyneduPath(pathname: string) {
  return pathname.startsWith("/dynedu");
}

function isPortalColegiosPath(pathname: string) {
  return pathname.startsWith("/portal-colegios");
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const url = req.nextUrl;

  // --- 1) Decide response base (rewrite/next) ---
  let res: NextResponse;

  const isRootDomain =
    hostname === "dynamiceducationperu.com" || hostname === "www.dynamiceducationperu.com";

  if (isRootDomain) {
    res = NextResponse.next();
  } else if (hostname.startsWith("colegios.")) {
    // colegios -> /portal-colegios
    if (!url.pathname.startsWith("/portal-colegios")) {
      const rewriteUrl = url.clone();
      rewriteUrl.pathname = `/portal-colegios${url.pathname === "/" ? "" : url.pathname}`;
      res = NextResponse.rewrite(rewriteUrl);
    } else {
      res = NextResponse.next();
    }
  } else if (hostname.startsWith("intranet.")) {
    // intranet -> /dynedu
    if (!url.pathname.startsWith("/dynedu")) {
      const rewriteUrl = url.clone();
      rewriteUrl.pathname = `/dynedu${url.pathname === "/" ? "" : url.pathname}`;
      res = NextResponse.rewrite(rewriteUrl);
    } else {
      res = NextResponse.next();
    }
  } else {
    res = NextResponse.next();
  }

  // --- 2) Supabase SSR (solo para rutas que usan Supabase Auth) ---
  const cookiesToApply: Array<{ name: string; value: string; options: any }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            cookiesToApply.push({ name, value, options });
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = url.pathname;
  const publicPath = isPublicPath(path);

  // --- 3) Guard para web pública (compradores) ---
  if (isRootDomain) {
    const protectedPath = isProtectedRootPath(path);

    if (protectedPath && !user && !publicPath) {
      const loginUrl = url.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", path + (url.search || ""));

      const redirectRes = NextResponse.redirect(loginUrl);
      cookiesToApply.forEach(({ name, value, options }) =>
        redirectRes.cookies.set(name, value, options)
      );
      return redirectRes;
    }

    return res;
  }

  // --- 4) DynEdu guard (Supabase Auth) ---
  const dyneduArea = isDyneduPath(path) || hostname.startsWith("intranet.");
  const isDyneduLogin = isDyneduLoginPath(path);

  if (dyneduArea && !user && !publicPath && !isDyneduLogin) {
    const loginUrl = url.clone();
    loginUrl.pathname = "/dynedu";
    loginUrl.searchParams.set("next", path + (url.search || ""));

    const redirectRes = NextResponse.redirect(loginUrl);
    cookiesToApply.forEach(({ name, value, options }) =>
      redirectRes.cookies.set(name, value, options)
    );
    return redirectRes;
  }

  // --- 5) Portal Colegios guard (cookie propia: portal_colegio_id) ---
  const portalArea = isPortalColegiosPath(path) || hostname.startsWith("colegios.");
  const isPortalLogin = isPortalColegiosLoginPath(path);

  const portalSession = req.cookies.get(PORTAL_COLEGIO_COOKIE)?.value;
  const hasPortalSession = Boolean(portalSession);

  if (portalArea && !hasPortalSession && !publicPath && !isPortalLogin) {
    const loginUrl = url.clone();
    loginUrl.pathname = "/portal-colegios";
    loginUrl.searchParams.set("next", path + (url.search || ""));

    return NextResponse.redirect(loginUrl);
  }

  return res;
}
