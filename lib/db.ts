import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

// Define the database path (writable in dev and production containers)
const DB_PATH = path.join(process.cwd(), "hizmet_takip.db");

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure database directory or file exists and is accessible
  dbInstance = new Database(DB_PATH, { verbose: console.log });

  // Enable foreign keys
  dbInstance.pragma("foreign_keys = ON");

  // Create tables if they do not exist
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'mail', 'sunucu', 'domain', 'diger'
      provider TEXT, -- Firma
      expiry_date TEXT NOT NULL, -- YYYY-MM-DD
      cost REAL NOT NULL,
      currency TEXT DEFAULT 'TRY', -- 'TRY', 'USD', 'EUR', 'GBP'
      status TEXT DEFAULT 'aktif', -- 'aktif', 'yaklasiyor', 'suresi_dolmus'
      notes TEXT,
      domain TEXT, -- Ilişkili web sitesi / alan adi
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cost_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      service_id INTEGER,
      service_name TEXT NOT NULL,
      cost REAL NOT NULL,
      currency TEXT DEFAULT 'TRY',
      payment_date TEXT NOT NULL, -- YYYY-MM-DD
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(service_id) REFERENCES services(id) ON DELETE SET NULL
    );
  `);

  // Seed default admin if not exists
  const userCheck = dbInstance.prepare("SELECT count(*) as count FROM users").get() as { count: number };
  if (userCheck.count === 0) {
    dbInstance.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run("admin", "admin123");
  }

  // Seed default high-quality services for demo/first-run
  const serviceCheck = dbInstance.prepare("SELECT count(*) as count FROM services").get() as { count: number };
  if (serviceCheck.count === 0) {
    // Current date calculations for mock durations
    const today = new Date();
    
    // 1. A domain that is safe (expires 1 year from now)
    const futureDate1 = new Date();
    futureDate1.setFullYear(today.getFullYear() + 1);
    const domainExpiry = futureDate1.toISOString().split("T")[0];

    // 2. A server expiring in 12 days (critical alert/yaklaşan)
    const futureDate2 = new Date();
    futureDate2.setDate(today.getDate() + 12);
    const serverExpiry = futureDate2.toISOString().split("T")[0];

    // 3. A mail service that expired 5 days ago (expired alert/süresi dolmuş)
    const pastDate = new Date();
    pastDate.setDate(today.getDate() - 5);
    const mailExpiry = pastDate.toISOString().split("T")[0];

    // Insert dummy entries (represented structured, clean Turkish services)
    const insertService = dbInstance.prepare(`
      INSERT INTO services (name, type, provider, expiry_date, cost, currency, status, notes, domain)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Insert service 1
    const s1 = insertService.run(
      "Kurumsal Domain Kaydı",
      "domain",
      "GoDaddy TR",
      domainExpiry,
      450.00,
      "TRY",
      "aktif",
      "Şirket ana web sitesi domain tescili (otomatik yenileme deaktif)",
      "sirketadresi.com"
    );

    // Insert service 2
    const s2 = insertService.run(
      "Ana Veritabanı Sunucusu",
      "sunucu",
      "DigitalOcean",
      serverExpiry,
      120.00,
      "USD",
      "yaklasiyor",
      "Sık yedeklenen Postgres veritabanının barındığı droplet.",
      "db.sirketadresi.com"
    );

    // Insert service 3
    const s3 = insertService.run(
      "Google Workspace Mail Paketi",
      "mail",
      "Google LLC",
      mailExpiry,
      75.00,
      "EUR",
      "suresi_dolmus",
      "Muhasebe ve operasyon ekiplerinin e-posta kutuları.",
      "sirketadresi.com"
    );

    // Seed historical payments for these
    const insertHistory = dbInstance.prepare(`
      INSERT INTO cost_history (service_id, service_name, cost, currency, payment_date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // Past 3 years of records for Domain
    const pastYear1 = new Date(); pastYear1.setFullYear(today.getFullYear() - 1);
    const pastYear2 = new Date(); pastYear2.setFullYear(today.getFullYear() - 2);
    
    insertHistory.run(s1.lastInsertRowid, "Kurumsal Domain Kaydı", 320.00, "TRY", pastYear1.toISOString().split("T")[0], "Yıllık periyodik yenileme yapıldı.");
    insertHistory.run(s1.lastInsertRowid, "Kurumsal Domain Kaydı", 250.00, "TRY", pastYear2.toISOString().split("T")[0], "İlk tescil ücreti.");

    // Past records for server
    const pastMonth1 = new Date(); pastMonth1.setMonth(today.getMonth() - 1);
    const pastMonth2 = new Date(); pastMonth2.setMonth(today.getMonth() - 2);

    insertHistory.run(s2.lastInsertRowid, "Ana Veritabanı Sunucusu", 120.00, "USD", pastMonth1.toISOString().split("T")[0], "Aylık sunucu faturası tahsil edildi.");
    insertHistory.run(s2.lastInsertRowid, "Ana Veritabanı Sunucusu", 120.00, "USD", pastMonth2.toISOString().split("T")[0], "Aylık sunucu faturası tahsil edildi.");

    // Past records for mail
    insertHistory.run(s3.lastInsertRowid, "Google Workspace Mail Paketi", 75.00, "EUR", pastMonth1.toISOString().split("T")[0], "Aylık Google Workspace faturası ödemesi.");
    insertHistory.run(s3.lastInsertRowid, "Google Workspace Mail Paketi", 75.00, "EUR", pastMonth2.toISOString().split("T")[0], "Aylık Google Workspace faturası ödemesi.");
  }

  // Define automatic status updates based on expiry_date
  updateServiceStatuses(dbInstance);

  return dbInstance;
}

// Automatically updates service active/expiring/expired status based on current datetime
export function updateServiceStatuses(db: Database.Database) {
  const services = db.prepare("SELECT id, expiry_date FROM services").all() as { id: number; expiry_date: string }[];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const updateStmt = db.prepare("UPDATE services SET status = ? WHERE id = ?");

  for (const s of services) {
    const expDate = new Date(s.expiry_date);
    expDate.setHours(0, 0, 0, 0);
    
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let status = "aktif";
    if (diffDays < 0) {
      status = "suresi_dolmus";
    } else if (diffDays <= 30) {
      status = "yaklasiyor";
    }

    updateStmt.run(status, s.id);
  }
}
