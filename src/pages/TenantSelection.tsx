import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CheckCircle, Loader2, Users, CreditCard, Calendar } from 'lucide-react';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';

const TenantSelection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { availableTenants, currentTenant, switchTenant, isLoading } = useTenant();
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (currentTenant) {
      setSelectedTenantId(currentTenant.id);
    }
  }, [currentTenant]);

  const handleSelectTenant = async (tenantId: string) => {
    if (switching || tenantId === currentTenant?.id) return;

    setSwitching(true);
    try {
      await switchTenant(tenantId);
      navigate('/');
    } catch (error) {
      console.error('Tenant switching error:', error);
    } finally {
      setSwitching(false);
    }
  };

  const getPlanBadgeColor = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'professional':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'basic':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPlanName = (plan: string) => {
    switch (plan) {
      case 'enterprise':
        return 'Kurumsal';
      case 'professional':
        return 'Profesyonel';
      case 'basic':
        return 'Temel';
      default:
        return plan;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Kiracılar yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-6">
      <div className="max-w-6xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center mb-6">
            <img
              src="/crmLogo_2.png"
              alt="Duende Health CRM"
              className="h-16 object-contain"
            />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Organizasyon Seçimi
          </h1>
          <p className="text-gray-600">
            {user?.role === 'super_admin'
              ? 'Yönetmek istediğiniz organizasyonu seçin'
              : 'Çalışmak istediğiniz organizasyonu seçin'}
          </p>
        </div>

        {/* Tenant Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {availableTenants.map((tenant) => (
            <div
              key={tenant.id}
              onClick={() => handleSelectTenant(tenant.id)}
              className={`
                relative bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer
                border-2 p-6
                ${currentTenant?.id === tenant.id
                  ? 'border-red-500 ring-2 ring-red-500 ring-opacity-50'
                  : 'border-gray-200 hover:border-red-300'}
                ${!tenant.is_active ? 'opacity-50 cursor-not-allowed' : ''}
                ${switching ? 'pointer-events-none' : ''}
              `}
            >
              {/* Active Badge */}
              {currentTenant?.id === tenant.id && (
                <div className="absolute -top-3 -right-3 bg-red-600 text-white rounded-full p-2 shadow-lg">
                  <CheckCircle className="h-5 w-5" />
                </div>
              )}

              {/* Organization Logo/Icon */}
              <div className="flex items-center space-x-4 mb-4">
                {tenant.logo_url ? (
                  <img
                    src={tenant.logo_url}
                    alt={tenant.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg">
                    {tenant.name}
                  </h3>
                  <p className="text-sm text-gray-500">{tenant.slug}</p>
                </div>
              </div>

              {/* Plan Badge */}
              <div className="mb-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getPlanBadgeColor(tenant.subscription_plan)}`}>
                  <CreditCard className="h-3 w-3 mr-1" />
                  {getPlanName(tenant.subscription_plan)}
                </span>
              </div>

              {/* Tenant Info */}
              <div className="space-y-3">
                <div className="flex items-center text-sm text-gray-600">
                  <Users className="h-4 w-4 mr-2 text-gray-400" />
                  <span>Maksimum {tenant.max_users} kullanıcı</span>
                </div>
                <div className="flex items-center text-sm text-gray-600">
                  <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                  <span>Maksimum {tenant.max_branches} şube</span>
                </div>
                {tenant.contact_email && (
                  <div className="text-sm text-gray-500 truncate">
                    {tenant.contact_email}
                  </div>
                )}
              </div>

              {/* Status */}
              {!tenant.is_active && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <span className="text-xs text-red-600 font-medium">
                    Bu organizasyon aktif değil
                  </span>
                </div>
              )}

              {/* Loading Overlay */}
              {switching && selectedTenantId === tenant.id && (
                <div className="absolute inset-0 bg-white bg-opacity-80 rounded-xl flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-red-600 animate-spin" />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* No Tenants Message */}
        {availableTenants.length === 0 && (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Building2 className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Organizasyon Bulunamadı
            </h3>
            <p className="text-gray-600">
              Henüz hiçbir organizasyona erişiminiz yok.
            </p>
          </div>
        )}

        {/* Footer Info */}
        {user?.role === 'super_admin' && (
          <div className="mt-8 text-center">
            <button
              onClick={() => navigate('/tenant-management')}
              className="text-red-600 hover:text-red-700 font-medium text-sm"
            >
              Organizasyon Yönetimi →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TenantSelection;
