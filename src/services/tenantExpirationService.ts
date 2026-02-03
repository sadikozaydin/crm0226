/**
 * Tenant Expiration Notification Service
 *
 * Bu servis, kiracıların abonelik bitiş tarihlerini kontrol eder ve
 * süresi dolmak üzere olan veya dolmuş kiracılar için bildirim gönderir.
 */

interface Tenant {
  id: string;
  name: string;
  contact_email?: string;
  subscription_start_date?: string;
  subscription_end_date?: string;
  subscription_status?: 'active' | 'expiring_soon' | 'expired' | 'suspended';
  is_active: boolean;
  last_reminder_sent_at?: string;
  reminder_count: number;
}

interface ExpiringTenant extends Tenant {
  days_remaining: number;
}

interface NotificationResult {
  success: boolean;
  message: string;
  tenants_notified: number;
}

/**
 * Süresi dolmak üzere olan kiracıları kontrol eder
 * @param daysThreshold - Kaç gün öncesinden kontrol edileceği (varsayılan: 7)
 * @returns Süresi dolmak üzere olan kiracıların listesi
 */
export const checkExpiringTenants = (daysThreshold: number = 7): ExpiringTenant[] => {
  // Mock tenant verileri - gerçek uygulamada Supabase'den gelecek
  const mockTenants: Tenant[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Default Organization',
      contact_email: 'admin@default.com',
      subscription_start_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_status: 'active',
      is_active: true,
      reminder_count: 0
    },
    {
      id: '00000000-0000-0000-0000-000000000002',
      name: 'Test Clinic',
      contact_email: 'info@testclinic.com',
      subscription_start_date: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
      subscription_end_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 gün sonra dolacak
      subscription_status: 'expiring_soon',
      is_active: true,
      reminder_count: 0
    }
  ];

  const now = new Date();
  const expiringTenants: ExpiringTenant[] = [];

  mockTenants.forEach(tenant => {
    if (!tenant.subscription_end_date || !tenant.is_active) {
      return;
    }

    const endDate = new Date(tenant.subscription_end_date);
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Eğer belirlenen gün eşiği içindeyse ve henüz dolmamışsa
    if (daysRemaining > 0 && daysRemaining <= daysThreshold) {
      expiringTenants.push({
        ...tenant,
        days_remaining: daysRemaining
      });
    }
  });

  return expiringTenants;
};

/**
 * Süper admin'e bildirim gönderir
 * @param tenants - Bildirim gönderilecek kiracılar
 */
const notifySuperAdmin = async (tenants: ExpiringTenant[]): Promise<boolean> => {
  console.log('🔔 Süper Admin\'e bildirim gönderiliyor...');

  // Gerçek uygulamada burada e-posta gönderme servisi çağrılacak
  // emailService.sendEmail(...) gibi

  console.log(`📧 ${tenants.length} kiracının aboneliği dolmak üzere:`);
  tenants.forEach(tenant => {
    console.log(`   - ${tenant.name}: ${tenant.days_remaining} gün kaldı`);
  });

  // Simülasyon için başarılı dön
  await new Promise(resolve => setTimeout(resolve, 500));
  return true;
};

/**
 * Kiracı yöneticisine bildirim gönderir
 * @param tenant - Bildirim gönderilecek kiracı
 */
const notifyTenantAdmin = async (tenant: ExpiringTenant): Promise<boolean> => {
  console.log(`📧 ${tenant.name} organizasyonuna bildirim gönderiliyor...`);

  if (!tenant.contact_email) {
    console.log('   ⚠️  E-posta adresi bulunamadı, bildirim gönderilemedi');
    return false;
  }

  // Gerçek uygulamada burada e-posta gönderme servisi çağrılacak
  console.log(`   ✅ ${tenant.contact_email} adresine hatırlatma gönderildi`);
  console.log(`   📅 Kalan gün: ${tenant.days_remaining}`);

  // Simülasyon için başarılı dön
  await new Promise(resolve => setTimeout(resolve, 500));
  return true;
};

/**
 * Süresi dolan kiracıları pasif hale getirir
 * @param tenantId - Pasif hale getirilecek kiracı ID'si
 */
export const deactivateExpiredTenant = async (tenantId: string): Promise<boolean> => {
  console.log(`🚫 ${tenantId} kiracısı pasif hale getiriliyor...`);

  // Gerçek uygulamada burada Supabase güncellemesi yapılacak
  // await supabase.from('tenants').update({ is_active: false }).eq('id', tenantId)

  console.log('   ✅ Kiracı başarıyla pasif hale getirildi');
  return true;
};

/**
 * Hatırlatma gönderilme kaydını günceller
 * @param tenantId - Kiracı ID'si
 */
const markReminderSent = async (tenantId: string): Promise<void> => {
  console.log(`📝 ${tenantId} için hatırlatma kaydı güncelleniyor...`);

  // Gerçek uygulamada burada Supabase güncellemesi yapılacak
  // await supabase.rpc('mark_reminder_sent', { tenant_id_param: tenantId })

  await new Promise(resolve => setTimeout(resolve, 100));
};

/**
 * Ana notification fonksiyonu - Tüm kontrolleri yapar ve bildirimleri gönderir
 * @param daysThreshold - Kaç gün öncesinden bildirim gönderileceği
 */
export const sendExpirationReminders = async (daysThreshold: number = 7): Promise<NotificationResult> => {
  try {
    console.log('🔍 Süresi dolmak üzere olan kiracılar kontrol ediliyor...');

    const expiringTenants = checkExpiringTenants(daysThreshold);

    if (expiringTenants.length === 0) {
      console.log('✅ Süresi dolmak üzere olan kiracı bulunamadı');
      return {
        success: true,
        message: 'Süresi dolmak üzere olan kiracı bulunamadı',
        tenants_notified: 0
      };
    }

    // Süper admin'e toplu bildirim gönder
    await notifySuperAdmin(expiringTenants);

    // Her kiracıya ayrı ayrı bildirim gönder
    let notifiedCount = 0;
    for (const tenant of expiringTenants) {
      const notified = await notifyTenantAdmin(tenant);
      if (notified) {
        await markReminderSent(tenant.id);
        notifiedCount++;
      }
    }

    console.log(`✅ ${notifiedCount} kiracıya bildirim başarıyla gönderildi`);

    return {
      success: true,
      message: `${notifiedCount} kiracıya bildirim gönderildi`,
      tenants_notified: notifiedCount
    };
  } catch (error) {
    console.error('❌ Bildirim gönderme hatası:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Bilinmeyen hata',
      tenants_notified: 0
    };
  }
};

/**
 * Süresi dolan kiracıları kontrol eder ve pasif hale getirir
 */
export const checkAndDeactivateExpiredTenants = async (): Promise<void> => {
  console.log('🔍 Süresi dolan kiracılar kontrol ediliyor...');

  // Mock tenant verileri
  const mockTenants: Tenant[] = [
    {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Default Organization',
      subscription_end_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      is_active: true,
      reminder_count: 0
    }
  ];

  const now = new Date();

  for (const tenant of mockTenants) {
    if (!tenant.subscription_end_date || !tenant.is_active) {
      continue;
    }

    const endDate = new Date(tenant.subscription_end_date);

    // Eğer abonelik süresi dolmuşsa
    if (endDate < now) {
      console.log(`⏰ ${tenant.name} kiracısının aboneliği dolmuş`);
      await deactivateExpiredTenant(tenant.id);
    }
  }
};

/**
 * Dashboard'da gösterilmek üzere yaklaşan süreleri getirir
 */
export const getUpcomingExpirations = (daysThreshold: number = 30): ExpiringTenant[] => {
  return checkExpiringTenants(daysThreshold);
};

/**
 * Belirli bir kiracının kalan gün sayısını hesaplar
 */
export const calculateDaysRemaining = (subscriptionEndDate: string): number => {
  const endDate = new Date(subscriptionEndDate);
  const now = new Date();
  return Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
};

/**
 * Kiracının durumunu hesaplar (active, expiring_soon, expired)
 */
export const getTenantStatus = (subscriptionEndDate?: string): 'active' | 'expiring_soon' | 'expired' => {
  if (!subscriptionEndDate) {
    return 'active';
  }

  const daysRemaining = calculateDaysRemaining(subscriptionEndDate);

  if (daysRemaining < 0) {
    return 'expired';
  } else if (daysRemaining <= 7) {
    return 'expiring_soon';
  } else {
    return 'active';
  }
};
