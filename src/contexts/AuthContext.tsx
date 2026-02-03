import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trackUserSession, endUserSession } from '../services/sessionService';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  permissions: string[];
  branch?: string;
  language: string;
  lastLogin?: string;
  sessionId: string;
  avatar?: string;
}

interface LoginCredentials {
  identifier: string;
  password: string;
  twoFactorCode?: string;
  branch?: string;
  language: string;
  loginType: 'email' | 'username' | 'phone';
}

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
  checkAccess: (requiredRoles: string[], requiredPermissions?: string[]) => boolean;
  isLoading: boolean;
  error: string | null;
  sessionExpiry: Date | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);

  // Tenant abonelik kontrolü fonksiyonu
  const checkTenantExpiration = (tenantId: string): boolean => {
    // Mock tenant verileri (gerçek uygulamada bu veriler API'den gelecek)
    const mockTenants = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 yıl sonra
        is_active: true
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        subscription_end_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(), // 6 ay sonra
        is_active: true
      }
    ];

    const tenant = mockTenants.find(t => t.id === tenantId);

    if (!tenant) {
      return false; // Tenant bulunamazsa varsayılan olarak izin ver
    }

    // Abonelik bitiş tarihini kontrol et
    if (tenant.subscription_end_date) {
      const endDate = new Date(tenant.subscription_end_date);
      const now = new Date();

      // Eğer abonelik süresi dolmuşsa ve tenant aktif değilse
      if (endDate < now && !tenant.is_active) {
        return true; // Expired
      }
    }

    return false; // Not expired
  };

  // Rol ve yetki tanımları
  const rolePermissions = {
    'super_admin': ['*', 'tenants.manage', 'tenants.view', 'tenants.create', 'tenants.edit', 'tenants.delete'], // Tüm yetkiler
    'admin': [
      'dashboard.view', 'users.manage', 'branches.manage', 'settings.manage', 'settings.view',
      'reports.view', 'patients.manage', 'patients.view', 'patients.edit', 'patients.create', 'patients.delete',
      'leads.manage', 'leads.view', 'leads.edit', 'leads.create', 'leads.assign',
      'appointments.manage', 'appointments.view', 'appointments.edit', 'appointments.create', 'appointments.cancel',
      'documents.manage', 'documents.view', 'travel.manage', 'travel.view',
      'payments.manage', 'payments.view', 'partners.manage', 'partners.view',
      'inventory.manage', 'inventory.view', 'communication.manage', 'communication.view',
      'offers.manage', 'offers.view', 'clinical.view', 'treatments.view'
    ],
    'manager': [
      'dashboard.view', 'patients.view', 'patients.edit', 'patients.create',
      'leads.manage', 'leads.view', 'leads.edit', 'leads.create', 'leads.assign',
      'appointments.manage', 'appointments.view', 'appointments.edit', 'appointments.create',
      'documents.view', 'travel.view', 'reports.view', 'communication.manage', 'communication.view',
      'offers.manage', 'offers.view', 'partners.view'
    ],
    'doctor': [
      'dashboard.view', 'patients.view', 'patients.edit', 'appointments.view', 'appointments.edit',
      'documents.view', 'clinical.manage', 'clinical.view', 'treatments.manage', 'treatments.view',
      'communication.view'
    ],
    'nurse': [
      'dashboard.view', 'patients.view', 'appointments.view', 'clinical.view', 'treatments.view',
      'documents.view', 'communication.view'
    ],
    'agent': [
      'dashboard.view', 'leads.manage', 'leads.view', 'leads.edit', 'leads.create', 'leads.assign',
      'patients.view', 'appointments.view', 'communication.manage', 'communication.view',
      'documents.view', 'offers.manage', 'offers.view'
    ],
    'coordinator': [
      'dashboard.view', 'patients.view', 'travel.manage', 'travel.view',
      'appointments.manage', 'appointments.view', 'appointments.edit', 'appointments.create',
      'communication.manage', 'communication.view', 'documents.view', 'partners.view'
    ],
    'finance': [
      'dashboard.view', 'payments.manage', 'payments.view', 'reports.view', 'patients.view', 'partners.view'
    ],
    'partner': [
      'leads.view', 'patients.view.own', 'reports.view.own', 'communication.view'
    ],
    'patient': [
      'portal.access', 'appointments.view.own', 'documents.view.own', 'communication.view.own'
    ]
  };

  // Session kontrolü
  useEffect(() => {
    const checkSession = () => {
      const storedUser = localStorage.getItem('user');
      const storedExpiry = localStorage.getItem('sessionExpiry');
      
      if (storedUser && storedExpiry) {
        const expiry = new Date(storedExpiry);
        if (expiry > new Date()) {
          setUser(JSON.parse(storedUser));
          setSessionExpiry(expiry);
        } else {
          // Session süresi dolmuş
          logout();
        }
      }
    };

    checkSession();
    
    // Her 5 dakikada bir session kontrolü
    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    setIsLoading(true);
    setError(null);

    try {
      // API çağrısı simülasyonu
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Tenant-User mapping (kullanıcı hangi kiracıya ait)
      const userTenantMapping: Record<string, { userId: string; tenantId: string; userData: any }> = {
        // Super Admin - Tüm kiracılara erişebilir
        'admin@sagliktur.com': {
          userId: '550e8400-e29b-41d4-a716-446655440001',
          tenantId: 'super_admin',
          userData: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Sistem Yöneticisi',
            email: 'admin@sagliktur.com',
            role: 'super_admin',
            permissions: rolePermissions.super_admin,
            sessionId: 'session_' + Date.now(),
            lastLogin: new Date().toISOString(),
            avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150'
          }
        },
        'admin': {
          userId: '550e8400-e29b-41d4-a716-446655440001',
          tenantId: 'super_admin',
          userData: {
            id: '550e8400-e29b-41d4-a716-446655440001',
            name: 'Sistem Yöneticisi',
            email: 'admin@sagliktur.com',
            role: 'super_admin',
            permissions: rolePermissions.super_admin,
            sessionId: 'session_' + Date.now(),
            lastLogin: new Date().toISOString(),
            avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150'
          }
        },

        // Default Organization Admin
        'default@duendehealth.com': {
          userId: '550e8400-e29b-41d4-a716-446655440002',
          tenantId: '00000000-0000-0000-0000-000000000001',
          userData: {
            id: '550e8400-e29b-41d4-a716-446655440002',
            name: 'Default Admin',
            email: 'default@duendehealth.com',
            role: 'admin',
            permissions: rolePermissions.admin,
            sessionId: 'session_' + Date.now(),
            lastLogin: new Date().toISOString(),
            avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
          }
        },

        // Turkey Organization Admin
        'turkey@duendehealth.com': {
          userId: '11111111-1111-1111-1111-111111111112',
          tenantId: '11111111-1111-1111-1111-111111111111',
          userData: {
            id: '11111111-1111-1111-1111-111111111112',
            name: 'Turkey Admin',
            email: 'turkey@duendehealth.com',
            role: 'admin',
            permissions: rolePermissions.admin,
            sessionId: 'session_' + Date.now(),
            lastLogin: new Date().toISOString(),
            avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
          }
        },

        // Germany Organization Admin
        'germany@duendehealth.com': {
          userId: '22222222-2222-2222-2222-222222222223',
          tenantId: '22222222-2222-2222-2222-222222222222',
          userData: {
            id: '22222222-2222-2222-2222-222222222223',
            name: 'Germany Admin',
            email: 'germany@duendehealth.com',
            role: 'admin',
            permissions: rolePermissions.admin,
            sessionId: 'session_' + Date.now(),
            lastLogin: new Date().toISOString(),
            avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
          }
        },

        // Spain Organization Admin
        'spain@duendehealth.com': {
          userId: '33333333-3333-3333-3333-333333333334',
          tenantId: '33333333-3333-3333-3333-333333333333',
          userData: {
            id: '33333333-3333-3333-3333-333333333334',
            name: 'Spain Admin',
            email: 'spain@duendehealth.com',
            role: 'admin',
            permissions: rolePermissions.admin,
            sessionId: 'session_' + Date.now(),
            lastLogin: new Date().toISOString(),
            avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
          }
        }
      };

      // Demo kullanıcılar (eski yapı - backward compatibility için)
      const demoUsers = {
        'admin@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Sistem Yöneticisi',
          email: 'admin@sagliktur.com',
          role: 'super_admin',
          permissions: rolePermissions.super_admin,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'admin': {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'Sistem Yöneticisi',
          email: 'admin@sagliktur.com',
          role: 'super_admin',
          permissions: rolePermissions.super_admin,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'yonetici@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Yönetici',
          email: 'yonetici@sagliktur.com',
          role: 'admin',
          permissions: rolePermissions.admin,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'yonetici': {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'Yönetici',
          email: 'yonetici@sagliktur.com',
          role: 'admin',
          permissions: rolePermissions.admin,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'mudur@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Müdür',
          email: 'mudur@sagliktur.com',
          role: 'manager',
          permissions: rolePermissions.manager,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'mudur': {
          id: '550e8400-e29b-41d4-a716-446655440003',
          name: 'Müdür',
          email: 'mudur@sagliktur.com',
          role: 'manager',
          permissions: rolePermissions.manager,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'doctor@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Dr. Mehmet Özkan',
          email: 'doctor@sagliktur.com',
          role: 'doctor',
          permissions: rolePermissions.doctor,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'doctor': {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Dr. Mehmet Özkan',
          email: 'doctor@sagliktur.com',
          role: 'doctor',
          permissions: rolePermissions.doctor,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'doktor@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Dr. Mehmet Özkan',
          email: 'doktor@sagliktur.com',
          role: 'doctor',
          permissions: rolePermissions.doctor,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'doktor': {
          id: '550e8400-e29b-41d4-a716-446655440004',
          name: 'Dr. Mehmet Özkan',
          email: 'doktor@sagliktur.com',
          role: 'doctor',
          permissions: rolePermissions.doctor,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'agent@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Fatma Yılmaz',
          email: 'agent@sagliktur.com',
          role: 'agent',
          permissions: rolePermissions.agent,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'agent': {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Fatma Yılmaz',
          email: 'agent@sagliktur.com',
          role: 'agent',
          permissions: rolePermissions.agent,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'satis@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Fatma Yılmaz',
          email: 'satis@sagliktur.com',
          role: 'agent',
          permissions: rolePermissions.agent,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'satis': {
          id: '550e8400-e29b-41d4-a716-446655440005',
          name: 'Fatma Yılmaz',
          email: 'satis@sagliktur.com',
          role: 'agent',
          permissions: rolePermissions.agent,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'koordinator@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440006',
          name: 'Zeynep Demir',
          email: 'koordinator@sagliktur.com',
          role: 'coordinator',
          permissions: rolePermissions.coordinator,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'koordinator': {
          id: '550e8400-e29b-41d4-a716-446655440006',
          name: 'Zeynep Demir',
          email: 'koordinator@sagliktur.com',
          role: 'coordinator',
          permissions: rolePermissions.coordinator,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/5327585/pexels-photo-5327585.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'hasta@sagliktur.com': {
          id: '550e8400-e29b-41d4-a716-446655440007',
          name: 'Maria Rodriguez',
          email: 'hasta@sagliktur.com',
          role: 'patient',
          permissions: rolePermissions.patient,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/7180651/pexels-photo-7180651.jpeg?auto=compress&cs=tinysrgb&w=150'
        },
        'hasta': {
          id: '550e8400-e29b-41d4-a716-446655440007',
          name: 'Maria Rodriguez',
          email: 'hasta@sagliktur.com',
          role: 'patient',
          permissions: rolePermissions.patient,
          language: credentials.language,
          sessionId: 'session_' + Date.now(),
          lastLogin: new Date().toISOString(),
          avatar: 'https://images.pexels.com/photos/7180651/pexels-photo-7180651.jpeg?auto=compress&cs=tinysrgb&w=150'
        }
      };

      // Kullanıcı tenant mapping kontrolü
      const userMapping = userTenantMapping[credentials.identifier];

      if (!userMapping || credentials.password !== '123456') {
        throw new Error('Geçersiz kullanıcı adı veya şifre');
      }

      const user = userMapping.userData;
      const tenantId = userMapping.tenantId;

      // Tenant bilgisini localStorage'a kaydet ve abonelik durumunu kontrol et
      if (tenantId !== 'super_admin') {
        // Super admin değilse, tenant abonelik durumunu kontrol et
        const tenantExpired = checkTenantExpiration(tenantId);

        if (tenantExpired) {
          throw new Error('Organizasyonunuzun aboneliği sona ermiştir. Lütfen yöneticinizle iletişime geçin.');
        }

        localStorage.setItem('selectedTenantId', tenantId);
      } else {
        // Super admin için default tenant'ı seç
        localStorage.setItem('selectedTenantId', '00000000-0000-0000-0000-000000000001');
      }

      // Session süresi: 8 saat
      const expiry = new Date();
      expiry.setHours(expiry.getHours() + 8);
      
      setUser(user);
      setSessionExpiry(expiry);
      
      // Kullanıcı oturumunu takip et
      trackUserSession(user.id).then(result => {
        if (!result.success) {
          console.error('Oturum takibi başlatılamadı:', result.error);
        }
      });
      
      // Dil ayarını uygula
      if (credentials.language) {
        localStorage.setItem('i18nextLng', credentials.language);
        document.documentElement.lang = credentials.language;
        
        // RTL diller için direction ayarı
        if (credentials.language === 'ar') {
          document.documentElement.dir = 'rtl';
          document.body.classList.add('rtl');
        } else {
          document.documentElement.dir = 'ltr';
          document.body.classList.remove('rtl');
        }
      }
      
      // Local storage'a kaydet
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('sessionExpiry', expiry.toISOString());
      
      // Audit log
      console.log('Login successful:', {
        userId: user.id,
        role: user.role,
        timestamp: new Date().toISOString(),
        ip: 'simulated_ip',
        userAgent: navigator.userAgent
      });
      
    } catch (error) {
      setError(error.message);
      
      // Audit log - başarısız giriş
      console.log('Login failed:', {
        identifier: credentials.identifier,
        timestamp: new Date().toISOString(),
        error: error.message
      });
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    // Audit log
    if (user) {
      // Kullanıcı oturumunu sonlandır
      endUserSession(user.id).catch(error => {
        console.error('Oturum sonlandırma hatası:', error);
      });
      
      console.log('Logout:', {
        userId: user.id,
        timestamp: new Date().toISOString()
      });
    }
    
    setUser(null);
    setSessionExpiry(null);
    setError(null);
    localStorage.removeItem('user');
    localStorage.removeItem('sessionExpiry');
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.permissions.includes('*')) return true;
    return user.permissions.includes(permission);
  };

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    return user.role === role;
  };

  const checkAccess = (requiredRoles: string[], requiredPermissions?: string[]): boolean => {
    if (!user) return false;
    
    // Süper admin her şeye erişebilir
    if (user.role === 'super_admin') return true;
    
    // Rol kontrolü
    const hasRequiredRole = requiredRoles.includes(user.role);
    
    // İzin kontrolü
    const hasRequiredPermissions = requiredPermissions 
      ? requiredPermissions.every(permission => hasPermission(permission))
      : true;
    
    return hasRequiredRole && hasRequiredPermissions;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      login, 
      logout, 
      hasPermission, 
      hasRole, 
      checkAccess, 
      isLoading, 
      error, 
      sessionExpiry 
    }}>
      {children}
    </AuthContext.Provider>
  );
};