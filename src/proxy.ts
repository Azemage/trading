import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith("/manager")) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
    if (session.user.role !== "MANAGER") {
      return NextResponse.redirect(new URL("/client", req.url));
    }
  }

  if (pathname.startsWith("/client")) {
    if (!session) return NextResponse.redirect(new URL("/login", req.url));
  }
});

export const config = {
  matcher: ["/manager/:path*", "/client/:path*"],
};
