import React, { useState, useEffect } from 'react';
import { useModalBodyScroll } from '../../hooks/useModalBodyScroll';
import { 
  insertEmployee, 
  insertEmployeeSalary, 
  createUserAccount, 
  uploadEmployeeDocument,
  calculateGrossSalary,
  logAuditEvent,
  hasHRPermission
} from '../../services/hrSupabaseService';
import { useAuth } from '../../contexts/AuthContext';
import { useBranch } from '../../contexts/BranchContext';
import { 
  X, 
  XCircle, 
  UserPlus, 
  User, 
  Building2, 
  CreditCard,
  FileText,
  Save,
  Loader2,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Upload,
  Trash2,
  Shield,
  Key,
  Mail,
  Phone,
  Calendar,
  MapPin,
  Briefcase,
  DollarSign,
  Euro,
  Banknote,
  Lock,
  Globe,
  Settings
} from 'lucide-react';
import { sendWelcomeEmail } from '../../services/emailService';

interface NewEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEmployeeAdded?: (employee: any) => void;
  editingEmployee?: any;
}

const NewEmployeeModal: React.FC<NewEmployeeModalProps> = ({ 
  isOpen, 
  onClose, 
  onEmployeeAdded,
  editingEmployee 
}) => {
  const { user } = useAuth();
  const { branches, currentBranch } = useBranch();
  
  // Modal açıkken body scroll'unu kapat
  useModalBodyScroll(isOpen);
  
  const [activeTab, setActiveTab] = useState('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  
  // Form verileri
  const [basicInfo, setBasicInfo] = useState({
    fullName: '',
    tcknPassport: '',
    gender: '',
    birthDate: '',
    phone: '',
    email: '',
    department: '',
    position: '',
    startDate: '',
    branchId: currentBranch?.id || '',
    address: '',
    emergencyContact: '',
    emergencyPhone: ''
  });

  const [userAccount, setUserAccount] = useState({
    createUser: false,
    role: 'employee',
    permissions: [],
    username: '',
    password: '',
    confirmPassword: '',
    language: 'tr',
    enable2FA: false,
    sendWelcomeEmail: true
  });

  const [salaryInfo, setSalaryInfo] = useState({
    grossSalary: 0,
    netSalary: 0,
    currency: 'TRY',
    salaryType: 'monthly',
    bonus: 0,
    mealSupport: 0,
    transportSupport: 0,
    overtimeRate: 0,
    taxRate: 18,
    stampTax: 0.759,
    insuranceEmployee: 14,
    insuranceEmployer: 20.5,
    exemptionNote: '',
    payrollNote: '',
    iban: '',
    bankName: '',
    startDate: new Date().toISOString().split('T')[0]
  });

  const [documents, setDocuments] = useState({
    cv: null as File | null,
    contract: null as File | null,
    certificates: [] as File[],
    notes: ''
  });

  // Departmanlar
  const departments = [
    { id: 'medical', name: 'Tıbbi Personel', description: 'Doktor, hemşire, teknisyen' },
    { id: 'administrative', name: 'İdari Personel', description: 'Yönetim, sekreter, muhasebe' },
    { id: 'sales', name: 'Satış & Pazarlama', description: 'Satış temsilcisi, pazarlama uzmanı' },
    { id: 'technical', name: 'Teknik Personel', description: 'IT, mühendis, tekniker' },
    { id: 'support', name: 'Destek Hizmetleri', description: 'Güvenlik, temizlik, yemek' },
    { id: 'finance', name: 'Finans & Muhasebe', description: 'Mali işler, bordro, vergi' }
  ];

  // Roller
  const roles = [
    { id: 'employee', name: 'Personel', description: 'Temel personel yetkileri' },
    { id: 'nurse', name: 'Hemşire', description: 'Hasta bakımı ve tıbbi destek' },
    { id: 'doctor', name: 'Doktor', description: 'Tıbbi muayene ve tedavi' },
    { id: 'agent', name: 'Satış Temsilcisi', description: 'Lead yönetimi ve satış' },
    { id: 'coordinator', name: 'Koordinatör', description: 'Hasta koordinasyonu' },
    { id: 'manager', name: 'Müdür', description: 'Departman yönetimi' },
    { id: 'admin', name: 'Yönetici', description: 'Sistem yönetimi' },
    { id: 'super_admin', name: 'Sistem Yöneticisi', description: 'Tam yetki' }
  ];

  // Para birimleri
  const currencies = [
    { code: 'TRY', symbol: '₺', name: 'Türk Lirası' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Amerikan Doları' },
    { code: 'GBP', symbol: '£', name: 'İngiliz Sterlini' }
  ];

  // Maaş tipleri
  const salaryTypes = [
    { id: 'monthly', name: 'Aylık Sabit', description: 'Sabit aylık maaş' },
    { id: 'hourly', name: 'Saatlik', description: 'Saat başına ücret' },
    { id: 'daily', name: 'Günlük', description: 'Gün başına ücret' },
    { id: 'contract', name: 'Sözleşmeli', description: 'Proje bazlı ödeme' },
    { id: 'commission', name: 'Komisyonlu', description: 'Satış komisyonu' }
  ];

  // Diller
  const languages = [
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'ar', name: 'العربية', flag: '🇸🇦' },
    { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'fr', name: 'Français', flag: '🇫🇷' },
    { code: 'ru', name: 'Русский', flag: '🇷🇺' }
  ];

  // Yetki kontrolü - maaş bilgilerini görebilir mi?
  const canViewSalary = user?.role && ['super_admin', 'admin', 'manager', 'finance'].includes(user.role);

  // ESC tuşu ile kapatma
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Düzenleme modunda verileri yükle
  useEffect(() => {
    if (editingEmployee) {
      setBasicInfo({
        fullName: editingEmployee.name || '',
        tcknPassport: editingEmployee.tcknPassport || '',
        gender: editingEmployee.gender || '',
        birthDate: editingEmployee.birthDate || '',
        phone: editingEmployee.phone || '',
        email: editingEmployee.email || '',
        department: editingEmployee.department || '',
        position: editingEmployee.position || '',
        startDate: editingEmployee.startDate || '',
        branchId: editingEmployee.branchId || '',
        address: editingEmployee.address || '',
        emergencyContact: editingEmployee.emergencyContact || '',
        emergencyPhone: editingEmployee.emergencyPhone || ''
      });

      if (editingEmployee.salary) {
        setSalaryInfo({
          grossSalary: editingEmployee.salary || 0,
          netSalary: editingEmployee.netSalary || 0,
          currency: editingEmployee.currency || 'TRY',
          salaryType: editingEmployee.salaryType || 'monthly',
          bonus: editingEmployee.bonus || 0,
          mealSupport: editingEmployee.mealSupport || 0,
          transportSupport: editingEmployee.transportSupport || 0,
          overtimeRate: editingEmployee.overtimeRate || 0,
          taxRate: editingEmployee.taxRate || 18,
          stampTax: editingEmployee.stampTax || 0.759,
          insuranceEmployee: editingEmployee.insuranceEmployee || 14,
          insuranceEmployer: editingEmployee.insuranceEmployer || 20.5,
          exemptionNote: editingEmployee.exemptionNote || '',
          payrollNote: editingEmployee.payrollNote || '',
          iban: editingEmployee.iban || '',
          bankName: editingEmployee.bankName || '',
          startDate: editingEmployee.salaryStartDate || new Date().toISOString().split('T')[0]
        });
      }
    }
  }, [editingEmployee]);

  // Modal dışına tıklayarak kapatma
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Form değişiklik handler'ları
  const handleBasicInfoChange = (field: string, value: any) => {
    setBasicInfo(prev => ({ ...prev, [field]: value }));
    
    // E-posta değişirse kullanıcı adını otomatik doldur
    if (field === 'email' && userAccount.createUser) {
      const username = value.split('@')[0];
      setUserAccount(prev => ({ ...prev, username }));
    }
  };

  const handleUserAccountChange = (field: string, value: any) => {
    setUserAccount(prev => ({ ...prev, [field]: value }));
  };

  const handleSalaryInfoChange = (field: string, value: any) => {
    setSalaryInfo(prev => ({ ...prev, [field]: value }));
  };

  const handleDocumentsChange = (field: string, value: any) => {
    setDocuments(prev => ({ ...prev, [field]: value }));
  };

  // Dosya yükleme
  const handleFileUpload = (field: string, files: FileList | null) => {
    if (!files) return;
    
    if (field === 'certificates') {
      setDocuments(prev => ({
        ...prev,
        certificates: [...prev.certificates, ...Array.from(files)]
      }));
    } else {
      setDocuments(prev => ({
        ...prev,
        [field]: files[0]
      }));
    }
  };

  // Dosya silme
  const handleRemoveFile = (field: string, index?: number) => {
    if (field === 'certificates' && index !== undefined) {
      setDocuments(prev => ({
        ...prev,
        certificates: prev.certificates.filter((_, i) => i !== index)
      }));
    } else {
      setDocuments(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Net maaş hesaplama
  const calculateNetSalary = () => {
    const gross = salaryInfo.grossSalary;
    if (gross <= 0) return 0;

    // Basit net maaş hesaplama (Türkiye için)
    const insuranceDeduction = (gross * salaryInfo.insuranceEmployee) / 100;
    const taxableIncome = gross - insuranceDeduction;
    const taxDeduction = (taxableIncome * salaryInfo.taxRate) / 100;
    const stampTaxDeduction = (gross * salaryInfo.stampTax) / 100;
    
    const net = gross - insuranceDeduction - taxDeduction - stampTaxDeduction;
    return Math.max(net, 0);
  };

  // Net maaştan brüt maaş hesaplama
  const calculateGrossFromNet = (netAmount: number): number => {
    // Supabase RPC fonksiyonunu kullan
    calculateGrossSalary(netAmount, salaryInfo.taxRate, salaryInfo.insuranceEmployee)
      .then(result => {
        if (result.success && result.data) {
          setSalaryInfo(prev => ({ ...prev, grossSalary: result.data }));
        }
      })
      .catch(console.error);
    
    // Geçici hesaplama (RPC yanıtı gelene kadar)
    return netAmount / 0.70;
  };

  // Form validasyonu
  const validateForm = () => {
    // Temel bilgiler kontrolü
    if (!basicInfo.fullName.trim()) {
      setError('Ad-Soyad gereklidir');
      setActiveTab('basic');
      return false;
    }

    if (!basicInfo.tcknPassport.trim()) {
      setError('TCKN/Pasaport No gereklidir');
      setActiveTab('basic');
      return false;
    }

    if (!basicInfo.department) {
      setError('Departman seçimi gereklidir');
      setActiveTab('basic');
      return false;
    }

    if (!basicInfo.position.trim()) {
      setError('Görev/Pozisyon gereklidir');
      setActiveTab('basic');
      return false;
    }

    if (!basicInfo.startDate) {
      setError('İşe başlama tarihi gereklidir');
      setActiveTab('basic');
      return false;
    }

    // Kullanıcı hesabı kontrolü
    if (userAccount.createUser) {
      if (!basicInfo.email.trim()) {
        setError('Kullanıcı hesabı için e-posta gereklidir');
        setActiveTab('basic');
        return false;
      }

      if (!userAccount.username.trim()) {
        setError('Kullanıcı adı gereklidir');
        setActiveTab('user');
        return false;
      }

      if (!userAccount.password.trim()) {
        setError('Parola gereklidir');
        setActiveTab('user');
        return false;
      }

      if (userAccount.password !== userAccount.confirmPassword) {
        setError('Parolalar eşleşmiyor');
        setActiveTab('user');
        return false;
      }

      if (userAccount.password.length < 6) {
        setError('Parola en az 6 karakter olmalıdır');
        setActiveTab('user');
        return false;
      }
    }

    return true;
  };

  // Form gönderme
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Simüle edilmiş API çağrısı
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Net maaş hesapla
      const calculatedNetSalary = calculateNetSalary();

      // Personel verisi oluştur
      const employeeData = {
        id: editingEmployee?.id || `emp_${Date.now()}`,
        employeeId: editingEmployee?.employeeId || `EMP${String(Date.now()).slice(-6)}`,
        name: basicInfo.fullName,
        tcknPassport: basicInfo.tcknPassport,
        gender: basicInfo.gender,
        birthDate: basicInfo.birthDate,
        phone: basicInfo.phone,
        email: basicInfo.email,
        department: basicInfo.department,
        position: basicInfo.position,
        startDate: basicInfo.startDate,
        branchId: basicInfo.branchId,
        address: basicInfo.address,
        emergencyContact: basicInfo.emergencyContact,
        emergencyPhone: basicInfo.emergencyPhone,
        status: 'active',
        avatar: null,
        performance: 0,
        leaveBalance: 15,
        // Maaş bilgileri (sadece yetkili roller için)
        ...(canViewSalary && {
          salary: salaryInfo.grossSalary,
          netSalary: calculatedNetSalary,
          currency: salaryInfo.currency,
          salaryType: salaryInfo.salaryType,
          bonus: salaryInfo.bonus,
          mealSupport: salaryInfo.mealSupport,
          transportSupport: salaryInfo.transportSupport,
          overtimeRate: salaryInfo.overtimeRate,
          taxRate: salaryInfo.taxRate,
          stampTax: salaryInfo.stampTax,
          insuranceEmployee: salaryInfo.insuranceEmployee,
          insuranceEmployer: salaryInfo.insuranceEmployer,
          exemptionNote: salaryInfo.exemptionNote,
          payrollNote: salaryInfo.payrollNote,
          iban: salaryInfo.iban,
          bankName: salaryInfo.bankName,
          salaryStartDate: salaryInfo.startDate
        }),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.id
      };

      // Kullanıcı hesabı oluşturulacaksa
      let userData = null;
      if (userAccount.createUser) {
        userData = {
          id: `user_${Date.now()}`,
          employeeId: employeeData.id,
          name: basicInfo.fullName,
          email: basicInfo.email,
          username: userAccount.username,
          password: userAccount.password, // Gerçek uygulamada hash'lenecek
          role: userAccount.role,
          permissions: userAccount.permissions,
          language: userAccount.language,
          enable2FA: userAccount.enable2FA,
          isActive: true,
          createdAt: new Date().toISOString()
        };

        // Hoş geldiniz e-postası gönder
        if (userAccount.sendWelcomeEmail) {
          try {
            const emailSettings = JSON.parse(localStorage.getItem('emailSettings') || '{}');
            await sendWelcomeEmail(
              emailSettings,
              { name: basicInfo.fullName, email: basicInfo.email },
              userAccount.password,
              userAccount.role
            );
          } catch (emailError) {
            console.error('Welcome email error:', emailError);
            // E-posta hatası personel eklemeyi engellemez
          }
        }
      }

      // LocalStorage'a kaydet (demo için)
      const existingEmployees = JSON.parse(localStorage.getItem('hr_employees') || '[]');
      
      if (editingEmployee) {
        // Güncelleme
        const updatedEmployees = existingEmployees.map((emp: any) => 
          emp.id === editingEmployee.id ? { ...emp, ...employeeData } : emp
        );
        localStorage.setItem('hr_employees', JSON.stringify(updatedEmployees));
      } else {
        // Yeni ekleme
        existingEmployees.push(employeeData);
        localStorage.setItem('hr_employees', JSON.stringify(existingEmployees));
      }

      // Kullanıcı verisi varsa kaydet
      if (userData) {
        const existingUsers = JSON.parse(localStorage.getItem('system_users') || '[]');
        existingUsers.push(userData);
        localStorage.setItem('system_users', JSON.stringify(existingUsers));
      }

      // Callback çağır
      if (onEmployeeAdded) {
        onEmployeeAdded(employeeData);
      }

      // Formu temizle
      setBasicInfo({
        fullName: '',
        tcknPassport: '',
        gender: '',
        birthDate: '',
        phone: '',
        email: '',
        department: '',
        position: '',
        startDate: '',
        branchId: currentBranch?.id || '',
        address: '',
        emergencyContact: '',
        emergencyPhone: ''
      });

      setUserAccount({
        createUser: false,
        role: 'employee',
        permissions: [],
        username: '',
        password: '',
        confirmPassword: '',
        language: 'tr',
        enable2FA: false,
        sendWelcomeEmail: true
      });

      setSalaryInfo({
        grossSalary: 0,
        netSalary: 0,
        currency: 'TRY',
        salaryType: 'monthly',
        bonus: 0,
        mealSupport: 0,
        transportSupport: 0,
        overtimeRate: 0,
        taxRate: 18,
        stampTax: 0.759,
        insuranceEmployee: 14,
        insuranceEmployer: 20.5,
        exemptionNote: '',
        payrollNote: '',
        iban: '',
        bankName: '',
        startDate: new Date().toISOString().split('T')[0]
      });

      setDocuments({
        cv: null,
        contract: null,
        certificates: [],
        notes: ''
      });

      onClose();
    } catch (err) {
      console.error('Personel ekleme hatası:', err);
      setError('Personel eklenirken bir hata oluştu');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Net maaş otomatik hesaplama
  useEffect(() => {
    if (salaryInfo.grossSalary > 0) {
      const calculated = calculateNetSalary();
      setSalaryInfo(prev => ({ ...prev, netSalary: calculated }));
    }
  }, [salaryInfo.grossSalary, salaryInfo.taxRate, salaryInfo.insuranceEmployee, salaryInfo.stampTax]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[99999] transition-opacity duration-300" 
      onClick={handleBackdropClick}
      style={{ margin: 0, padding: 0, top: 0, left: 0, right: 0, bottom: 0 }}
    >
      <div 
        className="bg-white rounded-xl shadow-xl max-w-4xl w-full flex flex-col max-h-[90vh]" 
        style={{ margin: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white shadow-md flex-shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 rounded-full bg-white bg-opacity-20 flex items-center justify-center">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">
                  {editingEmployee ? 'Personel Düzenle' : 'Yeni Personel Ekle'}
                </h2>
                <div className="text-blue-100 text-sm">
                  {editingEmployee ? 'Personel bilgilerini güncelle' : 'Yeni personel kaydı oluştur'}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="ml-4 bg-white bg-opacity-20 text-white p-2 rounded-full hover:bg-opacity-30 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mx-6 mt-4">
            <div className="flex items-center text-red-800">
              <AlertTriangle className="h-4 w-4 mr-2" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 bg-gray-50">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'basic', label: 'Temel Bilgiler', icon: User, required: true },
              { id: 'user', label: 'Kullanıcı Hesabı', icon: Key, required: userAccount.createUser },
              ...(canViewSalary ? [{ id: 'salary', label: 'Maaş Bilgileri', icon: DollarSign, required: false }] : []),
              { id: 'documents', label: 'Evraklar', icon: FileText, required: false }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.required && (
                  <span className="text-red-500">*</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-grow p-6">
          {/* Temel Bilgiler Sekmesi */}
          {activeTab === 'basic' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Info className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium text-blue-900">Personel Temel Bilgileri</h4>
                </div>
                <p className="text-sm text-blue-700">
                  Personelin kimlik, iletişim ve pozisyon bilgilerini girin. Kırmızı (*) işaretli alanlar zorunludur.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ad-Soyad *
                  </label>
                  <input
                    type="text"
                    value={basicInfo.fullName}
                    onChange={(e) => handleBasicInfoChange('fullName', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: Mehmet Yılmaz"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    TCKN / Pasaport No *
                  </label>
                  <input
                    type="text"
                    value={basicInfo.tcknPassport}
                    onChange={(e) => handleBasicInfoChange('tcknPassport', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="12345678901 veya A1234567"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cinsiyet
                  </label>
                  <select
                    value={basicInfo.gender}
                    onChange={(e) => handleBasicInfoChange('gender', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Belirtilmedi</option>
                    <option value="male">Erkek</option>
                    <option value="female">Kadın</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Doğum Tarihi
                  </label>
                  <input
                    type="date"
                    value={basicInfo.birthDate}
                    onChange={(e) => handleBasicInfoChange('birthDate', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Telefon
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="tel"
                      value={basicInfo.phone}
                      onChange={(e) => handleBasicInfoChange('phone', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+90 555 123 45 67"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    E-posta {userAccount.createUser && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="email"
                      value={basicInfo.email}
                      onChange={(e) => handleBasicInfoChange('email', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="mehmet.yilmaz@duendehealth.com"
                      required={userAccount.createUser}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Departman *
                  </label>
                  <select
                    value={basicInfo.department}
                    onChange={(e) => handleBasicInfoChange('department', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Departman Seçin</option>
                    {departments.map(dept => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name} - {dept.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Görevi/Pozisyonu *
                  </label>
                  <input
                    type="text"
                    value={basicInfo.position}
                    onChange={(e) => handleBasicInfoChange('position', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Örn: Kardiyolog, Satış Temsilcisi, IT Uzmanı"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İşe Başlama Tarihi *
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={basicInfo.startDate}
                      onChange={(e) => handleBasicInfoChange('startDate', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Şube/Lokasyon *
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <select
                      value={basicInfo.branchId}
                      onChange={(e) => handleBasicInfoChange('branchId', e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Şube Seçin</option>
                      {branches.map(branch => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name} - {branch.address}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adres
                  </label>
                  <textarea
                    rows={3}
                    value={basicInfo.address}
                    onChange={(e) => handleBasicInfoChange('address', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Ev adresi..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Acil Durum İletişim Kişisi
                    </label>
                    <input
                      type="text"
                      value={basicInfo.emergencyContact}
                      onChange={(e) => handleBasicInfoChange('emergencyContact', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Yakın akraba adı"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Acil Durum Telefonu
                    </label>
                    <input
                      type="tel"
                      value={basicInfo.emergencyPhone}
                      onChange={(e) => handleBasicInfoChange('emergencyPhone', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+90 555 987 65 43"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Kullanıcı Hesabı Sekmesi */}
          {activeTab === 'user' && (
            <div className="space-y-6">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Key className="h-5 w-5 text-purple-600" />
                  <h4 className="font-medium text-purple-900">Kullanıcı Hesabı Oluşturma</h4>
                </div>
                <p className="text-sm text-purple-700">
                  Bu personel için sistem kullanıcı hesabı oluşturmak istiyorsanız aşağıdaki seçeneği işaretleyin.
                </p>
              </div>

              <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg">
                <input
                  type="checkbox"
                  id="createUser"
                  checked={userAccount.createUser}
                  onChange={(e) => handleUserAccountChange('createUser', e.target.checked)}
                  className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                />
                <div>
                  <label htmlFor="createUser" className="text-sm font-medium text-gray-900">
                    Bu personel için kullanıcı hesabı oluştur
                  </label>
                  <p className="text-xs text-gray-600">
                    İşaretlenirse personel sisteme giriş yapabilir
                  </p>
                </div>
              </div>

              {userAccount.createUser && (
                <div className="space-y-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rol *
                      </label>
                      <select
                        value={userAccount.role}
                        onChange={(e) => handleUserAccountChange('role', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      >
                        {roles.map(role => (
                          <option key={role.id} value={role.id}>
                            {role.name} - {role.description}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Dil Tercihi
                      </label>
                      <select
                        value={userAccount.language}
                        onChange={(e) => handleUserAccountChange('language', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      >
                        {languages.map(lang => (
                          <option key={lang.code} value={lang.code}>
                            {lang.flag} {lang.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Kullanıcı Adı *
                      </label>
                      <input
                        type="text"
                        value={userAccount.username}
                        onChange={(e) => handleUserAccountChange('username', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="mehmet.yilmaz"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Parola *
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={userAccount.password}
                          onChange={(e) => handleUserAccountChange('password', e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="Güçlü parola"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Parola Tekrar *
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={userAccount.confirmPassword}
                        onChange={(e) => handleUserAccountChange('confirmPassword', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Parolayı tekrar girin"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="enable2FA"
                        checked={userAccount.enable2FA}
                        onChange={(e) => handleUserAccountChange('enable2FA', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <div>
                        <label htmlFor="enable2FA" className="text-sm font-medium text-gray-900">
                          İki Faktörlü Kimlik Doğrulama
                        </label>
                        <p className="text-xs text-gray-600">
                          Giriş sırasında SMS/e-posta doğrulama ister
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="sendWelcomeEmail"
                        checked={userAccount.sendWelcomeEmail}
                        onChange={(e) => handleUserAccountChange('sendWelcomeEmail', e.target.checked)}
                        className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      />
                      <div>
                        <label htmlFor="sendWelcomeEmail" className="text-sm font-medium text-gray-900">
                          Hoş Geldiniz E-postası Gönder
                        </label>
                        <p className="text-xs text-gray-600">
                          Hesap bilgileri e-posta ile gönderilir
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Maaş Bilgileri Sekmesi */}
          {activeTab === 'salary' && canViewSalary && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <Shield className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium text-green-900">Maaş ve Finansal Bilgiler</h4>
                </div>
                <p className="text-sm text-green-700">
                  Bu bilgiler sadece yetkili personel tarafından görülebilir. KVKK kapsamında korunur.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Brüt Maaş
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={salaryInfo.grossSalary}
                      onChange={(e) => handleSalaryInfoChange('grossSalary', parseFloat(e.target.value) || 0)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="25000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Net Maaş (Otomatik Hesaplanan)
                  </label>
                  <div className="w-full border border-gray-200 rounded-lg px-3 py-2 bg-gray-100 text-gray-900 font-semibold">
                    {currencies.find(c => c.code === salaryInfo.currency)?.symbol}
                    {calculateNetSalary().toLocaleString()}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Para Birimi
                  </label>
                  <select
                    value={salaryInfo.currency}
                    onChange={(e) => handleSalaryInfoChange('currency', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {currencies.map(currency => (
                      <option key={currency.code} value={currency.code}>
                        {currency.symbol} {currency.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maaş Tipi
                  </label>
                  <select
                    value={salaryInfo.salaryType}
                    onChange={(e) => handleSalaryInfoChange('salaryType', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    {salaryTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name} - {type.description}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Aylık Bonus/Prim
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryInfo.bonus}
                    onChange={(e) => handleSalaryInfoChange('bonus', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="2000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Yemek Yardımı
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryInfo.mealSupport}
                    onChange={(e) => handleSalaryInfoChange('mealSupport', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ulaşım Yardımı
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryInfo.transportSupport}
                    onChange={(e) => handleSalaryInfoChange('transportSupport', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fazla Mesai Ücreti (Saat Başı)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salaryInfo.overtimeRate}
                    onChange={(e) => handleSalaryInfoChange('overtimeRate', parseFloat(e.target.value) || 0)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="50"
                  />
                </div>
              </div>

              {/* Vergi ve SGK Bilgileri */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-medium text-yellow-900 mb-4">Vergi ve SGK Oranları</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Gelir Vergisi Oranı (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={salaryInfo.taxRate}
                      onChange={(e) => handleSalaryInfoChange('taxRate', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Damga Vergisi (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      step="0.001"
                      value={salaryInfo.stampTax}
                      onChange={(e) => handleSalaryInfoChange('stampTax', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SGK İşçi Payı (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      value={salaryInfo.insuranceEmployee}
                      onChange={(e) => handleSalaryInfoChange('insuranceEmployee', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      SGK İşveren Payı (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="50"
                      step="0.1"
                      value={salaryInfo.insuranceEmployer}
                      onChange={(e) => handleSalaryInfoChange('insuranceEmployer', parseFloat(e.target.value) || 0)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Banka Bilgileri */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-4">Banka Bilgileri</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Banka Adı
                    </label>
                    <input
                      type="text"
                      value={salaryInfo.bankName}
                      onChange={(e) => handleSalaryInfoChange('bankName', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Örn: Ziraat Bankası"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      IBAN
                    </label>
                    <input
                      type="text"
                      value={salaryInfo.iban}
                      onChange={(e) => handleSalaryInfoChange('iban', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="TR64 0001 0000 0000 0000 0000 01"
                    />
                  </div>
                </div>
              </div>

              {/* Notlar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Muafiyet Notu
                  </label>
                  <textarea
                    rows={3}
                    value={salaryInfo.exemptionNote}
                    onChange={(e) => handleSalaryInfoChange('exemptionNote', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Vergi muafiyeti, indirim vb."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Bordro Notu
                  </label>
                  <textarea
                    rows={3}
                    value={salaryInfo.payrollNote}
                    onChange={(e) => handleSalaryInfoChange('payrollNote', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Bordro ile ilgili özel notlar..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Evraklar Sekmesi */}
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <div className="flex items-center space-x-2 mb-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                  <h4 className="font-medium text-orange-900">Personel Evrakları</h4>
                </div>
                <p className="text-sm text-orange-700">
                  Personelin özlük dosyası için gerekli belgeleri yükleyebilirsiniz.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    CV / Özgeçmiş
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload('cv', e.target.files)}
                      className="hidden"
                      id="cv-upload"
                    />
                    <label htmlFor="cv-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">CV yükle</p>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX</p>
                    </label>
                    {documents.cv && (
                      <div className="mt-2 flex items-center justify-between bg-green-50 p-2 rounded">
                        <span className="text-sm text-green-800">{documents.cv.name}</span>
                        <button
                          onClick={() => handleRemoveFile('cv')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    İş Sözleşmesi
                  </label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => handleFileUpload('contract', e.target.files)}
                      className="hidden"
                      id="contract-upload"
                    />
                    <label htmlFor="contract-upload" className="cursor-pointer">
                      <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Sözleşme yükle</p>
                      <p className="text-xs text-gray-500">PDF, DOC, DOCX</p>
                    </label>
                    {documents.contract && (
                      <div className="mt-2 flex items-center justify-between bg-green-50 p-2 rounded">
                        <span className="text-sm text-green-800">{documents.contract.name}</span>
                        <button
                          onClick={() => handleRemoveFile('contract')}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sertifikalar (Çoklu Yükleme)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={(e) => handleFileUpload('certificates', e.target.files)}
                    className="hidden"
                    id="certificates-upload"
                  />
                  <label htmlFor="certificates-upload" className="cursor-pointer">
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Sertifikaları yükle</p>
                    <p className="text-xs text-gray-500">PDF, JPG, PNG (Çoklu seçim)</p>
                  </label>
                  
                  {documents.certificates.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {documents.certificates.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 p-2 rounded">
                          <span className="text-sm text-green-800">{file.name}</span>
                          <button
                            onClick={() => handleRemoveFile('certificates', index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Dahili Notlar
                </label>
                <textarea
                  rows={4}
                  value={documents.notes}
                  onChange={(e) => handleDocumentsChange('notes', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Personel hakkında dahili notlar, özel durumlar..."
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-600">
              {activeTab === 'basic' && 'Temel bilgiler'}
              {activeTab === 'user' && userAccount.createUser && 'Kullanıcı hesabı oluşturulacak'}
              {activeTab === 'salary' && canViewSalary && `Net maaş: ${currencies.find(c => c.code === salaryInfo.currency)?.symbol}${calculateNetSalary().toLocaleString()}`}
              {activeTab === 'documents' && `${documents.certificates.length + (documents.cv ? 1 : 0) + (documents.contract ? 1 : 0)} dosya`}
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:bg-gray-100 flex items-center space-x-2"
              >
                <XCircle className="h-4 w-4" />
                <span>İptal</span>
              </button>
              
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || !basicInfo.fullName.trim() || !basicInfo.tcknPassport.trim() || !basicInfo.department || !basicInfo.position.trim() || !basicInfo.startDate}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{editingEmployee ? 'Güncelleniyor...' : 'Ekleniyor...'}</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>{editingEmployee ? 'Güncelle' : 'Personel Ekle'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewEmployeeModal;