import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase();
  const url = req.nextUrl;

  // Dominio raíz (public)
  if (hostname === "lcsofttestings.xyz" || hostname === "www.lcsofttestings.xyz") {
    return NextResponse.next();
  }

  // colegios -> /portal-colegios
  if (hostname.startsWith("colegios.")) {
    if (!url.pathname.startsWith("/portal-colegios")) {
      const rewriteUrl = url.clone();
      rewriteUrl.pathname = `/portal-colegios${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(rewriteUrl);
    }
    return NextResponse.next();
  }

  // intranet -> /dynedu
  if (hostname.startsWith("intranet.")) {
    if (!url.pathname.startsWith("/dynedu")) {
      const rewriteUrl = url.clone();
      rewriteUrl.pathname = `/dynedu${url.pathname === "/" ? "" : url.pathname}`;
      return NextResponse.rewrite(rewriteUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}
