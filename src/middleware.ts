import { getKindeServerSession } from "@kinde-oss/kinde-auth-nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { LOGIN, PROTECTED_SUB_ROUTE, PUBLIC_ROUTES, ROOT } from "./lib/routes";

const { getUser } = getKindeServerSession();

export async function middleware(req: NextRequest) {
  const { nextUrl } = req;

  const user = await getUser();

  const isAuthenticated = !!user;

  if (!isAuthenticated) {
    return NextResponse.redirect(new URL(LOGIN, nextUrl));
  }
}

export const config = {
  matcher: ["/dashboard/:path*", "/auth-callback"],
};
