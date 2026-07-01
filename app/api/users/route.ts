import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

// GET: Retrieve list of all users
export async function GET(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const db = getDb();
    const users = db.prepare("SELECT id, username, created_at FROM users ORDER BY username ASC").all();

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("Users GET Error:", error);
    return NextResponse.json({ success: false, message: "Kullanıcılar yüklenirken hata oluştu." }, { status: 500 });
  }
}

// POST: Create a new user
export async function POST(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: "Lütfen kullanıcı adı ve şifre girin." }, { status: 400 });
    }

    const trimmedUsername = username.trim().toLowerCase();
    if (trimmedUsername.length < 3) {
      return NextResponse.json({ success: false, message: "Kullanıcı adı en az 3 karakter olmalıdır." }, { status: 400 });
    }

    if (password.length < 4) {
      return NextResponse.json({ success: false, message: "Şifre en az 4 karakter olmalıdır." }, { status: 400 });
    }

    const db = getDb();

    // Check duplicate username
    const exists = db.prepare("SELECT id FROM users WHERE username = ?").get(trimmedUsername);
    if (exists) {
      return NextResponse.json({ success: false, message: "Bu kullanıcı adı zaten kullanımda." }, { status: 400 });
    }

    // Insert user
    db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(trimmedUsername, password);

    return NextResponse.json({ success: true, message: "Kullanıcı başarıyla oluşturuldu." });
  } catch (error: any) {
    console.error("Users POST Error:", error);
    return NextResponse.json({ success: false, message: "Kullanıcı eklenirken sunucu hatası oluştu." }, { status: 500 });
  }
}

// PUT: Update an existing user (username and/or password)
export async function PUT(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { id, username, password } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, message: "Kullanıcı ID gereklidir." }, { status: 400 });
    }

    const trimmedUsername = username?.trim().toLowerCase();
    if (trimmedUsername && trimmedUsername.length < 3) {
      return NextResponse.json({ success: false, message: "Kullanıcı adı en az 3 karakter olmalıdır." }, { status: 400 });
    }

    const db = getDb();

    // Verify user exists
    const user = db.prepare("SELECT id, username FROM users WHERE id = ?").get(id) as any;
    if (!user) {
      return NextResponse.json({ success: false, message: "Kullanıcı bulunamadı." }, { status: 404 });
    }

    // Check duplicate username if changed
    if (trimmedUsername && trimmedUsername !== user.username) {
      const exists = db.prepare("SELECT id FROM users WHERE username = ? AND id != ?").get(trimmedUsername, id);
      if (exists) {
        return NextResponse.json({ success: false, message: "Bu kullanıcı adı başka bir kullanıcı tarafından kullanılıyor." }, { status: 400 });
      }
    }

    // Update query
    if (password && password.trim().length > 0) {
      if (password.trim().length < 4) {
        return NextResponse.json({ success: false, message: "Şifre en az 4 karakter olmalıdır." }, { status: 400 });
      }
      db.prepare("UPDATE users SET username = ?, password = ? WHERE id = ?").run(trimmedUsername || user.username, password, id);
    } else {
      db.prepare("UPDATE users SET username = ? WHERE id = ?").run(trimmedUsername || user.username, id);
    }

    return NextResponse.json({ success: true, message: "Kullanıcı başarıyla güncellendi." });
  } catch (error: any) {
    console.error("Users PUT Error:", error);
    return NextResponse.json({ success: false, message: "Kullanıcı güncellenirken sunucu hatası oluştu." }, { status: 500 });
  }
}

// DELETE: Delete a user
export async function DELETE(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, message: "Kullanıcı ID gereklidir." }, { status: 400 });
    }

    const db = getDb();

    // Check total users count to prevent locking out
    const userCountResult = db.prepare("SELECT count(*) as count FROM users").get() as { count: number };
    if (userCountResult.count <= 1) {
      return NextResponse.json({ success: false, message: "Sistemde en az bir kullanıcı kalmalıdır. Son kullanıcıyı silemezsiniz!" }, { status: 400 });
    }

    // Perform deletion
    db.prepare("DELETE FROM users WHERE id = ?").run(id);

    return NextResponse.json({ success: true, message: "Kullanıcı silindi." });
  } catch (error: any) {
    console.error("Users DELETE Error:", error);
    return NextResponse.json({ success: false, message: "Kullanıcı silinirken sunucu hatası oluştu." }, { status: 500 });
  }
}
