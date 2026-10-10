ALTER TABLE members ADD COLUMN IF NOT EXISTS parents_household_id INT REFERENCES households(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS members_parents_household_idx ON members(parents_household_id);

CREATE TABLE IF NOT EXISTS family_people (
  id SERIAL PRIMARY KEY,
  stable_key UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  member_id INT UNIQUE REFERENCES members(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL CHECK (length(trim(name)) > 0),
  household_id INT REFERENCES households(id) ON DELETE SET NULL,
  merged_into_id INT REFERENCES family_people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT family_people_merge_unregistered CHECK (merged_into_id IS NULL OR member_id IS NULL),
  CONSTRAINT family_people_merge_not_self CHECK (merged_into_id IS NULL OR merged_into_id <> id)
);
CREATE INDEX IF NOT EXISTS family_people_household_idx ON family_people(household_id);
ALTER TABLE family_people ADD COLUMN IF NOT EXISTS household_entry_key TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS family_people_household_entry_idx ON family_people(household_id,household_entry_key);
CREATE TABLE IF NOT EXISTS family_relationships (
  id SERIAL PRIMARY KEY,
  from_person_id INT NOT NULL REFERENCES family_people(id) ON DELETE RESTRICT,
  to_person_id INT NOT NULL REFERENCES family_people(id) ON DELETE RESTRICT,
  kind VARCHAR(20) NOT NULL CHECK (kind IN ('parent', 'guardian', 'spouse')),
  parent_role VARCHAR(10) CHECK (parent_role IN ('father', 'mother', 'parent')),
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(from_person_id, to_person_id, kind),
  CHECK (from_person_id <> to_person_id),
  CHECK ((kind = 'parent' AND parent_role IS NOT NULL) OR (kind <> 'parent' AND parent_role IS NULL)),
  CHECK (kind <> 'spouse' OR from_person_id < to_person_id)
);
CREATE INDEX IF NOT EXISTS family_relationships_to_idx ON family_relationships(to_person_id);
-- Safe to rerun after an interrupted or earlier additive installation.
ALTER TABLE family_people ADD COLUMN IF NOT EXISTS merged_into_id INT REFERENCES family_people(id) ON DELETE RESTRICT;
ALTER TABLE family_relationships ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE family_relationships ADD COLUMN IF NOT EXISTS source_household_id INT REFERENCES households(id) ON DELETE SET NULL;
ALTER TABLE family_relationships ADD COLUMN IF NOT EXISTS source_removed BOOLEAN NOT NULL DEFAULT FALSE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='family_people'::regclass AND conname='family_people_merge_unregistered') THEN
    ALTER TABLE family_people ADD CONSTRAINT family_people_merge_unregistered CHECK (merged_into_id IS NULL OR member_id IS NULL);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='family_people'::regclass AND conname='family_people_merge_not_self') THEN
    ALTER TABLE family_people ADD CONSTRAINT family_people_merge_not_self CHECK (merged_into_id IS NULL OR merged_into_id <> id);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname=current_schema() AND indexname='family_child_parent_role_idx' AND indexdef NOT LIKE '%deleted_at%') THEN
    DROP INDEX family_child_parent_role_idx;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS family_child_parent_role_idx ON family_relationships(to_person_id, parent_role)
  WHERE deleted_at IS NULL AND kind = 'parent' AND parent_role IN ('father', 'mother');

-- Only explicit registered identities are seeded. Legacy names are suggestions, not ancestry.
INSERT INTO family_people(member_id, name)
SELECT id, trim(first_name || ' ' || last_name) FROM members ON CONFLICT(member_id) DO NOTHING;
INSERT INTO family_relationships(from_person_id, to_person_id, kind)
SELECT LEAST(a.id,b.id), GREATEST(a.id,b.id), 'spouse'
FROM members m JOIN family_people a ON a.member_id=m.id JOIN family_people b ON b.member_id=m.spouse_id
WHERE m.id <> m.spouse_id
ON CONFLICT DO NOTHING;
