
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Room, Player, PlayerCard, GameAction, GameLog } from "@/types/game";
import { toast } from "sonner";

export function useGameState(roomId: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [myPlayer, setMyPlayer] = useState<Player | null>(null);
  const [myCards, setMyCards] = useState<PlayerCard[]>([]);
  const [allCards, setAllCards] = useState<PlayerCard[]>([]);
  const [actions, setActions] = useState<GameAction[]>([]);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) return;

        // Fetch room and players in parallel
        const [roomRes, playersRes] = await Promise.all([
          supabase.from('rooms').select('*').eq('id', roomId).single(),
          supabase.from('players').select('*').eq('room_id', roomId)
        ]);
        
        if (!mounted) return;
        if (roomRes.data) setRoom(roomRes.data as Room);

        if (playersRes.data) {
          const typedPlayers = playersRes.data as Player[];
          setPlayers(typedPlayers);
          const currentMe = typedPlayers.find(p => p.user_id === user.id);
          
          if (currentMe) {
            setMyPlayer(currentMe);
            // Fetch my cards and logs/actions in parallel
            const [cardsRes, logsRes, actionsRes] = await Promise.all([
              supabase.from('player_cards').select('*').in('player_id', typedPlayers.map(p => p.id)),
              supabase.from('game_logs').select('*').eq('room_id', roomId).order('created_at', { ascending: false }).limit(20),
              supabase.from('game_actions').select('*').eq('room_id', roomId).eq('status', 'pending')
            ]);
            
            if (!mounted) return;
            if (cardsRes.data) {
              const typedCards = cardsRes.data as PlayerCard[];
              setAllCards(typedCards);
              setMyCards(typedCards.filter(c => c.player_id === currentMe.id));
            }
            if (logsRes.data) setLogs(logsRes.data as GameLog[]);
            if (actionsRes.data) setActions(actionsRes.data as GameAction[]);
          }
        }
      } catch (error) {
        console.error("Error fetching game state:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();

    // Set up real-time subscriptions with stable handlers
    const channel = supabase.channel(`room_sync:${roomId}`);

    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        payload => {
          if (mounted) setRoom(payload.new as Room);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` }, 
        payload => {
          if (!mounted) return;
          if (payload.eventType === 'INSERT') {
            setPlayers(prev => [...prev, payload.new as Player]);
          } else if (payload.eventType === 'UPDATE') {
            setPlayers(prev => prev.map(p => p.id === payload.new.id ? (payload.new as Player) : p));
          } else if (payload.eventType === 'DELETE') {
            setPlayers(prev => prev.filter(p => p.id !== payload.old.id));
          }
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'player_cards' }, 
        payload => {
          if (!mounted) return;
          const card = (payload.new || payload.old) as PlayerCard;
          
          if (payload.eventType === 'INSERT') {
            setAllCards(prev => [...prev, payload.new as PlayerCard]);
            if (myPlayer?.id && card.player_id === myPlayer.id) {
              setMyCards(prev => [...prev, payload.new as PlayerCard]);
            }
          } else if (payload.eventType === 'UPDATE') {
            setAllCards(prev => prev.map(c => c.id === payload.new.id ? (payload.new as PlayerCard) : c));
            if (myPlayer?.id && card.player_id === myPlayer.id) {
              setMyCards(prev => prev.map(c => c.id === payload.new.id ? (payload.new as PlayerCard) : c));
            }
          } else if (payload.eventType === 'DELETE') {
            setAllCards(prev => prev.filter(c => c.id !== payload.old.id));
            if (myPlayer?.id && card.player_id === myPlayer.id) {
              setMyCards(prev => prev.filter(c => c.id !== payload.old.id));
            }
          }
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_logs', filter: `room_id=eq.${roomId}` }, 
        payload => {
          if (mounted) setLogs(prev => [payload.new as GameLog, ...prev].slice(0, 20));
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_actions', filter: `room_id=eq.${roomId}` }, 
        payload => {
          if (!mounted) return;
          if (payload.eventType === 'INSERT') {
            setActions(prev => [...prev, payload.new as GameAction]);
          } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            const current = (payload.new || payload.old) as GameAction;
            if (current.status !== 'pending' || payload.eventType === 'DELETE') {
              setActions(prev => prev.filter(a => a.id !== current.id));
            } else {
              setActions(prev => prev.map(a => a.id === current.id ? (payload.new as GameAction) : a));
            }
          }
        })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId, myPlayer?.id]); // myPlayer.id is stable enough once set

  return { room, players, myPlayer, myCards, allCards, actions, logs, loading };
}
