// Merkezi LocalStorage yönetim servisi
// Tüm sistem verilerini localStorage'da saklar ve yönetir

export interface StorageKeys {
  // Kullanıcı ve oturum verileri
  user: 'user';
  sessionExpiry: 'sessionExpiry';
  userPreferences: 'userPreferences';
  dashboardLayout: 'dashboardLayout';
  
  // Lead ve hasta verileri
  leads: 'crm_leads';
  patients: 'crm_patients';
  leadNotes: 'lead_notes';
  leadDocuments: 'lead_documents';
  leadOffers: 'lead_offers';
  
  // Teklif ve iletişim verileri
  offers: 'offers';
  offerTemplates: 'offer_templates';
  offerSendLogs: 'offer_send_logs';
  messageTemplates: 'custom_message_templates';
  
  // Chat ve mesajlaşma verileri
  internalMessages: 'crm_internal_messages';
  internalConversations: 'crm_internal_conversations';
  chatFiles: 'chat_files';
  
  // Sistem ayarları
  emailSettings: 'emailSettings';
  branchSettings: 'branchSettings';
  branches: 'branches';
  systemSettings: 'systemSettings';
  
  // Analitik ve metrikler
  dashboardMetrics: 'dashboardMetrics';
  performanceMetrics: 'performanceMetrics';
  
  // Randevu ve takvim
  appointments: 'appointments';
  calendar: 'calendar_events';
  
  // Doküman ve şablonlar
  documents: 'documents';
  templates: 'document_templates';
  
  // Finansal veriler
  payments: 'payments';
  invoices: 'invoices';
  
  // Partner ve acenta verileri
  partners: 'partners';
  agencies: 'agencies';
  
  // Seyahat koordinasyonu
  travelPlans: 'travel_plans';
  hotels: 'partner_hotels';
  
  // Stok ve envanter
  inventory: 'inventory';
  supplies: 'medical_supplies';
  
  // Güvenlik ve audit
  auditLogs: 'audit_logs';
  securityLogs: 'security_logs';
  
  // Bildirimler
  notifications: 'notifications';
  alerts: 'system_alerts';
}

const STORAGE_KEYS: StorageKeys = {
  user: 'user',
  sessionExpiry: 'sessionExpiry',
  userPreferences: 'userPreferences',
  dashboardLayout: 'dashboardLayout',
  leads: 'crm_leads',
  patients: 'crm_patients',
  leadNotes: 'lead_notes',
  leadDocuments: 'lead_documents',
  leadOffers: 'lead_offers',
  offers: 'offers',
  offerTemplates: 'offer_templates',
  offerSendLogs: 'offer_send_logs',
  messageTemplates: 'custom_message_templates',
  internalMessages: 'crm_internal_messages',
  internalConversations: 'crm_internal_conversations',
  chatFiles: 'chat_files',
  emailSettings: 'emailSettings',
  branchSettings: 'branchSettings',
  branches: 'branches',
  systemSettings: 'systemSettings',
  dashboardMetrics: 'dashboardMetrics',
  performanceMetrics: 'performanceMetrics',
  appointments: 'appointments',
  calendar: 'calendar_events',
  documents: 'documents',
  templates: 'document_templates',
  payments: 'payments',
  invoices: 'invoices',
  partners: 'partners',
  agencies: 'agencies',
  travelPlans: 'travel_plans',
  hotels: 'partner_hotels',
  inventory: 'inventory',
  supplies: 'medical_supplies',
  auditLogs: 'audit_logs',
  securityLogs: 'security_logs',
  notifications: 'notifications',
  alerts: 'system_alerts'
};

// LocalStorage yardımcı fonksiyonları
class LocalStorageManager {
  // Veri kaydetme
  static setItem<T>(key: keyof StorageKeys, data: T): boolean {
    try {
      const serializedData = JSON.stringify({
        data,
        timestamp: new Date().toISOString(),
        version: '1.0'
      });
      localStorage.setItem(STORAGE_KEYS[key], serializedData);
      console.log(`✅ LocalStorage: ${key} saved successfully`);
      return true;
    } catch (error) {
      console.error(`❌ LocalStorage: Error saving ${key}:`, error);
      return false;
    }
  }

  // Veri okuma
  static getItem<T>(key: keyof StorageKeys): T | null {
    try {
      const item = localStorage.getItem(STORAGE_KEYS[key]);
      if (!item) return null;
      
      const parsed = JSON.parse(item);
      
      // Eski format kontrolü (geriye uyumluluk)
      if (parsed.data !== undefined) {
        return parsed.data as T;
      } else {
        return parsed as T;
      }
    } catch (error) {
      console.error(`❌ LocalStorage: Error reading ${key}:`, error);
      return null;
    }
  }

  // Veri silme
  static removeItem(key: keyof StorageKeys): boolean {
    try {
      localStorage.removeItem(STORAGE_KEYS[key]);
      console.log(`🗑️ LocalStorage: ${key} removed successfully`);
      return true;
    } catch (error) {
      console.error(`❌ LocalStorage: Error removing ${key}:`, error);
      return false;
    }
  }

  // Tüm verileri temizleme
  static clearAll(): boolean {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('🧹 LocalStorage: All data cleared');
      return true;
    } catch (error) {
      console.error('❌ LocalStorage: Error clearing all data:', error);
      return false;
    }
  }

  // Veri boyutu hesaplama
  static getStorageSize(): { used: number; total: number; percentage: number } {
    let used = 0;
    Object.values(STORAGE_KEYS).forEach(key => {
      const item = localStorage.getItem(key);
      if (item) {
        used += item.length;
      }
    });
    
    const total = 5 * 1024 * 1024; // 5MB (tarayıcı limiti)
    const percentage = (used / total) * 100;
    
    return { used, total, percentage };
  }

  // Veri yedekleme
  static exportData(): string {
    const exportData: Record<string, any> = {};
    
    Object.entries(STORAGE_KEYS).forEach(([key, storageKey]) => {
      const data = this.getItem(key as keyof StorageKeys);
      if (data) {
        exportData[key] = data;
      }
    });
    
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: exportData
    }, null, 2);
  }

  // Veri geri yükleme
  static importData(jsonData: string): boolean {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.data) {
        throw new Error('Invalid import format');
      }
      
      Object.entries(importData.data).forEach(([key, value]) => {
        if (key in STORAGE_KEYS) {
          this.setItem(key as keyof StorageKeys, value);
        }
      });
      
      console.log('📥 LocalStorage: Data imported successfully');
      return true;
    } catch (error) {
      console.error('❌ LocalStorage: Error importing data:', error);
      return false;
    }
  }

  // Veri senkronizasyonu (gelecekte API ile)
  static async syncWithServer(): Promise<boolean> {
    try {
      // Gelecekte API ile senkronizasyon yapılacak
      console.log('🔄 LocalStorage: Sync with server (not implemented yet)');
      return true;
    } catch (error) {
      console.error('❌ LocalStorage: Sync error:', error);
      return false;
    }
  }

  // Otomatik temizleme (eski veriler)
  static cleanupOldData(daysOld: number = 30): number {
    let cleanedCount = 0;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    try {
      // Audit logları temizle
      const auditLogs = this.getItem('auditLogs') as any[] || [];
      const filteredLogs = auditLogs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );
      
      if (filteredLogs.length < auditLogs.length) {
        this.setItem('auditLogs', filteredLogs);
        cleanedCount += auditLogs.length - filteredLogs.length;
      }
      
      // Güvenlik logları temizle
      const securityLogs = this.getItem('securityLogs') as any[] || [];
      const filteredSecurityLogs = securityLogs.filter(log => 
        new Date(log.timestamp) > cutoffDate
      );
      
      if (filteredSecurityLogs.length < securityLogs.length) {
        this.setItem('securityLogs', filteredSecurityLogs);
        cleanedCount += securityLogs.length - filteredSecurityLogs.length;
      }
      
      // Eski chat dosyalarını temizle
      const chatFiles = this.getItem('chatFiles') as any[] || [];
      const filteredChatFiles = chatFiles.filter(file => 
        new Date(file.uploadedAt) > cutoffDate
      );
      
      if (filteredChatFiles.length < chatFiles.length) {
        this.setItem('chatFiles', filteredChatFiles);
        cleanedCount += chatFiles.length - filteredChatFiles.length;
      }
      
      console.log(`🧹 LocalStorage: Cleaned ${cleanedCount} old records`);
      return cleanedCount;
    } catch (error) {
      console.error('❌ LocalStorage: Cleanup error:', error);
      return 0;
    }
  }
}

// Otomatik kaydetme hook'u
const useAutoSave = <T>(key: keyof StorageKeys, data: T, delay: number = 1000) => {
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      LocalStorageManager.setItem(key, data);
    }, delay);

    return () => clearTimeout(timeoutId);
  }, [key, data, delay]);
};

// Veri değişiklik dinleyicisi
const useStorageListener = (key: keyof StorageKeys, callback: (newValue: any) => void) => {
  React.useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS[key]) {
        const newValue = e.newValue ? JSON.parse(e.newValue) : null;
        callback(newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, callback]);
};

export default LocalStorageManager;
;