# One-time invitation identity repair

Tracked in [issue #13](https://github.com/Isapolloo08/DPC_ManagementSystem/issues/13). This is an operator-authorized repair, not an automatic matching rule for Cloud Sync.

The deployed Local Master and cloud inherited the same member dataset but independently assigned invitation synchronization UUIDs. Diagnosis on October 12, 2026 found 81 local members and 84 cloud members: the 81 common member rows agreed on every shared field except `sync_identity`, including original creation timestamps. Seven event UUIDs differed; shared event fields agreed and different creator IDs resolved to the same accounts. Existing matching invitation tokens had matching identities, while one new local link was unpublished.

`server/scripts/repair-invitation-identities.cjs` creates a private mapping plan in preview mode. It accepts only records with identical shared fields; event creator ID differences require verified account identifiers. Conflicting assignments or changed records stop the repair. The paired invitation source must be the inspected cloud database. Cloud-only records are not mapped or deleted.

Apply recomputes the exact plan under database/table and synchronization locks, requires the existing invitation encryption key and creates full custom-format PostgreSQL backups of both public schemas. Dumps are encrypted with AES-256-GCM using `INVITATION_SYNC_ENCRYPTION_KEY`; decryption is verified before temporary plaintext dumps are removed. Preserve that key securely to restore these backups. `backup-manifest.json` records encrypted backup checksums; `repair-plan.json` records exact UUID mappings and snapshot fingerprints without names, contact details or credentials.

The repair changes local member/event UUIDs to the verified cloud identities, preserving numeric IDs, all business fields, response identities, receipts and attendance. Related local availability/notification event UUIDs are updated. Transactional audit entries record each mapping. No cloud records are changed by the identity repair itself. Broad Push remains a separate explicit operation; it still skips online invitation responses.

Run from the repository root with an absolute private directory:

```powershell
node server/scripts/repair-invitation-identities.cjs --directory="C:/private/repair"
node server/scripts/repair-invitation-identities.cjs --apply --directory="C:/private/repair"
node --test server/scripts/repair-invitation-identities.test.cjs
```

The default Windows dump executable is PostgreSQL 18; set `PG_DUMP_PATH` for another installed location. Configuration deliberately comes from `server/.env`, matching this Master installation. The command must not be added to startup, migrations or recurring jobs. A future mismatch requires another reviewed plan, not a blanket UUID reset or a disabled identity guard.

## Completed repair: October 12, 2026

The authorized repair committed 81 member and 7 event identity mappings locally, with audit entries and no cloud changes in the repair transaction. Encrypted backups, mapping plan, checksums and execution results are outside the repository at `C:/Users/MARK ANGELO/.codex/backups/dpc-identity-repair-20261012`. Both decrypted dumps passed PostgreSQL `pg_restore --list` catalog verification (590 local and 549 cloud entries). Keep the existing encryption key with the backups for recovery.

The normal application Push then successfully transferred 992 records across 30 tables. Post-transfer checks verified all four local invitation link identities exist online, cloud member count remains 84, the three cloud-only member rows are unchanged, and online responses, local responses and synchronization receipts are unchanged. No invitation submission was automatically imported. The three focused repair tests pass.
