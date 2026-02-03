import React, { useState, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { Eye, EyeOff, Shield, Globe, Building2, Smartphone, AlertTriangle, CheckCircle, Loader2, Lock, User, Mail, Phone, Key, Languages, MapPin, Stethoscope, Heart, ChevronsDownUp as ChevronUpDown, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { useTranslation } from 'react-i18next';

interface LoginFormData {
  identifier: string;
  password: string;
  twoFactorCode: string;
  selectedBranch: string;
  language: string;
  privacyConsent: boolean;
  kvkkConsent: boolean;
}

const Login = () => {
  const { login, isLoading, error } = useAuth();
  const { branches, branchSettings } = useBranch();
  const { t, i18n } = useTranslation();

  const [formData, setFormData] = useState<LoginFormData>({
    identifier: '',
    password: '',
    twoFactorCode: '',
    selectedBranch: '',
    language: i18n.language || 'tr',
    privacyConsent: false,
    kvkkConsent: false
  });

  const [showPassword, setShowPassword] = useState(false);
  const [show2FA, setShow2FA] = useState(false);
  const [loginType, setLoginType] = useState<'email' | 'username' | 'phone'>('email');
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [attemptCount, setAttemptCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockTimeRemaining, setBlockTimeRemaining] = useState(0);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const languageOptions = React.useMemo(() => [
    { code: 'tr', name: 'Türkçe', flag: '/tr.png' },
    { code: 'en', name: 'English', flag: '/en.png' },
    { code: 'ar', name: 'العربية', flag: '/ar.png' },
    { code: 'es', name: 'Español', flag: '/es.png' },
    { code: 'de', name: 'Deutsch', flag: '/de.png' },
    { code: 'fr', name: 'Français', flag: '/fr.png' },
    { code: 'ru', name: 'Русский', flag: '/ru.png' }
  ], []);

  const currentLanguageData = React.useMemo(() =>
    languageOptions.find(lang => lang.code === formData.language) || languageOptions[0],
    [languageOptions, formData.language]
  );

  const detectLoginType = React.useCallback((value: string) => {
    if (value.includes('@')) return 'email';
    if (value.match(/^\+?[\d\s-()]+$/)) return 'phone';
    return 'username';
  }, []);

  const handleInputChange = React.useCallback((field: keyof LoginFormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    if (field === 'language' && typeof value === 'string') {
      i18n.changeLanguage(value);
    }

    if (field === 'password' && typeof value === 'string' && value.length > 0 && value.length < 6) {
      setPasswordError('Şifre çok kısa olabilir');
    } else {
      setPasswordError(null);
    }

    if (field === 'identifier' && typeof value === 'string') {
      setLoginType(detectLoginType(value));
    }
  }, [detectLoginType, i18n]);

  const performSecurityCheck = () => {
    const warnings: string[] = [];

    if (attemptCount >= 3) {
      warnings.push('Çoklu başarısız giriş denemesi tespit edildi');
    }

    if (!formData.kvkkConsent) {
      warnings.push('KVKK aydınlatma metni onayı gereklidir');
    }

    setSecurityWarnings(warnings);
    return formData.kvkkConsent;
  };

  const send2FACode = async () => {
    try {
      setShow2FA(true);
    } catch (error) {
      console.error('2FA kod gönderme hatası:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!performSecurityCheck()) {
      return;
    }

    if (isBlocked) {
      alert(`Hesabınız ${Math.ceil(blockTimeRemaining / 60)} dakika boyunca bloke edilmiştir.`);
      return;
    }

    try {
      await login({
        identifier: formData.identifier,
        password: formData.password,
        twoFactorCode: formData.twoFactorCode,
        branch: formData.selectedBranch,
        language: formData.language,
        loginType
      });
    } catch (error) {
      setAttemptCount(prev => prev + 1);

      if (attemptCount >= 4) {
        setIsBlocked(true);
        setBlockTimeRemaining(30 * 60);
      }
    }
  };

  useEffect(() => {
    if (isBlocked && blockTimeRemaining > 0) {
      const timer = setInterval(() => {
        setBlockTimeRemaining(prev => {
          if (prev <= 1) {
            setIsBlocked(false);
            setAttemptCount(0);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isBlocked, blockTimeRemaining]);

  const getPlaceholder = () => {
    switch (loginType) {
      case 'email': return t('login.emailPlaceholder');
      case 'phone': return 'Telefon numaranız';
      case 'username': return t('login.username');
      default: return 'E-posta, telefon veya kullanıcı adı';
    }
  };

  const getInputIcon = () => {
    switch (loginType) {
      case 'email': return <Mail className="h-5 w-5 text-gray-400" />;
      case 'phone': return <Phone className="h-5 w-5 text-gray-400" />;
      case 'username': return <User className="h-5 w-5 text-gray-400" />;
      default: return <User className="h-5 w-5 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Sol Taraf - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-8">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <img
              src="/crmLogo_2.png"
              alt="Duende Health CRM"
              className="h-12 object-contain"
            />
          </div>

          {/* Başlık */}
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">CRM Sistemi Girişi</h1>
            <p className="text-gray-600">Sağlık turizmi yönetim platformunuza hoşgeldiniz</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* E-posta */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                E-posta Adresi
              </label>
              <input
                type="text"
                value={formData.identifier}
                onChange={(e) => handleInputChange('identifier', e.target.value)}
                placeholder="klinik@duendecrm.com"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900 placeholder-gray-400"
                required
              />
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Şifre
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white text-gray-900"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* KVKK Onayı */}
            <div className="flex items-start space-x-3">
              <input
                type="checkbox"
                id="kvkk"
                checked={formData.kvkkConsent}
                onChange={(e) => handleInputChange('kvkkConsent', e.target.checked)}
                className="mt-1 h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                required
              />
              <label htmlFor="kvkk" className="text-sm text-gray-700">
                <span className="font-medium text-red-600">*</span>
                {t('login.kvkkConsent')}
              </label>
            </div>

            {/* Hata Mesajı */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                  <span className="text-sm text-red-800">{error}</span>
                </div>
              </div>
            )}

            {/* Giriş Butonu */}
            <button
              type="submit"
              disabled={isLoading || isBlocked || !formData.kvkkConsent || !formData.identifier || !formData.password}
              className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </div>

      {/* Sağ Taraf - Kırmızı Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-red-600 to-red-700 items-center justify-center p-12">
        <div className="max-w-lg text-white space-y-12">
          <div>
            <h2 className="text-4xl font-bold mb-4">Sağlık Turizmi CRM</h2>
            <p className="text-red-100 text-lg">
              Lead yönetiminden operasyona, faturalardan bordro hesaplamalarına tüm süreçlerinizi tek platformda yönetin
            </p>
          </div>

          {/* Özellik Kartları */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Heart className="h-8 w-8 mb-3" />
              <h3 className="font-semibold mb-2">Lead Yönetimi</h3>
              <p className="text-red-100 text-sm">Potansiyel hastalarınızı takip edin, otomatik lead skorlama ile önceliklendirin</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Stethoscope className="h-8 w-8 mb-3" />
              <h3 className="font-semibold mb-2">Tedavi Süreçleri</h3>
              <p className="text-red-100 text-sm">Randevudan tedaviye, tüm klinik süreçleri dijital olarak yönetin</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Building2 className="h-8 w-8 mb-3" />
              <h3 className="font-semibold mb-2">Çoklu Şube Yönetimi</h3>
              <p className="text-red-100 text-sm">Tüm şubelerinizi tek merkezden kontrol edin, performansı karşılaştırın</p>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/20">
              <Globe className="h-8 w-8 mb-3" />
              <h3 className="font-semibold mb-2">Uluslararası Destek</h3>
              <p className="text-red-100 text-sm">7 dilde çoklu para birimi desteği ile global hasta yönetimi</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
