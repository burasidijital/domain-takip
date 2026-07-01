"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Mail,
  Server,
  Globe,
  SlidersHorizontal,
  Eye,
  EyeOff,
  LogOut,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  Calendar,
  DollarSign,
  TrendingUp,
  Trash2,
  Edit,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  ChevronRight,
  History,
  Activity,
  ArrowUpRight,
  RefreshCw,
  Clock,
  Layers,
  HelpCircle,
  Users,
  UserPlus,
  Shield,
  Key,
} from "lucide-react";

// Types corresponding to backend
interface Service {
  id: number;
  name: string;
  type: "mail" | "sunucu" | "domain" | "diger";
  provider: string;
  expiry_date: string;
  cost: number;
  currency: "TRY" | "USD" | "EUR" | "GBP";
  status: "aktif" | "yaklasiyor" | "suresi_dolmus";
  notes: string;
  domain: string;
  created_at: string;
  updated_at: string;
}

interface PaymentHistory {
  id: number;
  service_id: number | null;
  service_name: string;
  cost: number;
  currency: "TRY" | "USD" | "EUR" | "GBP";
  payment_date: string;
  notes: string;
  created_at: string;
}

interface AnalysisData {
  summary: {
    totalCount: number;
    annualRunRateTry: number;
    monthlyRunRateTry: number;
    currenciesUsed: string[];
    exchangeRates: Record<string, number>;
  };
  typeDistribution: { type: string; count: number }[];
  statusDistribution: { status: string; count: number }[];
  costByCategoryTry: Record<string, number>;
  criticalServices: Omit<Service, "notes" | "created_at" | "updated_at">[];
  spendingTimeline: { month: string; total: number }[];
  topVendors: { name: string; total: number }[];
}

export default function HizmetTakipSistemi() {
  // Authentication states
  const [isAuthenticatedState, setIsAuthenticatedState] = useState<boolean | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Core Data States
  const [services, setServices] = useState<Service[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters & Tabs
  const [activeTab, setActiveTab] = useState<"services" | "excel" | "analysis" | "users">("services");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");

  // Users Management states
  const [usersList, setUsersList] = useState<{ id: number; username: string; created_at: string }[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [userActionLoading, setUserActionLoading] = useState(false);
  const [userActionSuccess, setUserActionSuccess] = useState("");

  // Masking controls (True = mask prices with ******, False = show them)
  const [revealedServicePrices, setRevealedServicePrices] = useState<Record<number, boolean>>({});
  const [revealedHistoryPrices, setRevealedHistoryPrices] = useState<Record<number, boolean>>({});
  const [maskAll, setMaskAll] = useState<boolean>(true);

  // New Service / Editing Modals & Drawers
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isServiceDrawerOpen, setIsServiceDrawerOpen] = useState(false);
  const [isNewServiceModalOpen, setIsNewServiceModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Active form values (Used for both Creation and Editing)
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<"mail" | "sunucu" | "domain" | "diger">("domain");
  const [formProvider, setFormProvider] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formCost, setFormCost] = useState<number | "">("");
  const [formCurrency, setFormCurrency] = useState<"TRY" | "USD" | "EUR" | "GBP">("TRY");
  const [formDomain, setFormDomain] = useState("");
  const [formNotes, setFormNotes] = useState("");

  // Cost comparison variables for new entry
  const [historySuggestions, setHistorySuggestions] = useState<PaymentHistory[]>([]);

  // Renewal payment confirmation states
  const [showRenewalConfirmModal, setShowRenewalConfirmModal] = useState(false);
  const [suggestedRenewalDate, setSuggestedRenewalDate] = useState("");

  // Excel Upload States
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelStatus, setExcelStatus] = useState<{ success: boolean; message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameInput, password: passwordInput }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("x-auth-token", data.token);
        setIsAuthenticatedState(true);
        fetchDashboardData();
        setUsernameInput("");
        setPasswordInput("");
      } else {
        setLoginError(data.message || "Giriş başarısız. Bilgilerinizi kontrol edin.");
      }
    } catch (err) {
      setLoginError("Sunucu bağlantı hatası gerçekleşti.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem("x-auth-token");
    setIsAuthenticatedState(false);
    // Reset States
    setServices([]);
    setPaymentHistory([]);
    setAnalysis(null);
  };

  // Centralized fetch routines
  async function fetchDashboardData() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const headers = { "x-auth-token": token };

      // Parallelize fetches for snapply dashboard updates
      const [servicesRes, historyRes, analysisRes] = await Promise.all([
        fetch("/api/services", { headers }),
        fetch("/api/history", { headers }),
        fetch("/api/analysis", { headers }),
      ]);

      if (servicesRes.ok && historyRes.ok && analysisRes.ok) {
        const dServices = await servicesRes.json();
        const dHistory = await historyRes.json();
        const dAnalysis = await analysisRes.json();

        setServices(dServices.services || []);
        setPaymentHistory(dHistory.history || []);
        setAnalysis(dAnalysis || null);
      } else {
        setErrorMsg("Bilinmeyen bir hata sebebiyle veriler yüklenemedi.");
      }
    } catch (e) {
      setErrorMsg("Veri sunucusuna bağlanırken hata meydana geldi.");
    } finally {
      setLoading(false);
    }
  }

  // Verify Token on Mount
  async function checkAuthSession() {
    try {
      const token = localStorage.getItem("x-auth-token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["x-auth-token"] = token;
      }

      const res = await fetch("/api/auth/check", { headers });
      if (res.ok) {
        const data = await res.json();
        if (data.authenticated) {
          setIsAuthenticatedState(true);
          fetchDashboardData();
        } else {
          setIsAuthenticatedState(false);
        }
      } else {
        setIsAuthenticatedState(false);
      }
    } catch (err) {
      setIsAuthenticatedState(false);
    } finally {
      setAuthChecking(false);
    }
  }

  useEffect(() => {
    setTimeout(() => {
      checkAuthSession();
    }, 0);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsServiceDrawerOpen(false);
        setIsNewServiceModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Users management actions
  async function fetchUsers() {
    setUsersLoading(true);
    setUsersError("");
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const res = await fetch("/api/users", {
        headers: { "x-auth-token": token },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsersList(data.users || []);
      } else {
        setUsersError(data.message || "Kullanıcılar yüklenemedi.");
      }
    } catch (e) {
      setUsersError("Kullanıcı sunucusuna bağlanırken hata meydana geldi.");
    } finally {
      setUsersLoading(false);
    }
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setUserActionLoading(true);
    setUsersError("");
    setUserActionSuccess("");
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserActionSuccess(data.message || "Kullanıcı başarıyla eklendi.");
        setNewUsername("");
        setNewPassword("");
        fetchUsers();
      } else {
        setUsersError(data.message || "Kullanıcı eklenemedi.");
      }
    } catch (e) {
      setUsersError("Sunucu bağlantı hatası.");
    } finally {
      setUserActionLoading(false);
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUserId) return;
    setUserActionLoading(true);
    setUsersError("");
    setUserActionSuccess("");
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          id: editUserId,
          username: editUsername,
          password: editPassword || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserActionSuccess(data.message || "Kullanıcı başarıyla güncellendi.");
        setEditUserId(null);
        setEditUsername("");
        setEditPassword("");
        fetchUsers();
      } else {
        setUsersError(data.message || "Kullanıcı güncellenemedi.");
      }
    } catch (e) {
      setUsersError("Sunucu bağlantı hatası.");
    } finally {
      setUserActionLoading(false);
    }
  }

  async function handleDeleteUser(id: number) {
    setUserActionLoading(true);
    setUsersError("");
    setUserActionSuccess("");
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const res = await fetch(`/api/users?id=${id}`, {
        method: "DELETE",
        headers: { "x-auth-token": token },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUserActionSuccess(data.message || "Kullanıcı silindi.");
        fetchUsers();
      } else {
        setUsersError(data.message || "Kullanıcı silinemedi.");
      }
    } catch (e) {
      setUsersError("Sunucu bağlantı hatası.");
    } finally {
      setUserActionLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === "users" && isAuthenticatedState) {
      const timer = setTimeout(() => {
        fetchUsers();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isAuthenticatedState]);

  // Dynamic filter lists for layout bindings
  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.provider && s.provider.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.domain && s.domain.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (s.notes && s.notes.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedType === "all" || s.type === selectedType;
    const matchesStatus = selectedStatus === "all" || s.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Calculate matching historical prices for a service name or provider
  // " geçmişte ne kadar ücret alınmış onuda görelim"
  const filterHistoryByTerm = (name: string, provider: string, type: string) => {
    if (!name && !provider) {
      setHistorySuggestions([]);
      return;
    }
    const matching = paymentHistory.filter((p) => {
      const matchName = name && p.service_name.toLowerCase().includes(name.toLowerCase());
      const matchHistoryType = p.service_id 
        ? services.find(s => s.id === p.service_id)?.type === type
        : false;
      return matchName || matchHistoryType;
    });
    setHistorySuggestions(matching.slice(0, 5));
  };

  // Handle service additions
  const handleAddNewService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formExpiryDate || formCost === "") {
      alert("Lütfen tüm zorunlu alanları doldurun.");
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const res = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          name: formName,
          type: formType,
          provider: formProvider,
          expiry_date: formExpiryDate,
          cost: Number(formCost),
          currency: formCurrency,
          domain: formDomain,
          notes: formNotes,
        }),
      });

      if (res.ok) {
        setIsNewServiceModalOpen(false);
        resetFormValues();
        fetchDashboardData();
      } else {
        const d = await res.json();
        alert(d.message || "Hizmet kaydedilirken hata oluştu.");
      }
    } catch (e) {
      alert("Sunucu bağlantısı sırasında hata gerçekleşti.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle service updates
  const executeUpdateService = async (finalExpiryDate: string, logPaymentOverride?: boolean) => {
    if (!selectedService) return;
    setActionLoading(true);
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const res = await fetch(`/api/services/${selectedService.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token,
        },
        body: JSON.stringify({
          name: formName,
          type: formType,
          provider: formProvider,
          expiry_date: finalExpiryDate,
          cost: Number(formCost),
          currency: formCurrency,
          domain: formDomain,
          notes: formNotes,
          log_new_payment: true,
        }),
      });

      if (res.ok) {
        setIsServiceDrawerOpen(false);
        setIsNewServiceModalOpen(false);
        setShowRenewalConfirmModal(false);
        setSelectedService(null);
        resetFormValues();
        fetchDashboardData();
      } else {
        const d = await res.json();
        alert(d.message || "Hizmet güncellenirken hata oluştu.");
      }
    } catch (e) {
      alert("Sunucu bağlantı hatası oluştu.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;
    if (!formName || !formExpiryDate || formCost === "") {
      alert("Lütfen temel zorunlu alanları doldurun.");
      return;
    }

    // Check if user manually modified/edited the date
    const isDateUnchanged = formExpiryDate === selectedService.expiry_date;

    if (isDateUnchanged) {
      try {
        const expiryDateObj = new Date(formExpiryDate);
        const expiryYear = expiryDateObj.getFullYear();
        const currentYear = new Date().getFullYear();

        if (!isNaN(expiryYear) && expiryYear === currentYear) {
          // Calculate 1 year later
          const nextYearDate = new Date(expiryDateObj);
          nextYearDate.setFullYear(nextYearDate.getFullYear() + 1);
          const y = nextYearDate.getFullYear();
          const m = String(nextYearDate.getMonth() + 1).padStart(2, "0");
          const d = String(nextYearDate.getDate()).padStart(2, "0");
          const suggestedDate = `${y}-${m}-${d}`;

          setSuggestedRenewalDate(suggestedDate);
          setShowRenewalConfirmModal(true);
          return; // Wait for modal confirmation
        }
      } catch (err) {
        console.error("Date checking error:", err);
      }
    }

    // If date is modified manually, or not in the current year, execute payment directly
    await executeUpdateService(formExpiryDate);
  };

  // Handle service deletions
  const handleDeleteService = async (id: number) => {
    if (!confirm("Bu hizmet takip kaydını silmek istediğinize emin misiniz? (Tarihsel harcama raporlarınız silinmez, koruma amaçlı sistemde kalır)")) {
      return;
    }

    setActionLoading(true);
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const res = await fetch(`/api/services/${id}`, {
        method: "DELETE",
        headers: { "x-auth-token": token },
      });

      if (res.ok) {
        setIsServiceDrawerOpen(false);
        setSelectedService(null);
        fetchDashboardData();
      } else {
        alert("Kayıt silinirken hata oluştu.");
      }
    } catch (e) {
      alert("Hizmet silinirken sunucu bağlantı hatası oluştu.");
    } finally {
      setActionLoading(false);
    }
  };

  // Excel Excel file upload and parsing
  const handleExcelImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      alert("Lütfen geçerli bir Excel dosyası (.xlsx, .xls, .csv) yükleyin.");
      return;
    }

    setExcelLoading(true);
    setExcelStatus(null);
    try {
      const token = localStorage.getItem("x-auth-token") || "";
      const formData = new FormData();
      formData.append("file", excelFile);

      const res = await fetch("/api/excel/import", {
        method: "POST",
        headers: {
          "x-auth-token": token,
        },
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setExcelStatus({ success: true, message: data.message });
        setExcelFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchDashboardData();
      } else {
        setExcelStatus({ success: false, message: data.message || "Excel içe aktarım başarısız." });
      }
    } catch (err: any) {
      setExcelStatus({ success: false, message: "Sunucuya yüklenirken bağlantı hatası yaşandı." });
    } finally {
      setExcelLoading(false);
    }
  };

  // Excel trigger export file downloads
  const handleExcelExport = () => {
    const token = localStorage.getItem("x-auth-token") || "";
    window.open(`/api/excel/export?token=${token}`, "_blank");
  };

  const openNewServiceModal = () => {
    resetFormValues();
    setIsNewServiceModalOpen(true);
    setHistorySuggestions([]);
  };

  const openServiceEditDrawer = (service: Service) => {
    setSelectedService(service);
    setFormName(service.name);
    setFormType(service.type);
    setFormProvider(service.provider || "");
    setFormExpiryDate(service.expiry_date);
    setFormCost(service.cost);
    setFormCurrency(service.currency);
    setFormDomain(service.domain || "");
    setFormNotes(service.notes || "");

    filterHistoryByTerm(service.name, service.provider || "", service.type);
    setIsServiceDrawerOpen(true);
  };

  const resetFormValues = () => {
    setFormName("");
    setFormType("domain");
    setFormProvider("");
    setFormExpiryDate("");
    setFormCost("");
    setFormCurrency("TRY");
    setFormDomain("");
    setFormNotes("");
    setHistorySuggestions([]);
  };

  // Utility to count remaining days
  const getDaysRemainingText = (expiryDateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expDate = new Date(expiryDateStr);
    expDate.setHours(0, 0, 0, 0);

    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `Süresi ${Math.abs(diffDays)} gün geçmiş!`,
        color: "text-rose-600 bg-rose-50 border-rose-100",
        urgent: true,
      };
    } else if (diffDays === 0) {
      return {
        text: "Bugün son gün!",
        color: "text-amber-700 bg-amber-50 border-amber-200 animate-pulse",
        urgent: true,
      };
    } else if (diffDays <= 30) {
      return {
        text: `${diffDays} gün kaldı`,
        color: "text-amber-600 bg-amber-50 border-amber-100",
        urgent: true,
      };
    } else {
      return {
        text: `${diffDays} gün kaldı`,
        color: "text-emerald-700 bg-emerald-50 border-emerald-100",
        urgent: false,
      };
    }
  };

  // Visual pricing format reveal helpers
  const toggleServicePrice = (id: number, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid opening row drawer
    setRevealedServicePrices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleHistoryPrice = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setRevealedHistoryPrices((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const formatPrice = (amount: number, currency: string, isRevealed: boolean) => {
    const symbols: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€", GBP: "£" };
    const sym = symbols[currency] || currency;

    if (maskAll && !isRevealed) {
      return "****** " + sym;
    }
    return `${amount.toLocaleString("tr-TR", { minimumFractionDigits: 2 })} ${sym}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}.${month}.${year}`;
    } catch (e) {
      return dateStr;
    }
  };

  const getLatestPastPayment = () => {
    if (!formName) return null;
    const exactMatches = paymentHistory.filter(
      (p) => p.service_name.trim().toLowerCase() === formName.trim().toLowerCase()
    );
    if (exactMatches.length === 0) return null;
    return [...exactMatches].sort((a, b) => {
      const timeA = new Date(a.payment_date).getTime();
      const timeB = new Date(b.payment_date).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return b.id - a.id;
    })[0];
  };

  const latestPastPayment = getLatestPastPayment();

  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-600">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
        <p className="text-sm font-medium tracking-tight">Oturum doğrulanıyor, lütfen bekleyin...</p>
      </div>
    );
  }

  // --- RENDERING LOGIN SCREEN ---
  if (isAuthenticatedState === false) {
    return (
      <div className="flex select-none items-center justify-center min-h-screen bg-slate-50 p-4 font-sans progression-fade">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
          {/* Header Theme layout */}
          <div className="bg-white p-8 border-b border-slate-100 relative flex flex-col items-center text-center">
            <div className="absolute top-4 right-4 bg-slate-100 px-3 py-1 rounded-full text-xs font-mono tracking-wider text-slate-500">
              v1.4.0
            </div>
            
            <div className="relative w-48 h-12 mb-4 flex items-center justify-center">
              <Image
                src="https://ozdgroup.com/wp-content/uploads/2021/07/ozd-group-yatay-beyaz-logo.svg"
                alt="OZD Group Logo"
                fill
                className="object-contain"
                style={{ filter: "brightness(0)" }}
                referrerPolicy="no-referrer"
                priority
              />
            </div>
            
            <div className="flex items-center space-x-2 text-indigo-600 mb-1">
              <SlidersHorizontal className="w-4 h-4 animate-pulse shrink-0" />
              <span className="text-xs uppercase tracking-widest font-semibold">Hizmet Takip Sistemi</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">Mail, Sunucu ve Domain abonelik koruma paneli.</p>
          </div>

          <form onSubmit={handleLogin} className="p-8 space-y-5">
            {loginError && (
              <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start space-x-2 text-rose-700 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Kullanıcı Adı</label>
              <input
                id="username_input"
                type="text"
                placeholder="admin"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                required
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Giriş Şifresi</label>
              </div>
              <input
                id="password_input"
                type="password"
                placeholder="••••••••"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 transition"
                required
              />
            </div>

            <button
              id="login_submit_btn"
              type="submit"
              disabled={loginLoading}
              className="w-full bg-slate-900 hover:bg-indigo-950 text-white font-medium text-sm py-3 rounded-xl transition duration-150 flex items-center justify-center space-x-2 mt-2 cursor-pointer shadow-sm hover:shadow active:scale-98"
            >
              {loginLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Doğrulanıyor...</span>
                </>
              ) : (
                <span>Yönetim Paneline Giriş Yap</span>
              )}
            </button>

            <div className="pt-4 border-t border-slate-100 text-center">
              <p className="text-xs text-slate-400">
                Giriş Değerleri Test Bilgisi: <br />
                <span className="font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Kullanıcı: admin</span>{" "}
                /{" "}
                <span className="font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">Şifre: admin123</span>
              </p>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // --- RENDERING SECURED CORE DASHBOARD PANEL ---
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col">
      {/* Upper Navigation Strip */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 px-4 sm:px-8 py-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 select-none w-full lg:w-auto">
            {/* Logo container */}
            <div className="flex items-center justify-center shrink-0 w-44 h-10 relative">
              <Image
                src="https://ozdgroup.com/wp-content/uploads/2021/07/ozd-group-yatay-beyaz-logo.svg"
                alt="OZD Group Logo"
                fill
                className="object-contain"
                style={{ filter: "brightness(0)" }}
                referrerPolicy="no-referrer"
                priority
              />
            </div>
            
            <div className="hidden sm:block h-8 w-[1px] bg-slate-200" />

            <div className="text-center sm:text-left">
              <h1 className="text-base font-bold tracking-tight text-slate-900 flex items-center justify-center sm:justify-start gap-1.5">
                Hizmet Takip Sistemi
              </h1>
              <p className="text-xs text-slate-500">Mail, Alan Adı ve Sunucu Yönetim Portalı</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Global mask reveal switch */}
            <button
              onClick={() => setMaskAll(!maskAll)}
              title={maskAll ? "Tüm ücretleri göster" : "Tüm ücretleri maskele"}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition ${
                maskAll
                  ? "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600"
                  : "bg-indigo-50 border-indigo-200 text-indigo-700 font-semibold"
              }`}
            >
              {maskAll ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span>{maskAll ? "Ücretleri Göster" : "Ücretleri Gizle (******)"}</span>
            </button>

            <div className="h-6 w-[1px] bg-slate-200" />

            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-lg py-1 px-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-medium text-slate-700">admin</span>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
              title="Güvenli Çıkış"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Quick Summary Strip Cards */}
        {analysis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between select-none hover:shadow transition duration-200">
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Toplam Hizmet</span>
                <span className="text-2xl font-bold text-slate-900 mt-1 block">{analysis.summary.totalCount} Adet</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
                <Layers className="w-5 h-5 text-slate-600" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between select-none hover:shadow transition duration-200">
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Yenileme Yaklaşan</span>
                <span className="text-2xl font-bold text-amber-600 mt-1 block">
                  {analysis.statusDistribution.find((s) => s.status === "yaklasiyor")?.count || 0} Adet
                </span>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl text-amber-500">
                <Clock className="w-5 h-5 text-amber-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between select-none hover:shadow transition duration-200">
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Süresi Dolanlar</span>
                <span className="text-2xl font-bold text-rose-600 mt-1 block">
                  {analysis.statusDistribution.find((s) => s.status === "suresi_dolmus")?.count || 0} Adet
                </span>
              </div>
              <div className="p-3 bg-rose-50 rounded-xl text-rose-500">
                <AlertTriangle className="w-5 h-5 text-rose-500" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between hover:shadow transition duration-200">
              <div>
                <span className="text-xs text-slate-400 block font-semibold uppercase tracking-wider">Yıllık Maliyet</span>
                <span className="text-2xl font-bold text-slate-950 mt-1 block flex items-center">
                  {formatPrice(analysis.summary.annualRunRateTry, "TRY", false)}
                </span>
              </div>
              <div className="p-3 bg-indigo-50 rounded-xl text-indigo-500">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
              </div>
            </div>
          </div>
        )}

        {/* Dynamic Critical Reminders Alert Panel (if have any) */}
        {analysis && analysis.criticalServices.length > 0 && (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex items-start space-x-3 select-none">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-amber-800">Kritik Son Kullanma Tarihi Uyarısı</h4>
              <p className="text-xs text-amber-600 mt-0.5">
                {analysis.criticalServices.filter((s) => s.status === "suresi_dolmus").length} adet hizmetin kullanım süresi sona ermiş ve{" "}
                {analysis.criticalServices.filter((s) => s.status === "yaklasiyor").length} adet hizmet 30 günden az süre içinde yenilenmelidir.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {analysis.criticalServices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      const completeS = services.find((srv) => srv.id === s.id);
                      if (completeS) openServiceEditDrawer(completeS);
                    }}
                    className="flex items-center space-x-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md bg-white border border-amber-200 text-amber-700 hover:bg-amber-100 tracking-tight transition cursor-pointer"
                  >
                    {s.type === "mail" ? <Mail className="w-3 h-3" /> : s.type === "sunucu" ? <Server className="w-3 h-3" /> : <Globe className="w-3 h-3" />}
                    <span>{s.name} ({s.expiry_date})</span>
                    <ChevronRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab Controls */}
        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-5 py-3 text-sm font-medium transition cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === "services"
                ? "border-slate-800 text-slate-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-950"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Abonelik & Hizmet Listesi
          </button>
          <button
            onClick={() => setActiveTab("excel")}
            className={`px-5 py-3 text-sm font-medium transition cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === "excel"
                ? "border-slate-800 text-slate-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-950"
            }`}
          >
            <Download className="w-4 h-4" />
            Excel İçe/Dışa Aktarma
          </button>
          <button
            onClick={() => setActiveTab("analysis")}
            className={`px-5 py-3 text-sm font-medium transition cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === "analysis"
                ? "border-slate-800 text-slate-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-950"
            }`}
          >
            <Activity className="w-4 h-4" />
            Analiz & Maliyet Raporu
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-5 py-3 text-sm font-medium transition cursor-pointer border-b-2 flex items-center gap-2 ${
              activeTab === "users"
                ? "border-slate-800 text-slate-900 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-950"
            }`}
          >
            <Users className="w-4 h-4" />
            Kullanıcı Yönetimi
          </button>
        </div>

        {/* ----------------- TAB: SERVICES LISTING ----------------- */}
        {activeTab === "services" && (
          <div className="space-y-6">
            {/* Filter and Control Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between select-none">
              {/* Left Search input */}
              <div className="relative w-full md:max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Hizmet, domain, sağlayıcı adı, notlarda ara..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
                />
              </div>

              {/* Filtering Selection Controls */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-600 focus:outline-none"
                  >
                    <option value="all">Tüm Kategoriler (Mail, Sunucu, Domain)</option>
                    <option value="mail">E-Posta (Mail)</option>
                    <option value="sunucu">Sunucu (Server)</option>
                    <option value="domain">Alan Adı (Domain)</option>
                    <option value="diger">Diğer Hizmetler</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                    className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-600 focus:outline-none"
                  >
                    <option value="all">Tüm Durumlar (Aktif, Kritik, Dolanlar)</option>
                    <option value="aktif">Aktif (Güvenli)</option>
                    <option value="yaklasiyor">Yenileme Yaklaşan (&lt; 30 Gün)</option>
                    <option value="suresi_dolmus">Süresi Dolanlar</option>
                  </select>
                </div>

                <button
                  onClick={openNewServiceModal}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 transition duration-150 ml-auto cursor-pointer active:scale-98"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Hizmet Ekle
                </button>
              </div>
            </div>

            {/* Error notifications */}
            {errorMsg && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-sm flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl">
                <RefreshCw className="w-8 h-8 animate-spin text-slate-400 mb-2" />
                <p className="text-xs text-slate-500">Veriler taranıyor...</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 bg-white border border-slate-200 rounded-xl text-center px-4">
                <Layers className="w-12 h-12 text-slate-300 mb-3" />
                <h3 className="text-sm font-semibold text-slate-700">Aranan kriterlerde hizmet bulunamadı</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  Aktif filtre parametrelerini değiştirebilir veya sağ üstteki &quot;Hizmet Ekle&quot; butonu üzerinden sisteme yeni bir mail, sunucu veya alan adı kaydı yapabilirsiniz.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {filteredServices.map((s) => {
                  const dayObj = getDaysRemainingText(s.expiry_date);
                  
                  return (
                    <div
                      key={s.id}
                      onClick={() => openServiceEditDrawer(s)}
                      className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 hover:shadow-md hover:border-slate-300 transition duration-200 cursor-pointer relative group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                    >
                      {/* Left/Middle Content Section */}
                      <div className="flex items-start sm:items-center gap-4 flex-1 min-w-0">
                        <span
                          className={`p-2.5 rounded-xl border shrink-0 ${
                            s.type === "mail"
                              ? "bg-cyan-50 border-cyan-100 text-cyan-600"
                              : s.type === "sunucu"
                              ? "bg-indigo-50 border-indigo-100 text-indigo-600"
                              : s.type === "domain"
                              ? "bg-amber-50 border-amber-100 text-amber-600"
                              : "bg-slate-50 border-slate-100 text-slate-600"
                          }`}
                        >
                          {s.type === "mail" && <Mail className="w-4 h-4" />}
                          {s.type === "sunucu" && <Server className="w-4 h-4" />}
                          {s.type === "domain" && <Globe className="w-4 h-4" />}
                          {s.type === "diger" && <Layers className="w-4 h-4" />}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-semibold text-slate-900 transition text-sm sm:text-base tracking-tight truncate flex items-center gap-1">
                              <span className={
                                s.type === "mail" ? "text-cyan-600 font-bold" :
                                s.type === "sunucu" ? "text-indigo-600 font-bold" :
                                s.type === "domain" ? "text-amber-600 font-bold" :
                                "text-slate-600 font-bold"
                              }>
                                {s.type === "mail" ? "E-Posta" : s.type === "sunucu" ? "Sunucu" : s.type === "domain" ? "Alan Adı" : "Diğer"}
                              </span>
                              <span className="text-slate-400 font-normal mx-0.5">/</span>
                              <span className="group-hover:text-indigo-600 transition">{s.name}</span>
                            </h3>
                            <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border inline-block ${dayObj.color}`}>
                              {dayObj.text}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-slate-500">
                            <span>şirket: <span className="text-slate-800 font-semibold">{s.domain || "Belirtilmemiş"}</span></span>
                            <span className="text-slate-300">|</span>
                            <span>sağlayıcı: <span className="text-slate-800 font-semibold">{s.provider || "Belirtilmemiş"}</span></span>
                            <span className="text-slate-300">|</span>
                            <span className="inline-flex items-center gap-1 text-slate-600 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              {formatDate(s.expiry_date)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Right Section: Pricing & Actions */}
                      <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Periyodik Ücret</p>
                          <div className="mt-0.5 flex items-center space-x-1.5">
                            <span className="font-bold text-slate-950 text-sm tracking-tight">
                              {formatPrice(s.cost, s.currency, revealedServicePrices[s.id])}
                            </span>
                            <button
                              onClick={(e) => toggleServicePrice(s.id, e)}
                              className="p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-slate-700 transition cursor-pointer"
                              title={revealedServicePrices[s.id] ? "Gizle" : "Göster"}
                            >
                              {revealedServicePrices[s.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-0.5 group-hover:text-indigo-600 transition">
                          Görüntüle
                          <ChevronRight className="w-3.5 h-3.5 transition group-hover:translate-x-0.5" />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ----------------- TAB: EXCEL MANAGEMENT ----------------- */}
        {activeTab === "excel" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-none">
            {/* Download/Export card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
              <div className="p-3 bg-slate-900 text-white rounded-xl w-11 h-11 flex items-center justify-center">
                <Download className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Excel Raporu Dışa Aktar</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Sisteminizde kayıtlı olan tüm mail, sunucu ve alan adı tracking hizmetlerini anlık ödeme durumları, kalan süreleri, yenileme fiyatları ve ilişkili notları ile birlikte tek hamlede formata uygun, temiz bir Excel (.xlsx) belgesine dökün.
                </p>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleExcelExport}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer active:scale-98"
                >
                  <Download className="w-4 h-4" />
                  Excel Raporunu Bilgisayara İndir
                </button>
              </div>

              {/* Localized spreadsheet view preview */}
              <div className="border border-slate-100 rounded-lg p-3 bg-slate-50 font-mono text-[10px] text-slate-400 space-y-1">
                <p className="text-[11px] font-bold text-slate-500 border-b pb-1 mb-2">Excel Rapor Yapısı Preview</p>
                <div className="grid grid-cols-4 gap-1 text-slate-500">
                  <span>Hizmet Adı</span> <span>Hizmet Türü</span> <span>Ücret (Tutar)</span> <span>Para Birimi</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-slate-300">
                  <span>Kurumsal Domain</span> <span>domain</span> <span>450.00</span> <span>TRY</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-slate-300">
                  <span>DigitalOcean</span> <span>sunucu</span> <span>120.00</span> <span>USD</span>
                </div>
              </div>
            </div>

            {/* Upload/Import card */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-4">
              <div className="p-3 bg-slate-900 text-white rounded-xl w-11 h-11 flex items-center justify-center">
                <Upload className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 tracking-tight">Excel İçe Aktar</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed font-normal">
                  Sistemimize başka platformlardan veya geçmiş yedeklerinizden aldığınız Excel (XLSX, XLS) veya CSV dosyalarını toplu olarak yükleyin. Kolon eşleştiricimiz, Türkçe ve İngilizce sütunları akıllı bir şekilde algılayarak otomatik entegrasyonu tamamlar.
                </p>
              </div>

              <form onSubmit={handleExcelImport} className="space-y-4 pt-3">
                <div className="border bg-slate-50 border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-6 flex flex-col items-center justify-center transition cursor-pointer relative group">
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setExcelFile(e.target.files[0]);
                      }
                    }}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 text-slate-400 group-hover:text-indigo-600 transition mb-2" />
                  <p className="text-xs font-semibold text-slate-600 group-hover:text-indigo-600 transition">
                    {excelFile ? excelFile.name : "Tıklayın ya da Excel dosyasını buraya sürükleyin"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">Sadece .xlsx, .xls veya .csv dosyaları</p>
                </div>

                {excelStatus && (
                  <div
                    className={`p-3.5 rounded-xl border text-xs flex items-start space-x-2 ${
                      excelStatus.success
                        ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                        : "bg-rose-50 border-rose-100 text-rose-800"
                    }`}
                  >
                    {excelStatus.success ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <XCircle className="w-4 h-4 mt-0.5 shrink-0" />}
                    <span>{excelStatus.message}</span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={excelLoading || !excelFile}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white font-medium text-sm px-5 py-2.5 rounded-xl flex items-center gap-2 transition cursor-pointer active:scale-98"
                  >
                    {excelLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>İçe Aktarılıyor...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Kayıtları Toplu Yükle</span>
                      </>
                    )}
                  </button>
                  
                  {excelFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setExcelFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                      className="border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium text-sm px-4 py-2.5 rounded-xl cursor-pointer"
                    >
                      İptal Et
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ----------------- TAB: ANALYTICAL CHARTS AND REPORTS ----------------- */}
        {activeTab === "analysis" && (
          <div className="space-y-6">
            {/* Visual Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 select-none">
              
              {/* Chart 1: Category Costs Bar chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    KATEGORİ BAZLI YILLIK TOPLAM GİDER (TRY)
                  </h3>
                  <p className="text-xs text-slate-400">Aktif durumdaki hizmetlerin para birimleri çevrilerek hesaplanmıştır.</p>
                </div>

                {analysis ? (
                  <div className="pt-4 space-y-4">
                    {/* SVG Bar Layout */}
                    <div className="flex items-end justify-between h-48 border-b border-l border-slate-100 pb-1 px-4">
                      {["domain", "sunucu", "mail", "diger"].map((cat) => {
                        const cost = analysis.costByCategoryTry[cat] || 0;
                        const rates = Object.values(analysis.costByCategoryTry);
                        const maxCost = Math.max(...rates, 1000);
                        const pct = Math.max((cost / maxCost) * 100, 3); // minimum 3% for visible bar

                        const labelsMap: Record<string, string> = {
                          domain: "Domain",
                          sunucu: "Sunucu",
                          mail: "E-Posta",
                          diger: "Diğer",
                        };

                        const colorsMap: Record<string, string> = {
                          mail: "bg-cyan-500 shadow-cyan-100",
                          sunucu: "bg-indigo-500 shadow-indigo-100",
                          domain: "bg-amber-500 shadow-amber-100",
                          diger: "bg-slate-400 shadow-slate-100",
                        };

                        return (
                          <div key={cat} className="flex flex-col items-center flex-1 mx-2 group relative">
                            {/* Hover tooltip */}
                            <div className="absolute -top-12 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-md transition duration-150 whitespace-nowrap z-10 font-bold">
                              {cost.toLocaleString("tr-TR")} ₺
                            </div>

                            <div className="w-full bg-slate-50 rounded-t-md h-full flex items-end">
                              <div
                                style={{ height: `${pct}%` }}
                                className={`w-full rounded-t-md transition-all duration-500 hover:opacity-80 shadow-md ${colorsMap[cat]}`}
                              />
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 mt-2 capitalize">{labelsMap[cat]}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Cost details table */}
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      {["domain", "sunucu", "mail", "diger"].map((cat) => {
                        const val = analysis.costByCategoryTry[cat] || 0;
                        const labelsMap: Record<string, string> = {
                          domain: "Domain",
                          sunucu: "Sunucu",
                          mail: "E-Posta",
                          diger: "Diğer",
                        };
                        return (
                          <div key={cat} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="text-[10px] text-slate-400 block font-bold uppercase">{labelsMap[cat]}</span>
                            <span className="text-xs font-bold text-slate-900 mt-0.5 block truncate">
                              {val.toLocaleString("tr-TR")} ₺
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 text-center py-10">Agregasyon bütçesi bulunmuyor.</p>
                )}
              </div>

              {/* Chart 2: Historical payments trend */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <History className="w-4 h-4 text-emerald-500" />
                    AYLIK GERÇEKLEŞEN ÖDEME YILLIK EĞRİSİ (TRY)
                  </h3>
                  <p className="text-xs text-slate-400">Veritabanına kaydedilen tarihsel ödemelerin toplu kronolojik eğilim grafiğidir.</p>
                </div>

                {analysis && analysis.spendingTimeline.length > 0 ? (
                  <div className="pt-4 space-y-4">
                    {/* SVG Wave chart visualization */}
                    <div className="relative h-48 border-b border-l border-slate-100 pb-1 px-4 flex items-end justify-between">
                      {analysis.spendingTimeline.slice(-7).map((point, idx, arr) => {
                        const maxVal = Math.max(...arr.map((p) => p.total), 100);
                        const pct = (point.total / maxVal) * 80; // keep max at 80% height

                        return (
                          <div key={point.month} className="flex flex-col items-center flex-1 mx-1 group relative h-full justify-end">
                            {/* Hover tooltip */}
                            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 bg-slate-900 text-white text-[10px] px-2 py-1 rounded shadow-md transition whitespace-nowrap z-10 font-bold">
                              {point.total.toLocaleString("tr-TR")} ₺
                            </div>

                            {/* Point Dot */}
                            <div
                              style={{ bottom: `${pct}%` }}
                              className="absolute w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-2 ring-emerald-100 group-hover:bg-indigo-600 transition duration-150 cursor-pointer"
                            />

                            {/* Column line for connection guide */}
                            <div className="w-[1px] bg-slate-100 h-full absolute select-none -z-0 pointer-events-none" />

                            <span className="text-[9px] font-mono font-medium text-slate-400 mt-2 block whitespace-nowrap select-none">
                              {point.month}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <p className="text-[10px] text-slate-400 text-center font-medium italic">
                      Grafik, ödemelerin kronolojik olarak son 7 ayının dağılımını gösterir.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <History className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs text-slate-500">Henüz trend çizmek için yeterli tescilli ödeme geçmişi yok.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Vendor analysis and Critical services alerts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Vendors */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 select-none">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1">
                  <TrendingUp className="w-4 h-4 text-indigo-500" /> En Yüksek Ödeme Yapılan Firmalar
                </h4>
                
                {analysis && analysis.topVendors.length > 0 ? (
                  <div className="space-y-3 pt-2">
                    {analysis.topVendors.map((vendor, index) => {
                      const maxVal = analysis.topVendors[0]?.total || 1;
                      const pct = Math.max((vendor.total / maxVal) * 100, 4);

                      return (
                        <div key={vendor.name} className="space-y-1">
                          <div className="flex justify-between items-center text-xs font-medium">
                            <span className="text-slate-700 truncate max-w-[200px]">{vendor.name || "İsimsiz Firma"}</span>
                            <span className="text-slate-900 font-semibold">{vendor.total.toLocaleString("tr-TR")} ₺</span>
                          </div>
                          <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${pct}%` }}
                              className={`h-full rounded-full ${
                                index === 0
                                  ? "bg-slate-900"
                                  : index === 1
                                  ? "bg-indigo-600"
                                  : index === 2
                                  ? "bg-indigo-400"
                                  : "bg-slate-300"
                              }`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Veri bulunmuyor.</p>
                )}
              </div>

              {/* Exchange rates summary information */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-widest flex items-center gap-1 select-none">
                    <DollarSign className="w-4 h-4 text-cyan-500" /> RAPOR DÖVİZ DEĞERLEMESİ
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed mt-2 select-none">
                    Farklı döviz birimlerindeki harcamalarınızın Türk Lirası cinsinden raporlanabilmesi amacıyla sistemimizde standart parite çevrim fihristi belirlenmiştir.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 select-none">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">USD Paritesi</span>
                    <span className="text-sm font-bold text-slate-800 tracking-tight block mt-1">33.00 ₺</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">EUR Paritesi</span>
                    <span className="text-sm font-bold text-slate-800 tracking-tight block mt-1">35.00 ₺</span>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-center">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">GBP Paritesi</span>
                    <span className="text-sm font-bold text-slate-800 tracking-tight block mt-1">42.00 ₺</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------- TAB: USER MANAGEMENT ----------------- */}
        {activeTab === "users" && (
          <div className="space-y-6 progression-fade">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left side: Add User or Edit User Form */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
                {editUserId ? (
                  <>
                    <div className="flex items-center gap-2 text-indigo-600">
                      <Shield className="w-5 h-5" />
                      <h3 className="font-bold text-sm uppercase tracking-wider">Kullanıcıyı Güncelle</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Seçilen kullanıcının adını değiştirebilir veya yeni bir şifre tanımlayabilirsiniz.
                    </p>
                    <form onSubmit={handleUpdateUser} className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block">Kullanıcı Adı</label>
                        <input
                          type="text"
                          required
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          placeholder="Örn: cagaty"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block">
                          Yeni Şifre <span className="text-slate-400 font-normal">(Boş bırakılırsa değişmez)</span>
                        </label>
                        <input
                          type="password"
                          value={editPassword}
                          onChange={(e) => setEditPassword(e.target.value)}
                          placeholder="Min. 4 karakter girin"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 font-medium"
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="submit"
                          disabled={userActionLoading}
                          className="flex-1 bg-slate-900 hover:bg-slate-850 text-white font-semibold py-2 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1"
                        >
                          {userActionLoading ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            "Güncelle"
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditUserId(null);
                            setEditUsername("");
                            setEditPassword("");
                          }}
                          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs cursor-pointer transition"
                        >
                          İptal
                        </button>
                      </div>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-indigo-600">
                      <UserPlus className="w-5 h-5" />
                      <h3 className="font-bold text-sm uppercase tracking-wider">Yeni Kullanıcı Ekle</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Sisteme erişebilecek yeni bir yönetici veya operatör hesabı oluşturun.
                    </p>
                    <form onSubmit={handleAddUser} className="space-y-4 pt-2">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block">Kullanıcı Adı</label>
                        <input
                          type="text"
                          required
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value)}
                          placeholder="Örn: cagaty"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 font-medium"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-500 uppercase block">Şifre</label>
                        <input
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Min. 4 karakter girin"
                          className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 font-medium"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={userActionLoading}
                        className="w-full bg-slate-900 hover:bg-slate-850 text-white font-semibold py-2 rounded-lg text-xs cursor-pointer transition flex items-center justify-center gap-1.5"
                      >
                        {userActionLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            Kullanıcı Ekle
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}

                {/* Notifications in Form */}
                {usersError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg text-xs text-rose-700 font-medium flex items-center gap-2 animate-fadeIn">
                    <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{usersError}</span>
                  </div>
                )}
                {userActionSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg text-xs text-emerald-700 font-medium flex items-center gap-2 animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{userActionSuccess}</span>
                  </div>
                )}
              </div>

              {/* Right side: Users Directory Table */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm lg:col-span-2 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-indigo-500" />
                    SİSTEM KULLANICILARI FİHRİSTİ
                  </h3>
                  <p className="text-xs text-slate-400">Veritabanında kayıtlı olan ve yönetim paneline giriş yetkisine sahip aktif hesaplar listesi.</p>
                </div>

                {usersLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mb-2" />
                    <p className="text-xs text-slate-500">Kullanıcılar listesi taranıyor...</p>
                  </div>
                ) : usersList.length > 0 ? (
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 uppercase tracking-wider font-bold select-none text-[10px]">
                          <th className="px-4 py-3">Kullanıcı Adı</th>
                          <th className="px-4 py-3">Oluşturulma Tarihi</th>
                          <th className="px-4 py-3 text-right">Eylemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 font-medium text-slate-700">
                        {usersList.map((usr) => (
                          <tr key={usr.id} className="hover:bg-slate-50/50 transition duration-150">
                            <td className="px-4 py-3.5 flex items-center gap-2">
                              <div className="w-7 h-7 bg-slate-100 rounded-full flex items-center justify-center font-bold text-xs uppercase text-slate-600 border border-slate-200 select-none">
                                {usr.username.slice(0, 2)}
                              </div>
                              <span className="font-semibold text-slate-900">{usr.username}</span>
                            </td>
                            <td className="px-4 py-3.5 text-slate-500 font-mono">
                              {usr.created_at ? new Date(usr.created_at).toLocaleString("tr-TR") : "-"}
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              <div className="inline-flex gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditUserId(usr.id);
                                    setEditUsername(usr.username);
                                    setEditPassword("");
                                    setUsersError("");
                                    setUserActionSuccess("");
                                  }}
                                  className="p-1 text-slate-400 hover:text-indigo-600 rounded hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition cursor-pointer"
                                  title="Düzenle"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(usr.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 border border-transparent hover:border-rose-100 transition cursor-pointer"
                                  title="Sil"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Sistemde kayıtlı kullanıcı bulunamadı.
                  </p>
                )}
              </div>

            </div>
          </div>
        )}
      </main>

      {/* FOOTER METADATA SIGNATURES */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-5 select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-slate-400 text-xs">
          <p className="font-medium">© 2026 Hizmet Takip Sistemi Admin Portalı</p>
          <p className="font-mono mt-1 sm:mt-0 text-slate-300">SQLite persistence layer active.</p>
        </div>
      </footer>

      {/* ----------------- MODAL: RENEWAL CONFIRMATION ----------------- */}
      {showRenewalConfirmModal && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowRenewalConfirmModal(false);
            }
          }}
          className="fixed inset-0 bg-slate-900/65 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fadeIn"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="p-5 bg-emerald-600 text-white flex items-center gap-3 shrink-0">
              <CheckCircle2 className="w-6 h-6 shrink-0" />
              <div>
                <h3 className="font-bold text-sm sm:text-base tracking-tight">Yenileme Tarihi Güncelleme Onayı</h3>
                <p className="text-[10px] text-emerald-105">Ödeme işlemi otomatik tarih uzatma uyarısı</p>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Yenileme tarihi içinde bulunduğumuz yıl (<span className="font-bold">{new Date().getFullYear()}</span>) ile aynı olduğu için sistem tarihi otomatik olarak <span className="font-semibold text-emerald-600">1 yıl ileri</span> almıştır.
              </p>
              
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Eski Tarih:</span>
                  <span className="font-mono text-slate-600 font-medium">{formatDate(selectedService?.expiry_date || "")}</span>
                </div>
                <div className="flex justify-between text-xs border-t border-slate-200/60 pt-2">
                  <span className="text-slate-500 font-semibold">Yeni Yenileme Tarihi:</span>
                  <span className="font-mono text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded">
                    {formatDate(suggestedRenewalDate)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500">
                Bu yenileme tarihini onaylıyor musunuz? Onaylarsanız ödeme işlenecektir ve tarihçe kaydı otomatik olarak eklenecektir.
              </p>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenewalConfirmModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={async () => {
                  // Direct submit with suggestedRenewalDate and forcing log_new_payment: true (since they are processing the payment!)
                  await executeUpdateService(suggestedRenewalDate, true);
                }}
                disabled={actionLoading}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer active:scale-98 transition shadow-sm"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                Onayla ve Ödemeyi İşle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ----------------- MODAL: CREATE NEW SERVICE ----------------- */}
      {isNewServiceModalOpen && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsNewServiceModalOpen(false);
            }
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-base tracking-tight">Yeni Hizmet Takip Kaydı</h3>
                <p className="text-[11px] text-slate-300">Mail, Sunucu veya Domain aboneliğinizi koruma altına alın.</p>
              </div>
              <button
                onClick={() => setIsNewServiceModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Scrollable Wrapper */}
            <form onSubmit={handleAddNewService} className="flex-1 overflow-y-auto p-6 space-y-4">
              
              {/* Category selections */}
              <div className="grid grid-cols-4 gap-2">
                {(["domain", "sunucu", "mail", "diger"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setFormType(t);
                      filterHistoryByTerm(formName, formProvider, t);
                    }}
                    className={`p-2.5 rounded-xl border text-center flex flex-col items-center justify-center gap-1.5 transition cursor-pointer select-none ${
                      formType === t
                        ? "border-slate-900 bg-slate-900 text-white shadow-md font-semibold"
                        : "border-slate-200 hover:border-slate-300 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {t === "domain" && <Globe className="w-4 h-4" />}
                    {t === "sunucu" && <Server className="w-4 h-4" />}
                    {t === "mail" && <Mail className="w-4 h-4" />}
                    {t === "diger" && <Layers className="w-4 h-4" />}
                    <span className="text-[10px] capitalize">
                      {t === "domain" ? "Domain" : t === "sunucu" ? "Sunucu" : t === "mail" ? "E-Posta" : "Diğer"}
                    </span>
                  </button>
                ))}
              </div>

              {/* General Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Hizmet Adı *</label>
                  <input
                    type="text"
                    placeholder="E.g. Kurumsal Alan Adı Tescili"
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      filterHistoryByTerm(e.target.value, formProvider, formType);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Firma / Sağlayıcı</label>
                  <input
                    type="text"
                    placeholder="E.g. GoDaddy"
                    value={formProvider}
                    onChange={(e) => {
                      setFormProvider(e.target.value);
                      filterHistoryByTerm(formName, e.target.value, formType);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">İlişkili Domain / URL</label>
                  <input
                    type="text"
                    placeholder="E.g. sirketadresi.com"
                    value={formDomain}
                    onChange={(e) => setFormDomain(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 text-slate-700 font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Son Kullanma Tarihi *</label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 font-medium"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 animate-fadeIn">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Abonelik Ücret Tutar *</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formCost}
                    onChange={(e) => setFormCost(e.target.value === "" ? "" : Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 text-slate-800"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Para Birimi</label>
                  <select
                    value={formCurrency}
                    onChange={(e) => setFormCurrency(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none text-slate-700 bg-white"
                  >
                    <option value="TRY">TRY (₺)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {/* MASKED SUGGESTIONS AND PREVIOUS CHARGES ACCORDING TO SPECS */}
              {latestPastPayment && (
                <div
                  onClick={(e) => toggleHistoryPrice(latestPastPayment.id, e)}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs text-slate-700 select-none animate-fadeIn cursor-pointer hover:bg-slate-100"
                  title="Detayı görmek/gizlemek için tıklayın"
                >
                  <span className="font-medium text-slate-500 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    Geçmişteki fiyat buydu:
                  </span>
                  <span className="font-mono font-bold text-slate-800 bg-white border border-slate-200 px-2 py-0.5 rounded shadow-sm hover:border-indigo-400">
                    {formatPrice(latestPastPayment.cost, latestPastPayment.currency, revealedHistoryPrices[latestPastPayment.id])}
                  </span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Açıklamalar & Notlar</label>
                <textarea
                  placeholder="Hizmete dair şifreler, otomatik ödeme ayarları veya kritik kullanım notları ekleyin..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-300/20 h-16"
                />
              </div>

              {/* Action operations in footer */}
              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsNewServiceModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  Kapat
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs px-5 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Hizmet Kaydını Oluştur</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ----------------- DRAWER SHOWN FOR DETAIL, EDITING AND LATEST PAYMENT TRACKING ----------------- */}
      {isServiceDrawerOpen && selectedService && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsServiceDrawerOpen(false);
            }
          }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-end"
        >
          <div className="bg-white w-full max-w-lg shadow-2xl h-full flex flex-col animate-slideLeft">
            
            {/* Header section with theme */}
            <div className="p-6 bg-slate-950 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-3">
                <span
                  className={`p-2 rounded-xl ${
                    selectedService.type === "mail"
                      ? "bg-cyan-500/10 text-cyan-400"
                      : selectedService.type === "sunucu"
                      ? "bg-indigo-500/10 text-indigo-400"
                      : "bg-amber-500/10 text-amber-400"
                  }`}
                >
                  {selectedService.type === "mail" && <Mail className="w-5 h-5" />}
                  {selectedService.type === "sunucu" && <Server className="w-5 h-5" />}
                  {selectedService.type === "domain" && <Globe className="w-5 h-5" />}
                  {selectedService.type === "diger" && <Layers className="w-5 h-5" />}
                </span>
                <div>
                  <h3 className="font-bold text-sm sm:text-base truncate max-w-[280px]">{(formName || selectedService.name)}</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Hizmet No: #{selectedService.id}</span>
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsServiceDrawerOpen(false)}
                  className="text-slate-400 hover:text-white p-1 hover:bg-white/10 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content Drawer Wrapper */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Form editing section */}
              <form onSubmit={handleUpdateService} className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b pb-1">
                  HİZMET AYARLARINI GÜNCELLE
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Hizmet Başlığı *</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        filterHistoryByTerm(e.target.value, formProvider, formType);
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none text-slate-800"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Firma / Sağlayıcı</label>
                    <input
                      type="text"
                      value={formProvider}
                      onChange={(e) => {
                        setFormProvider(e.target.value);
                        filterHistoryByTerm(formName, e.target.value, formType);
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none text-slate-800"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Kategori</label>
                    <select
                      value={formType}
                      onChange={(e) => {
                        setFormType(e.target.value as any);
                        filterHistoryByTerm(formName, formProvider, e.target.value);
                      }}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-800 focus:outline-none"
                    >
                      <option value="domain">Domain (Alan Adı)</option>
                      <option value="sunucu">Server (Sunucu)</option>
                      <option value="mail">E-Posta (Mail)</option>
                      <option value="diger">Diğer Hizmet</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Son Yenileme Tarihi *</label>
                    <input
                      type="date"
                      value={formExpiryDate}
                      onChange={(e) => setFormExpiryDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 block">Şirket Bilgisi</label>
                    <input
                      type="text"
                      value={formDomain}
                      onChange={(e) => setFormDomain(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none font-mono text-slate-700"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="grid grid-cols-2 gap-1">
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block truncate">Tutar *</label>
                        <input
                          type="number"
                          step="0.01"
                          value={formCost}
                          onChange={(e) => setFormCost(e.target.value === "" ? "" : Number(e.target.value))}
                          className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 text-slate-800 focus:outline-none"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block">Para Br.</label>
                        <select
                          value={formCurrency}
                          onChange={(e) => setFormCurrency(e.target.value as any)}
                          className="w-full p-1 py-1.5 text-[11px] rounded-lg border border-slate-200 bg-white focus:outline-none"
                        >
                          <option value="TRY">TRY (₺)</option>
                          <option value="USD">USD ($)</option>
                          <option value="EUR">EUR (€)</option>
                          <option value="GBP">GBP (£)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  {/* Automatic payment history log indicator */}
                  <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-start space-x-2 select-none animate-fadeIn">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <label className="text-xs font-semibold text-emerald-800 block">
                        Ödeme Geçmişi Otomatik Kaydedilir
                      </label>
                      <p className="text-[10px] text-emerald-600/80 mt-0.5">
                        Bu hizmet ödemesini işlediğinizde, ödeme tutarı ve tarihi otomatik olarak geçmiş raporlarınıza işlenecektir.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => handleDeleteService(selectedService.id)}
                    className="border border-rose-300 hover:bg-rose-50 text-rose-700 font-medium text-xs px-3.5 py-2 rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hizmeti Sil
                  </button>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer active:scale-97 transition shadow-sm hover:shadow"
                  >
                    {actionLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Ödemeyi İşle
                  </button>
                </div>
              </form>

              {/* Chronological Payment History section */}
              {/* " geçmişte ne kadar ücret alınmış onuda görelim ama ücret bilgileri ****** olsun tıklanınca ücreti göstersin" */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between items-center select-none">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <History className="w-4 h-4 text-indigo-500" />
                    BU HİZMETİN TÜM GEÇMİŞ ÖDEMELERİ
                  </h4>
                  <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full border border-indigo-100 font-bold uppercase select-none">
                    Tıkla / Göster
                  </span>
                </div>

                {paymentHistory.filter((p) => p.service_id === selectedService.id).length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6 select-none bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    Kayıtlı geçmiş ödeme transaction bilgisi bulunmuyor.
                  </p>
                ) : (
                  <div className="space-y-2 select-none">
                    {paymentHistory
                      .filter((p) => p.service_id === selectedService.id)
                      .map((payment) => (
                        <div
                          key={payment.id}
                          onClick={(e) => toggleHistoryPrice(payment.id, e)}
                          className="p-3 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl flex items-center justify-between transition cursor-pointer"
                        >
                          <div className="space-y-0.5 truncate pr-2">
                            <span className="text-xs font-semibold text-slate-800 block truncate">
                              {payment.notes || "Açıklama belirtilmemiş"}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400 block flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                              Ödeme Tarihi: {payment.payment_date}
                            </span>
                          </div>

                          <div className="shrink-0 flex items-center space-x-1 font-mono text-xs font-bold text-slate-900 bg-white border border-slate-250 px-2 py-1 rounded-lg shadow-sm hover:border-indigo-400">
                            <span>{formatPrice(payment.cost, payment.currency, revealedHistoryPrices[payment.id])}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Drawer Footer info details */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 text-center select-none text-[10px] text-slate-400 shrink-0 font-medium">
              Sistem en son veritabanı değişikliğini otomatik olarak tesciller.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
