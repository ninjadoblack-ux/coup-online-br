
-- Final Security Polish
DROP POLICY IF EXISTS "Rooms can be created by anyone" ON public.rooms;
CREATE POLICY "Rooms can be created by authenticated users" ON public.rooms 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Players can be created by anyone" ON public.players;
CREATE POLICY "Players can be created by authenticated users" ON public.players 
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
