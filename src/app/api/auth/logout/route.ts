import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const session = await getSession();
  session.destroy();
  const res = NextResponse.redirect(new URL("/", request.url), 303);
  // Clear all site data on logout — defense-in-depth for PHI
  res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
  return res;
}
