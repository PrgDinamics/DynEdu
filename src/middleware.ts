import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

function isDyneduLoginPath(pathname: string) {
  return pathname === "/dynedu" || pathname === "/dynedu/";
}

function isPortalColegiosLoginPath(pathname: string) {
  return pathname === "/portal-colegios" || pathname === "/portal-colegios/";
}

function isPublicPath(pathname: string) {
  // Public auth (compras)
  if (pathname.startsWith("/auth")) return true;

  // ✅ DynEdu + Portal login pages must be public
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
  // Public site protected pages (buyer session)
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

function needsSchoolRegistryPermission(pathname: string) {
  // exact module route (and any nested)
  return pathname.startsWith("/dynedu/settings/usuario-colegio");
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const url = req.nextUrl;

  // --- 1) Decide response base (rewrite/next) ---
  let res: NextResponse;

  const isRootDomain =
    hostname === "dynamiceducationperu.com" || hostname === "www.dynamiceducationperu.com";

  // Root domain (public)
  if (isRootDomain) {
    res = NextResponse.next();
  }
  // colegios -> /portal-colegios
  else if (hostname.startsWith("colegios.")) {
    if (!url.pathname.startsWith("/portal-colegios")) {
      const rewriteUrl = url.clone();
      rewriteUrl.pathname = `/portal-colegios${url.pathname === "/" ? "" : url.pathname}`;
      res = NextResponse.rewrite(rewriteUrl);
    } else {
      res = NextResponse.next();
    }
  }
  // intranet -> /dynedu
  else if (hostname.startsWith("intranet.")) {
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

  // --- 2) Supabase SSR: capture cookies to apply to any response ---
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

  // --- 3) Auth guard: root-domain protected pages (buyer) ---
  if (isRootDomain) {
    const protectedPath = isProtectedRootPath(path);

    if (protectedPath && !user && !publicPath) {
      const loginUrl = url.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", path + (url.search || ""));

      const redirectRes = NextResponse.redirect(loginUrl);
      cookiesToApply.forEach(({ name, value, options }) => redirectRes.cookies.set(name, value, options));
      return redirectRes;
    }

    return res;
  }

  // --- 4) Auth guard: DynEdu + Portal (localhost + subdomains) ---
  const dyneduArea = isDyneduPath(path) || hostname.startsWith("intranet.");
  const portalArea = isPortalColegiosPath(path) || hostname.startsWith("colegios.");

  // ✅ Allow DynEdu & Portal login pages to render even without user
  const isDyneduLogin = isDyneduLoginPath(path);
  const isPortalLogin = isPortalColegiosLoginPath(path);

  // If user not logged in and trying to access protected dynedu/portal content:
  if (!user && !publicPath) {
    if (dyneduArea && !isDyneduLogin) {
      const loginUrl = url.clone();
      // ✅ DynEdu login page is /dynedu (not /auth/login)
      loginUrl.pathname = "/dynedu";
      loginUrl.searchParams.set("next", path + (url.search || ""));

      const redirectRes = NextResponse.redirect(loginUrl);
      cookiesToApply.forEach(({ name, value, options }) => redirectRes.cookies.set(name, value, options));
      return redirectRes;
    }

    if (portalArea && !isPortalLogin) {
      const loginUrl = url.clone();
      // ✅ Portal login page is /portal-colegios
      loginUrl.pathname = "/portal-colegios";
      loginUrl.searchParams.set("next", path + (url.search || ""));

      const redirectRes = NextResponse.redirect(loginUrl);
      cookiesToApply.forEach(({ name, value, options }) => redirectRes.cookies.set(name, value, options));
      return redirectRes;
    }
  }

  // --- 5) Permission guard: Registro Colegio (DynEdu) ---
  if (dyneduArea && user && needsSchoolRegistryPermission(path)) {
    const { data: appUser, error } = await supabase
      .from("app_users")
      .select("id,email, role:app_roles(permissions)")
      .eq("email", user.email ?? "")
      .maybeSingle();

    const permissions = (appUser as any)?.role?.permissions ?? null;
    const allowed = permissions?.canManageSchoolRegistry === true;

    if (error || !allowed) {
      const redirectUrl = url.clone();
      redirectUrl.pathname = "/dynedu/dashboard";
      redirectUrl.searchParams.set("error", "forbidden");

      const redirectRes = NextResponse.redirect(redirectUrl);
      cookiesToApply.forEach(({ name, value, options }) => redirectRes.cookies.set(name, value, options));
      return redirectRes;
    }
  }

  return res;
}
