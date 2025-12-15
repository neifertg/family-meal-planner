-- Add role field to umbrella_group_invitations
-- This allows admins to specify what role the invited user will have

ALTER TABLE umbrella_group_invitations
ADD COLUMN IF NOT EXISTS role TEXT NOT NULL
CHECK (role IN ('admin', 'member'))
DEFAULT 'member';

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_invitations_email_status
ON umbrella_group_invitations(email, status);
