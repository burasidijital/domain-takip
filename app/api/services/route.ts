import { NextRequest, NextResponse } from "next/server";
import { getDb, updateServiceStatuses } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

// GET all services (with optional query filter and live date validation)
export async function GET(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filterType = searchParams.get("type"); // mail, sunucu, domain, diger
    const filterStatus = searchParams.get("status"); // aktif, yaklasiyor, suresi_dolmus
    const searchQuery = searchParams.get("search");

    const db = getDb();
    
    // Live update statuses in db before fetching
    updateServiceStatuses(db);

    let query = "SELECT * FROM services WHERE 1=1";
    const params: any[] = [];

    if (filterType) {
      query += " AND type = ?";
      params.push(filterType);
    }

    if (filterStatus) {
      query += " AND status = ?";
      params.push(filterStatus);
    }

    if (searchQuery) {
      query += " AND (name LIKE ? OR provider LIKE ? OR domain LIKE ? OR notes LIKE ?)";
      const likeVal = `%${searchQuery}%`;
      params.push(likeVal, likeVal, likeVal, likeVal);
    }

    // Sort by service expiry date (soonest first)
    query += " ORDER BY expiry_date ASC, name ASC";

    const services = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, services });
  } catch (error: any) {
    console.error("Services GET Error:", error);
    return NextResponse.json({ success: false, message: "Veriler yüklenirken hata oluştu." }, { status: 500 });
  }
}

// POST: Add new service & log initial payment history
export async function POST(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { name, type, provider, expiry_date, cost, currency, notes, domain } = await req.json();

    if (!name || !type || !expiry_date || cost === undefined || cost === null) {
      return NextResponse.json({ success: false, message: "Lütfen gerekli alanları doldurun." }, { status: 400 });
    }

    const db = getDb();

    // Insert service
    const insertStmt = db.prepare(`
      INSERT INTO services (name, type, provider, expiry_date, cost, currency, notes, domain, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Determine initial status based on expiry_date from input
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiry_date);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = "aktif";
    if (diffDays < 0) {
      status = "suresi_dolmus";
    } else if (diffDays <= 30) {
      status = "yaklasiyor";
    }

    const result = insertStmt.run(
      name,
      type,
      provider || "",
      expiry_date,
      Number(cost),
      currency || "TRY",
      notes || "",
      domain || "",
      status
    );

    const serviceId = result.lastInsertRowid;

    // Log the initial payment in history as the first log entry
    const insertHistory = db.prepare(`
      INSERT INTO cost_history (service_id, service_name, cost, currency, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertHistory.run(
      serviceId,
      name,
      Number(cost),
      currency || "TRY",
      today.toISOString().split("T")[0],
      `${name} hizmet kaydı ile oluşan ilk ödeme girdisi.`
    );

    return NextResponse.json({
      success: true,
      message: "Hizmet başarıyla eklendi ve ilk ödemesi geçmişe kaydedildi.",
      serviceId
    });
  } catch (error: any) {
    console.error("Services POST Error:", error);
    return NextResponse.json({ success: false, message: "Hizmet eklenirken hata oluştu." }, { status: 500 });
  }
}
