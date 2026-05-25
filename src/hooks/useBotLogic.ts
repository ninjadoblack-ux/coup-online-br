
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room, Player, GameAction, PlayerCard } from '@/types/game';
import { ACTION_LABELS, ACTION_REQUIRED_CARDS } from '@/lib/game-logic';

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
    if (pendingAction && pendingAction.status === 'pending') {
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
  }, [room?.current_turn_player_id, actions.length, isHost]); // Only run when turn changes or number of actions change

  const handleBotTurn = async (bot: Player) => {
    thinkingRef.current[bot.id] = true;
    
    // 2 second "thinking" delay as requested
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const botCards = allCards.filter(c => c.player_id === bot.id && !c.is_revealed);
      const canTakeAction = (action: string) => {
        const req = ACTION_REQUIRED_CARDS[action];
        if (!req) return true;
        return botCards.some(c => c.card_type === req);
      };

      const legalActions = ['Income', 'Foreign Aid', 'Tax', 'Steal', 'Assassinate', 'Exchange', 'Coup'].filter(canTakeAction);
      let actionType = 'Income';

      const difficulty = bot.bot_difficulty || 'moderate';

      // Difficulty-based decision making
      if (difficulty === 'easy') {
        if (bot.coins >= 10 && legalActions.includes('Coup')) {
          actionType = 'Coup';
        } else {
          const random = Math.random();
          if (random > 0.9 && legalActions.includes('Tax')) actionType = 'Tax';
          else if (random > 0.8 && legalActions.includes('Foreign Aid')) actionType = 'Foreign Aid';
          else if (random > 0.7 && legalActions.includes('Steal')) actionType = 'Steal';
          else actionType = 'Income';
        }
      } else if (difficulty === 'moderate') {
        if (bot.coins >= 10 && legalActions.includes('Coup')) {
          actionType = 'Coup';
        } else if (bot.coins >= 7 && Math.random() > 0.5 && legalActions.includes('Coup')) {
          actionType = 'Coup';
        } else if (bot.coins >= 3 && Math.random() > 0.7 && legalActions.includes('Assassinate')) {
          actionType = 'Assassinate';
        } else {
          const random = Math.random();
          if (random > 0.8 && legalActions.includes('Tax')) actionType = 'Tax';
          else if (random > 0.6 && legalActions.includes('Steal')) actionType = 'Steal';
          else if (random > 0.4 && legalActions.includes('Foreign Aid')) actionType = 'Foreign Aid';
          else if (random > 0.2 && legalActions.includes('Exchange')) actionType = 'Exchange';
          else actionType = 'Income';
        }
      } else { // Hard
        if (bot.coins >= 7 && legalActions.includes('Coup')) {
          actionType = 'Coup';
        } else if (bot.coins >= 3 && legalActions.includes('Assassinate')) {
          // More aggressive assassination
          actionType = Math.random() > 0.4 ? 'Assassinate' : (legalActions.includes('Tax') ? 'Tax' : 'Income');
        } else {
          const random = Math.random();
          if (random > 0.6 && legalActions.includes('Tax')) actionType = 'Tax';
          else if (random > 0.3 && legalActions.includes('Steal')) actionType = 'Steal';
          else if (legalActions.includes('Foreign Aid')) actionType = 'Foreign Aid';
          else actionType = 'Income';
        }
      }


      // Select target if needed
      let targetId: string | null = null;
      if (['Assassinate', 'Steal', 'Coup'].includes(actionType)) {
        const potentialTargets = players.filter(p => p.id !== bot.id && p.status === 'alive');
        if (potentialTargets.length > 0) {
          if (difficulty === 'hard') {
            // Target the player with most coins
            targetId = [...potentialTargets].sort((a, b) => b.coins - a.coins)[0].id;
          } else {
            targetId = potentialTargets[Math.floor(Math.random() * potentialTargets.length)].id;
          }
        } else {
          actionType = 'Income'; // Fallback
        }
      }


      await supabase.from('game_actions').insert([{
        room_id: room!.id,
        player_id: bot.id,
        target_id: targetId,
        action_type: actionType,
        status: 'pending',
        expires_at: new Date(Date.now() + (actionType === 'Income' ? 2000 : 10000)).toISOString()
      }]);

      await supabase.from('game_logs').insert([{
        room_id: room!.id,
        message: `${bot.name} anunciou ${ACTION_LABELS[actionType] || actionType}${targetId ? ` contra ${players.find(p => p.id === targetId)?.name}` : ''}.`
      }]);

    } catch (err) {
      console.error('Error in bot turn:', err);
    } finally {
      // We don't clear the ref immediately to avoid double turns if state hasn't updated
      setTimeout(() => {
        thinkingRef.current[bot.id] = false;
      }, 2000);
    }
  };

  const handleBotReaction = async (bot: Player, action: GameAction) => {
    const reactionKey = `react_${bot.id}_${action.id}`;
    thinkingRef.current[reactionKey] = true;

    // Bots take some time to "decide"
    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 2000));

    try {
      // Difficulty-based reaction
      const isBasic = ['Income', 'Foreign Aid', 'Coup'].includes(action.action_type);
      const difficulty = bot.bot_difficulty || 'moderate';
      
      let challengeProb = 0.15; // Moderate default
      if (difficulty === 'easy') challengeProb = 0.05;
      if (difficulty === 'hard') challengeProb = 0.30;

      const shouldChallenge = !isBasic && Math.random() < challengeProb;


      if (shouldChallenge) {
        await supabase
          .from('game_actions')
          .update({ status: 'challenged' })
          .eq('id', action.id);
        
        await supabase.from('game_logs').insert([{
          room_id: room!.id,
          message: `${bot.name} CONTESTOU ${players.find(p => p.id === action.player_id)?.name}!`
        }]);
      } else {
        // Bot allows the action
        await supabase.from('game_logs').insert([{
          room_id: room!.id,
          message: `${bot.name} permitiu a ação.`
        }]);
      }
    } catch (err) {
      console.error('Error in bot reaction:', err);
    }
    // No need to clear reactionKey as the action will be resolved/deleted
  };
}
