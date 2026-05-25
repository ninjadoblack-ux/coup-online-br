
-- Create ENUMs for better type safety where possible, or use text constraints
-- Rooms table
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting', -- 'waiting', 'playing', 'finished'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    winner_id UUID,
    current_turn_player_id UUID,
    deck TEXT[] DEFAULT '{}'::TEXT[] -- Shuffled deck of cards
);

-- Players table
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID,
    name TEXT NOT NULL,
    avatar TEXT,
    coins INTEGER DEFAULT 2,
    status TEXT DEFAULT 'alive', -- 'alive', 'dead'
    is_host BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    turn_order INTEGER
);

-- Cards table
CREATE TABLE IF NOT EXISTS public.player_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    card_type TEXT NOT NULL, -- 'Duke', 'Assassin', 'Ambassador', 'Captain', 'Contessa'
    is_revealed BOOLEAN DEFAULT FALSE,
    slot_index INTEGER NOT NULL -- 0 or 1
);

-- Game Logs
CREATE TABLE IF NOT EXISTS public.game_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game Actions (to track pending reactions)
CREATE TABLE IF NOT EXISTS public.game_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.players(id), -- who initiated
    target_id UUID REFERENCES public.players(id), -- optional target
    action_type TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'blocked', 'challenged', 'failed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Add foreign key for turn player after tables are created
ALTER TABLE public.rooms ADD CONSTRAINT fk_current_player FOREIGN KEY (current_turn_player_id) REFERENCES public.players(id);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.player_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_actions;

-- Enable RLS
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Rooms: Anyone can view rooms by code (to join)
CREATE POLICY "Rooms are viewable by everyone" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Rooms can be created by anyone" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Rooms can be updated by members" ON public.rooms FOR UPDATE USING (true);

-- Players: Anyone can view players in their room
CREATE POLICY "Players are viewable by everyone" ON public.players FOR SELECT USING (true);
CREATE POLICY "Players can be created by anyone" ON public.players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update themselves" ON public.players FOR UPDATE USING (true);

-- Player Cards: Players can see all cards (but the frontend will filter secret ones)
-- In a real production app, we'd use more complex RLS to hide unrevealed cards, 
-- but for this MVP, we'll handle the "fog of war" in the application logic 
-- to keep implementation fast, or we can use a VIEW.
CREATE POLICY "Cards are viewable by everyone" ON public.player_cards FOR SELECT USING (true);
CREATE POLICY "Cards can be managed by anyone" ON public.player_cards FOR ALL USING (true);

-- Logs & Actions
CREATE POLICY "Logs are viewable by everyone" ON public.game_logs FOR SELECT USING (true);
CREATE POLICY "Logs can be inserted by anyone" ON public.game_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Actions are viewable by everyone" ON public.game_actions FOR SELECT USING (true);
CREATE POLICY "Actions can be managed by anyone" ON public.game_actions FOR ALL USING (true);
