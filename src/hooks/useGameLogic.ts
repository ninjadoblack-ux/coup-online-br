
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room, Player, GameAction } from '@/types/game';

export function useGameLogic(
  room: Room | null,
  players: Player[],
  myPlayer: Player | null,
  actions: GameAction[]
) {
  const isHost = myPlayer?.is_host;
  const processingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!room || !isHost || room.status !== 'playing') return;

    const pendingAction = actions.length > 0 ? actions[0] : null;

    if (pendingAction && pendingAction.status === 'pending') {
      const interval = setInterval(() => {
        const expiresAt = pendingAction.expires_at ? new Date(pendingAction.expires_at).getTime() : 0;
        const now = Date.now();

        if (now >= expiresAt && expiresAt > 0) {
          if (processingRef.current !== pendingAction.id) {
            resolveAction(pendingAction);
          }
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [room?.status, actions.length, isHost, players]);

  const resolveAction = async (action: GameAction) => {
    if (processingRef.current === action.id) return;
    processingRef.current = action.id;
    
    console.log("Resolving action:", action.action_type);

    try {
      const player = players.find(p => p.id === action.player_id);
      if (!player) return;

      // 1. Execute the action effects
      switch (action.action_type) {
        case 'Income':
          await updateCoins(player.id, player.coins + 1);
          break;
        case 'Foreign Aid':
          await updateCoins(player.id, player.coins + 2);
          break;
        case 'Tax':
          await updateCoins(player.id, player.coins + 3);
          break;
        case 'Steal':
          if (action.target_id) {
            const target = players.find(p => p.id === action.target_id);
            if (target) {
              const stealAmount = Math.min(target.coins, 2);
              await updateCoins(target.id, target.coins - stealAmount);
              await updateCoins(player.id, player.coins + stealAmount);
            }
          }
          break;
        case 'Assassinate':
          // Cost is paid on announcement now, but we verify target still exists
          if (action.target_id) {
            await loseCard(action.target_id);
          }
          break;
        case 'Coup':
          // Cost is paid on announcement now
          if (action.target_id) {
            await loseCard(action.target_id);
          }
          break;
        case 'Exchange':
          // Simple exchange: no change for now as it's complex to UI
          break;
      }

      // 2. Mark action as completed
      await supabase
        .from('game_actions')
        .update({ status: 'completed' })
        .eq('id', action.id);

      // 3. Check for eliminated players
      await checkEliminations();

      // 4. Advance Turn
      const nextPlayerId = getNextPlayerId(players, player.id);
      await supabase
        .from('rooms')
        .update({ current_turn_player_id: nextPlayerId })
        .eq('id', room!.id);

    } catch (err) {
      console.error("Error resolving action:", err);
    } finally {
      // Clear ref after a delay to ensure state has updated
      setTimeout(() => {
        if (processingRef.current === action.id) {
          processingRef.current = null;
        }
      }, 2000);
    }
  };

  const updateCoins = async (playerId: string, coins: number) => {
    await supabase.from('players').update({ coins: Math.max(0, coins) }).eq('id', playerId);
  };

  const loseCard = async (playerId: string) => {
    const { data: cards } = await supabase
      .from('player_cards')
      .select('*')
      .eq('player_id', playerId)
      .eq('is_revealed', false);
    
    if (cards && cards.length > 0) {
      // Pick the first unrevealed card to lose
      await supabase
        .from('player_cards')
        .update({ is_revealed: true })
        .eq('id', cards[0].id);
      
      const p = players.find(player => player.id === playerId);
      await supabase.from('game_logs').insert([{
        room_id: room!.id,
        message: `${p?.name} perdeu uma influência!`
      }]);
    }
  };

  const checkEliminations = async () => {
    for (const player of players) {
      if (player.status === 'alive') {
        const { data: unrevealedCards } = await supabase
          .from('player_cards')
          .select('id')
          .eq('player_id', player.id)
          .eq('is_revealed', false);
        
        if (!unrevealedCards || unrevealedCards.length === 0) {
          await supabase.from('players').update({ status: 'dead' }).eq('id', player.id);
          await supabase.from('game_logs').insert([{
            room_id: room!.id,
            message: `${player.name} foi ELIMINADO!`
          }]);
        }
      }
    }
  };

  const getNextPlayerId = (players: Player[], currentId: string) => {
    // Re-fetch or use latest players to ensure status is up to date
    const alivePlayers = players
      .filter(p => p.status === 'alive')
      .sort((a, b) => (a.turn_order || 0) - (b.turn_order || 0));
    
    if (alivePlayers.length <= 1) return currentId;
    
    const currentIndex = alivePlayers.findIndex(p => p.id === currentId);
    if (currentIndex === -1) return alivePlayers[0].id;
    
    const nextIndex = (currentIndex + 1) % alivePlayers.length;
    return alivePlayers[nextIndex].id;
  };
}
