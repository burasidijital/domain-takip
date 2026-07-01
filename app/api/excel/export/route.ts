import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const db = getDb();
    
    // Fetch all services
    const services = db.prepare("SELECT * FROM services ORDER BY expiry_date ASC").all() as any[];

    // Map database structures to clean, localized spreadsheet rows
    const excelRows = services.map((s, idx) => ({
      "Sıra No": idx + 1,
      "Hizmet Adı": s.name || "",
      "Hizmet Türü": (s.type === "mail" ? "E-Posta (Mail)" : s.type === "sunucu" ? "Sunucu (Server)" : s.type === "domain" ? "Alan Adı (Domain)" : "Diğer Hizmet"),
      "Sağlayıcı / Firma": s.provider || "",
      "Son Kullanma Tarihi": s.expiry_date || "",
      "Ücret (Tutar)": s.cost || 0,
      "Para Birimi": s.currency || "TRY",
      "Durum": (s.status === "aktif" ? "Aktif (Güvenli)" : s.status === "yaklasiyor" ? "Yenileme Yaklaşıyor (< 30 Gün)" : "Süresi Dolmuş"),
      "İlişkili Domain": s.domain || "",
      "Özel Notlar": s.notes || "",
      "Sisteme Eklenme Tarihi": s.created_at || ""
    }));

    // Generate XLSX workbook & worksheet
    const worksheet = XLSX.utils.json_to_sheet(excelRows);
    
    // Configure visual column widths for optimal spacing
    const colWidths = [
      { wch: 8 },  // Sıra No
      { wch: 25 }, // Hizmet Adı
      { wch: 18 }, // Hizmet Türü
      { wch: 20 }, // Sağlayıcı / Firma
      { wch: 20 }, // Son Kullanma Tarihi
      { wch: 15 }, // Ücret (Tutar)
      { wch: 12 }, // Para Birimi
      { wch: 25 }, // Durum
      { wch: 22 }, // İlişkili Domain
      { wch: 30 }, // Özel Notlar
      { wch: 22 }  // Sisteme Eklenme Tarihi
    ];
    worksheet["!cols"] = colWidths;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Aktif Hizmet Takip Listesi");

    // Write workbook to buffer
    const buf = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

    // Set elegant disposition attachment content and steam binary
    const dateStr = new Date().toISOString().split("T")[0];
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename=hizmet_takip_raporu_${dateStr}.xlsx`,
      },
    });

  } catch (error: any) {
    console.error("Excel Export GET Error:", error);
    return NextResponse.json({ success: false, message: "Excel belgesi oluşturulurken hata oluştu." }, { status: 500 });
  }
}
