import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ success: true, message: "Çıkış yapıldı." });
  
  // Clear cookie
  response.cookies.set("session_token", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}
