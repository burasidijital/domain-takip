import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const authenticated = isAuthenticated(req);
    
    if (authenticated) {
      return NextResponse.json({
        authenticated: true,
        username: "admin",
      });
    }

    return NextResponse.json(
      { authenticated: false },
      { status: 401 }
    );
  } catch (error) {
    return NextResponse.json(
      { authenticated: false, message: "Sunucu hatası" },
      { status: 500 }
    );
  }
}
