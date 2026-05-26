
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room, Player, GameAction, CardType } from '@/types/game';
import { ACTION_REQUIRED_CARDS, ACTION_LABELS, CARD_LABELS, BLOCKABLE_ACTIONS, getNextPlayerId } from '@/lib/game-logic';

export function useGameLogic(
  room: Room | null,
  players: Player[],
  myPlayer: Player | null,
  actions: GameAction[]
) {
  const isHost = myPlayer?.is_host;
  const processingRef = useRef<string | null>(null);

  const currentAction = actions[0];

  useEffect(() => {
    if (!room || !isHost || room.status !== 'playing' || !currentAction) return;

    // Handle automated resolution if all human players have accepted
    const humanPlayers = players.filter(p => !p.is_bot && p.status === 'alive');
    const opponents = humanPlayers.filter(p => p.id !== currentAction.player_id);
    const allAccepted = opponents.every(p => currentAction.accepted_by?.includes(p.id));

    if (allAccepted && opponents.length > 0 && currentAction.status === 'pending') {
      resolveAction(currentAction, 'execute');
      return;
    }

    // Immediate resolution for blocked / challenged / block_challenged
    if ((currentAction.status as any) === 'blocked') {
      resolveAction(currentAction, 'block');
      return;
    }
    if ((currentAction.status as any) === 'challenged') {
      resolveAction(currentAction, 'challenge');
      return;
    }
    if ((currentAction.status as any) === 'block_challenged') {
      resolveAction(currentAction, 'block_challenge');
      return;
    }
    
    if ((currentAction.status as any) === 'executing_final') {
      resolveAction(currentAction, 'execute');
      return;
    }

    if ((currentAction.status as any) === 'blocked' || (currentAction.status as any) === 'failed') {
      const finishAction = async () => {
        await checkEliminations();
        const nextPlayerId = getNextPlayerId(players, currentAction.player_id);
        // Advance turn FIRST to prevent race conditions with bot logic
        await supabase.from('rooms').update({ current_turn_player_id: nextPlayerId }).eq('id', room!.id);
        await supabase.from('game_actions').update({ status: 'completed' }).eq('id', currentAction.id);
      };
      finishAction();
      return;
    }

    // If it's a Coup, it doesn't need pending phase, it goes straight to awaiting_reveal
    if (currentAction.action_type === 'Coup' && currentAction.status === 'pending') {
      resolveAction(currentAction, 'execute');
      return;
    }

    if (currentAction.status === 'pending' || currentAction.status === 'blocking') {
      const expiresAt = currentAction.expires_at ? new Date(currentAction.expires_at).getTime() : 0;
      const diff = expiresAt - Date.now();

      const timeout = setTimeout(() => {
        if (processingRef.current !== currentAction.id) {
          resolveAction(currentAction, 'execute');
        }
      }, Math.max(0, diff));

      return () => clearTimeout(timeout);
    }
  }, [room?.status, currentAction?.id, currentAction?.status, currentAction?.expires_at, currentAction?.accepted_by, isHost]);

  const resolveAction = async (action: GameAction, outcome: 'execute' | 'block' | 'challenge' | 'block_challenge') => {
    if (processingRef.current === action.id) return;
    processingRef.current = action.id;

    const handlePenalty = async (targetPlayerId: string, nextStatus: string, logMsg: string) => {
      const { data: unrevealed } = await supabase
        .from('player_cards')
        .select('*')
        .eq('player_id', targetPlayerId)
        .eq('is_revealed', false);
      
      await supabase.from('game_logs').insert([{
        room_id: room!.id,
        message: logMsg
      }]);

      if (unrevealed && unrevealed.length === 1) {
        // Auto reveal if only one card left
        const card = unrevealed[0];
        await supabase.from('player_cards').update({ is_revealed: true }).eq('id', card.id);
        await supabase.from('game_logs').insert([{
          room_id: room!.id,
          message: `${players.find(p => p.id === targetPlayerId)?.name} perdeu sua influência (${CARD_LABELS[card.card_type]})!`
        }]);
        
        await checkEliminations();
        
        if (nextStatus === 'completed') {
          const nextPlayerId = getNextPlayerId(players, action.player_id);
          await supabase.from('rooms').update({ current_turn_player_id: nextPlayerId }).eq('id', room!.id);
        }

        await supabase.from('game_actions').update({ 
          status: nextStatus,
          acting_player_id: null 
        }).eq('id', action.id);
      } else {
        // Wait for player to choose which card to lose
        await supabase.from('game_actions').update({ 
          status: 'awaiting_reveal', 
          acting_player_id: targetPlayerId,
          next_status: nextStatus
        }).eq('id', action.id);
      }
    };

    try {
      const player = players.find(p => p.id === action.player_id);
      if (!player) return;

      let shouldExecute = outcome === 'execute';

      // Handle challenge to attacker
      if (outcome === 'challenge') {
        const requiredCard = ACTION_REQUIRED_CARDS[action.action_type];
        const challenger = players.find(p => p.id === action.challenger_id);
        
        if (!requiredCard) {
          shouldExecute = true;
        } else {
          const { data: cards } = await supabase
            .from('player_cards')
            .select('*')
            .eq('player_id', player.id)
            .eq('is_revealed', false);
          const hasCard = cards?.some(c => c.card_type === requiredCard);

          if (hasCard) {
            // Announcer was telling the truth: announcer keeps card, action executes, challenger loses influence
            const matchedCardObj = cards!.find(c => c.card_type === requiredCard)!;
            await swapCard(player.id, matchedCardObj.id, matchedCardObj.card_type);

            const nextStatus = BLOCKABLE_ACTIONS[action.action_type] ? 'blocking' : 'executing_final';
            await handlePenalty(
              challenger!.id, 
              nextStatus, 
              `${player.name} provou ter ${CARD_LABELS[requiredCard]} e trocou a carta! ${challenger?.name} perde influência.`
            );
            return;
          } else {
            // Bluff caught: attacker loses influence, action cancelled
            await handlePenalty(
              player.id, 
              'failed', 
              `${player.name} estava blefando sobre ter ${CARD_LABELS[requiredCard]}! ${player.name} perde influência.`
            );
            return;
          }
        }
      }

      // Handle challenge to a block
      if (outcome === 'block_challenge') {
        const blocker = players.find(p => p.id === action.blocker_id);
        const challenger = players.find(p => p.id === action.challenger_id);
        const blockableBy = BLOCKABLE_ACTIONS[action.action_type] || [];

        const { data: cards } = await supabase
          .from('player_cards')
          .select('*')
          .eq('player_id', blocker!.id)
          .eq('is_revealed', false);
        
        const matchedCardObj = cards?.find(c => blockableBy.includes(c.card_type as any));

        if (matchedCardObj) {
          // Blocker was telling the truth: challenger loses influence, action stays blocked
          await swapCard(blocker!.id, matchedCardObj.id, matchedCardObj.card_type);
          await handlePenalty(
            challenger!.id, 
            'blocked', 
            `${blocker?.name} provou ter ${CARD_LABELS[matchedCardObj.card_type]}! ${challenger?.name} perde influência.`
          );
          return;
        } else {
          // Blocker bluff caught: blocker loses a card, action executes
          await handlePenalty(
            blocker!.id, 
            'executing_final', 
            `${blocker?.name} estava blefando! ${blocker?.name} perde influência.`
          );
          return;
        }
      }

      if (outcome === 'block') {
        await supabase.from('game_logs').insert([{
          room_id: room!.id,
          message: `Ação ${ACTION_LABELS[action.action_type]} de ${player.name} foi bloqueada.`
        }]);
        // Note: No refund here anymore as per Coup rules for Assassinate
        shouldExecute = false;
      }

      // Special case: if outcome is execute but it's blockable, move to blocking phase first
      if (outcome === 'execute' && BLOCKABLE_ACTIONS[action.action_type] && action.status === 'pending') {
        await supabase.from('game_actions').update({ 
          status: 'blocking',
          expires_at: new Date(Date.now() + 10000).toISOString()
        }).eq('id', action.id);
        return;
      }

      if (shouldExecute || action.next_status === 'executing_final' || action.next_status === 'blocked') {
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
          case 'Coup':
            if (action.target_id) {
              await handlePenalty(
                action.target_id, 
                'completed', 
                `${player.name} executou ${ACTION_LABELS[action.action_type]} contra ${players.find(p => p.id === action.target_id)?.name}!`
              );
              return; 
            }
            break;
          case 'Exchange':
            await startExchange(player.id, action.id);
            return; // Wait for player to choose cards
        }
      }

      // Finish turn if not waiting for more choices
      await checkEliminations();
      const nextPlayerId = getNextPlayerId(players, player.id);
      // Advance turn FIRST to prevent race conditions with bot logic
      await supabase.from('rooms').update({ current_turn_player_id: nextPlayerId }).eq('id', room!.id);
      await supabase.from('game_actions').update({ status: 'completed' }).eq('id', action.id);
    } catch (err) {
      console.error('Error resolving action:', err);
    } finally {
      setTimeout(() => {
        if (processingRef.current === action.id) processingRef.current = null;
      }, 1000);
    }
  };

  const refundCost = async (player: Player, actionType: string) => {
    // In Coup rules, Assassinate and Coup costs are NOT refunded if blocked or challenged.
    // However, if the action is cancelled for OTHER reasons (like a bug), we might want it.
    // For now, keeping it empty as per official rules.
  };

  const startExchange = async (playerId: string, actionId: string) => {
    const { data: currentRoom } = await supabase.from('rooms').select('deck').eq('id', room!.id).single();
    if (!currentRoom) return;

    let deck = [...(currentRoom.deck as CardType[])];
    const newCards = deck.splice(0, 2);
    
    await Promise.all([
      supabase.from('rooms').update({ deck }).eq('id', room!.id),
      supabase.from('game_actions').update({ 
        status: 'exchanging', 
        acting_player_id: playerId,
        temporary_cards: newCards
      }).eq('id', actionId)
    ]);
  };

  const updateCoins = async (playerId: string, coins: number) => {
    await supabase.from('players').update({ coins: Math.max(0, coins) }).eq('id', playerId);
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

  const swapCard = async (playerId: string, cardId: string, oldCardType: string) => {
    const { data: currentRoom } = await supabase.from('rooms').select('deck').eq('id', room!.id).single();
    if (!currentRoom) return;

    const deck = [...(currentRoom.deck as string[])];
    deck.push(oldCardType);
    
    // Shuffle
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    const newCard = deck.shift();

    await Promise.all([
      supabase.from('rooms').update({ deck }).eq('id', room!.id),
      supabase.from('player_cards').update({ card_type: newCard }).eq('id', cardId)
    ]);
  };

  return { resolveAction };
}
