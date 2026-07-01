import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

// GET entire payment cost history
export async function GET(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const serviceId = searchParams.get("serviceId");

    const db = getDb();
    let query = `
      SELECT h.*, s.type as service_type, s.provider as service_provider
      FROM cost_history h
      LEFT JOIN services s ON h.service_id = s.id
    `;
    const params = [];

    if (serviceId) {
      query += " WHERE h.service_id = ?";
      params.push(serviceId);
    }

    query += " ORDER BY h.payment_date DESC, h.id DESC";

    const history = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, history });
  } catch (error: any) {
    console.error("History GET Error:", error);
    return NextResponse.json({ success: false, message: "Ödeme geçmişi yüklenirken hata oluştu." }, { status: 500 });
  }
}

// POST manual payment record for historical accuracy
export async function POST(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { service_id, service_name, cost, currency, payment_date, notes } = await req.json();

    if (!service_name || cost === undefined || cost === null || !payment_date) {
      return NextResponse.json({ success: false, message: "Lütfen tüm gerekli alanları doldurun." }, { status: 400 });
    }

    const db = getDb();

    const insertStmt = db.prepare(`
      INSERT INTO cost_history (service_id, service_name, cost, currency, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      service_id || null,
      service_name,
      Number(cost),
      currency || "TRY",
      payment_date,
      notes || ""
    );

    return NextResponse.json({ success: true, message: "Ödeme geçmişi kaydı başarıyla eklendi." });
  } catch (error: any) {
    console.error("History POST Error:", error);
    return NextResponse.json({ success: false, message: "Ödeme kaydı eklenirken hata oluştu." }, { status: 500 });
  }
}
