
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room, Player, GameAction } from '@/types/game';
import { ACTION_REQUIRED_CARDS, ACTION_LABELS, CARD_LABELS, BLOCKABLE_ACTIONS } from '@/lib/game-logic';

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

    // Immediate resolution for blocked / challenged
    if (currentAction.status === 'blocked') {
      resolveAction(currentAction, 'block');
      return;
    }
    if (currentAction.status === 'challenged') {
      resolveAction(currentAction, 'challenge');
      return;
    }
    if (currentAction.status === 'block_challenged') {
      resolveAction(currentAction, 'block_challenge');
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
  }, [room?.status, currentAction?.id, currentAction?.status, currentAction?.expires_at, isHost]);

  const resolveAction = async (action: GameAction, outcome: 'execute' | 'block' | 'challenge' | 'block_challenge') => {
    if (processingRef.current === action.id) return;
    processingRef.current = action.id;

    try {
      const player = players.find(p => p.id === action.player_id);
      if (!player) return;

      let shouldExecute = outcome === 'execute';

      // Handle challenge: verify announcer holds the required card
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

            await supabase.from('game_logs').insert([{
              room_id: room!.id,
              message: `${player.name} provou ter ${CARD_LABELS[requiredCard]} e trocou a carta! Ação ${ACTION_LABELS[action.action_type]} segue adiante.`
            }]);
            if (challenger) await loseCard(challenger.id);
            shouldExecute = true;
          } else {
            // Bluff caught: announcer loses a card, action cancelled, refund cost
            await loseCard(player.id);
            await supabase.from('game_logs').insert([{
              room_id: room!.id,
              message: `${player.name} estava blefando sobre ter ${CARD_LABELS[requiredCard]}! Ação cancelada.`
            }]);
            await refundCost(player, action.action_type);
            shouldExecute = false;
          }
        }
      }

      // Handle challenge to a block: verify blocker holds the required blocking card
      if (outcome === 'block_challenge') {
        const blocker = players.find(p => p.id === action.blocker_id);
        const challenger = players.find(p => p.id === action.challenger_id);
        const blockableBy = BLOCKABLE_ACTIONS[action.action_type] || [];

        if (!blocker) {
          shouldExecute = true;
        } else {
          const { data: cards } = await supabase
            .from('player_cards')
            .select('*')
            .eq('player_id', blocker.id)
            .eq('is_revealed', false);
          
          const hasCard = cards?.some(c => blockableBy.includes(c.card_type as any));

          if (hasCard) {
            // Blocker was telling the truth: action stays blocked, challenger loses influence
            const matchedCardObj = cards!.find(c => blockableBy.includes(c.card_type as any))!;
            await swapCard(blocker.id, matchedCardObj.id, matchedCardObj.card_type);

            await supabase.from('game_logs').insert([{
              room_id: room!.id,
              message: `${blocker.name} provou ter ${CARD_LABELS[matchedCardObj.card_type]} e trocou a carta! O bloqueio permanece.`
            }]);
            if (challenger) await loseCard(challenger.id);
            await refundCost(player, action.action_type);
            shouldExecute = false;
          } else {
            // Blocker bluff caught: blocker loses a card, action executes normally
            await loseCard(blocker.id);
            const blockDesc = blockableBy.map(c => CARD_LABELS[c]).join(' ou ');
            await supabase.from('game_logs').insert([{
              room_id: room!.id,
              message: `${blocker.name} estava blefando sobre ter ${blockDesc}! Ação ${ACTION_LABELS[action.action_type]} de ${player.name} executa.`
            }]);
            shouldExecute = true;
          }
        }
      }

      if (outcome === 'block') {
        await supabase.from('game_logs').insert([{
          room_id: room!.id,
          message: `Ação ${ACTION_LABELS[action.action_type] || action.action_type} de ${player.name} foi bloqueada.`
        }]);
        await refundCost(player, action.action_type);
        shouldExecute = false;
      }

      if (shouldExecute) {
        switch (action.action_type) {
          case 'Income':
            await updateCoins(player.id, (player.coins || 0) + 1);
            break;
          case 'Foreign Aid':
            await updateCoins(player.id, (player.coins || 0) + 2);
            break;
          case 'Tax':
            await updateCoins(player.id, (player.coins || 0) + 3);
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
            if (action.target_id) await loseCard(action.target_id);
            break;
          case 'Coup':
            if (action.target_id) await loseCard(action.target_id);
            break;
          case 'Exchange':
            await handleExchange(player.id);
            break;
        }
      }

      await supabase.from('game_actions').update({ status: 'completed' }).eq('id', action.id);
      await checkEliminations();

      const nextPlayerId = getNextPlayerId(players, player.id);
      await supabase.from('rooms').update({ current_turn_player_id: nextPlayerId }).eq('id', room!.id);
    } catch (err) {
      console.error('Error resolving action:', err);
    } finally {
      setTimeout(() => {
        if (processingRef.current === action.id) processingRef.current = null;
      }, 1500);
    }
  };

  const refundCost = async (player: Player, actionType: string) => {
    // Costs are paid upfront for Assassinate (3) and Coup (7)
    if (actionType === 'Assassinate') {
      await updateCoins(player.id, (player.coins || 0) + 3);
    } else if (actionType === 'Coup') {
      await updateCoins(player.id, (player.coins || 0) + 7);
    }
  };

  const handleExchange = async (playerId: string) => {
    const { data: currentRoom } = await supabase.from('rooms').select('deck').eq('id', room!.id).single();
    if (!currentRoom) return;

    let deck = [...(currentRoom.deck as any[])];
    const { data: myCards } = await supabase.from('player_cards').select('*').eq('player_id', playerId).eq('is_revealed', false);
    if (!myCards) return;

    // Standard Coup: Ambassador takes 2 cards, looks at them + their own cards, and puts 2 back
    // For simplicity here: we'll just swap all unrevealed cards with new ones from the deck and shuffle the old ones back.
    const oldCards = myCards.map(c => c.card_type);
    const numToSwap = oldCards.length;
    
    const newCards = deck.splice(0, numToSwap);
    deck.push(...oldCards);

    // Shuffle deck
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    await supabase.from('rooms').update({ deck }).eq('id', room!.id);
    
    for (let i = 0; i < numToSwap; i++) {
      await supabase.from('player_cards').update({ card_type: newCards[i] }).eq('id', myCards[i].id);
    }

    await supabase.from('game_logs').insert([{
      room_id: room!.id,
      message: `${players.find(p => p.id === playerId)?.name} trocou suas cartas.`
    }]);
  };

  const updateCoins = async (playerId: string, coins: number) => {
    const { error } = await supabase.from('players').update({ coins: Math.max(0, coins) }).eq('id', playerId);
    if (error) console.error('Error updating coins:', error);
  };

  const loseCard = async (playerId: string) => {
    const { data: cards } = await supabase
      .from('player_cards')
      .select('*')
      .eq('player_id', playerId)
      .eq('is_revealed', false);

    if (cards && cards.length > 0) {
      await supabase.from('player_cards').update({ is_revealed: true }).eq('id', cards[0].id);
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

  const getNextPlayerId = (players: Player[], currentId: string) => {
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
