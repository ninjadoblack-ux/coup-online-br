import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room, Player, GameAction, PlayerCard, CardType } from '@/types/game';
import { ACTION_LABELS, ACTION_REQUIRED_CARDS, BLOCKABLE_ACTIONS } from '@/lib/game-logic';

export function useBotLogic(
  room: Room | null,
  players: Player[],
  myPlayer: Player | null,
  actions: GameAction[],
  allCards: PlayerCard[]
) {
  const isHost = myPlayer?.is_host;
  const thinkingRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    if (!room || !isHost || room.status !== 'playing') return;

    const pendingAction = actions.length > 0 ? actions[0] : null;
    const currentTurnPlayer = players.find(p => p.id === room.current_turn_player_id);

    // 1. Bot's Turn to act
    if (currentTurnPlayer?.is_bot && !pendingAction) {
      const botId = currentTurnPlayer.id;
      if (!thinkingRef.current[botId]) {
        handleBotTurn(currentTurnPlayer);
      }
    }

    // 2. Bot needs to react to an action
    if (pendingAction && (pendingAction.status === 'pending' || pendingAction.status === 'blocking')) {
      const actionId = pendingAction.id;
      
      // Bots react to other players' actions
      players.forEach(player => {
        if (player.is_bot && player.id !== pendingAction.player_id && player.status === 'alive') {
          const reactionKey = `react_${player.id}_${actionId}`;
          if (!thinkingRef.current[reactionKey]) {
            handleBotReaction(player, pendingAction);
          }
        }
      });
    }

    // 3. Bot needs to make a mandatory choice (Reveal or Exchange)
    if (pendingAction && pendingAction.acting_player_id) {
      const actingPlayer = players.find(p => p.id === pendingAction.acting_player_id);
      if (actingPlayer?.is_bot) {
        const key = `choice_${actingPlayer.id}_${pendingAction.id}`;
        if (!thinkingRef.current[key]) {
          handleBotChoice(actingPlayer, pendingAction);
        }
      }
    }
  }, [room?.current_turn_player_id, actions[0]?.id, actions[0]?.status, actions[0]?.acting_player_id, isHost]);

  const sendBotEmote = async (botId: string, emote: string) => {
    try {
      await supabase.from('players').update({ 
        current_emote: emote, 
        emote_at: new Date().toISOString() 
      }).eq('id', botId);
    } catch (err) {
      console.error('Error sending bot emote:', err);
    }
  };

  const handleBotChoice = async (bot: Player, action: GameAction) => {
    const key = `choice_${bot.id}_${action.id}`;
    thinkingRef.current[key] = true;

    await new Promise(resolve => setTimeout(resolve, 2000));

    try {
      if (action.status === 'awaiting_reveal') {
        const botCards = allCards.filter(c => c.player_id === bot.id && !c.is_revealed);
        if (botCards.length > 0) {
          // Difficulty-based reveal: smarter bots might keep better cards
          const cardToReveal = botCards[0]; 
          await supabase.from('player_cards').update({ is_revealed: true }).eq('id', cardToReveal.id);
          
          await supabase.from('game_logs').insert([{
            room_id: room!.id,
            message: `${bot.name} revelou um ${cardToReveal.card_type}!`
          }]);

          // Move state forward
          if (action.next_status === 'completed' || action.next_status === 'failed' || action.next_status === 'blocked') {
            await supabase.from('game_actions').update({ 
              status: action.next_status as any,
              acting_player_id: null 
            }).eq('id', action.id);
          } else if (action.next_status === 'executing_final') {
            await supabase.from('game_actions').update({ 
              status: 'pending', // Trick resolveAction into executing it
              acting_player_id: null,
              next_status: 'executing_final' 
            }).eq('id', action.id);
          } else if (action.next_status === 'blocking') {
            await supabase.from('game_actions').update({ 
              status: 'blocking',
              acting_player_id: null,
              expires_at: new Date(Date.now() + 10000).toISOString()
            }).eq('id', action.id);
          }
        }
      } else if (action.status === 'exchanging') {
        // Ambassador exchange logic for bots
        const botCards = allCards.filter(c => c.player_id === bot.id && !c.is_revealed);
        const tempCards = action.temporary_cards || [];
        const allAvailable = [...botCards.map(c => c.card_type), ...tempCards];
        
        // Bot just keeps the first 1 or 2 cards it had/drew (simple logic)
        const cardsToKeep = allAvailable.slice(0, botCards.length);
        const cardsToReturn = allAvailable.slice(botCards.length);

        // Update player cards
        for (let i = 0; i < botCards.length; i++) {
          await supabase.from('player_cards').update({ card_type: cardsToKeep[i] }).eq('id', botCards[i].id);
        }

        // Return others to deck
        const { data: currentRoom } = await supabase.from('rooms').select('deck').eq('id', room!.id).single();
        if (currentRoom) {
          const deck = [...(currentRoom.deck as string[]), ...cardsToReturn];
          // Shuffle deck
          for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
          }
          await supabase.from('rooms').update({ deck }).eq('id', room!.id);
        }

        await supabase.from('game_logs').insert([{
          room_id: room!.id,
          message: `${bot.name} concluiu a troca de cartas.`
        }]);

        await supabase.from('game_actions').update({ 
          status: 'completed',
          acting_player_id: null 
        }).eq('id', action.id);
      }
    } catch (err) {
      console.error('Error in bot choice:', err);
    }
  };

  const handleBotTurn = async (bot: Player) => {
    thinkingRef.current[bot.id] = true;
    
    // Bots occasionally emote at the start of their turn
    if (Math.random() > 0.7) {
      const emotes = ["🤔", "😈", "🔥", "🤫"];
      sendBotEmote(bot.id, emotes[Math.floor(Math.random() * emotes.length)]);
    }

    // 3 second delay
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const botCards = allCards.filter(c => c.player_id === bot.id && !c.is_revealed);
      const difficulty = bot.bot_difficulty || 'moderate';
      let actionType = 'Income';

      if (bot.coins >= 10) {
        actionType = 'Coup';
      } else if (difficulty === 'easy') {
        const random = Math.random();
        if (random > 0.9) actionType = 'Tax';
        else if (random > 0.8) actionType = 'Foreign Aid';
        else actionType = 'Income';
      } else {
        const random = Math.random();
        if (bot.coins >= 7 && random > 0.5) actionType = 'Coup';
        else if (bot.coins >= 3 && random > 0.7) actionType = 'Assassinate';
        else if (random > 0.8) actionType = 'Tax';
        else if (random > 0.6) actionType = 'Steal';
        else if (random > 0.4) actionType = 'Exchange';
        else actionType = 'Income';
      }

      // Select target
      let targetId: string | null = null;
      if (['Assassinate', 'Steal', 'Coup'].includes(actionType)) {
        const potentialTargets = players.filter(p => p.id !== bot.id && p.status === 'alive');
        if (potentialTargets.length > 0) {
          targetId = potentialTargets[Math.floor(Math.random() * potentialTargets.length)].id;
        } else {
          actionType = 'Income';
        }
      }

      // Cost upfront
      if (actionType === 'Assassinate') {
        await supabase.from('players').update({ coins: bot.coins - 3 }).eq('id', bot.id);
      } else if (actionType === 'Coup') {
        await supabase.from('players').update({ coins: bot.coins - 7 }).eq('id', bot.id);
      }

      await supabase.from('game_actions').insert([{
        room_id: room!.id,
        player_id: bot.id,
        target_id: targetId,
        action_type: actionType,
        status: 'pending',
        expires_at: new Date(Date.now() + (actionType === 'Income' ? 2000 : 12000)).toISOString()
      }]);

      await supabase.from('game_logs').insert([{
        room_id: room!.id,
        message: `${bot.name} anunciou ${ACTION_LABELS[actionType] || actionType}${targetId ? ` contra ${players.find(p => p.id === targetId)?.name}` : ''}.`
      }]);

    } catch (err) {
      console.error('Error in bot turn:', err);
    } finally {
      setTimeout(() => {
        thinkingRef.current[bot.id] = false;
      }, 2000);
    }
  };

  const handleBotReaction = async (bot: Player, action: GameAction) => {
    const reactionKey = `react_${bot.id}_${action.id}`;
    thinkingRef.current[reactionKey] = true;

    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 3000));

    try {
      const { data: currentAction } = await supabase.from('game_actions').select('status, accepted_by').eq('id', action.id).single();
      if (!currentAction || (currentAction.status !== 'pending' && currentAction.status !== 'blocking')) {
        // If the action is pending but hasn't been accepted by the bot yet, we can mark it as accepted to speed up
        if (currentAction && !currentAction.accepted_by?.includes(bot.id)) {
           const newAcceptedBy = [...(currentAction.accepted_by || []), bot.id];
           await supabase.from('game_actions').update({ accepted_by: newAcceptedBy }).eq('id', action.id);
        }
        return;
      }

      const difficulty = bot.bot_difficulty || 'moderate';
      let challengeProb = 0.15;
      let blockProb = 0.2;
      if (difficulty === 'easy') { challengeProb = 0.05; blockProb = 0.1; }
      if (difficulty === 'hard') { challengeProb = 0.35; blockProb = 0.4; }

      const isTarget = action.target_id === bot.id;
      const canBlock = !!BLOCKABLE_ACTIONS[action.action_type];
      const finalChallengeProb = isTarget ? challengeProb * 1.5 : challengeProb;
      const finalBlockProb = isTarget ? blockProb * 2 : blockProb;

      if (action.status === 'pending') {
        if (Math.random() < finalChallengeProb) {
          await supabase.from('game_actions').update({ status: 'challenged', challenger_id: bot.id }).eq('id', action.id);
          await supabase.from('game_logs').insert([{ room_id: room!.id, message: `${bot.name} CONTESTOU!` }]);
        } else if (canBlock && Math.random() < finalBlockProb) {
          await supabase.from('game_actions').update({ status: 'blocking', blocker_id: bot.id, expires_at: new Date(Date.now() + 10000).toISOString() }).eq('id', action.id);
          await supabase.from('game_logs').insert([{ room_id: room!.id, message: `${bot.name} BLOQUEOU!` }]);
        } else {
          // Accept the action
          const newAcceptedBy = [...(currentAction.accepted_by || []), bot.id];
          await supabase.from('game_actions').update({ accepted_by: newAcceptedBy }).eq('id', action.id);
        }
      } else if (action.status === 'blocking' && action.player_id === bot.id) {
        if (Math.random() < challengeProb) {
          await supabase.from('game_actions').update({ status: 'block_challenged', challenger_id: bot.id }).eq('id', action.id);
          await supabase.from('game_logs').insert([{ room_id: room!.id, message: `${bot.name} CONTESTOU o bloqueio!` }]);
        } else {
          const newAcceptedBy = [...(currentAction.accepted_by || []), bot.id];
          await supabase.from('game_actions').update({ accepted_by: newAcceptedBy }).eq('id', action.id);
        }
      }
    } catch (err) {
      console.error('Error in bot reaction:', err);
    }
  };
}
