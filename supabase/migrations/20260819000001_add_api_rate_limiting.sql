-- Rate limiting for AI-processing API routes (scan-receipt, transcribe-audio,
-- parse-transcript, scrape-recipe). These routes call paid third-party APIs
-- (Anthropic, OpenAI, Gemini) and were previously reachable by any
-- authenticated user with no cap, allowing a compromised/leaked session to
-- run up provider costs.
--
-- No RLS policies are defined on this table: it is only ever touched through
-- check_rate_limit() below, a SECURITY DEFINER function that reads the
-- caller's identity from auth.uid() and cannot be pointed at another user's
-- bucket.

CREATE TABLE IF NOT EXISTS api_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  route text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, route, window_start)
);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_route text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_window_start timestamptz;
  v_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);

  -- Opportunistically clear this user's stale buckets for this route so the
  -- table doesn't grow unbounded without needing a separate cron job.
  DELETE FROM api_rate_limits
  WHERE user_id = v_user_id
    AND route = p_route
    AND window_start < v_window_start;

  INSERT INTO api_rate_limits (user_id, route, window_start, request_count)
  VALUES (v_user_id, p_route, v_window_start, 1)
  ON CONFLICT (user_id, route, window_start)
  DO UPDATE SET request_count = api_rate_limits.request_count + 1
  RETURNING request_count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION check_rate_limit(text, integer, integer) TO authenticated;
