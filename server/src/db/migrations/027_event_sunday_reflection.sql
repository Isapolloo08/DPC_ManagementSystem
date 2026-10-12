-- Opt-in per event. Existing events and Sunday attendance remain unchanged.
ALTER TABLE events ADD COLUMN IF NOT EXISTS sunday_service_date DATE CHECK (EXTRACT(DOW FROM sunday_service_date) = 0);
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS reflected_from_event_id INTEGER REFERENCES events(id) ON DELETE SET NULL;
