-- Add applied_to_budget field to track which receipts count toward budget
-- This allows users to optionally apply receipts to their monthly budget

ALTER TABLE receipt_scans
ADD COLUMN applied_to_budget BOOLEAN DEFAULT false;

-- Create index for faster budget queries
CREATE INDEX IF NOT EXISTS idx_receipt_scans_budget ON receipt_scans(family_id, applied_to_budget, purchase_date);

-- Add comment explaining the field
COMMENT ON COLUMN receipt_scans.applied_to_budget IS 'Whether this receipt has been applied to the monthly budget calculation';
