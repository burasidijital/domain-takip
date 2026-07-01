import { NextRequest, NextResponse } from "next/server";
import { getDb, updateServiceStatuses } from "@/lib/db";
import { isAuthenticated } from "@/lib/auth";

// Expose simple currency conversion rates for unified reporting
const EX_RATES: { [key: string]: number } = {
  TRY: 1.0,
  USD: 33.0,
  EUR: 35.0,
  GBP: 42.0,
};

function convertToTry(amount: number, currency: string): number {
  const rate = EX_RATES[currency.toUpperCase()] || 1.0;
  return amount * rate;
}

export async function GET(req: NextRequest) {
  try {
    const isAuth = isAuthenticated(req);
    if (!isAuth) {
      return NextResponse.json({ success: false, message: "Yetkisiz işlem!" }, { status: 401 });
    }

    const db = getDb();
    
    // Live refresh status variables before aggregating
    updateServiceStatuses(db);

    // 1. Core aggregations (Total Counts)
    const totalServicesCount = db.prepare("SELECT count(*) as count FROM services").get() as { count: number };
    const typeCounts = db.prepare("SELECT type, count(*) as count FROM services GROUP BY type").all() as { type: string; count: number }[];
    const statusCounts = db.prepare("SELECT status, count(*) as count FROM services GROUP BY status").all() as { status: string; count: number }[];

    // 2. Aggregate active costs
    const activeServices = db.prepare("SELECT cost, currency, type FROM services WHERE status != 'suresi_dolmus'").all() as { cost: number; currency: string; type: string }[];
    
    let totalAnnualCostTry = 0;
    const costByTypeTry: { [key: string]: number } = { mail: 0, sunucu: 0, domain: 0, diger: 0 };

    for (const service of activeServices) {
      // Assume services are priced annually. If the user prices them, we sum.
      // Let's standardly treat these as annual run-rate costs.
      const costInTry = convertToTry(service.cost, service.currency || "TRY");
      totalAnnualCostTry += costInTry;
      
      const category = service.type || "diger";
      costByTypeTry[category] = (costByTypeTry[category] || 0) + costInTry;
    }

    // 3. Expiry Warning List (Expiring within 30 days, or Expired)
    const criticalServices = db.prepare(`
      SELECT id, name, type, provider, expiry_date, status, cost, currency 
      FROM services 
      WHERE status IN ('yaklasiyor', 'suresi_dolmus') 
      ORDER BY expiry_date ASC
    `).all();

    // 4. Monthly spending history (from payments table)
    const rawHistory = db.prepare(`
      SELECT payment_date, cost, currency 
      FROM cost_history 
      ORDER BY payment_date ASC
    `).all() as { payment_date: string; cost: number; currency: string }[];

    // Group history by month (Y-M)
    const monthlySpendingMap: { [key: string]: number } = {};
    for (const h of rawHistory) {
      if (!h.payment_date) continue;
      const monthKey = h.payment_date.substring(0, 7); // "YYYY-MM"
      const tryCost = convertToTry(h.cost, h.currency || "TRY");
      monthlySpendingMap[monthKey] = (monthlySpendingMap[monthKey] || 0) + tryCost;
    }

    // Generate chronological monthly points array for charting
    const monthlyTimeline = Object.entries(monthlySpendingMap).map(([month, total]) => ({
      month, // "YYYY-MM"
      total: Math.round(total),
    })).sort((a, b) => a.month.localeCompare(b.month));

    // 5. Vendor spending (Top spent providers)
    const vendorMap: { [key: string]: number } = {};
    const servicesForVendors = db.prepare("SELECT provider, cost, currency FROM services").all() as { provider: string | null; cost: number; currency: string }[];
    for (const s of servicesForVendors) {
      const p = s.provider || "Bilinmeyen Firma";
      const tryVal = convertToTry(s.cost, s.currency);
      vendorMap[p] = (vendorMap[p] || 0) + tryVal;
    }
    const vendorProportions = Object.entries(vendorMap)
      .map(([name, total]) => ({ name, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);

    return NextResponse.json({
      success: true,
      summary: {
        totalCount: totalServicesCount.count,
        annualRunRateTry: Math.round(totalAnnualCostTry),
        monthlyRunRateTry: Math.round(totalAnnualCostTry / 12),
        currenciesUsed: ["TRY", "USD", "EUR", "GBP"],
        exchangeRates: EX_RATES
      },
      typeDistribution: typeCounts,
      statusDistribution: statusCounts,
      costByCategoryTry: costByTypeTry,
      criticalServices,
      spendingTimeline: monthlyTimeline,
      topVendors: vendorProportions,
    });

  } catch (error: any) {
    console.error("Analysis GET Error:", error);
    return NextResponse.json({ success: false, message: "Sunucu hatası oluştu." }, { status: 500 });
  }
}
