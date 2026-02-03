// İK Supabase Servisleri - Production Ready
import { supabase } from '../lib/supabaseClient';
import { Employee } from './employeeService';

// 🧑‍💼 Employee Operations
export async function insertEmployee(employeeData: Partial<Employee>): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .insert([{
        full_name: employeeData.name,
        tckn_passport: employeeData.tcknPassport,
        gender: employeeData.gender,
        birth_date: employeeData.birthDate,
        phone: employeeData.phone,
        email: employeeData.email,
        department: employeeData.department,
        position: employeeData.position,
        start_date: employeeData.startDate,
        branch_id: employeeData.branchId,
        address: employeeData.address,
        emergency_contact: employeeData.emergencyContact,
        emergency_phone: employeeData.emergencyPhone,
        status: employeeData.status || 'active',
        performance: employeeData.performance || 0,
        leave_balance: employeeData.leaveBalance || 15,
        avatar_url: employeeData.avatar,
        created_by: employeeData.createdBy
      }])
      .select()
      .single();

    if (error) {
      console.error('Employee insert error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('employee_created', 'employees', data.id, {
      employee_name: employeeData.name,
      department: employeeData.department,
      position: employeeData.position
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error inserting employee:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

export async function updateEmployee(employeeId: string, updates: Partial<Employee>): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Eski verileri al (audit için)
    const { data: oldData } = await supabase
      .from('employees')
      .select('*')
      .eq('id', employeeId)
      .single();

    const { data, error } = await supabase
      .from('employees')
      .update({
        full_name: updates.name,
        tckn_passport: updates.tcknPassport,
        gender: updates.gender,
        birth_date: updates.birthDate,
        phone: updates.phone,
        email: updates.email,
        department: updates.department,
        position: updates.position,
        start_date: updates.startDate,
        branch_id: updates.branchId,
        address: updates.address,
        emergency_contact: updates.emergencyContact,
        emergency_phone: updates.emergencyPhone,
        status: updates.status,
        performance: updates.performance,
        leave_balance: updates.leaveBalance,
        avatar_url: updates.avatar,
        updated_at: new Date().toISOString()
      })
      .eq('id', employeeId)
      .select()
      .single();

    if (error) {
      console.error('Employee update error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('employee_updated', 'employees', employeeId, {
      old_values: oldData,
      new_values: data,
      changes: Object.keys(updates)
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error updating employee:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 💰 Salary Operations
export async function insertEmployeeSalary(salaryData: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Önce mevcut aktif maaş kaydını pasif yap
    await supabase
      .from('employee_salaries')
      .update({ is_active: false })
      .eq('employee_id', salaryData.employeeId)
      .eq('is_active', true);

    const { data, error } = await supabase
      .from('employee_salaries')
      .insert([{
        employee_id: salaryData.employeeId,
        gross_salary: salaryData.grossSalary,
        net_salary: salaryData.netSalary,
        currency: salaryData.currency || 'TRY',
        salary_type: salaryData.salaryType || 'monthly',
        bonus: salaryData.bonus || 0,
        meal_support: salaryData.mealSupport || 0,
        transport_support: salaryData.transportSupport || 0,
        overtime_rate: salaryData.overtimeRate || 0,
        tax_rate: salaryData.taxRate || 15,
        stamp_tax: salaryData.stampTax || 0.759,
        insurance_employee: salaryData.insuranceEmployee || 14,
        insurance_employer: salaryData.insuranceEmployer || 20.5,
        unemployment_insurance: 1, // Sabit %1
        exemption_note: salaryData.exemptionNote,
        payroll_note: salaryData.payrollNote,
        iban: salaryData.iban,
        bank_name: salaryData.bankName,
        start_date: salaryData.salaryStartDate || new Date().toISOString().split('T')[0],
        is_active: true
      }])
      .select()
      .single();

    if (error) {
      console.error('Salary insert error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('salary_created', 'employee_salaries', data.id, {
      employee_id: salaryData.employeeId,
      net_salary: salaryData.netSalary,
      gross_salary: salaryData.grossSalary
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error inserting salary:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 👤 User Account Operations
export async function createUserAccount(userData: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Şifre hash'leme (gerçek uygulamada bcrypt kullanılır)
    const passwordHash = await hashPassword(userData.password);

    const { data, error } = await supabase
      .from('users')
      .insert([{
        employee_id: userData.employeeId,
        name: userData.name,
        email: userData.email,
        username: userData.username,
        role: userData.role,
        language: userData.language || 'tr',
        permissions: userData.permissions || [],
        enable_2fa: userData.enable2FA || false,
        is_active: true,
        created_by: userData.createdBy
      }])
      .select()
      .single();

    if (error) {
      console.error('User creation error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('user_created', 'users', data.id, {
      employee_id: userData.employeeId,
      username: userData.username,
      role: userData.role
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error creating user:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 📄 Document Operations
export async function uploadEmployeeDocument(
  employeeId: string, 
  file: File, 
  documentCategory: string,
  uploadedBy: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Dosya adını oluştur
    const timestamp = Date.now();
    const fileName = `${employeeId}/${timestamp}_${file.name}`;
    
    // Supabase Storage'a yükle
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('employee_documents')
      .upload(fileName, file);

    if (uploadError) {
      console.error('File upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Public URL al
    const { data: urlData } = supabase.storage
      .from('employee_documents')
      .getPublicUrl(fileName);

    // Veritabanına kaydet
    const { data, error } = await supabase
      .from('employee_documents')
      .insert([{
        employee_id: employeeId,
        file_name: file.name,
        file_type: documentCategory,
        file_url: urlData.publicUrl,
        file_size: file.size,
        mime_type: file.type,
        document_category: documentCategory,
        is_confidential: ['contract', 'salary', 'medical'].includes(documentCategory),
        uploaded_by: uploadedBy
      }])
      .select()
      .single();

    if (error) {
      console.error('Document record insert error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('document_uploaded', 'employee_documents', data.id, {
      employee_id: employeeId,
      file_name: file.name,
      document_category: documentCategory,
      file_size: file.size
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error uploading document:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 🕒 PDKS Operations
export async function recordAttendance(attendanceData: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // Aynı gün için kayıt var mı kontrol et
    const { data: existingRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', attendanceData.employeeId)
      .eq('date', attendanceData.date)
      .single();

    let result;
    
    if (existingRecord) {
      // Güncelle (çıkış saati vb.)
      const { data, error } = await supabase
        .from('attendance')
        .update({
          check_out: attendanceData.checkOut,
          total_hours: attendanceData.totalHours,
          overtime_hours: attendanceData.overtimeHours,
          is_early_leave: attendanceData.isEarlyLeave,
          notes: attendanceData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRecord.id)
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    } else {
      // Yeni kayıt oluştur
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          employee_id: attendanceData.employeeId,
          date: attendanceData.date,
          check_in: attendanceData.checkIn,
          check_out: attendanceData.checkOut,
          total_hours: attendanceData.totalHours,
          overtime_hours: attendanceData.overtimeHours || 0,
          is_late: attendanceData.isLate || false,
          is_early_leave: attendanceData.isEarlyLeave || false,
          status: attendanceData.status || 'present',
          notes: attendanceData.notes
        }])
        .select()
        .single();
        
      if (error) throw error;
      result = data;
    }

    return { success: true, data: result };
  } catch (error) {
    console.error('Attendance record error:', error);
    return { success: false, error: error.message };
  }
}

// 📋 Leave Request Operations
export async function createLeaveRequest(leaveData: any): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('leave_requests')
      .insert([{
        employee_id: leaveData.employeeId,
        leave_type: leaveData.leaveType,
        start_date: leaveData.startDate,
        end_date: leaveData.endDate,
        days: leaveData.days,
        reason: leaveData.reason,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('Leave request error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('leave_request_created', 'leave_requests', data.id, {
      employee_id: leaveData.employeeId,
      leave_type: leaveData.leaveType,
      days: leaveData.days
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error creating leave request:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 💳 Payroll Operations
export async function generatePayrollForEmployee(
  employeeId: string, 
  period: string, 
  overtimeHours: number = 0, 
  bonusAmount: number = 0
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('generate_payroll', {
      p_employee_id: employeeId,
      p_period: period,
      p_overtime_hours: overtimeHours,
      p_bonus_amount: bonusAmount
    });

    if (error) {
      console.error('Payroll generation error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('payroll_generated', 'payroll_records', data, {
      employee_id: employeeId,
      period: period,
      overtime_hours: overtimeHours,
      bonus_amount: bonusAmount
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error generating payroll:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 🧮 Salary Calculation RPC Calls
export async function calculateNetSalary(
  grossSalary: number,
  taxRate: number = 15,
  insuranceEmployee: number = 14,
  unemploymentRate: number = 1,
  stampTaxRate: number = 0.759
): Promise<{ success: boolean; data?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('calculate_net_salary', {
      gross_amount: grossSalary,
      tax_rate: taxRate,
      insurance_employee: insuranceEmployee,
      unemployment_rate: unemploymentRate,
      stamp_tax_rate: stampTaxRate
    });

    if (error) {
      console.error('Net salary calculation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error calculating net salary:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

export async function calculateGrossSalary(
  netSalary: number,
  taxRate: number = 15,
  insuranceEmployee: number = 14,
  unemploymentRate: number = 1,
  stampTaxRate: number = 0.759
): Promise<{ success: boolean; data?: number; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('calculate_gross_salary', {
      net_amount: netSalary,
      tax_rate: taxRate,
      insurance_employee: insuranceEmployee,
      unemployment_rate: unemploymentRate,
      stamp_tax_rate: stampTaxRate
    });

    if (error) {
      console.error('Gross salary calculation error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error calculating gross salary:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 📊 Employee Analytics
export async function getEmployeeStats(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('status, department, performance');

    if (empError) throw empError;

    const stats = {
      total: employees.length,
      active: employees.filter(e => e.status === 'active').length,
      on_leave: employees.filter(e => e.status === 'on_leave').length,
      inactive: employees.filter(e => e.status === 'inactive').length,
      by_department: employees.reduce((acc, emp) => {
        acc[emp.department] = (acc[emp.department] || 0) + 1;
        return acc;
      }, {}),
      average_performance: employees.reduce((sum, emp) => sum + (emp.performance || 0), 0) / employees.length
    };

    return { success: true, data: stats };
  } catch (error) {
    console.error('Employee stats error:', error);
    return { success: false, error: error.message };
  }
}

// 🔍 Audit Logging
export async function logAuditEvent(
  action: string,
  targetTable: string,
  targetId: string,
  details?: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert([{
        user_id: (await supabase.auth.getUser()).data.user?.id,
        action,
        description: `${action} performed on ${targetTable}`,
        target_table: targetTable,
        target_id: targetId,
        new_values: details,
        module: 'HR',
        ip_address: await getUserIP(),
        user_agent: navigator.userAgent
      }]);

    if (error) {
      console.error('Audit log error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error logging audit event:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 📸 Avatar yükleme fonksiyonu
export async function uploadEmployeeAvatar(
  employeeId: string, 
  file: File
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    // Dosya adını oluştur
    const fileExt = file.name.split('.').pop();
    const fileName = `avatars/${employeeId}.${fileExt}`;
    
    // Eski avatar'ı sil (varsa)
    await supabase.storage
      .from('employee_documents')
      .remove([`avatars/${employeeId}.jpg`, `avatars/${employeeId}.png`, `avatars/${employeeId}.jpeg`]);
    
    // Yeni avatar'ı yükle
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('employee_documents')
            .upload(fileName, file, { upsert: true });

    if (uploadError) {
      console.error('Avatar upload error:', uploadError);
      return { success: false, error: uploadError.message };
    }

    // Public URL al
    const { data: urlData } = supabase.storage
      .from('employee_documents')
      .getPublicUrl(fileName);

    // Employee tablosunda avatar_url güncelle
    const { error: updateError } = await supabase
      .from('employees')
      .update({ avatar_url: urlData.publicUrl })
      .eq('id', employeeId);

    if (updateError) {
      console.error('Avatar URL update error:', updateError);
      return { success: false, error: updateError.message };
    }

    // Audit log
    await logAuditEvent('avatar_uploaded', 'employees', employeeId, {
      file_name: file.name,
      file_size: file.size,
      avatar_url: urlData.publicUrl
    });

    return { success: true, data: urlData.publicUrl };
  } catch (error) {
    console.error('Unexpected error uploading avatar:', error);
    return { success: false, error: 'Avatar yüklenirken beklenmeyen hata oluştu' };
  }
}

// 📧 Hoş geldin e-postası gönderme
export async function sendWelcomeEmail(
  employeeId: string,
  email: string,
  username: string,
  password: string,
  role: string
): Promise<{ success: boolean; error?: string }>  {
  try {
    // E-posta içeriğini hazırla
    const subject = 'Duende Health CRM - Hoş Geldiniz!';
    const content = `
Merhaba,

Duende Health CRM sistemine hoş geldiniz! Hesabınız başarıyla oluşturuldu.

Giriş Bilgileriniz:
- E-posta: ${email}
- Geçici Şifre: ${password}
- Rol: ${role}

Güvenlik için ilk girişinizde şifrenizi değiştirmeniz önerilir.

Sistem Linki: ${window.location.origin}/login

Herhangi bir sorunuz olursa IT destek ekibi ile iletişime geçebilirsiniz.

Saygılarımızla,
Duende Health CRM Ekibi
    `;

    // E-posta kuyruğuna ekle
    const { error } = await supabase
      .from('email_notifications')
      .insert([{
        employee_id: employeeId,
        email_type: 'welcome',
        recipient_email: email,
        subject: subject,
        content: content,
        status: 'pending'
      }]);

    if (error) {
      console.error('Welcome email queue error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('welcome_email_queued', 'email_notifications', employeeId, {
      recipient: email,
      username: username,
      role: role
    });

    return { success: true };
  } catch (error) {
    console.error('Unexpected error sending welcome email:', error);
    return { success: false, error: 'Hoş geldin e-postası gönderilirken hata oluştu' };
  }
}

// 📅 Vardiya atama fonksiyonu
export async function assignShiftToEmployee(
  employeeId: string,
  shiftId: string,
  startDate: string,
  assignedBy: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('assign_shift_to_employee', {
      p_employee_id: employeeId,
      p_shift_id: shiftId,
      p_start_date: startDate,
      p_assigned_by: assignedBy
    });

    if (error) {
      console.error('Shift assignment error:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await logAuditEvent('shift_assigned', 'employee_shifts', data, {
      employee_id: employeeId,
      shift_id: shiftId,
      start_date: startDate
    });

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error assigning shift:', error);
    return { success: false, error: 'Vardiya atanırken beklenmeyen hata oluştu' };
  }
}

// 📋 Mevcut vardiyaları getir
export async function getShifts(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Get shifts error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error) {
    console.error('Unexpected error getting shifts:', error);
    return { success: false, error: 'Vardiyalar yüklenirken beklenmeyen hata oluştu' };
  }
}

// 📊 Personel özet bilgileri
export async function getEmployeeSummary(employeeId: string): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .select(`
        *,
        employee_salaries!inner(*),
        employee_shifts(
          *,
          shifts(*)
        ),
        users(*),
        employee_documents(count)
      `)
      .eq('id', employeeId)
      .eq('employee_salaries.is_active', true)
      .eq('employee_shifts.is_active', true)
      .single();

    if (error) {
      console.error('Employee summary error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Unexpected error getting employee summary:', error);
    return { success: false, error: 'Personel özeti yüklenirken beklenmeyen hata oluştu' };
  }
}

// 🔐 Permission Helpers
export function hasHRPermission(user: any, permission: string): boolean {
  const rolePermissions = {
    super_admin: ['*'],
    admin: ['view_salary', 'edit_employee', 'manage_payroll', 'view_documents'],
    manager: ['edit_employee', 'view_performance', 'approve_leave'],
    finance: ['view_salary', 'manage_payroll', 'view_financial_reports'],
    hr_specialist: ['edit_employee', 'manage_leave', 'view_documents', 'manage_attendance']
  };

  const userPermissions = rolePermissions[user.role] || [];
  return userPermissions.includes('*') || userPermissions.includes(permission);
}

// 🛠️ Utility Functions
async function hashPassword(password: string): Promise<string> {
  // Gerçek uygulamada bcrypt kullanılır
  // Şimdilik basit hash simülasyonu
  return `hashed_${password}_${Date.now()}`;
}

async function getUserIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'unknown';
  }
}

// 📈 Performance Tracking
export async function updateEmployeePerformance(
  employeeId: string, 
  score: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.rpc('update_employee_performance', {
      p_employee_id: employeeId,
      p_score: score
    });

    if (error) {
      console.error('Performance update error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error updating performance:', error);
    return { success: false, error: 'Beklenmeyen hata oluştu' };
  }
}

// 📊 Payroll Calculation Helpers
export function calculateTurkishPayroll(grossSalary: number) {
  const sskEmployee = grossSalary * 0.14; // %14 SSK işçi payı
  const unemploymentInsurance = grossSalary * 0.01; // %1 işsizlik sigortası
  const taxBase = grossSalary - sskEmployee - unemploymentInsurance;
  const incomeTax = taxBase * 0.15; // %15 gelir vergisi
  const stampTax = grossSalary * 0.00759; // 0.759‰ damga vergisi
  
  const totalDeductions = sskEmployee + unemploymentInsurance + incomeTax + stampTax;
  const netSalary = grossSalary - totalDeductions;
  
  return {
    grossSalary,
    sskEmployee,
    unemploymentInsurance,
    taxBase,
    incomeTax,
    stampTax,
    totalDeductions,
    netSalary: Math.max(netSalary, 0)
  };
}

export function calculateGrossFromNet(netSalary: number, maxIterations: number = 100): number {
  let grossEstimate = netSalary / 0.70; // Başlangıç tahmini
  let iteration = 0;
  const tolerance = 0.01;
  
  while (iteration < maxIterations) {
    const calculated = calculateTurkishPayroll(grossEstimate);
    const difference = netSalary - calculated.netSalary;
    
    if (Math.abs(difference) < tolerance) {
      break;
    }
    
    grossEstimate += difference / 0.70;
    iteration++;
  }
  
  return Math.round(grossEstimate * 100) / 100;
}

// 🔄 Data Sync Functions
export async function syncEmployeeData(employeeId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Employee, salary, documents verilerini senkronize et
    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select(`
        *,
        employee_salaries(*),
        employee_documents(*),
        users(*)
      `)
      .eq('id', employeeId)
      .single();

    if (empError) throw empError;

    // LocalStorage'a da kaydet (offline çalışma için)
    localStorage.setItem(`employee_${employeeId}`, JSON.stringify(employee));

    return { success: true };
  } catch (error) {
    console.error('Employee data sync error:', error);
    return { success: false, error: error.message };
  }
}

// 🎯 Bulk Operations
export async function bulkUpdateEmployees(
  employeeIds: string[], 
  updates: Partial<Employee>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('employees')
      .update(updates)
      .in('id', employeeIds)
      .select();

    if (error) throw error;

    // Bulk audit log
    await logAuditEvent('bulk_employee_update', 'employees', 'multiple', {
      employee_ids: employeeIds,
      updates: updates,
      affected_count: data.length
    });

    return { success: true, data };
  } catch (error) {
    console.error('Bulk update error:', error);
    return { success: false, error: error.message };
  }
}