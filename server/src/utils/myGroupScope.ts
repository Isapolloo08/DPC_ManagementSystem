// The primary leader is stored as name/contact in the existing schema.
// Prefer the saved contact; use an exact name only for legacy rows without one.
// Assistant member IDs and enrollment IDs refer to members, never users.
export const MY_GROUP_LEADER_SCOPE = `EXISTS (
  SELECT 1 FROM users account
  LEFT JOIN members linked ON linked.user_id = account.id
  WHERE account.id = $1 AND (
    (
      NULLIF(LOWER(TRIM(g.leader_contact)), '') IN (
        NULLIF(LOWER(TRIM(account.email)), ''), NULLIF(LOWER(TRIM(account.username)), ''),
        NULLIF(LOWER(TRIM(linked.contact_email)), ''), NULLIF(LOWER(TRIM(linked.contact_phone)), '')
      )
      OR (
        NULLIF(TRIM(g.leader_contact), '') IS NULL
        AND NULLIF(LOWER(TRIM(g.leader_name)), '') IN (
          NULLIF(LOWER(TRIM(account.name)), ''),
          NULLIF(LOWER(TRIM(linked.first_name || ' ' || linked.last_name)), '')
        )
        AND NOT EXISTS (
          SELECT 1 FROM users other_account
          LEFT JOIN members other_linked ON other_linked.user_id = other_account.id
          WHERE other_account.id <> account.id
            AND LOWER(TRIM(g.leader_name)) IN (
              LOWER(TRIM(other_account.name)), LOWER(TRIM(other_linked.first_name || ' ' || other_linked.last_name))
            )
        )
      )
    )
    OR g.assistant_leader_id = linked.id
    OR (
      g.assistant_leader_id IS NULL AND (
        NULLIF(LOWER(TRIM(g.assistant_leader_contact)), '') IN (
          NULLIF(LOWER(TRIM(account.email)), ''), NULLIF(LOWER(TRIM(account.username)), ''),
          NULLIF(LOWER(TRIM(linked.contact_email)), ''), NULLIF(LOWER(TRIM(linked.contact_phone)), '')
        )
        OR (
          NULLIF(TRIM(g.assistant_leader_contact), '') IS NULL
          AND NULLIF(LOWER(TRIM(g.assistant_leader_name)), '') IN (
            NULLIF(LOWER(TRIM(account.name)), ''),
            NULLIF(LOWER(TRIM(linked.first_name || ' ' || linked.last_name)), '')
          )
          AND NOT EXISTS (
            SELECT 1 FROM users other_account
            LEFT JOIN members other_linked ON other_linked.user_id = other_account.id
            WHERE other_account.id <> account.id
              AND LOWER(TRIM(g.assistant_leader_name)) IN (
                LOWER(TRIM(other_account.name)), LOWER(TRIM(other_linked.first_name || ' ' || other_linked.last_name))
              )
          )
        )
      )
    )
  )
)`;

export const MY_GROUP_SCOPE = `(${MY_GROUP_LEADER_SCOPE} OR EXISTS (
  SELECT 1 FROM members linked
  JOIN bible_study_members enrollment ON enrollment.member_id = linked.id
  WHERE linked.user_id = $1 AND enrollment.group_id = g.id
    AND COALESCE(enrollment.status, 'active') = 'active'
))`;
