import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getSessionToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, message: "Kullanıcı adı ve şifre gereklidir." },
        { status: 400 }
      );
    }

    const db = getDb();
    
    // Find user in SQLite DB
    const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;

    if (!user || user.password !== password) {
      return NextResponse.json(
        { success: false, message: "Hatalı kullanıcı adı veya şifre!" },
        { status: 401 }
      );
    }

    const token = getSessionToken();
    const response = NextResponse.json({
      success: true,
      message: "Giriş başarılı.",
      token: token,
      username: user.username,
    });

    // Set cookie (HTTP-Only, Secure, SameSite Lax)
    response.cookies.set("session_token", token, {
      path: "/",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24, // 24 hours
      sameSite: "lax",
    });

    return response;
  } catch (error: any) {
    console.error("Login API Error:", error);
    return NextResponse.json(
      { success: false, message: "Sunucu hatası oluştu." },
      { status: 500 }
    );
  }
}
