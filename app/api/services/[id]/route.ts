import { NextRequest, NextResponse } from "next/server";
import { getDb, updateServiceStatuses } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

type ParamsObj = { id: string };

// GET detailed service and its associated payment history logs
export async function GET(req: NextRequest, props: { params: Promise<ParamsObj> }) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { id } = await props.params;
    const db = getDb();
    
    // Fetch the service
    const service = db.prepare("SELECT * FROM services WHERE id = ?").get(id);
    if (!service) {
      return NextResponse.json({ success: false, message: "Hizmet bulunamadı." }, { status: 404 });
    }

    // Fetch its cost history log entries
    const history = db.prepare("SELECT * FROM cost_history WHERE service_id = ? ORDER BY payment_date DESC").all(id);

    return NextResponse.json({ success: true, service, history });
  } catch (error: any) {
    console.error("Service GET Detail Error:", error);
    return NextResponse.json({ success: false, message: "Sunucu hatası oluştu." }, { status: 500 });
  }
}

// PUT: Update service content, and record a cost log if payment details change
export async function PUT(req: NextRequest, props: { params: Promise<ParamsObj> }) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { id } = await props.params;
    const body = await req.json();
    const { name, type, provider, expiry_date, cost, currency, notes, domain, log_new_payment } = body;

    if (!name || !type || !expiry_date || cost === undefined || cost === null) {
      return NextResponse.json({ success: false, message: "Lütfen gerekli alanları doldurun." }, { status: 400 });
    }

    const db = getDb();

    // Check old values to verify cost changes
    const oldService = db.prepare("SELECT cost, currency, name FROM services WHERE id = ?").get(id) as any;
    if (!oldService) {
      return NextResponse.json({ success: false, message: "Hizmet bulunamadı." }, { status: 404 });
    }

    // Update service record
    const updateStmt = db.prepare(`
      UPDATE services
      SET name = ?, type = ?, provider = ?, expiry_date = ?, cost = ?, currency = ?, notes = ?, domain = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    updateStmt.run(name, type, provider || "", expiry_date, Number(cost), currency || "TRY", notes || "", domain || "", id);

    // Live update status
    updateServiceStatuses(db);

    // If costs changed OR user specifically requested to record a payment history event:
    const finalCost = Number(cost);
    const finalCurrency = currency || "TRY";

    const costChanged = oldService.cost !== finalCost || oldService.currency !== finalCurrency;

    if (log_new_payment || costChanged) {
      const today = new Date().toISOString().split("T")[0];
      const insertHistory = db.prepare(`
        INSERT INTO cost_history (service_id, service_name, cost, currency, payment_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      let noteStr = `Fiyat Güncellemesi: Eski fiyatı (${oldService.cost} ${oldService.currency}) iken, yeni fiyatı (${finalCost} ${finalCurrency}) olarak güncellendi.`;
      if (log_new_payment) {
        noteStr = `Zamanlanmış veya Manuel Ödeme: ${finalCost} ${finalCurrency} tutarında yenileme ödemesi gerçekleşti.`;
      }

      insertHistory.run(id, name, finalCost, finalCurrency, today, noteStr);
    }

    return NextResponse.json({ success: true, message: "Hizmet başarıyla güncellendi." });
  } catch (error: any) {
    console.error("Service PUT Error:", error);
    return NextResponse.json({ success: false, message: "Sunucu hatası oluştu." }, { status: 500 });
  }
}

// DELETE: Delete a service (cascades on payment log references)
export async function DELETE(req: NextRequest, props: { params: Promise<ParamsObj> }) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const { id } = await props.params;
    const db = getDb();

    // Verify service exists
    const serviceExists = db.prepare("SELECT id FROM services WHERE id = ?").get(id);
    if (!serviceExists) {
      return NextResponse.json({ success: false, message: "Hizmet bulunamadı." }, { status: 404 });
    }

    // Cost history remains but service_id becomes null (thanks to ON DELETE SET NULL)
    // Wait, let's keep database neat. If the user wants, the database deletes service and foreign keys trigger.
    db.prepare("DELETE FROM services WHERE id = ?").run(id);

    return NextResponse.json({ success: true, message: "Hizmet başarıyla silindi. Geçmiş ödemeler analiz için korunuyor." });
  } catch (error: any) {
    console.error("Service DELETE Error:", error);
    return NextResponse.json({ success: false, message: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
