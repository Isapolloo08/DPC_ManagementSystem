ALTER TABLE event_invitation_responses ADD COLUMN IF NOT EXISTS member_id INTEGER REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE event_invitation_responses ADD COLUMN IF NOT EXISTS event_id INTEGER REFERENCES events(id) ON DELETE CASCADE;
UPDATE event_invitation_responses r SET event_id = i.event_id, member_id = COALESCE(r.member_id, i.member_id)
FROM event_invitation_links i WHERE r.invitation_id = i.id AND r.event_id IS NULL;
ALTER TABLE event_invitation_responses ALTER COLUMN event_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS event_invitation_response_member_unique
  ON event_invitation_responses(event_id, member_id) WHERE member_id IS NOT NULL;
