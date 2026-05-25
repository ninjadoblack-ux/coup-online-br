
import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Room, Player, GameAction, PlayerCard } from '@/types/game';
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
  }, [room?.current_turn_player_id, actions[0]?.id, isHost]); // Only run when turn changes or pending action changes

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

  const handleBotTurn = async (bot: Player) => {
    thinkingRef.current[bot.id] = true;
    
    // Bots occasionally emote at the start of their turn
    if (Math.random() > 0.7) {
      const emotes = ["🤔", "😈", "🔥", "🤫"];
      sendBotEmote(bot.id, emotes[Math.floor(Math.random() * emotes.length)]);
    }

    // 2 second "thinking" delay as requested
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      const botCards = allCards.filter(c => c.player_id === bot.id && !c.is_revealed);
      const canTakeAction = (action: string) => {
        const req = ACTION_REQUIRED_CARDS[action];
        if (!req) return true;
        return botCards.some(c => c.card_type === req);
      };

      const legalActions = ['Income', 'Foreign Aid', 'Tax', 'Steal', 'Assassinate', 'Exchange', 'Coup'];
      let actionType = 'Income';

      const difficulty = bot.bot_difficulty || 'moderate';

      // Difficulty-based decision making
      if (difficulty === 'easy') {
        if (bot.coins >= 10) {
          actionType = 'Coup';
        } else {
          const random = Math.random();
          if (random > 0.9) actionType = 'Tax';
          else if (random > 0.8) actionType = 'Foreign Aid';
          else if (random > 0.7) actionType = 'Steal';
          else actionType = 'Income';
        }
      } else if (difficulty === 'moderate') {
        if (bot.coins >= 10) {
          actionType = 'Coup';
        } else if (bot.coins >= 7 && Math.random() > 0.5) {
          actionType = 'Coup';
        } else if (bot.coins >= 3 && Math.random() > 0.7) {
          actionType = 'Assassinate';
        } else {
          const random = Math.random();
          if (random > 0.8) actionType = 'Tax';
          else if (random > 0.6) actionType = 'Steal';
          else if (random > 0.4) actionType = 'Foreign Aid';
          else if (random > 0.2) actionType = 'Exchange';
          else actionType = 'Income';
        }
      } else { // Hard
        if (bot.coins >= 7) {
          actionType = 'Coup';
        } else if (bot.coins >= 3) {
          // More aggressive assassination
          actionType = Math.random() > 0.4 ? 'Assassinate' : 'Tax';
        } else {
          const random = Math.random();
          if (random > 0.6) actionType = 'Tax';
          else if (random > 0.3) actionType = 'Steal';
          else actionType = 'Foreign Aid';
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


      // Deduct coins immediately for bots as well
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
    await new Promise(resolve => setTimeout(resolve, 3000 + Math.random() * 3000));

    try {
      // Re-fetch action to see if it was already resolved
      const { data: currentAction } = await supabase.from('game_actions').select('status').eq('id', action.id).single();
      if (!currentAction || (currentAction.status !== 'pending' && currentAction.status !== 'blocking')) return;

      const difficulty = bot.bot_difficulty || 'moderate';
      
      let challengeProb = 0.15;
      let blockProb = 0.2;
      if (difficulty === 'easy') { challengeProb = 0.05; blockProb = 0.1; }
      if (difficulty === 'hard') { challengeProb = 0.35; blockProb = 0.4; }

      if (action.status === 'pending') {
        const isTarget = action.target_id === bot.id;
        const canBlock = !!BLOCKABLE_ACTIONS[action.action_type];
        
        // Higher probability to challenge/block if they are the target
        const finalChallengeProb = isTarget ? challengeProb * 1.5 : challengeProb;
        const finalBlockProb = isTarget ? blockProb * 2 : blockProb;

        if (Math.random() < finalChallengeProb) {
          await supabase.from('game_actions').update({ 
            status: 'challenged',
            challenger_id: bot.id 
          }).eq('id', action.id);
          
          await supabase.from('game_logs').insert([{
            room_id: room!.id,
            message: `${bot.name} CONTESTOU ${players.find(p => p.id === action.player_id)?.name}!`
          }]);
        } else if (canBlock && Math.random() < finalBlockProb) {
          await supabase.from('game_actions').update({ 
            status: 'blocking',
            blocker_id: bot.id,
            expires_at: new Date(Date.now() + 12000).toISOString()
          }).eq('id', action.id);
          
          await supabase.from('game_logs').insert([{
            room_id: room!.id,
            message: `${bot.name} anunciou BLOQUEIO contra ${players.find(p => p.id === action.player_id)?.name}!`
          }]);
        }
      } else if (action.status === 'blocking' && action.player_id === bot.id) {
        // The bot's own action was blocked! They might challenge the block.
        if (Math.random() < challengeProb) {
          await supabase.from('game_actions').update({ 
            status: 'block_challenged',
            challenger_id: bot.id 
          }).eq('id', action.id);
          
          await supabase.from('game_logs').insert([{
            room_id: room!.id,
            message: `${bot.name} CONTESTOU o bloqueio!`
          }]);
        }
      }
    } catch (err) {
      console.error('Error in bot reaction:', err);
    }
  };
}
