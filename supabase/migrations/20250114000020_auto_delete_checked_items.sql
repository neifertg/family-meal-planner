-- Add checked_at column to grocery_list_items for tracking when items were crossed off
-- Create a function to automatically delete items that have been checked for over a week

-- Add checked_at timestamp column
ALTER TABLE grocery_list_items
ADD COLUMN IF NOT EXISTS checked_at TIMESTAMP WITH TIME ZONE;

-- Create index for efficient querying of old checked items
CREATE INDEX IF NOT EXISTS idx_grocery_list_items_checked_at
ON grocery_list_items(checked_at)
WHERE is_checked = true;

-- Function to delete grocery items that have been checked for over 7 days
CREATE OR REPLACE FUNCTION delete_old_checked_grocery_items()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete items that were checked more than 7 days ago
  DELETE FROM grocery_list_items
  WHERE is_checked = true
  AND checked_at IS NOT NULL
  AND checked_at < NOW() - INTERVAL '7 days';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  RETURN deleted_count;
END;
$$;

-- Create a cron job to run the cleanup function daily at 2 AM
-- Note: This requires pg_cron extension to be enabled
SELECT cron.schedule(
  'delete-old-checked-grocery-items',
  '0 2 * * *',  -- Run at 2:00 AM every day
  $$SELECT delete_old_checked_grocery_items();$$
);

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION delete_old_checked_grocery_items() TO authenticated;

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'checked_at column added to grocery_list_items';
  RAISE NOTICE 'Auto-deletion function created and scheduled to run daily at 2 AM';
  RAISE NOTICE 'Checked items older than 7 days will be automatically deleted';
END $$;
