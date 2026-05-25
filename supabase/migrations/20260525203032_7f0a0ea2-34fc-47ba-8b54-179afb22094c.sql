ALTER TABLE public.players 
ADD COLUMN bot_difficulty TEXT DEFAULT 'moderate';

-- Add a constraint to ensure valid difficulty values
ALTER TABLE public.players
ADD CONSTRAINT valid_bot_difficulty 
CHECK (bot_difficulty IN ('easy', 'moderate', 'hard'));