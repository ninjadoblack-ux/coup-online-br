-- Add tracking columns to game_actions
ALTER TABLE public.game_actions 
ADD COLUMN challenger_id UUID REFERENCES public.players(id),
ADD COLUMN blocker_id UUID REFERENCES public.players(id);

-- Update RLS if needed (usually standard columns are covered if table is enabled)
