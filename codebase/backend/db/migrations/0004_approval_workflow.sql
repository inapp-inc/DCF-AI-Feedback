-- Migration 0004: Submission Approval Workflow
-- Adds supervisor gate (all submissions) and legal review gate (attorney submissions)
-- before feedback is published into analytics.

PRAGMA foreign_keys = ON;

-- ── Approval status on every submission ─────────────────────────────────────
-- pending_supervisor : waiting for supervisor sign-off  (all non-attorney)
-- pending_legal      : waiting for legal team review    (attorney only)
-- legal_approved     : legal team cleared it, now awaits supervisor sign-off
-- supervisor_approved: fully published — enters analytics
-- rejected           : rejected at either gate; excluded from analytics
ALTER TABLE submissions ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'pending_supervisor';

-- Back-fill: existing attorney submissions go into the legal review gate
UPDATE submissions SET approval_status = 'pending_legal' WHERE user_group = 'attorney';

-- ── Immutable approval audit trail ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submission_approvals (
  approval_id       TEXT PRIMARY KEY,
  submission_id     TEXT NOT NULL,
  reviewer_username TEXT NOT NULL,
  reviewer_role     TEXT NOT NULL,
  -- action values: legal_approved | legal_rejected | supervisor_approved | supervisor_rejected | responded
  action            TEXT NOT NULL,
  note              TEXT,
  created_at        TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(submission_id)
);
