CREATE TABLE IF NOT EXISTS planned_visits (
  id SERIAL PRIMARY KEY,
  receipt_id UUID NOT NULL UNIQUE,
  submission_token UUID NOT NULL UNIQUE,
  payload_hash TEXT NOT NULL,
  visit_date DATE NOT NULL,
  party TEXT NOT NULL CHECK (party IN ('Just me', 'With friends', 'With family')),
  bringing_children BOOLEAN NOT NULL,
  child_age_groups TEXT[] NOT NULL DEFAULT '{}',
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254),
  phone VARCHAR(30),
  questions VARCHAR(2000) NOT NULL DEFAULT '',
  consent_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Contacted', 'Visited', 'Cancelled')),
  staff_notes VARCHAR(4000) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CHECK (EXTRACT(DOW FROM visit_date) = 0),
  CHECK (child_age_groups <@ ARRAY['Under 3', 'Ages 3–5', 'Ages 6–12']::TEXT[]),
  CHECK (bringing_children OR cardinality(child_age_groups) = 0)
);
CREATE INDEX IF NOT EXISTS planned_visits_date_status_idx ON planned_visits (visit_date, status, id);
