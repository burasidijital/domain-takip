import { NextRequest, NextResponse } from "next/server";
import { getDb, updateServiceStatuses } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";
import * as XLSX from "xlsx";

function parseExcelDate(val: any): string {
  if (!val) return "";
  
  // 1. If it is already a serialized float/number (excel serial date format)
  if (typeof val === "number") {
    try {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      return date.toISOString().split("T")[0];
    } catch (e) {
      // fallback
    }
  }

  const str = String(val).trim();
  if (!str) return "";

  // 2. Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // 3. Turkish formats e.g. "DD.MM.YYYY" or "DD/MM/YYYY" or "DD-MM-YYYY"
  const parts = str.split(/[./-]/);
  if (parts.length === 3) {
    const p0 = parts[0].trim();
    const p1 = parts[1].trim();
    const p2 = parts[2].trim();
    
    // Day.Month.Year
    if (p0.length <= 2 && p1.length <= 2 && p2.length === 4) {
      return `${p2}-${p1.padStart(2, "0")}-${p0.padStart(2, "0")}`;
    }
    // Year.Month.Day
    if (p0.length === 4 && p1.length <= 2 && p2.length <= 2) {
      return `${p0}-${p1.padStart(2, "0")}-${p2.padStart(2, "0")}`;
    }
  }

  // 4. Default JS Date Parser fallback
  try {
    const parsed = Date.parse(str);
    if (!isNaN(parsed)) {
      return new Date(parsed).toISOString().split("T")[0];
    }
  } catch (e) {
    // fallback empty
  }

  return "";
}

// Map various potential localized column headers to target model properties
function findValueByHeaders(row: any, targetKeys: string[]): any {
  for (const key of Object.keys(row)) {
    const normalizedKey = key.trim().toLowerCase()
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/\s+/g, "");

    for (const target of targetKeys) {
      if (normalizedKey === target || normalizedKey.includes(target)) {
        return row[key];
      }
    }
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return NextResponse.json({ success: false, message: "Lütfen bir dosya yükleyin." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

    if (!jsonData || jsonData.length === 0) {
      return NextResponse.json({ success: false, message: "Dosya içeriği boş veya geçersiz format." }, { status: 400 });
    }

    const db = getDb();
    
    // Begin raw transaction to ensure all-or-nothing database integrity
    const insertService = db.prepare(`
      INSERT INTO services (name, type, provider, expiry_date, cost, currency, notes, domain, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertHistory = db.prepare(`
      INSERT INTO cost_history (service_id, service_name, cost, currency, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let importedCount = 0;
    const todayStr = new Date().toISOString().split("T")[0];

    // Wrap in direct transaction to keep DB intact in case of parse fails
    const runTransaction = db.transaction(() => {
      for (const row of jsonData) {
        // Resolve headers
        const nameVal = findValueByHeaders(row, ["hizmetadi", "hizmetad", "servicename", "name", "hizmet", "baslik"]);
        const typeRaw = findValueByHeaders(row, ["hizmetturu", "turu", "type", "tur", "kategori"]);
        const providerVal = findValueByHeaders(row, ["saglayici", "firma", "provider", "vendor", "ureten"]);
        const expiryRaw = findValueByHeaders(row, ["sonkullanmatarihi", "expirydate", "expiry", "sontarih", "expiration", "bitistarihi"]);
        const costVal = findValueByHeaders(row, ["ucret", "tutar", "cost", "price", "ucrettutar", "fiyat"]);
        const currencyVal = findValueByHeaders(row, ["parabirimi", "currency", "doviz", "birim"]);
        const domainVal = findValueByHeaders(row, ["domain", "websitesi", "website", "url", "alanadi"]);
        const notesVal = findValueByHeaders(row, ["ozelnotlar", "notlar", "not", "notes", "aciklama"]);

        // Skip rows that lack basic identifiers
        if (!nameVal) continue;

        const name = String(nameVal).trim();
        
        // Match types
        let type = "diger";
        const typeStr = String(typeRaw || "").toLowerCase();
        if (typeStr.includes("mail") || typeStr.includes("posta")) {
          type = "mail";
        } else if (typeStr.includes("sunucu") || typeStr.includes("server") || typeStr.includes("host")) {
          type = "sunucu";
        } else if (typeStr.includes("domain") || typeStr.includes("alan") || typeStr.includes("web")) {
          type = "domain";
        } else {
          type = "diger";
        }

        const expiry_date = parseExcelDate(expiryRaw) || todayStr;
        const provider = providerVal ? String(providerVal).trim() : "";
        const cost = costVal ? Number(costVal) : 0;
        let currency = currencyVal ? String(currencyVal).trim().toUpperCase() : "TRY";
        if (!["TRY", "USD", "EUR", "GBP"].includes(currency)) {
          currency = "TRY";
        }
        const domain = domainVal ? String(domainVal).trim() : "";
        const notes = notesVal ? String(notesVal).trim() : "";

        // Status determination
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

        const res = insertService.run(
          name,
          type,
          provider,
          expiry_date,
          cost,
          currency,
          notes,
          domain,
          status
        );

        // Record initial imported payment log
        insertHistory.run(
          res.lastInsertRowid,
          name,
          cost,
          currency,
          todayStr,
          "Excel içe aktarma ile otomatik oluşturulan ödeme kaydı."
        );

        importedCount++;
      }
    });

    runTransaction();
    updateServiceStatuses(db);

    return NextResponse.json({
      success: true,
      message: `${importedCount} adet hizmet başarıyla içe aktarıldı ve ödeme geçmişleri oluşturuldu.`,
      importedCount
    });

  } catch (error: any) {
    console.error("Excel Import POST Error:", error);
    return NextResponse.json({ success: false, message: `İçe aktarma hatası: ${error.message || "Bilinmeyen hata"}` }, { status: 500 });
  }
}
