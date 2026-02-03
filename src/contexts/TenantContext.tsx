import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  subdomain?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  contact_email?: string;
  contact_phone?: string;
  is_active: boolean;
  subscription_plan: 'basic' | 'professional' | 'enterprise';
  max_users: number;
  max_branches: number;
  features: Record<string, any>;
}

interface TenantContextType {
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  setCurrentTenant: (tenant: Tenant) => void;
  switchTenant: (tenantId: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

interface TenantProviderProps {
  children: ReactNode;
}

export const TenantProvider: React.FC<TenantProviderProps> = ({ children }) => {
  const [currentTenant, setCurrentTenantState] = useState<Tenant | null>(null);
  const [availableTenants, setAvailableTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    loadTenantFromStorage();
    loadAvailableTenants();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        loadAvailableTenants();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const interval = setInterval(() => {
      const user = localStorage.getItem('user');
      if (user) {
        try {
          const userData = JSON.parse(user);
          const newIsSuperAdmin = userData.role === 'super_admin';
          if (newIsSuperAdmin !== isSuperAdmin) {
            loadAvailableTenants();
          }
        } catch (error) {
          console.error('Error checking user role:', error);
        }
      }
    }, 1000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const checkSelectedTenant = () => {
      const selectedTenantId = localStorage.getItem('selectedTenantId');
      if (selectedTenantId && availableTenants.length > 0) {
        const tenant = availableTenants.find(t => t.id === selectedTenantId);
        if (tenant && (!currentTenant || currentTenant.id !== tenant.id)) {
          setCurrentTenant(tenant);
        }
      }
    };

    checkSelectedTenant();
  }, [availableTenants]);

  const loadTenantFromStorage = () => {
    const storedTenant = localStorage.getItem('currentTenant');
    if (storedTenant) {
      try {
        setCurrentTenantState(JSON.parse(storedTenant));
      } catch (error) {
        console.error('Error loading tenant from storage:', error);
        localStorage.removeItem('currentTenant');
      }
    }
  };

  const loadAvailableTenants = async () => {
    setIsLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');

      setIsSuperAdmin(user.role === 'super_admin');

      const mockTenants: Tenant[] = [
        {
          id: '00000000-0000-0000-0000-000000000001',
          name: 'Default Organization',
          slug: 'default',
          subdomain: 'default',
          is_active: true,
          subscription_plan: 'enterprise',
          max_users: 100,
          max_branches: 10,
          features: {}
        },
        {
          id: '11111111-1111-1111-1111-111111111111',
          name: 'Duende Health Turkey',
          slug: 'duende-turkey',
          subdomain: 'turkey',
          contact_email: 'turkey@duendehealth.com',
          is_active: true,
          subscription_plan: 'enterprise',
          max_users: 50,
          max_branches: 5,
          features: {}
        },
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'Duende Health Germany',
          slug: 'duende-germany',
          subdomain: 'germany',
          contact_email: 'germany@duendehealth.com',
          is_active: true,
          subscription_plan: 'professional',
          max_users: 30,
          max_branches: 3,
          features: {}
        },
        {
          id: '33333333-3333-3333-3333-333333333333',
          name: 'Duende Health Spain',
          slug: 'duende-spain',
          subdomain: 'spain',
          contact_email: 'spain@duendehealth.com',
          is_active: true,
          subscription_plan: 'professional',
          max_users: 30,
          max_branches: 3,
          features: {}
        }
      ];

      if (user.role === 'super_admin') {
        setAvailableTenants(mockTenants);
      } else {
        setAvailableTenants([mockTenants[0]]);
      }

      if (!currentTenant && mockTenants.length > 0) {
        setCurrentTenant(mockTenants[0]);
      }
    } catch (error) {
      console.error('Error loading tenants:', error);
      setError('Kiracı bilgileri yüklenemedi');
    } finally {
      setIsLoading(false);
    }
  };

  const setCurrentTenant = (tenant: Tenant) => {
    setCurrentTenantState(tenant);
    localStorage.setItem('currentTenant', JSON.stringify(tenant));

    if (tenant.primary_color) {
      document.documentElement.style.setProperty('--primary-color', tenant.primary_color);
    }
    if (tenant.secondary_color) {
      document.documentElement.style.setProperty('--secondary-color', tenant.secondary_color);
    }
  };

  const switchTenant = async (tenantId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const tenant = availableTenants.find(t => t.id === tenantId);

      if (!tenant) {
        throw new Error('Kiracı bulunamadı');
      }

      if (!tenant.is_active) {
        throw new Error('Bu kiracı aktif değil');
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      setCurrentTenant(tenant);

      console.log('Tenant switched:', {
        tenantId: tenant.id,
        tenantName: tenant.name,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error switching tenant:', error);
      setError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        availableTenants,
        setCurrentTenant,
        switchTenant,
        isLoading,
        error,
        isSuperAdmin
      }}
    >
      {children}
    </TenantContext.Provider>
  );
};
