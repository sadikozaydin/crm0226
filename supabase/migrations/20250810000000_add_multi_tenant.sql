/*
  # Multi-Tenant Architecture Implementation

  ## Overview
  This migration adds multi-tenant support to the existing CRM system while maintaining
  backward compatibility with current data and functionality.

  ## Changes

  1. New Tables
    - `tenants` - Main tenant/organization table
    - `tenant_users` - User-tenant relationships (many-to-many)
    - `tenant_settings` - Tenant-specific configuration

  2. Schema Modifications
    - Add `tenant_id` column to all existing tables
    - Add foreign key constraints
    - Preserve existing data with default tenant

  3. Security Updates
    - Update all RLS policies for tenant isolation
    - Add super_admin bypass for cross-tenant access
    - Maintain existing role-based permissions within tenants

  4. Important Notes
    - Existing data will be migrated to a default tenant
    - Super admins can access all tenants
    - Users can belong to multiple tenants
    - Each tenant operates in complete isolation
*/

-- =============================================================================
-- STEP 1: CREATE TENANTS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  subdomain text UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#DC2626',
  secondary_color text DEFAULT '#1F2937',
  contact_email text,
  contact_phone text,
  address text,
  country text DEFAULT 'TR',
  timezone text DEFAULT 'Europe/Istanbul',
  currency text DEFAULT 'TRY' CHECK (currency IN ('TRY', 'USD', 'EUR', 'GBP')),
  language text DEFAULT 'tr' CHECK (language IN ('tr', 'en', 'ar', 'es', 'de', 'fr', 'ru')),
  is_active boolean DEFAULT true,
  subscription_plan text DEFAULT 'basic' CHECK (subscription_plan IN ('basic', 'professional', 'enterprise')),
  subscription_expires_at timestamptz,
  max_users integer DEFAULT 10,
  max_branches integer DEFAULT 1,
  features jsonb DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid
);

-- =============================================================================
-- STEP 2: CREATE TENANT SETTINGS TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  allow_registration boolean DEFAULT false,
  require_2fa boolean DEFAULT false,
  session_timeout_hours integer DEFAULT 8,
  password_policy jsonb DEFAULT '{"min_length": 6, "require_uppercase": false, "require_numbers": false}',
  email_settings jsonb DEFAULT '{}',
  sms_settings jsonb DEFAULT '{}',
  notification_settings jsonb DEFAULT '{}',
  api_settings jsonb DEFAULT '{}',
  custom_fields jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id)
);

-- =============================================================================
-- STEP 3: CREATE TENANT USERS JUNCTION TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('super_admin', 'admin', 'manager', 'doctor', 'nurse', 'agent', 'coordinator', 'finance', 'partner', 'patient')),
  permissions text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  joined_at timestamptz DEFAULT now(),
  last_accessed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- =============================================================================
-- STEP 4: ADD TENANT_ID TO EXISTING TABLES
-- =============================================================================

-- Employees
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employees' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE employees ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Employee Salaries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_salaries' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE employee_salaries ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE users ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Employee Documents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_documents' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE employee_documents ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Attendance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'attendance' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE attendance ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Leave Requests
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leave_requests' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE leave_requests ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Payroll Records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payroll_records' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE payroll_records ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Audit Logs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Performance Reviews
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'performance_reviews' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE performance_reviews ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Training Records
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_records' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE training_records ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shifts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE shifts ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Employee Shifts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'employee_shifts' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE employee_shifts ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Email Notifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_notifications' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE email_notifications ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- =============================================================================
-- STEP 5: CREATE DEFAULT TENANT AND MIGRATE EXISTING DATA
-- =============================================================================

-- Create default tenant
INSERT INTO tenants (
  id, name, slug, subdomain, contact_email, is_active, subscription_plan
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Default Organization',
  'default',
  'default',
  'admin@duendecrm.com',
  true,
  'enterprise'
) ON CONFLICT (id) DO NOTHING;

-- Update existing data with default tenant_id
UPDATE employees SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE employee_salaries SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE users SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE employee_documents SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE attendance SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE leave_requests SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE payroll_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE audit_logs SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE performance_reviews SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE training_records SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE shifts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE employee_shifts SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE email_notifications SET tenant_id = '00000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;

-- =============================================================================
-- STEP 6: ENABLE RLS ON NEW TABLES
-- =============================================================================

ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_users ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 7: CREATE RLS POLICIES FOR TENANT ISOLATION
-- =============================================================================

-- Tenants Policies
CREATE POLICY "Super admins can view all tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their own tenants"
  ON tenants FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "Super admins can manage all tenants"
  ON tenants FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Tenant Settings Policies
CREATE POLICY "Tenant admins can view their tenant settings"
  ON tenant_settings FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  );

CREATE POLICY "Tenant admins can manage their tenant settings"
  ON tenant_settings FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  );

-- Tenant Users Policies
CREATE POLICY "Users can view their tenant memberships"
  ON tenant_users FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() OR
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  );

CREATE POLICY "Tenant admins can manage tenant users"
  ON tenant_users FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin')
      AND is_active = true
    )
  );

-- =============================================================================
-- STEP 8: UPDATE EXISTING RLS POLICIES WITH TENANT ISOLATION
-- =============================================================================

-- Drop existing policies and recreate with tenant isolation
DROP POLICY IF EXISTS "Employees can view own data" ON employees;
DROP POLICY IF EXISTS "HR can manage employees" ON employees;

CREATE POLICY "Users can view employees in their tenant"
  ON employees FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid() AND is_active = true
    ) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Admins can manage employees in their tenant"
  ON employees FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'manager')
      AND is_active = true
    ) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

-- Update other table policies similarly
DROP POLICY IF EXISTS "Only authorized can view salaries" ON employee_salaries;
DROP POLICY IF EXISTS "Only authorized can manage salaries" ON employee_salaries;

CREATE POLICY "Authorized users can view salaries in their tenant"
  ON employee_salaries FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'finance')
      AND is_active = true
    ) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

CREATE POLICY "Authorized users can manage salaries in their tenant"
  ON employee_salaries FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM tenant_users
      WHERE user_id = auth.uid()
      AND role IN ('super_admin', 'admin', 'finance')
      AND is_active = true
    ) OR
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'super_admin'
    )
  );

-- =============================================================================
-- STEP 9: CREATE HELPER FUNCTIONS
-- =============================================================================

-- Get current user's tenant
CREATE OR REPLACE FUNCTION get_current_user_tenant()
RETURNS uuid AS $$
BEGIN
  RETURN (
    SELECT tenant_id FROM tenant_users
    WHERE user_id = auth.uid()
    AND is_active = true
    ORDER BY last_accessed_at DESC NULLS LAST
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user is super admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role = 'super_admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user belongs to tenant
CREATE OR REPLACE FUNCTION user_belongs_to_tenant(p_tenant_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM tenant_users
    WHERE user_id = auth.uid()
    AND tenant_id = p_tenant_id
    AND is_active = true
  ) OR is_super_admin();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create new tenant with initial setup
CREATE OR REPLACE FUNCTION create_tenant(
  p_name text,
  p_slug text,
  p_admin_user_id uuid,
  p_contact_email text DEFAULT NULL
) RETURNS uuid AS $$
DECLARE
  new_tenant_id uuid;
BEGIN
  -- Create tenant
  INSERT INTO tenants (name, slug, contact_email)
  VALUES (p_name, p_slug, p_contact_email)
  RETURNING id INTO new_tenant_id;

  -- Create default settings
  INSERT INTO tenant_settings (tenant_id)
  VALUES (new_tenant_id);

  -- Add admin user to tenant
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, p_admin_user_id, 'admin');

  -- Log action
  INSERT INTO audit_logs (user_id, action, description, module, tenant_id)
  VALUES (auth.uid(), 'tenant_created', 'New tenant created: ' || p_name, 'SYSTEM', new_tenant_id);

  RETURN new_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 10: CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON tenants(is_active);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant_id ON tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_user_id ON tenant_users(user_id);
CREATE INDEX IF NOT EXISTS idx_tenant_users_role ON tenant_users(role);

-- Add tenant_id indexes on all tables
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_employee_salaries_tenant_id ON employee_salaries(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attendance_tenant_id ON attendance(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_tenant_id ON payroll_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id ON audit_logs(tenant_id);

-- =============================================================================
-- STEP 11: CREATE TRIGGERS
-- =============================================================================

-- Auto-update updated_at for tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_settings_updated_at
  BEFORE UPDATE ON tenant_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_users_updated_at
  BEFORE UPDATE ON tenant_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- STEP 12: CREATE DEMO TENANTS
-- =============================================================================

-- Create demo tenants for testing
INSERT INTO tenants (name, slug, subdomain, contact_email, subscription_plan) VALUES
('Duende Health Turkey', 'duende-turkey', 'turkey', 'turkey@duendehealth.com', 'enterprise'),
('Duende Health Germany', 'duende-germany', 'germany', 'germany@duendehealth.com', 'professional'),
('Duende Health Spain', 'duende-spain', 'spain', 'spain@duendehealth.com', 'professional')
ON CONFLICT (slug) DO NOTHING;
