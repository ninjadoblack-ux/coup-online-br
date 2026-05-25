
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Room, Player, PlayerCard, GameAction, GameLog } from "@/types/game";
import { toast } from "sonner";

export function useGameState(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [myCards, setMyCards] = useState<PlayerCard[]>([]);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch room
        const { data: roomData } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single();
        
        if (roomData) setRoom(roomData as Room);

        // Fetch players
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId);
        
        if (playersData) {
          const typedPlayers = playersData as Player[];
          setPlayers(typedPlayers);
          const currentMe = typedPlayers.find(p => p.user_id === user.id);
          if (currentMe) {
            setMyPlayer(currentMe);
            // Fetch my cards
            const { data: cardsData } = await supabase
              .from('player_cards')
              .select('*')
              .eq('player_id', currentMe.id);
            if (cardsData) setMyCards(cardsData as PlayerCard[]);
          }
        }

        // Fetch logs
        const { data: logsData } = await supabase
          .from('game_logs')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: false })
          .limit(20);
        if (logsData) setLogs(logsData as GameLog[]);

        // Fetch actions
        const { data: actionsData } = await supabase
          .from('game_actions')
          .select('*')
          .eq('room_id', roomId)
          .eq('status', 'pending');
        if (actionsData) setActions(actionsData as GameAction[]);

      } catch (error) {
        console.error("Error fetching game state:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscriptions
    const channel = supabase
      .channel(`room:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        payload => setRoom(payload.new as Room))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, 
        payload => {
          if (payload.eventType === 'INSERT') {
            setPlayers(prev => [...prev, payload.new as Player]);
          } else if (payload.eventType === 'UPDATE') {
            setPlayers(prev => prev.map(p => p.id === payload.new.id ? (payload.new as Player) : p));
            if (myPlayer && payload.new.id === myPlayer.id) {
              setMyPlayer(payload.new as Player);
            }
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_cards' }, 
        payload => {
          if (myPlayer && (payload.new as PlayerCard).player_id === myPlayer.id) {
            if (payload.eventType === 'INSERT') {
              setMyCards(prev => [...prev, payload.new as PlayerCard]);
            } else if (payload.eventType === 'UPDATE') {
              setMyCards(prev => prev.map(c => c.id === payload.new.id ? (payload.new as PlayerCard) : c));
            }
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_logs', filter: `room_id=eq.${roomId}` }, 
        payload => setLogs(prev => [payload.new as GameLog, ...prev]))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_actions', filter: `room_id=eq.${roomId}` }, 
        payload => {
          if (payload.eventType === 'INSERT') {
            setActions(prev => [...prev, payload.new as GameAction]);
          } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            if ((payload.new as GameAction)?.status !== 'pending' || payload.eventType === 'DELETE') {
              setActions(prev => prev.filter(a => a.id !== (payload.old as GameAction).id));
            } else {
              setActions(prev => prev.map(a => a.id === payload.new.id ? (payload.new as GameAction) : a));
            }
          }
        })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, myPlayer?.id]);

  return { room, players, myPlayer, myCards, actions, logs, loading };
}
