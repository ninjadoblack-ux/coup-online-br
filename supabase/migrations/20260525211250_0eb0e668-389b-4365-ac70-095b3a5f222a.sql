-- Update player_cards policy to allow hosts to manage cards
DROP POLICY IF EXISTS "Cards can be managed by owners" ON public.player_cards;
CREATE POLICY "Cards can be managed by owners and hosts" 
ON public.player_cards 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.players p 
    WHERE p.id = player_cards.player_id 
    AND (
      p.user_id = auth.uid() 
      OR EXISTS (
        SELECT 1 FROM public.players h 
        WHERE h.room_id = p.room_id 
        AND h.user_id = auth.uid() 
        AND h.is_host = true
      )
    )
  )
);

-- Update players policy to allow hosts to manage bots
DROP POLICY IF EXISTS "Players can update themselves" ON public.players;
CREATE POLICY "Players can update themselves or be managed by host" 
ON public.players 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.players h 
    WHERE h.room_id = players.room_id 
    AND h.user_id = auth.uid() 
    AND h.is_host = true
  )
);

DROP POLICY IF EXISTS "Players can be deleted by host" ON public.players; -- In case it exists
CREATE POLICY "Players can be deleted by host" 
ON public.players 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.players h 
    WHERE h.room_id = players.room_id 
    AND h.user_id = auth.uid() 
    AND h.is_host = true
  )
);
