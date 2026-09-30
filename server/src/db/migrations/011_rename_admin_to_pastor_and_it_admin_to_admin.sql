-- ==============================================================================
-- PostgreSQL Migration: 011_rename_admin_to_pastor_and_it_admin_to_admin.sql
-- Description: Renames 'IT Admin' -> 'Admin' (Super Admin) and old 'Admin' -> 'Pastor' (Pastor / Executive)
-- ==============================================================================

DO $$
DECLARE
  v_it_admin_id INT;
  v_admin_id INT;
  v_pastor_id INT;
BEGIN
  -- Case 1: Both 'Admin' and 'IT Admin' exist
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'Admin') AND EXISTS (SELECT 1 FROM roles WHERE name = 'IT Admin') THEN
    SELECT id INTO v_it_admin_id FROM roles WHERE name = 'IT Admin';
    SELECT id INTO v_admin_id FROM roles WHERE name = 'Admin';
    
    IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Pastor') THEN
      UPDATE roles SET name = 'Pastor' WHERE id = v_admin_id;
      UPDATE roles SET name = 'Admin' WHERE id = v_it_admin_id;
    ELSE
      SELECT id INTO v_pastor_id FROM roles WHERE name = 'Pastor';
      UPDATE users SET role_id = v_pastor_id WHERE role_id = v_admin_id;
      UPDATE roles SET name = 'Old_Admin_Temp' WHERE id = v_admin_id;
      UPDATE roles SET name = 'Admin' WHERE id = v_it_admin_id;
      DELETE FROM roles WHERE id = v_admin_id;
    END IF;
  -- Case 2: Only 'IT Admin' exists without 'Admin'
  ELSIF EXISTS (SELECT 1 FROM roles WHERE name = 'IT Admin') AND NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Admin') THEN
    UPDATE roles SET name = 'Admin' WHERE name = 'IT Admin';
  -- Case 3: Only 'Admin' exists without 'Pastor'
  ELSIF EXISTS (SELECT 1 FROM roles WHERE name = 'Admin') AND NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Pastor') THEN
    UPDATE roles SET name = 'Pastor' WHERE name = 'Admin';
    INSERT INTO roles (name) VALUES ('Admin') ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Ensure 'Pastor' exists
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Pastor') THEN
    INSERT INTO roles (name) VALUES ('Pastor') ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Ensure 'Admin' exists
  IF NOT EXISTS (SELECT 1 FROM roles WHERE name = 'Admin') THEN
    INSERT INTO roles (name) VALUES ('Admin') ON CONFLICT (name) DO NOTHING;
  END IF;

  -- Cleanup any leftover 'IT Admin' role
  IF EXISTS (SELECT 1 FROM roles WHERE name = 'IT Admin') THEN
    SELECT id INTO v_admin_id FROM roles WHERE name = 'Admin';
    SELECT id INTO v_it_admin_id FROM roles WHERE name = 'IT Admin';
    IF v_admin_id IS NOT NULL AND v_it_admin_id IS NOT NULL THEN
      UPDATE users SET role_id = v_admin_id WHERE role_id = v_it_admin_id;
      DELETE FROM roles WHERE id = v_it_admin_id;
    END IF;
  END IF;
END $$;

-- Ensure all 6 roles exist
INSERT INTO roles (name) VALUES
  ('Admin'),
  ('Pastor'),
  ('Coordinator'),
  ('Leader'),
  ('Volunteer'),
  ('Member')
ON CONFLICT (name) DO NOTHING;
