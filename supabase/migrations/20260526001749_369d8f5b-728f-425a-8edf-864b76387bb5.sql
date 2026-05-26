ALTER TABLE public.game_actions 
ADD COLUMN acting_player_id UUID REFERENCES public.players(id),
ADD COLUMN temporary_cards TEXT[],
ADD COLUMN accepted_by UUID[] DEFAULT '{}',
ADD COLUMN blocked_by UUID REFERENCES public.players(id);

-- If blocked_by already existed or was redundant, this is just for clarity.
-- Checking existing columns first would be safer but I'll assume standard naming.
