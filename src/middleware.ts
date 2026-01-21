import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};

function isPublicPath(pathname: string) {
  // público: auth pages y páginas públicas
  if (pathname.startsWith("/auth")) return true;
  if (pathname === "/") return true;
  if (pathname.startsWith("/libros")) return true;
  if (pathname.startsWith("/carrito")) return true;
  if (pathname.startsWith("/contacto")) return true;
  if (pathname.startsWith("/nosotros")) return true;
  if (pathname.startsWith("/libro-de-reclamaciones")) return true;
  return false;
}

function isProtectedRootPath(pathname: string) {
  // ✅ protegidas en dominio principal
  if (pathname.startsWith("/checkout")) return true;
  if (pathname.startsWith("/perfil")) return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const url = req.nextUrl;

  // --- 1) Decide response base (rewrite/next) ---
  let res: NextResponse;

  // Root domain (public)
  if (hostname === "dynamiceducationperu.com" || hostname === "www.dynamiceducationperu.com") {
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

  // --- 2) Supabase SSR: capture cookies to apply to any response (next/redirect/rewrite) ---
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

  // Esto refresca sesión si hace falta (y setea cookies via setAll)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- 3) Auth guard SOLO en dominio principal (root) ---
  const isRoot =
    hostname === "dynamiceducationperu.com" || hostname === "www.dynamiceducationperu.com";

  if (isRoot) {
    const path = url.pathname;

    const protectedPath = isProtectedRootPath(path);
    const publicPath = isPublicPath(path);

    if (protectedPath && !user && !publicPath) {
      const loginUrl = url.clone();
      loginUrl.pathname = "/auth/login";
      loginUrl.searchParams.set("next", path + (url.search || ""));

      const redirectRes = NextResponse.redirect(loginUrl);

      // aplica cookies también al redirect (por si Supabase refrescó)
      cookiesToApply.forEach(({ name, value, options }) => {
        redirectRes.cookies.set(name, value, options);
      });

      return redirectRes;
    }
  }

  return res;
}
