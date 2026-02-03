/*
  # Add Subscription Dates to Tenants

  ## Summary
  Adds subscription start and end dates to the tenants table to enable:
  - Automatic tenant expiration tracking
  - Renewal reminders for admins and super admins
  - Automatic login blocking for expired tenants
  - Historical subscription tracking

  ## Changes

  1. New Columns
    - `subscription_start_date` (timestamptz) - When the subscription period begins
    - `subscription_end_date` (timestamptz) - When the subscription period ends
    - `subscription_status` (text) - Current status: active, expiring_soon, expired, suspended
    - `last_reminder_sent_at` (timestamptz) - Track when last expiration reminder was sent
    - `reminder_count` (integer) - Count of reminders sent

  2. Indexes
    - Index on `subscription_end_date` for efficient expiration queries
    - Index on `subscription_status` for filtering active tenants

  3. Functions
    - `update_tenant_subscription_status()` - Auto-update status based on dates
    - Trigger to run status update on tenant changes

  4. Important Notes
    - Existing tenants will have NULL dates (need manual setup)
    - Super admins can always access expired tenants
    - Regular users cannot login to expired tenants
*/

-- =============================================================================
-- STEP 1: ADD NEW COLUMNS TO TENANTS TABLE
-- =============================================================================

DO $$
BEGIN
  -- Add subscription_start_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'subscription_start_date'
  ) THEN
    ALTER TABLE tenants ADD COLUMN subscription_start_date timestamptz DEFAULT now();
  END IF;

  -- Add subscription_end_date column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'subscription_end_date'
  ) THEN
    ALTER TABLE tenants ADD COLUMN subscription_end_date timestamptz;
  END IF;

  -- Add subscription_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'subscription_status'
  ) THEN
    ALTER TABLE tenants ADD COLUMN subscription_status text DEFAULT 'active'
      CHECK (subscription_status IN ('active', 'expiring_soon', 'expired', 'suspended'));
  END IF;

  -- Add last_reminder_sent_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'last_reminder_sent_at'
  ) THEN
    ALTER TABLE tenants ADD COLUMN last_reminder_sent_at timestamptz;
  END IF;

  -- Add reminder_count column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tenants' AND column_name = 'reminder_count'
  ) THEN
    ALTER TABLE tenants ADD COLUMN reminder_count integer DEFAULT 0;
  END IF;
END $$;

-- =============================================================================
-- STEP 2: CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_tenants_subscription_end_date
  ON tenants(subscription_end_date);

CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status
  ON tenants(subscription_status);

CREATE INDEX IF NOT EXISTS idx_tenants_is_active
  ON tenants(is_active);

-- =============================================================================
-- STEP 3: CREATE FUNCTION TO UPDATE SUBSCRIPTION STATUS
-- =============================================================================

CREATE OR REPLACE FUNCTION update_tenant_subscription_status()
RETURNS trigger AS $$
BEGIN
  -- If subscription_end_date is null, keep as active
  IF NEW.subscription_end_date IS NULL THEN
    NEW.subscription_status := 'active';
    RETURN NEW;
  END IF;

  -- Calculate days until expiration
  DECLARE
    days_until_expiration integer;
  BEGIN
    days_until_expiration := EXTRACT(DAY FROM (NEW.subscription_end_date - now()));

    -- Update status based on days remaining
    IF days_until_expiration < 0 THEN
      NEW.subscription_status := 'expired';
      NEW.is_active := false;
    ELSIF days_until_expiration <= 7 THEN
      NEW.subscription_status := 'expiring_soon';
    ELSE
      NEW.subscription_status := 'active';
    END IF;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: CREATE TRIGGER FOR AUTO STATUS UPDATE
-- =============================================================================

DROP TRIGGER IF EXISTS trigger_update_tenant_subscription_status ON tenants;

CREATE TRIGGER trigger_update_tenant_subscription_status
  BEFORE INSERT OR UPDATE OF subscription_end_date, subscription_start_date
  ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_tenant_subscription_status();

-- =============================================================================
-- STEP 5: CREATE FUNCTION TO GET EXPIRING TENANTS
-- =============================================================================

CREATE OR REPLACE FUNCTION get_expiring_tenants(days_threshold integer DEFAULT 7)
RETURNS TABLE (
  tenant_id uuid,
  tenant_name text,
  contact_email text,
  subscription_end_date timestamptz,
  days_remaining integer,
  last_reminder_sent_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.name,
    t.contact_email,
    t.subscription_end_date,
    EXTRACT(DAY FROM (t.subscription_end_date - now()))::integer,
    t.last_reminder_sent_at
  FROM tenants t
  WHERE
    t.subscription_end_date IS NOT NULL
    AND t.subscription_end_date > now()
    AND EXTRACT(DAY FROM (t.subscription_end_date - now())) <= days_threshold
    AND t.is_active = true
  ORDER BY t.subscription_end_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 6: CREATE FUNCTION TO MARK REMINDER SENT
-- =============================================================================

CREATE OR REPLACE FUNCTION mark_reminder_sent(tenant_id_param uuid)
RETURNS void AS $$
BEGIN
  UPDATE tenants
  SET
    last_reminder_sent_at = now(),
    reminder_count = reminder_count + 1
  WHERE id = tenant_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- STEP 7: UPDATE EXISTING TENANTS WITH DEFAULT DATES
-- =============================================================================

-- Set default subscription dates for existing tenants (1 year from now)
UPDATE tenants
SET
  subscription_start_date = now(),
  subscription_end_date = now() + interval '1 year',
  subscription_status = 'active'
WHERE
  subscription_end_date IS NULL
  AND is_active = true;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON COLUMN tenants.subscription_start_date IS 'When the current subscription period started';
COMMENT ON COLUMN tenants.subscription_end_date IS 'When the current subscription period ends';
COMMENT ON COLUMN tenants.subscription_status IS 'Current subscription status: active, expiring_soon, expired, suspended';
COMMENT ON COLUMN tenants.last_reminder_sent_at IS 'Timestamp of the last expiration reminder sent';
COMMENT ON COLUMN tenants.reminder_count IS 'Total number of reminders sent for this subscription period';
