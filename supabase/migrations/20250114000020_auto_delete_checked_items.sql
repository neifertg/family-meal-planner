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

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION delete_old_checked_grocery_items() TO authenticated;

-- Try to create a cron job if pg_cron extension is available
-- If not available, the function can still be called manually or via external cron
DO $$
BEGIN
  -- Try to schedule with pg_cron if available
  BEGIN
    PERFORM cron.schedule(
      'delete-old-checked-grocery-items',
      '0 2 * * *',  -- Run at 2:00 AM every day
      $$SELECT delete_old_checked_grocery_items();$$
    );
    RAISE NOTICE 'Cron job scheduled successfully';
  EXCEPTION
    WHEN undefined_table OR invalid_schema_name THEN
      RAISE NOTICE 'pg_cron extension not available - auto-deletion function created but not scheduled';
      RAISE NOTICE 'You can enable pg_cron in Supabase dashboard under Database > Extensions';
      RAISE NOTICE 'Or call delete_old_checked_grocery_items() manually/via external cron';
  END;

  RAISE NOTICE 'checked_at column added to grocery_list_items';
  RAISE NOTICE 'Function delete_old_checked_grocery_items() is available to delete items older than 7 days';
END $$;
