ALTER TABLE public.players 
ADD COLUMN current_emote TEXT,
ADD COLUMN emote_at TIMESTAMP WITH TIME ZONE;

-- Ensure these columns are accessible
COMMENT ON COLUMN public.players.current_emote IS 'The last emoji used by the player for social expression.';
COMMENT ON COLUMN public.players.emote_at IS 'The timestamp when the emote was last updated, used for ephemeral display.';
