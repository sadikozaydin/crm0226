import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Building2, Plus, Edit2, Trash2, Users, Check, X, Loader2, Mail, Phone, Calendar, Bell, Search, Filter, Copy, CheckCheck, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useModalBodyScroll } from '../hooks/useModalBodyScroll';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  country?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  subscription_plan: 'basic' | 'professional' | 'enterprise';
  subscription_start_date: string;
  subscription_end_date: string;
  max_users: number;
  max_branches: number;
  is_active: boolean;
}

interface TenantFormData {
  name: string;
  slug: string;
  subdomain: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  country: string;
  timezone: string;
  currency: string;
  language: string;
  subscription_plan: 'basic' | 'professional' | 'enterprise';
  subscription_start_date: string;
  subscription_end_date: string;
  max_users: number;
  max_branches: number;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}

type Mode = 'create' | 'edit';

const PLAN_PRESETS = {
  basic: { max_users: 10, max_branches: 1 },
  professional: { max_users: 50, max_branches: 5 },
  enterprise: { max_users: 9999, max_branches: 9999 }
} as const;

const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api', 'mail', 'support', 'cdn', 'ftp', 'smtp', 'pop', 'imap', 'help', 'blog']);

// Shared constants
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isValidSlug = (s: string) => SLUG_REGEX.test(s);
const getTenantUrl = (sub: string) => `https://${sub || 'kurum'}.sizinapp.com`;
const isDev = import.meta.env.DEV;

// Slug sanitization (without uniqueness check)
const sanitizeSlug = (raw: string): string => {
  return raw
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// Ensure uniqueness (separate from sanitization)
const ensureUnique = (
  base: string,
  list: Tenant[],
  selfId: string | undefined,
  field: 'slug' | 'subdomain'
): string => {
  const isTaken = (s: string) =>
    list.some(t => {
      const value = field === 'slug' ? t.slug : (t.subdomain ?? t.slug);
      return value === s && t.id !== selfId;
    });
  let result = base;
  let counter = 1;
  while (isTaken(result)) {
    result = `${base}-${counter}`;
    counter++;
  }
  return result;
};

// Helper: Local date formatting (TR timezone safe)
const formatLocalDate = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Helper: Calculate days until date
const daysUntilDate = (endDate: string): number => {
  const today = new Date(formatLocalDate());
  const end = new Date(endDate);
  return Math.ceil((+end - +today) / (1000 * 60 * 60 * 24));
};

// Status Pill Component
const StatusPill: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
    active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }`}>
    {active ? <Check className="h-3 w-3 mr-1" /> : <X className="h-3 w-3 mr-1" />}
    {active ? 'Aktif' : 'Pasif'}
  </span>
);

const buildInitialForm = (): TenantFormData => ({
  name: '',
  slug: '',
  subdomain: '',
  contact_email: '',
  contact_phone: '',
  address: '',
  country: 'TR',
  timezone: 'Europe/Istanbul',
  currency: 'TRY',
  language: 'tr',
  subscription_plan: 'basic',
  subscription_start_date: formatLocalDate(),
  subscription_end_date: formatLocalDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))),
  max_users: 10,
  max_branches: 1,
  admin_name: '',
  admin_email: '',
  admin_password: ''
});

const TenantManagement = () => {
  const { availableTenants, isSuperAdmin } = useTenant();
  const [showNewTenantModal, setShowNewTenantModal] = useState(false);
  const [mode, setMode] = useState<Mode>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState<'all' | 'basic' | 'professional' | 'enterprise'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'passive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'plan' | 'status'>('name');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const initialFormRef = useRef<TenantFormData | null>(null);
  const openButtonRef = useRef<HTMLButtonElement>(null);

  const [formData, setFormData] = useState<TenantFormData>(buildInitialForm());
  const [adminPassword, setAdminPassword] = useState('');

  // Modal açıkken body scroll'unu kapat
  useModalBodyScroll(showNewTenantModal);

  // ESC tuşu ile kapatma fonksiyonu
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showNewTenantModal) {
        tryCloseModal();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showNewTenantModal]);

  // Focus trap (erişilebilirlik)
  useEffect(() => {
    if (!showNewTenantModal) return;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusables = modalRef.current?.querySelectorAll<HTMLElement>(
        'a, button, input, select, textarea, [tabindex]:not([tabindex=\"-1\"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [showNewTenantModal]);

  // Modal açıldığında ilk input'a focus
  useEffect(() => {
    if (showNewTenantModal && firstInputRef.current) {
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [showNewTenantModal]);

  // İstatistikleri hesapla (memoized)
  const stats = useMemo(() => {
    const active = availableTenants.filter(t => t.is_active).length;
    const basic = availableTenants.filter(t => t.subscription_plan === 'basic').length;
    const professional = availableTenants.filter(t => t.subscription_plan === 'professional').length;
    const enterprise = availableTenants.filter(t => t.subscription_plan === 'enterprise').length;
    return { active, basic, professional, enterprise, total: availableTenants.length };
  }, [availableTenants]);

  // Check if subdomain is reserved (case-insensitive)
  const isReserved = useMemo(() => {
    return RESERVED_SUBDOMAINS.has((formData.subdomain || '').toLowerCase());
  }, [formData.subdomain]);

  // Check if slug is already taken
  const slugTaken = useMemo(() => {
    return !!formData.slug && availableTenants.some(t => t.slug === formData.slug && t.id !== editingId);
  }, [formData.slug, availableTenants, editingId]);

  // Check if subdomain is already taken
  const subdomainTaken = useMemo(() => {
    return !!formData.subdomain && availableTenants.some(t =>
      (t.subdomain ?? t.slug) === formData.subdomain && t.id !== editingId
    );
  }, [formData.subdomain, availableTenants, editingId]);

  // Check if any inline errors exist (for submit button)
  const hasInlineErrors = useMemo(() => {
    return isReserved || slugTaken || subdomainTaken;
  }, [isReserved, slugTaken, subdomainTaken]);

  // Filtrelenmiş ve sıralanmış tenant listesi
  const filteredTenants = useMemo(() => {
    let list = availableTenants;

    // Arama
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(term) ||
        t.slug?.toLowerCase().includes(term) ||
        t.contact_email?.toLowerCase().includes(term)
      );
    }

    // Plan filtresi
    if (planFilter !== 'all') {
      list = list.filter(t => t.subscription_plan === planFilter);
    }

    // Durum filtresi
    if (statusFilter !== 'all') {
      list = list.filter(t => statusFilter === 'active' ? t.is_active : !t.is_active);
    }

    // Sıralama
    list = list.slice().sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'tr');
      if (sortBy === 'plan') return a.subscription_plan.localeCompare(b.subscription_plan);
      if (sortBy === 'status') return Number(b.is_active) - Number(a.is_active);
      return 0;
    });

    return list;
  }, [availableTenants, searchTerm, planFilter, statusFilter, sortBy]);

  if (!isSuperAdmin) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </div>
    );
  }


  const mapTenantToForm = (t: Tenant): TenantFormData => ({
    name: t.name,
    slug: t.slug ?? '',
    subdomain: t.subdomain ?? t.slug ?? '',
    contact_email: t.contact_email ?? '',
    contact_phone: t.contact_phone ?? '',
    address: t.address ?? '',
    country: t.country ?? 'TR',
    timezone: t.timezone ?? 'Europe/Istanbul',
    currency: t.currency ?? 'TRY',
    language: t.language ?? 'tr',
    subscription_plan: t.subscription_plan,
    subscription_start_date: t.subscription_start_date,
    subscription_end_date: t.subscription_end_date,
    max_users: t.max_users,
    max_branches: t.max_branches,
    admin_name: '',
    admin_email: '',
    admin_password: ''
  });

  const isUnlimited = formData.subscription_plan === 'enterprise';

  const formatLimit = (n: number): string => (n >= 9999 ? 'Sınırsız' : `${n}`);

  const toInt = (v: string, min = 1): number => {
    const num = parseInt(v, 10);
    return Number.isFinite(num) && num >= min ? num : min;
  };

  const handleCopyUrl = async () => {
    const text = getTenantUrl(formData.subdomain);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback for browsers without clipboard API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch (err) {
      console.error('Failed to copy URL:', err);
    }
  };

  const validateForm = (): boolean => {
    setValidationError(null);

    // Subdomain rezerve kelime kontrolü (case-insensitive)
    if (RESERVED_SUBDOMAINS.has((formData.subdomain || '').toLowerCase())) {
      setValidationError('Bu subdomain rezerve edilmiş, lütfen farklı bir subdomain seçin!');
      return false;
    }

    // Slug ve subdomain format kontrolü
    if (!isValidSlug(formData.slug)) {
      setValidationError('Slug sadece küçük harf, rakam ve tire içerebilir!');
      return false;
    }
    if (!isValidSlug(formData.subdomain)) {
      setValidationError('Subdomain sadece küçük harf, rakam ve tire içerebilir!');
      return false;
    }

    // Slug ve subdomain benzersizlik kontrolü (final defense)
    if (availableTenants.some(t => t.slug === formData.slug && t.id !== editingId)) {
      setValidationError('Bu slug zaten kullanımda!');
      return false;
    }
    if (availableTenants.some(t => (t.subdomain ?? t.slug) === formData.subdomain && t.id !== editingId)) {
      setValidationError('Bu subdomain zaten kullanımda!');
      return false;
    }

    // Tarih kontrolü
    const startDate = new Date(formData.subscription_start_date);
    const endDate = new Date(formData.subscription_end_date);

    if (endDate < startDate) {
      setValidationError('Bitiş tarihi, başlangıç tarihinden önce olamaz!');
      return false;
    }

    // İletişim e-posta kontrolü (opsiyonel ama doluysa geçerli olmalı)
    if (formData.contact_email && formData.contact_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
      setValidationError('Geçerli bir iletişim e-posta adresi girin!');
      return false;
    }

    // Edit modda admin bilgileri kontrol edilmez
    if (mode === 'create') {
      if (!formData.admin_name.trim()) {
        setValidationError('Yönetici adı gereklidir!');
        return false;
      }
      if (!formData.admin_email.trim()) {
        setValidationError('Yönetici e-postası gereklidir!');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.admin_email)) {
        setValidationError('Geçerli bir yönetici e-posta adresi girin!');
        return false;
      }
      // Şifre kontrolü (sadece create'de zorunlu)
      if (adminPassword.length < 8) {
        setValidationError('Şifre en az 8 karakter olmalıdır!');
        return false;
      }
    }

    return true;
  };

  const openCreate = () => {
    setMode('create');
    setEditingId(null);
    const initial = buildInitialForm();
    setFormData(initial);
    setAdminPassword('');
    initialFormRef.current = JSON.parse(JSON.stringify(initial)); // deep copy
    setValidationError(null);
    setShowNewTenantModal(true);
  };

  const openEdit = (tenant: Tenant) => {
    setMode('edit');
    setEditingId(tenant.id);
    const initial = mapTenantToForm(tenant);
    setFormData(initial);
    setAdminPassword('');
    initialFormRef.current = JSON.parse(JSON.stringify(initial)); // deep copy
    setValidationError(null);
    setShowNewTenantModal(true);
  };

  const handleCloseModal = useCallback(() => {
    setShowNewTenantModal(false);
    setValidationError(null);
    setTimeout(() => {
      setFormData(buildInitialForm());
      setAdminPassword('');
      setEditingId(null);
      initialFormRef.current = null;
      openButtonRef.current?.focus();
    }, 300);
  }, []);

  const tryCloseModal = useCallback(() => {
    // Submitting sırasında kapatmaya izin verme
    if (isSubmitting) return;

    // Gerçek kirli kontrol (deep compare)
    const formDirty = initialFormRef.current
      ? JSON.stringify(initialFormRef.current) !== JSON.stringify(formData)
      : false;
    const passwordDirty = mode === 'create' && adminPassword.length > 0;
    const reallyDirty = formDirty || passwordDirty;

    if (reallyDirty && !confirm('Kaydedilmemiş değişiklikler var. Kapatmak istiyor musunuz?')) {
      return;
    }
    handleCloseModal();
  }, [isSubmitting, formData, mode, adminPassword, handleCloseModal]);

  const handleInputChange = useCallback((field: keyof TenantFormData, value: string | number) => {
    setFormData(prev => {
      // Değişiklik yoksa early return (dirty'yi bouna tetikleme)
      if (prev[field] === value) return prev;

      const newData = { ...prev, [field]: value };

      // Slug otomatik güncelleme sadece create modda
      if (field === 'name' && typeof value === 'string' && mode === 'create') {
        const base = sanitizeSlug(value);
        newData.slug = ensureUnique(base, availableTenants, editingId ?? undefined, 'slug');
        newData.subdomain = ensureUnique(base, availableTenants, editingId ?? undefined, 'subdomain');
      }

      // Plan değiştiğinde limitleri otomatik ayarla
      if (field === 'subscription_plan') {
        const preset = PLAN_PRESETS[value as keyof typeof PLAN_PRESETS];
        if (preset) {
          newData.max_users = preset.max_users;
          newData.max_branches = preset.max_branches;
        }
      }

      // Başlangıç tarihi değişirse ve bitiş daha erkense, bitişi +1 yıl yap
      if (field === 'subscription_start_date' && typeof value === 'string') {
        const start = new Date(value);
        const end = new Date(prev.subscription_end_date);
        if (end < start) {
          const nextYear = new Date(start);
          nextYear.setFullYear(nextYear.getFullYear() + 1);
          newData.subscription_end_date = formatLocalDate(nextYear);
        }
      }

      return newData;
    });
  }, [mode, availableTenants, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double submit guard
    if (isSubmitting) return;

    // Validasyon
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Enterprise normalization (limitleri zorla 9999 yap)
      const normalized = formData.subscription_plan === 'enterprise'
        ? { ...formData, max_users: 9999, max_branches: 9999 }
        : formData;

      // Form verisini hazırla (admin password'ü ayrı state'den al)
      const submissionData = {
        ...normalized,
        admin_password: mode === 'create' ? adminPassword : undefined
      };

      // Güvenli loglama (şifre gizli, sadece dev'de)
      if (isDev) {
        const { admin_password, ...safeData } = submissionData;
        console.log(mode === 'create' ? 'Creating tenant:' : 'Updating tenant:', {
          ...safeData,
          admin_password: admin_password ? '***' : undefined
        });
      }

      // Başarı mesajı
      alert(`✅ Organizasyon başarıyla ${mode === 'create' ? 'oluşturuldu' : 'güncellendi'}!`);

      handleCloseModal();
    } catch (error) {
      console.error('Error submitting tenant:', error);
      setValidationError(error instanceof Error ? error.message : 'Bilinmeyen hata');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (tenantId: string, currentStatus: boolean) => {
    if (!confirm(`Bu kiracıyı ${currentStatus ? 'pasif' : 'aktif'} hale getirmek istediginizden emin misiniz?`)) {
      return;
    }

    try {
      console.log(`Toggling tenant ${tenantId} to ${!currentStatus}`);
      // Gerçek uygulamada Supabase update
      alert(`✅ Kiracı durumu güncellendi!`);
    } catch (error) {
      console.error('Error toggling tenant status:', error);
      alert('❌ Durum güncellenirken hata oluştu!');
    }
  };

  const handleDelete = async (tenantId: string, tenantName: string) => {
    if (!confirm(`"${tenantName}" organizasyonunu silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`)) {
      return;
    }

    try {
      console.log(`Deleting tenant ${tenantId}`);
      // Gerçek uygulamada Supabase delete
      alert('✅ Organizasyon başarıyla silindi!');
    } catch (error) {
      console.error('Error deleting tenant:', error);
      alert('❌ Silme işlemi sırasında hata oluştu!');
    }
  };

  const getPlanLabel = (plan: string): string => {
    const labels = {
      basic: 'Temel',
      professional: 'Profesyonel',
      enterprise: 'Kurumsal'
    };
    return labels[plan as keyof typeof labels] || plan;
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'basic':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizasyon Yönetimi</h1>
          <p className="text-gray-600 mt-1">Tüm kiracıları görüntüleyin ve yönetin</p>
        </div>
        <button
          ref={openButtonRef}
          onClick={openCreate}
          className="flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2.5 rounded-lg transition-all shadow-lg font-medium"
        >
          <Plus className="h-5 w-5" />
          <span>Yeni Organizasyon</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Toplam Organizasyon</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
            </div>
            <Building2 className="h-10 w-10 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Aktif Organizasyon</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.active}</p>
            </div>
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Profesyonel</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{stats.professional}</p>
            </div>
            <Building2 className="h-10 w-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Kurumsal</p>
              <p className="text-2xl font-bold text-purple-600 mt-1">{stats.enterprise}</p>
            </div>
            <Building2 className="h-10 w-10 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Search Bar & Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Organizasyon adı, slug veya e-posta ile ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filtreler:</span>
          </div>

          {/* Plan Filter */}
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value as typeof planFilter)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Planlar</option>
            <option value="basic">Temel</option>
            <option value="professional">Profesyonel</option>
            <option value="enterprise">Kurumsal</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sırala:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Ada göre (A→Z)</option>
              <option value="plan">Plana göre</option>
              <option value="status">Duruma göre</option>
            </select>
          </div>

          {/* Clear Filters */}
          {(searchTerm || planFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setPlanFilter('all');
                setStatusFilter('all');
              }}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Filtreleri Temizle
            </button>
          )}

          <div className="ml-auto text-sm text-gray-600">
            {filteredTenants.length} / {availableTenants.length} organizasyon
          </div>
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Organizasyon
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                İletişim
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Plan
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Limitler
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredTenants.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-500 mb-4">
                    {searchTerm || planFilter !== 'all' || statusFilter !== 'all'
                      ? 'Arama kriterlerine uygun organizasyon bulunamadı'
                      : 'Henüz organizasyon oluşturulmamış'}
                  </p>
                  {searchTerm || planFilter !== 'all' || statusFilter !== 'all' ? (
                    <button
                      onClick={() => {
                        setSearchTerm('');
                        setPlanFilter('all');
                        setStatusFilter('all');
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Filtreleri Temizle
                    </button>
                  ) : (
                    <button
                      onClick={openCreate}
                      className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-6 py-2.5 rounded-lg transition-all shadow-lg font-medium"
                    >
                      <Plus className="h-5 w-5" />
                      <span>İlk Organizasyonu Oluştur</span>
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredTenants.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className={`h-2 w-2 rounded-full mr-3 ${tenant.is_active ? 'bg-green-500' : 'bg-red-500'}`} />
                      <div className="h-10 w-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                        <Building2 className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                        <div className="text-xs text-gray-500">{tenant.slug}</div>
                      </div>
                    </div>
                  </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    {tenant.contact_email && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {tenant.contact_email}
                      </div>
                    )}
                    {tenant.contact_phone && (
                      <div className="flex items-center text-sm text-gray-600">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {tenant.contact_phone}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${getPlanBadgeColor(tenant.subscription_plan)}`}>
                    {getPlanLabel(tenant.subscription_plan)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="space-y-1 text-sm text-gray-600">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-400" />
                      {formatLimit(tenant.max_users)} kullanıcı
                    </div>
                    <div className="flex items-center">
                      <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                      {formatLimit(tenant.max_branches)} şube
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <StatusPill active={tenant.is_active} />
                    {(() => {
                      const daysLeft = daysUntilDate(tenant.subscription_end_date);
                      return daysLeft <= 14 && daysLeft >= 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                          <Bell className="h-3 w-3 mr-1" />
                          {daysLeft} gün kaldı
                        </span>
                      ) : null;
                    })()}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => handleToggleActive(tenant.id, tenant.is_active)}
                      className={`p-2 rounded-lg transition-colors ${
                        tenant.is_active
                          ? 'text-yellow-600 hover:bg-yellow-50'
                          : 'text-green-600 hover:bg-green-50'
                      }`}
                      title={tenant.is_active ? 'Pasif yap' : 'Aktif yap'}
                      aria-label={tenant.is_active ? 'Pasif yap' : 'Aktif yap'}
                    >
                      {tenant.is_active ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(tenant as Tenant)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Düzenle"
                      aria-label="Düzenle"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(tenant.id, tenant.name)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Sil"
                      aria-label="Sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
          </tbody>
        </table>
      </div>

      {/* New Tenant Modal */}
      {showNewTenantModal && (
        <div
          className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-50 flex items-center justify-center"
          onClick={() => { if (!isSubmitting) tryCloseModal(); }}
          aria-hidden="true"
          style={{ zIndex: 9999, margin: 0, padding: 0 }}
        >
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            aria-describedby="modal-desc"
            className="bg-white rounded-xl shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh] m-4 outline-none overscroll-contain"
            style={{ touchAction: 'pan-y' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header - Gradient like LeadPreviewPopup */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white shadow-md flex-shrink-0 rounded-t-xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 id="modal-title" className="text-xl font-bold">
                      {mode === 'create' ? 'Yeni Organizasyon Oluştur' : 'Organizasyonu Düzenle'}
                    </h2>
                    <p id="modal-desc" className="text-sm text-white/80">Kiracı bilgilerini doldurun ve abonelik süresini belirleyin</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { if (!isSubmitting) tryCloseModal(); }}
                  className="text-white/80 hover:text-white transition-colors"
                  aria-label="Modalı kapat"
                  disabled={isSubmitting}
                >
                  <X className="h-6 w-6" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Validation Error */}
            {validationError && (
              <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start" role="alert" aria-live="assertive">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">{validationError}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setValidationError(null)}
                  className="text-red-400 hover:text-red-600"
                  aria-label="Hatayı kapat"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Body - Scrollable */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto" noValidate aria-busy={isSubmitting ? 'true' : 'false'}>
              <fieldset disabled={isSubmitting} className={isSubmitting ? 'opacity-75 pointer-events-none' : ''}>
                <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="org_name" className="block text-sm font-medium text-gray-700 mb-2">
                    Organizasyon Adı *
                  </label>
                  <input
                    id="org_name"
                    ref={firstInputRef}
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: İstanbul Sağlık Merkezi"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="contact_email" className="block text-sm font-medium text-gray-700 mb-2">
                    İletişim E-posta
                  </label>
                  <input
                    id="contact_email"
                    type="email"
                    autoComplete="email"
                    value={formData.contact_email}
                    onChange={(e) => handleInputChange('contact_email', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    placeholder="info@organizasyon.com"
                  />
                </div>

                <div>
                  <label htmlFor="contact_phone" className="block text-sm font-medium text-gray-700 mb-2">
                    İletişim Telefon
                  </label>
                  <input
                    id="contact_phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.contact_phone}
                    onChange={(e) => handleInputChange('contact_phone', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>

                <div className="md:col-span-2">
                  <label htmlFor="contact_address" className="block text-sm font-medium text-gray-700 mb-2">
                    Adres
                  </label>
                  <textarea
                    id="contact_address"
                    value={formData.contact_address}
                    onChange={(e) => handleInputChange('contact_address', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Organizasyon adresi"
                    rows={3}
                  />
                </div>
              </div>

              {/* License Period Section */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5">
                <div className="flex items-center space-x-2 mb-4">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Lisans Dönemi</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  Organizasyonun sisteme erişim tarihlerini belirleyin.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="subscription_start_date" className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-green-600" />
                      <span>Başlangıç Tarihi *</span>
                    </label>
                    <input
                      id="subscription_start_date"
                      type="date"
                      min={mode === 'create' ? formatLocalDate() : undefined}
                      value={formData.subscription_start_date}
                      onChange={(e) => handleInputChange('subscription_start_date', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  <div>
                    <label htmlFor="subscription_end_date" className="block text-sm font-medium text-gray-700 mb-2 flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-red-600" />
                      <span>Bitiş Tarihi *</span>
                    </label>
                    <input
                      id="subscription_end_date"
                      type="date"
                      min={formData.subscription_start_date}
                      value={formData.subscription_end_date}
                      onChange={(e) => handleInputChange('subscription_end_date', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Admin User Section - Only in create mode */}
              {mode === 'create' && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Yönetici Kullanıcı Bilgileri
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Bu organizasyon için otomatik olarak bir yönetici kullanıcısı oluşturulacaktır.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="admin_name" className="block text-sm font-medium text-gray-700 mb-2">
                        Yönetici Adı *
                      </label>
                      <input
                        id="admin_name"
                        type="text"
                        autoComplete="name"
                        value={formData.admin_name}
                        onChange={(e) => handleInputChange('admin_name', e.target.value)}
                        placeholder="Örn: Mehmet Yılmaz"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        required={mode === 'create'}
                      />
                    </div>

                    <div>
                      <label htmlFor="admin_email" className="block text-sm font-medium text-gray-700 mb-2">
                        Yönetici E-posta *
                      </label>
                      <input
                        id="admin_email"
                        type="email"
                        autoComplete="email"
                        value={formData.admin_email}
                        onChange={(e) => handleInputChange('admin_email', e.target.value)}
                        placeholder="admin@example.com"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        required={mode === 'create'}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="admin_password" className="block text-sm font-medium text-gray-700 mb-2">
                        Yönetici Şifre *
                      </label>
                      <input
                        id="admin_password"
                        type="password"
                        autoComplete="new-password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="Güvenli bir şifre belirleyin"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                        required={mode === 'create'}
                        minLength={8}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Bu şifre ile yönetici kullanıcısı giriş yapabilecektir. En az 8 karakter olmalıdır.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {mode === 'edit' && (
                <div className="border-t border-gray-200 pt-6 mt-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-800">
                      <strong>Not:</strong> Düzenleme modunda yönetici bilgileri değiştirilemez. Kullanıcı yönetiminden admin kullanıcıları düzenleyebilirsiniz.
                    </p>
                  </div>
                </div>
              )}
                </div>
              </fieldset>

              {/* Footer - Sticky */}
              <div className="sticky bottom-0 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200 px-6 py-4 flex-shrink-0 rounded-b-xl">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={tryCloseModal}
                    className="px-6 py-2.5 border-2 border-gray-300 rounded-lg text-gray-700 hover:bg-white hover:border-gray-400 transition-all font-medium"
                    disabled={isSubmitting}
                  >
                    İptal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || hasInlineErrors}
                    className="px-8 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium shadow-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>{mode === 'create' ? 'Oluşturuluyor...' : 'Güncelleniyor...'}</span>
                      </>
                    ) : (
                      <>
                        {mode === 'create' ? <Plus className="h-5 w-5" /> : <Check className="h-5 w-5" />}
                        <span>{mode === 'create' ? 'Organizasyonu Oluştur' : 'Değişiklikleri Kaydet'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TenantManagement;
