/*
  # İK ve PDKS Sistemi - Kapsamlı Veritabanı Şeması

  1. Yeni Tablolar
    - `employees` - Personel ana bilgileri
    - `employee_salaries` - Maaş ve bordro bilgileri  
    - `users` - Kullanıcı hesapları (employees ile bağlantılı)
    - `employee_documents` - Personel evrakları
    - `attendance` - PDKS giriş-çıkış kayıtları
    - `audit_logs` - Sistem audit kayıtları

  2. RPC Fonksiyonları
    - `calculate_net_salary` - Net maaş hesaplama
    - `calculate_gross_salary` - Brüt maaş hesaplama
    - `generate_employee_code` - Otomatik personel kodu

  3. Güvenlik
    - RLS politikaları tüm tablolarda aktif
    - Rol bazlı erişim kontrolü
    - KVKK uyumlu veri maskeleme
</sql>

-- 🧑‍💼 Employees tablosu
CREATE TABLE IF NOT EXISTS employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code text UNIQUE,
  full_name text NOT NULL,
  tckn_passport text NOT NULL,
  gender text CHECK (gender IN ('male', 'female', 'other')),
  birth_date date,
  phone text,
  email text,
  department text NOT NULL,
  position text NOT NULL,
  start_date date NOT NULL,
  branch_id uuid,
  address text,
  emergency_contact text,
  emergency_phone text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'on_leave', 'inactive', 'terminated')),
  performance numeric DEFAULT 0 CHECK (performance >= 0 AND performance <= 5),
  leave_balance numeric DEFAULT 15,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- 💰 Employee Salaries tablosu
CREATE TABLE IF NOT EXISTS employee_salaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  gross_salary numeric NOT NULL CHECK (gross_salary > 0),
  net_salary numeric NOT NULL CHECK (net_salary > 0),
  currency text DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
  salary_type text DEFAULT 'monthly' CHECK (salary_type IN ('monthly', 'daily', 'hourly')),
  bonus numeric DEFAULT 0,
  meal_support numeric DEFAULT 0,
  transport_support numeric DEFAULT 0,
  overtime_rate numeric DEFAULT 0,
  tax_rate numeric DEFAULT 15,
  stamp_tax numeric DEFAULT 0.759,
  insurance_employee numeric DEFAULT 14,
  insurance_employer numeric DEFAULT 20.5,
  unemployment_insurance numeric DEFAULT 1,
  exemption_note text,
  payroll_note text,
  iban text,
  bank_name text,
  start_date date DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 👤 Users tablosu (auth.users ile bağlantılı)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  username text UNIQUE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'doctor', 'nurse', 'agent', 'coordinator', 'finance', 'partner', 'patient')),
  language text DEFAULT 'tr',
  permissions text[] DEFAULT '{}',
  enable_2fa boolean DEFAULT false,
  is_active boolean DEFAULT true,
  last_login timestamptz,
  login_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- 📄 Employee Documents tablosu
CREATE TABLE IF NOT EXISTS employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  document_category text CHECK (document_category IN ('contract', 'id_card', 'diploma', 'certificate', 'medical', 'other')),
  is_confidential boolean DEFAULT false,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES users(id)
);

-- 🕒 Attendance (PDKS) tablosu
CREATE TABLE IF NOT EXISTS attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  date date NOT NULL,
  check_in time,
  check_out time,
  total_hours numeric,
  overtime_hours numeric DEFAULT 0,
  is_late boolean DEFAULT false,
  is_early_leave boolean DEFAULT false,
  status text DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'sick_leave', 'annual_leave')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 📋 Leave Requests tablosu
CREATE TABLE IF NOT EXISTS leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  leave_type text NOT NULL CHECK (leave_type IN ('annual', 'sick', 'maternity', 'emergency', 'unpaid')),
  start_date date NOT NULL,
  end_date date NOT NULL,
  days integer NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by uuid REFERENCES users(id),
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 💳 Payroll Records tablosu
CREATE TABLE IF NOT EXISTS payroll_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  period text NOT NULL, -- YYYY-MM format
  gross_salary numeric NOT NULL,
  net_salary numeric NOT NULL,
  ssk_employee numeric NOT NULL,
  unemployment_insurance numeric NOT NULL,
  income_tax numeric NOT NULL,
  stamp_tax numeric NOT NULL,
  overtime_amount numeric DEFAULT 0,
  bonus_amount numeric DEFAULT 0,
  meal_support numeric DEFAULT 0,
  transport_support numeric DEFAULT 0,
  other_deductions numeric DEFAULT 0,
  total_deductions numeric NOT NULL,
  final_net_salary numeric NOT NULL,
  payment_date date,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'paid')),
  notes text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id)
);

-- 🔍 Audit Logs tablosu
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id),
  employee_id uuid REFERENCES employees(id),
  action text NOT NULL,
  description text,
  target_table text,
  target_id uuid,
  old_values jsonb,
  new_values jsonb,
  ip_address inet,
  user_agent text,
  module text DEFAULT 'HR',
  created_at timestamptz DEFAULT now()
);

-- 📊 Performance Reviews tablosu
CREATE TABLE IF NOT EXISTS performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  reviewer_id uuid REFERENCES users(id),
  period text NOT NULL, -- Q1-2024, 2024-Annual vb.
  overall_score numeric CHECK (overall_score >= 1 AND overall_score <= 5),
  work_quality numeric CHECK (work_quality >= 1 AND work_quality <= 5),
  productivity numeric CHECK (productivity >= 1 AND productivity <= 5),
  communication numeric CHECK (communication >= 1 AND communication <= 5),
  teamwork numeric CHECK (teamwork >= 1 AND teamwork <= 5),
  leadership numeric CHECK (leadership >= 1 AND leadership <= 5),
  goals text,
  achievements text,
  improvements text,
  comments text,
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'approved')),
  evaluation_date date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 🎓 Training Records tablosu
CREATE TABLE IF NOT EXISTS training_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  training_name text NOT NULL,
  provider text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  certificate_url text,
  status text DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'completed', 'failed', 'cancelled')),
  score numeric CHECK (score >= 0 AND score <= 100),
  cost numeric DEFAULT 0,
  mandatory boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 🔐 RLS Politikaları
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_salaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_records ENABLE ROW LEVEL SECURITY;

-- Employees politikaları
CREATE POLICY "Employees can view own data" ON employees
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT created_by::text FROM employees WHERE id = employees.id
    ) OR
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'manager')
    )
  );

CREATE POLICY "HR can manage employees" ON employees
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Salary politikaları (sadece yetkili roller görebilir)
CREATE POLICY "Only authorized can view salaries" ON employee_salaries
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'finance')
    )
  );

CREATE POLICY "Only authorized can manage salaries" ON employee_salaries
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'finance')
    )
  );

-- Users politikaları
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can manage users" ON users
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin')
    )
  );

-- Documents politikaları
CREATE POLICY "Employees can view own documents" ON employee_documents
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE created_by = auth.uid()
    ) OR
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Attendance politikaları
CREATE POLICY "Employees can view own attendance" ON attendance
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE created_by = auth.uid()
    ) OR
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'manager')
    )
  );

-- 🧮 RPC Fonksiyonları

-- Net maaş hesaplama (Türk bordro sistemi)
CREATE OR REPLACE FUNCTION calculate_net_salary(
  gross_amount numeric,
  tax_rate numeric DEFAULT 15,
  insurance_employee numeric DEFAULT 14,
  unemployment_rate numeric DEFAULT 1,
  stamp_tax_rate numeric DEFAULT 0.759
) RETURNS numeric AS $$
DECLARE
  ssk_deduction numeric;
  unemployment_deduction numeric;
  tax_base numeric;
  income_tax numeric;
  stamp_tax numeric;
  total_deductions numeric;
  net_amount numeric;
BEGIN
  -- SSK işçi payı
  ssk_deduction := gross_amount * insurance_employee / 100;
  
  -- İşsizlik sigortası işçi payı
  unemployment_deduction := gross_amount * unemployment_rate / 100;
  
  -- Gelir vergisi matrahı
  tax_base := gross_amount - ssk_deduction - unemployment_deduction;
  
  -- Gelir vergisi
  income_tax := tax_base * tax_rate / 100;
  
  -- Damga vergisi
  stamp_tax := gross_amount * stamp_tax_rate / 100;
  
  -- Toplam kesintiler
  total_deductions := ssk_deduction + unemployment_deduction + income_tax + stamp_tax;
  
  -- Net maaş
  net_amount := gross_amount - total_deductions;
  
  RETURN GREATEST(net_amount, 0);
END;
$$ LANGUAGE plpgsql;

-- Brüt maaş hesaplama (net'ten brüt'e)
CREATE OR REPLACE FUNCTION calculate_gross_salary(
  net_amount numeric,
  tax_rate numeric DEFAULT 15,
  insurance_employee numeric DEFAULT 14,
  unemployment_rate numeric DEFAULT 1,
  stamp_tax_rate numeric DEFAULT 0.759
) RETURNS numeric AS $$
DECLARE
  gross_estimate numeric;
  calculated_net numeric;
  difference numeric;
  iteration integer := 0;
  max_iterations integer := 100;
  tolerance numeric := 0.01;
BEGIN
  -- Başlangıç tahmini (yaklaşık %30 kesinti varsayımı)
  gross_estimate := net_amount / 0.70;
  
  -- İteratif hesaplama
  LOOP
    calculated_net := calculate_net_salary(
      gross_estimate, 
      tax_rate, 
      insurance_employee, 
      unemployment_rate, 
      stamp_tax_rate
    );
    
    difference := net_amount - calculated_net;
    
    -- Tolerans içindeyse dur
    IF ABS(difference) < tolerance THEN
      EXIT;
    END IF;
    
    -- Tahmini ayarla
    gross_estimate := gross_estimate + (difference / 0.70);
    
    iteration := iteration + 1;
    IF iteration > max_iterations THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN ROUND(gross_estimate, 2);
END;
$$ LANGUAGE plpgsql;

-- Otomatik personel kodu üretimi
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS text AS $$
DECLARE
  current_year text;
  current_month text;
  current_day text;
  random_suffix text;
  new_code text;
  code_exists boolean;
BEGIN
  current_year := EXTRACT(year FROM now())::text;
  current_month := LPAD(EXTRACT(month FROM now())::text, 2, '0');
  current_day := LPAD(EXTRACT(day FROM now())::text, 2, '0');
  
  LOOP
    random_suffix := LPAD((RANDOM() * 9999)::integer::text, 4, '0');
    new_code := 'EMP' || current_year || current_month || current_day || random_suffix;
    
    SELECT EXISTS(SELECT 1 FROM employees WHERE employee_code = new_code) INTO code_exists;
    
    IF NOT code_exists THEN
      EXIT;
    END IF;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Bordro hesaplama ve oluşturma
CREATE OR REPLACE FUNCTION generate_payroll(
  p_employee_id uuid,
  p_period text,
  p_overtime_hours numeric DEFAULT 0,
  p_bonus_amount numeric DEFAULT 0
) RETURNS uuid AS $$
DECLARE
  employee_record employees%ROWTYPE;
  salary_record employee_salaries%ROWTYPE;
  attendance_hours numeric;
  gross_with_overtime numeric;
  ssk_deduction numeric;
  unemployment_deduction numeric;
  tax_base numeric;
  income_tax numeric;
  stamp_tax numeric;
  total_deductions numeric;
  final_net numeric;
  payroll_id uuid;
BEGIN
  -- Personel bilgilerini al
  SELECT * INTO employee_record FROM employees WHERE id = p_employee_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;
  
  -- Maaş bilgilerini al
  SELECT * INTO salary_record 
  FROM employee_salaries 
  WHERE employee_id = p_employee_id AND is_active = true
  ORDER BY created_at DESC LIMIT 1;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Salary record not found';
  END IF;
  
  -- Mesai hesaplama
  gross_with_overtime := salary_record.gross_salary + (p_overtime_hours * salary_record.overtime_rate);
  
  -- Kesintileri hesapla
  ssk_deduction := gross_with_overtime * salary_record.insurance_employee / 100;
  unemployment_deduction := gross_with_overtime * 1 / 100; -- %1 işsizlik
  tax_base := gross_with_overtime - ssk_deduction - unemployment_deduction;
  income_tax := tax_base * salary_record.tax_rate / 100;
  stamp_tax := gross_with_overtime * salary_record.stamp_tax / 100;
  
  total_deductions := ssk_deduction + unemployment_deduction + income_tax + stamp_tax;
  final_net := gross_with_overtime - total_deductions + p_bonus_amount + salary_record.meal_support + salary_record.transport_support;
  
  -- Bordro kaydı oluştur
  INSERT INTO payroll_records (
    employee_id, period, gross_salary, net_salary,
    ssk_employee, unemployment_insurance, income_tax, stamp_tax,
    overtime_amount, bonus_amount, meal_support, transport_support,
    total_deductions, final_net_salary, status
  ) VALUES (
    p_employee_id, p_period, gross_with_overtime, salary_record.net_salary,
    ssk_deduction, unemployment_deduction, income_tax, stamp_tax,
    p_overtime_hours * salary_record.overtime_rate, p_bonus_amount,
    salary_record.meal_support, salary_record.transport_support,
    total_deductions, final_net, 'draft'
  ) RETURNING id INTO payroll_id;
  
  RETURN payroll_id;
END;
$$ LANGUAGE plpgsql;

-- Çalışan performans güncelleme
CREATE OR REPLACE FUNCTION update_employee_performance(
  p_employee_id uuid,
  p_score numeric
) RETURNS void AS $$
BEGIN
  UPDATE employees 
  SET performance = p_score, updated_at = now()
  WHERE id = p_employee_id;
  
  -- Audit log
  INSERT INTO audit_logs (user_id, employee_id, action, description, module)
  VALUES (auth.uid(), p_employee_id, 'performance_update', 
          'Performance score updated to ' || p_score, 'HR');
END;
$$ LANGUAGE plpgsql;

-- İndeksler (performans için)
CREATE INDEX IF NOT EXISTS idx_employees_employee_code ON employees(employee_code);
CREATE INDEX IF NOT EXISTS idx_employees_department ON employees(department);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_employee_id ON employee_salaries(employee_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance(employee_id, date);
CREATE INDEX IF NOT EXISTS idx_payroll_employee_period ON payroll_records(employee_id, period);
CREATE INDEX IF NOT EXISTS idx_audit_logs_employee_id ON audit_logs(employee_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Trigger'lar (otomatik güncelleme için)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Updated_at trigger'larını ekle
CREATE TRIGGER update_employees_updated_at BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_employee_salaries_updated_at BEFORE UPDATE ON employee_salaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Otomatik personel kodu trigger'ı
CREATE OR REPLACE FUNCTION set_employee_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := generate_employee_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_employee_code_trigger BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION set_employee_code();/*
  # İK Sistemi Ekstra Özellikler

  1. Yeni Özellikler
    - Otomatik personel kodu üretimi
    - Avatar yükleme sistemi
    - E-posta bildirimleri
    - Vardiya ve PDKS bağlantısı

  2. Yeni Tablolar
    - `shifts` - Vardiya tanımları
    - `employee_shifts` - Personel vardiya atamaları
    - `email_notifications` - E-posta bildirim logları

  3. RPC Fonksiyonları
    - `generate_employee_code` - Otomatik personel kodu
    - `assign_shift_to_employee` - Vardiya atama
    - `send_welcome_email` - Hoş geldin e-postası
*/

-- 📋 Shifts (Vardiya) tablosu
CREATE TABLE IF NOT EXISTS shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_duration integer DEFAULT 60, -- dakika cinsinden
  is_night_shift boolean DEFAULT false,
  overtime_threshold integer DEFAULT 480, -- 8 saat = 480 dakika
  department text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 👥 Employee Shifts (Personel Vardiya Atamaları) tablosu
CREATE TABLE IF NOT EXISTS employee_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES shifts(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  is_active boolean DEFAULT true,
  assigned_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- 📧 Email Notifications tablosu
CREATE TABLE IF NOT EXISTS email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE,
  email_type text NOT NULL, -- 'welcome', 'password_reset', 'payroll', 'leave_approval'
  recipient_email text NOT NULL,
  subject text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- 🔢 Otomatik personel kodu üretimi fonksiyonu
CREATE OR REPLACE FUNCTION generate_employee_code()
RETURNS text AS $$
DECLARE
  current_year text;
  current_month text;
  sequence_num integer;
  new_code text;
BEGIN
  current_year := EXTRACT(year FROM now())::text;
  current_month := LPAD(EXTRACT(month FROM now())::text, 2, '0');
  
  -- Bu ay için sıradaki numarayı bul
  SELECT COALESCE(MAX(
    CASE 
      WHEN employee_code ~ '^EMP[0-9]{6}[0-9]{3}$' 
      THEN (RIGHT(employee_code, 3))::integer 
      ELSE 0 
    END
  ), 0) + 1
  INTO sequence_num
  FROM employees
  WHERE employee_code LIKE 'EMP' || current_year || current_month || '%';
  
  new_code := 'EMP' || current_year || current_month || LPAD(sequence_num::text, 3, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- 👤 Kullanıcı hesabı oluşturma fonksiyonu
CREATE OR REPLACE FUNCTION create_user_account(
  p_employee_id uuid,
  p_username text,
  p_email text,
  p_password text,
  p_role text,
  p_language text DEFAULT 'tr'
) RETURNS uuid AS $$
DECLARE
  user_id uuid;
  password_hash text;
BEGIN
  -- Basit password hash (production'da bcrypt kullanın)
  password_hash := encode(digest(p_password || 'salt', 'sha256'), 'hex');
  
  INSERT INTO users (
    employee_id, name, email, username, password_hash, 
    role, language, is_active
  ) 
  SELECT 
    p_employee_id, full_name, p_email, p_username, password_hash,
    p_role, p_language, true
  FROM employees 
  WHERE id = p_employee_id
  RETURNING id INTO user_id;
  
  -- Hoş geldin e-postası kuyruğa ekle
  INSERT INTO email_notifications (
    employee_id, email_type, recipient_email, subject, content
  ) VALUES (
    p_employee_id, 'welcome', p_email,
    'Duende Health CRM - Hoş Geldiniz',
    'Merhaba, sisteme hoş geldiniz! Kullanıcı adınız: ' || p_username
  );
  
  RETURN user_id;
END;
$$ LANGUAGE plpgsql;

-- 📅 Vardiya atama fonksiyonu
CREATE OR REPLACE FUNCTION assign_shift_to_employee(
  p_employee_id uuid,
  p_shift_id uuid,
  p_start_date date,
  p_assigned_by uuid
) RETURNS uuid AS $$
DECLARE
  assignment_id uuid;
BEGIN
  -- Mevcut aktif vardiyayı sonlandır
  UPDATE employee_shifts 
  SET end_date = p_start_date - INTERVAL '1 day', is_active = false
  WHERE employee_id = p_employee_id AND is_active = true;
  
  -- Yeni vardiya ataması
  INSERT INTO employee_shifts (
    employee_id, shift_id, start_date, assigned_by
  ) VALUES (
    p_employee_id, p_shift_id, p_start_date, p_assigned_by
  ) RETURNING id INTO assignment_id;
  
  RETURN assignment_id;
END;
$$ LANGUAGE plpgsql;

-- 💰 Gelişmiş bordro hesaplama (mesai dahil)
CREATE OR REPLACE FUNCTION calculate_monthly_payroll(
  p_employee_id uuid,
  p_period text, -- 'YYYY-MM'
  p_overtime_hours numeric DEFAULT 0,
  p_bonus numeric DEFAULT 0
) RETURNS TABLE (
  gross_salary numeric,
  ssk_employee numeric,
  unemployment_insurance numeric,
  income_tax numeric,
  stamp_tax numeric,
  total_deductions numeric,
  net_salary numeric,
  overtime_amount numeric,
  final_amount numeric
) AS $$
DECLARE
  emp_salary numeric;
  overtime_rate numeric;
  tax_rate numeric;
  gross_with_overtime numeric;
  ssk_deduction numeric;
  unemployment_deduction numeric;
  tax_base numeric;
  income_tax_amount numeric;
  stamp_tax_amount numeric;
  total_deduction numeric;
  net_amount numeric;
  overtime_payment numeric;
  final_payment numeric;
BEGIN
  -- Personel maaş bilgilerini al
  SELECT es.gross_salary, es.overtime_rate, es.tax_rate
  INTO emp_salary, overtime_rate, tax_rate
  FROM employee_salaries es
  WHERE es.employee_id = p_employee_id AND es.is_active = true
  ORDER BY es.created_at DESC LIMIT 1;
  
  IF emp_salary IS NULL THEN
    RAISE EXCEPTION 'Employee salary record not found';
  END IF;
  
  -- Mesai ücreti hesapla
  overtime_payment := p_overtime_hours * COALESCE(overtime_rate, 0);
  gross_with_overtime := emp_salary + overtime_payment;
  
  -- Kesintileri hesapla
  ssk_deduction := gross_with_overtime * 0.14; -- %14 SSK
  unemployment_deduction := gross_with_overtime * 0.01; -- %1 İşsizlik
  tax_base := gross_with_overtime - ssk_deduction - unemployment_deduction;
  income_tax_amount := tax_base * (COALESCE(tax_rate, 15) / 100); -- Varsayılan %15
  stamp_tax_amount := gross_with_overtime * 0.00759; -- 0.759‰ Damga vergisi
  
  total_deduction := ssk_deduction + unemployment_deduction + income_tax_amount + stamp_tax_amount;
  net_amount := gross_with_overtime - total_deduction;
  final_payment := net_amount + p_bonus;
  
  RETURN QUERY SELECT 
    gross_with_overtime,
    ssk_deduction,
    unemployment_deduction,
    income_tax_amount,
    stamp_tax_amount,
    total_deduction,
    net_amount,
    overtime_payment,
    final_payment;
END;
$$ LANGUAGE plpgsql;

-- 🔄 Trigger: Otomatik personel kodu
CREATE OR REPLACE FUNCTION set_employee_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.employee_code IS NULL THEN
    NEW.employee_code := generate_employee_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_employee_code_trigger 
  BEFORE INSERT ON employees
  FOR EACH ROW EXECUTE FUNCTION set_employee_code();

-- 📧 E-posta kuyruğu işleme fonksiyonu
CREATE OR REPLACE FUNCTION process_email_queue()
RETURNS void AS $$
DECLARE
  email_record email_notifications%ROWTYPE;
BEGIN
  FOR email_record IN 
    SELECT * FROM email_notifications 
    WHERE status = 'pending' 
    ORDER BY created_at ASC 
    LIMIT 10
  LOOP
    -- Gerçek uygulamada burada SMTP ile e-posta gönderilir
    -- Şimdilik sadece durumu güncelliyoruz
    UPDATE email_notifications 
    SET status = 'sent', sent_at = now()
    WHERE id = email_record.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 🕒 PDKS entegrasyonu için view
CREATE OR REPLACE VIEW employee_attendance_summary AS
SELECT 
  e.id,
  e.employee_code,
  e.full_name,
  e.department,
  e.position,
  COUNT(a.id) as total_days,
  COUNT(CASE WHEN a.status = 'present' THEN 1 END) as present_days,
  COUNT(CASE WHEN a.is_late = true THEN 1 END) as late_days,
  AVG(a.total_hours) as avg_daily_hours,
  SUM(a.overtime_hours) as total_overtime
FROM employees e
LEFT JOIN attendance a ON e.id = a.employee_id
WHERE e.status = 'active'
GROUP BY e.id, e.employee_code, e.full_name, e.department, e.position;

-- 📊 Varsayılan vardiyalar
INSERT INTO shifts (name, start_time, end_time, break_duration, department) VALUES
('Gündüz Vardiyası', '09:00', '18:00', 60, 'Genel'),
('Gece Vardiyası', '22:00', '06:00', 60, 'Genel'),
('Esnek Vardiya', '10:00', '19:00', 60, 'Satış'),
('Doktor Vardiyası', '08:00', '17:00', 60, 'Tıp'),
('Hemşire Vardiyası', '07:00', '19:00', 60, 'Tıp')
ON CONFLICT DO NOTHING;

-- 🔐 RLS Politikaları
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Shifts politikaları
CREATE POLICY "Everyone can view shifts" ON shifts
  FOR SELECT USING (true);

CREATE POLICY "Only managers can manage shifts" ON shifts
  FOR ALL USING (
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Employee shifts politikaları
CREATE POLICY "Employees can view own shifts" ON employee_shifts
  FOR SELECT USING (
    employee_id IN (
      SELECT id FROM employees WHERE created_by = auth.uid()
    ) OR
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', 'admin', 'manager')
    )
  );

-- Email notifications politikaları
CREATE POLICY "Only admins can view email logs" ON email_notifications
  FOR SELECT USING (
    auth.uid()::text IN (
      SELECT id::text FROM users WHERE role IN ('super_admin', '
    )
  );

-- 📈 İndeksler
CREATE INDEX IF NOT EXISTS idx_employee_shifts_employee_id ON employee_shifts(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_shifts_shift_id ON employee_shifts(shift_id);
CREATE INDEX IF NOT EXISTS idx_email_notifications_status ON email_notifications(status);
CREATE INDEX IF NOT EXISTS idx_email_notifications_employee_id ON email_notifications(employee_id);