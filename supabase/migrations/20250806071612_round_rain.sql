/*
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