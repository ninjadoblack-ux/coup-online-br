
-- Refine Policies
-- Rooms: Allow update only if player is in the room
DROP POLICY IF EXISTS "Rooms can be updated by members" ON public.rooms;
CREATE POLICY "Rooms can be updated by members" ON public.rooms 
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.players 
        WHERE players.room_id = rooms.id AND players.user_id = auth.uid()
    )
);

-- Players: Only the user can update their own player record
DROP POLICY IF EXISTS "Players can update themselves" ON public.players;
CREATE POLICY "Players can update themselves" ON public.players 
FOR UPDATE USING (user_id = auth.uid());

-- Actions: Only players in the room can manage actions
DROP POLICY IF EXISTS "Actions can be managed by anyone" ON public.game_actions;
CREATE POLICY "Actions can be managed by players in room" ON public.game_actions 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.players 
        WHERE players.room_id = game_actions.room_id AND players.user_id = auth.uid()
    )
);

-- Player Cards: Players can only update their own cards
DROP POLICY IF EXISTS "Cards can be managed by anyone" ON public.player_cards;
CREATE POLICY "Cards can be managed by owners" ON public.player_cards 
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.players 
        WHERE players.id = player_cards.player_id AND players.user_id = auth.uid()
    )
);

-- Logs: Only players in room can insert logs
DROP POLICY IF EXISTS "Logs can be inserted by anyone" ON public.game_logs;
CREATE POLICY "Logs can be inserted by players in room" ON public.game_logs 
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.players 
        WHERE players.room_id = game_logs.room_id AND players.user_id = auth.uid()
    )
);
