
import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player, Room, PlayerCard, GameAction, GameLog } from "@/types/game";
import { GameCard } from "./GameCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Coins, History, Timer } from "lucide-react";
import coinGold from "@/assets/coin-gold.png";
import coinSilver from "@/assets/coin-silver.png";
import { ACTION_DESCRIPTIONS, ACTION_LABELS, ACTION_REQUIRED_CARDS, CARD_LABELS, BLOCKABLE_ACTIONS } from "@/lib/game-logic";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBotLogic } from "@/hooks/useBotLogic";
import { useGameLogic } from "@/hooks/useGameLogic";
import { Bot, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface GameViewProps {
  room: Room;
  players: Player[];
  myPlayer: Player | null;
  myCards: PlayerCard[];
  allCards: PlayerCard[];
  actions: GameAction[];
  logs: GameLog[];
  onLeaveRoom: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ 
  room, 
  players, 
  myPlayer, 
  myCards, 
  allCards,
  actions, 

  logs,
  onLeaveRoom
}) => {
  const [isSelectingTarget, setIsSelectingTarget] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isClashing, setIsClashing] = useState(false);
  const [clashActors, setClashActors] = useState<{ challenger: Player; victim: Player } | null>(null);

  // Game Engine & Bot Logic Hooks (Host only)
  useBotLogic(room, players, myPlayer, actions, allCards);
  useGameLogic(room, players, myPlayer, actions);
  
  const opponents = useMemo(() => players.filter(p => p.id !== myPlayer?.id), [players, myPlayer?.id]);
  const isMyTurn = useMemo(() => room.current_turn_player_id === myPlayer?.id, [room.current_turn_player_id, myPlayer?.id]);
  const pendingAction = useMemo(() => actions.find(a => ['pending', 'blocking'].includes(a.status)) || null, [actions]);

  // Handle clash detection
  useEffect(() => {
    const activeChallenge = actions.find(a => ['challenged', 'block_challenged'].includes(a.status));
    if (activeChallenge && !isClashing) {
      const challenger = players.find(p => p.id === activeChallenge.challenger_id);
      const victimId = activeChallenge.status === 'challenged' ? activeChallenge.player_id : activeChallenge.blocker_id;
      const victim = players.find(p => p.id === victimId);
      
      if (challenger && victim) {
        setClashActors({ challenger, victim });
        setIsClashing(true);
        const timer = setTimeout(() => setIsClashing(false), 2500);
        return () => clearTimeout(timer);
      }
    }
  }, [actions, players, isClashing]);

  // Screen shake animation variants
  const shakeVariants = {
    shake: {
      x: [0, -10, 10, -10, 10, 0],
      transition: { duration: 0.4 }
    }
  };

  // Local 10s countdown that starts when the overlay first appears for this action,
  // independent of server-side expires_at drift.
  useEffect(() => {
    if (!pendingAction) {
      setTimeLeft(null);
      return;
    }
    const REACTION_SECONDS = 10;
    setTimeLeft(REACTION_SECONDS);
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - start) / 1000);
      const remaining = Math.max(0, REACTION_SECONDS - elapsed);
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [pendingAction?.id]);

  const handleAction = useCallback(async (actionType: string, targetId: string | null = null) => {
    if (!myPlayer || !isMyTurn) return;

    if (['Assassinate', 'Steal', 'Coup'].includes(actionType) && !targetId) {
      setIsSelectingTarget(actionType);
      return;
    }

    const requiredCard = ACTION_REQUIRED_CARDS[actionType];
    const hasCard = !requiredCard || myCards.some(c => c.card_type === requiredCard && !c.is_revealed);

    if (!hasCard) {
      const confirmBluff = window.confirm(`Você não tem o ${CARD_LABELS[requiredCard!]}. Deseja BLEFAR e anunciar esta ação?`);
      if (!confirmBluff) return;
    }

    try {
      // Cost is paid upfront for Assassinate and Coup to avoid double-spend/delay issues
      if (actionType === 'Assassinate') {
        await supabase.from('players').update({ coins: myPlayer.coins - 3 }).eq('id', myPlayer.id);
      } else if (actionType === 'Coup') {
        await supabase.from('players').update({ coins: myPlayer.coins - 7 }).eq('id', myPlayer.id);
      }

      await supabase.from('game_actions').insert([{
        room_id: room.id,
        player_id: myPlayer.id,
        target_id: targetId,
        action_type: actionType,
        status: 'pending',
        expires_at: new Date(Date.now() + (actionType === 'Income' ? 2000 : 12000)).toISOString()
      }]);

      await supabase.from('game_logs').insert([{
        room_id: room.id,
        message: `${myPlayer.name} anunciou ${ACTION_LABELS[actionType] || actionType}${targetId ? ` contra ${players.find(p => p.id === targetId)?.name}` : ''}.`
      }]);

      setIsSelectingTarget(null);

    } catch (err) {
      console.error(err);
      toast.error("Erro ao realizar ação.");
    }
  }, [myPlayer, isMyTurn, room.id, players, myCards]);

  const handleReaction = useCallback(async (type: 'allow' | 'challenge' | 'block') => {
    if (!pendingAction || !myPlayer) return;

    try {
      if (type === 'allow') {
        if (pendingAction.status === 'blocking') {
          // Allowing a block means the action is now permanently blocked
          await supabase
            .from('game_actions')
            .update({ status: 'blocked' })
            .eq('id', pendingAction.id);
          await supabase.from('game_logs').insert([{
            room_id: room.id,
            message: `${myPlayer.name} permitiu o bloqueio.`
          }]);
        } else {
          // Encurta o expires_at para que o host resolva imediatamente
          await supabase
            .from('game_actions')
            .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
            .eq('id', pendingAction.id);
          await supabase.from('game_logs').insert([{
            room_id: room.id,
            message: `${myPlayer.name} permitiu a ação.`
          }]);
        }
      } else if (type === 'challenge') {
        const newStatus = pendingAction.status === 'blocking' ? 'block_challenged' : 'challenged';
        await supabase
          .from('game_actions')
          .update({ 
            status: newStatus,
            challenger_id: myPlayer.id 
          })
          .eq('id', pendingAction.id);
        
        const message = newStatus === 'block_challenged' 
          ? `${myPlayer.name} CONTESTOU o bloqueio de ${players.find(p => p.id === pendingAction.blocker_id)?.name}!`
          : `${myPlayer.name} CONTESTOU ${players.find(p => p.id === pendingAction.player_id)?.name}!`;

        await supabase.from('game_logs').insert([{
          room_id: room.id,
          message
        }]);
      } else if (type === 'block') {
        await supabase
          .from('game_actions')
          .update({ 
            status: 'blocking',
            blocker_id: myPlayer.id,
            expires_at: new Date(Date.now() + 12000).toISOString() // Reset timer for challenge to block
          })
          .eq('id', pendingAction.id);
        
        await supabase.from('game_logs').insert([{
          room_id: room.id,
          message: `${myPlayer.name} anunciou BLOQUEIO contra ${players.find(p => p.id === pendingAction.player_id)?.name}!`
        }]);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao reagir.");
    }
  const handleSendEmote = useCallback(async (emote: string) => {
    if (!myPlayer) return;
    try {
      await supabase
        .from('players')
        .update({ 
          current_emote: emote, 
          emote_at: new Date().toISOString() 
        })
        .eq('id', myPlayer.id);
    } catch (err) {
      console.error("Error sending emote:", err);
    }
  }, [myPlayer]);

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden flex flex-col bg-slate-950 cyber-grid">
      <div className="scanline" />
      
      {/* Clash Animation Overlay */}
      <AnimatePresence>
        {isClashing && clashActors && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center overflow-hidden"
          >
            <div className="absolute inset-0 flex items-center justify-center">
               <motion.div 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="w-[300px] h-[300px] bg-red-500/20 rounded-full blur-3xl"
               />
            </div>

            <div className="relative flex items-center justify-center w-full max-w-4xl px-4 gap-4 sm:gap-20">
               {/* Challenger */}
               <motion.div
                initial={{ x: -300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="flex flex-col items-center gap-4"
               >
                  <div className="w-24 h-24 sm:w-40 sm:h-40 rounded-3xl bg-gradient-to-br from-purple-500 to-purple-900 flex items-center justify-center shadow-[0_0_50px_rgba(168,85,247,0.5)] border-2 border-purple-400">
                    <span className="text-4xl sm:text-6xl font-black text-white">{clashActors.challenger.name[0].toUpperCase()}</span>
                  </div>
                  <span className="text-lg sm:text-2xl font-black text-purple-400 uppercase tracking-widest">{clashActors.challenger.name}</span>
                  <div className="px-4 py-1 bg-purple-500/20 border border-purple-500/40 rounded-full">
                    <span className="text-[10px] font-black text-purple-300 uppercase">Contestador</span>
                  </div>
               </motion.div>

               <motion.div 
                initial={{ scale: 0 }}
                animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                transition={{ delay: 0.3 }}
                className="text-6xl sm:text-9xl font-black text-red-600 italic drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]"
               >
                 VS
               </motion.div>

               {/* Victim */}
               <motion.div
                initial={{ x: 300, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ type: "spring", damping: 12 }}
                className="flex flex-col items-center gap-4"
               >
                  <div className="w-24 h-24 sm:w-40 sm:h-40 rounded-3xl bg-gradient-to-br from-red-500 to-red-900 flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.5)] border-2 border-red-400">
                    <span className="text-4xl sm:text-6xl font-black text-white">{clashActors.victim.name[0].toUpperCase()}</span>
                  </div>
                  <span className="text-lg sm:text-2xl font-black text-red-400 uppercase tracking-widest">{clashActors.victim.name}</span>
                  <div className="px-4 py-1 bg-red-500/20 border border-red-500/40 rounded-full">
                    <span className="text-[10px] font-black text-red-300 uppercase">Alvo</span>
                  </div>
               </motion.div>
            </div>

            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-20 flex flex-col items-center gap-2"
            >
              <h2 className="text-3xl sm:text-5xl font-black text-white uppercase tracking-[0.4em] animate-pulse">EMBATE NEURAL</h2>
              <div className="h-1 w-64 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Info */}
      <div className="flex items-center justify-between p-3 sm:p-4 z-20">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <span className="text-lg sm:text-xl font-black text-purple-400">C</span>
          </div>
          <div>
            <h1 className="text-xs sm:text-sm font-black text-white tracking-widest uppercase">Protocolo // Golpe</h1>
            <p className="text-[8px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-widest">Sincronização Neural: Ativa</p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-all font-black uppercase tracking-widest text-[10px]"
          onClick={onLeaveRoom}
        >
          Abortar
        </Button>
      </div>

      {/* Opponents Layout */}
      <div className="flex justify-center gap-3 sm:gap-6 px-4 py-2 overflow-x-auto no-scrollbar">
        {opponents.map(opponent => (
          <OpponentCard 
            key={opponent.id}
            opponent={opponent}
            currentTurnId={room.current_turn_player_id}
            isSelectingTarget={!!isSelectingTarget}
            onSelect={() => isSelectingTarget && handleAction(isSelectingTarget, opponent.id)}
          />
        ))}
      </div>

      {/* Main Table Area */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8 relative">
        <motion.div 
          variants={shakeVariants}
          animate={isClashing ? "shake" : "default"}
          className="w-full max-w-2xl aspect-[2/1] rounded-[100px] sm:rounded-[200px] border-[1px] border-slate-800 bg-gradient-to-b from-slate-900/20 to-slate-950/40 relative shadow-2xl flex flex-col items-center justify-center group overflow-hidden"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.5_0.2_280_/_0.03),_transparent)]" />
          
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
             <div className="w-[80%] h-[80%] border-2 border-dashed border-purple-500 rounded-full animate-[spin_20s_linear_infinite]" />
             <div className="absolute w-40 h-40 border-2 border-purple-500 rounded-full" />
          </div>

          {isSelectingTarget && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-md rounded-[100px] sm:rounded-[200px] flex flex-col items-center justify-center gap-6"
            >
               <h4 className="text-xl sm:text-3xl font-black text-red-500 uppercase tracking-[0.3em] drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">Selecionar Alvo</h4>
               <Button 
                variant="ghost" 
                className="text-slate-400 font-black uppercase tracking-widest text-xs hover:text-white"
                onClick={() => setIsSelectingTarget(null)}
               >
                Cancelar Operação
               </Button>
            </motion.div>
          )}

          <div className="flex flex-col items-center gap-1 z-10 opacity-60">
             <img src={coinGold} alt="banco" className="w-10 h-10 sm:w-14 sm:h-14 drop-shadow-[0_0_12px_rgba(234,179,8,0.4)]" />
             <span className="text-xl sm:text-3xl font-black text-yellow-500/80 tracking-[0.5em] ml-4">BANCO</span>
          </div>

          <div className="w-full max-w-sm h-20 sm:h-32 mt-2 sm:mt-4 z-10">
            <ScrollArea className="h-full w-full px-6">
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {logs.slice(0, 10).reverse().map((log) => {
                    const isBotMessage = players.some(p => p.is_bot && log.message.startsWith(p.name));
                    return (
                      <motion.div 
                        key={log.id} 
                        initial={{ x: -10, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        className={cn(
                          "text-[10px] font-black uppercase tracking-tighter flex items-start gap-2 py-1 border-b border-slate-800/30",
                          isBotMessage ? "text-purple-400" : "text-slate-500"
                        )}
                      >
                        <span className="opacity-30 font-mono">[{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                        <span>{log.message}</span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </ScrollArea>
          </div>
        </motion.div>
      </div>

      {/* Action Overlay (Reaction) */}
      <AnimatePresence>
        {pendingAction && pendingAction.player_id !== myPlayer?.id && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-2 sm:p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className={cn(
                "bg-slate-900 border-2 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] text-center relative overflow-hidden transition-colors duration-300",
                timeLeft && timeLeft <= 3 ? "border-red-500 animate-pulse bg-red-950/20" : "border-slate-800"
              )}
            >
              <div className={cn(
                "absolute top-0 left-0 w-full h-1 bg-gradient-to-r",
                timeLeft && timeLeft <= 3 ? "from-transparent via-red-500 to-transparent" : "from-transparent via-slate-500 to-transparent"
              )} />
              
              <div className="flex items-center justify-center gap-3 mb-8">
                <Timer className={cn(
                  "w-5 h-5",
                  timeLeft && timeLeft <= 3 ? "text-red-500 animate-[bounce_0.5s_infinite]" : "text-slate-400"
                )} />
                <span className={cn(
                  "font-black uppercase tracking-[0.3em] text-xs transition-all",
                  timeLeft && timeLeft <= 3 ? "text-red-500 scale-125 animate-pulse" : "text-slate-500"
                )}>
                   Reação Necessária // {timeLeft}s
                </span>
              </div>
              
              <h3 className="text-xl sm:text-2xl font-black text-white leading-tight uppercase tracking-tight">
                {pendingAction.status === 'blocking' ? (
                  <>
                    {players.find(p => p.id === pendingAction.blocker_id)?.name} <br/>
                    <span className="text-red-500 text-lg sm:text-2xl">Bloqueou {ACTION_LABELS[pendingAction.action_type]}!</span>
                  </>
                ) : (
                  <>
                    {players.find(p => p.id === pendingAction.player_id)?.name} <br/> 
                    <span className="text-red-500 text-lg sm:text-2xl">Reivindica {ACTION_LABELS[pendingAction.action_type] || pendingAction.action_type}!</span>
                  </>
                )}
              </h3>
              
              <div className="flex flex-col gap-3 sm:gap-4 mt-8 sm:mt-12">
                {/* Only others can challenge an action, but anyone can challenge a block */}
                {(pendingAction.status === 'blocking' || pendingAction.player_id !== myPlayer?.id) && (
                  <Button 
                    size="lg"
                    className={cn(
                      "h-14 sm:h-16 font-black text-lg sm:text-xl rounded-2xl shadow-lg border-t transition-all",
                      timeLeft && timeLeft <= 3 
                        ? "bg-red-500 hover:bg-red-400 border-red-300 shadow-red-500/50 scale-105" 
                        : "bg-red-600 hover:bg-red-500 border-red-400/30 shadow-red-900/20"
                    )}
                    onClick={() => handleReaction('challenge')}
                  >
                    CONTESTAR!
                  </Button>
                )}

                <div className="grid grid-cols-2 gap-3">
                   <Button 
                    variant="outline" 
                    className="h-12 sm:h-14 border-slate-700 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700" 
                    onClick={() => handleReaction('allow')}
                   >
                    {pendingAction.status === 'blocking' ? 'PERMITIR BLOQUEIO' : 'PERMITIR'}
                  </Button>
                  
                  {/* Blocking logic: can block if it's blockable AND I'm not the actor AND it's not already being blocked */}
                  {pendingAction.status !== 'blocking' && 
                   BLOCKABLE_ACTIONS[pendingAction.action_type] && 
                   pendingAction.player_id !== myPlayer?.id && (
                    <Button 
                      variant="outline" 
                      className="h-12 sm:h-14 border-slate-700 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700"
                      onClick={() => handleReaction('block')}
                    >
                      BLOQUEAR
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Interface - Player Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border-t border-slate-800/50 p-3 sm:p-6 z-20">
        <div className="max-w-5xl mx-auto flex flex-col xl:flex-row items-center gap-4 sm:gap-10">
          
          <div className="flex items-center gap-4 sm:gap-8">
            <div className="flex flex-col items-center gap-1.5">
               <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-700 p-[2px] shadow-lg">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center gap-1 sm:gap-1.5">
                    <img src={coinGold} alt="moedas" className="w-4 h-4 sm:w-6 sm:h-6 drop-shadow-[0_0_6px_rgba(234,179,8,0.5)]" />
                    <span className="text-lg sm:text-xl font-black text-white">{myPlayer?.coins || 0}</span>
                  </div>
               </div>
               <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Moedas</span>
            </div>

            <div className="flex gap-2 sm:gap-4 md:gap-6">
              {myCards.map(card => (
                <GameCard 
                  key={card.id} 
                  type={card.card_type} 
                  isRevealed={true}
                  className={cn(
                    "shadow-2xl transition-all duration-500 hover:-translate-y-2 sm:hover:-translate-y-6 hover:rotate-1 hover:scale-105",
                    card.is_revealed && "grayscale opacity-50 ring-4 ring-red-500/50"
                  )}
                />
              ))}
              {myCards.length === 0 && (
                <div className="w-20 h-30 xs:w-24 xs:h-36 md:w-32 md:h-48 border-2 border-dashed border-slate-800 rounded-3xl flex items-center justify-center">
                   <span className="text-slate-800 font-black uppercase text-[10px] rotate-[-45deg]">Eliminado</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 w-full">
             <div className="flex items-center justify-between mb-2 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isMyTurn ? "bg-purple-500 shadow-[0_0_10px_oklch(0.6_0.2_280)]" : "bg-slate-700")} />
                  <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isMyTurn ? "text-purple-400" : "text-slate-500")}>
                    {isMyTurn ? "Sua Vez // Escolha uma Ação" : "Aguardando Turno..."}
                  </span>
                </div>
             </div>
             <div className="grid grid-cols-2 xs:grid-cols-4 xl:grid-cols-4 gap-2 sm:gap-3">
              <TooltipProvider delayDuration={300}>
                {Object.keys(ACTION_DESCRIPTIONS).map((action) => {
                  const requiredCard = ACTION_REQUIRED_CARDS[action];
                  const hasCard = !requiredCard || myCards.some(c => c.card_type === requiredCard && !c.is_revealed);
                  
                  return (
                    <ActionBtn 
                      key={action}
                      action={action}
                      disabled={!isMyTurn || pendingAction !== null || ((myPlayer?.coins ?? 0) >= 10 && action !== 'Coup')}
                      hasCard={hasCard}
                      isMyTurn={isMyTurn}
                      onClick={() => handleAction(action)}
                    />
                  );
                })}
              </TooltipProvider>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const OpponentCard = memo(({ opponent, currentTurnId, isSelectingTarget, onSelect }: any) => {
  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-1.5 sm:gap-2 p-2 sm:p-4 rounded-[1.5rem] sm:rounded-[2rem] bg-slate-900/40 backdrop-blur-md border transition-all relative group min-w-[120px] sm:min-w-0",
        currentTurnId === opponent.id ? "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "border-slate-800",
        opponent.status === 'dead' && "grayscale opacity-30",
        isSelectingTarget && opponent.status === 'alive' && "cursor-pointer border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse"
      )}
    >
      {currentTurnId === opponent.id && (
         <div className="absolute -top-1 -left-1 -right-1 -bottom-1 border border-purple-500 rounded-[1.6rem] sm:rounded-[2.1rem] animate-pulse pointer-events-none" />
      )}

      <div className="flex items-center gap-2">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-inner",
          opponent.is_bot ? "bg-gradient-to-br from-purple-500 to-purple-800" : "bg-gradient-to-br from-slate-700 to-slate-900"
        )}>
          {opponent.is_bot ? <Bot className="w-5 h-5 text-white" /> : (opponent.name?.[0]?.toUpperCase() || 'P')}
        </div>
        <div className="flex flex-col">
          <span className={cn(
            "text-xs font-black uppercase tracking-tighter",
            opponent.is_bot ? "text-purple-300" : "text-slate-100"
          )}>{opponent.name}</span>
          <div className="flex items-center gap-1 text-slate-300 text-[10px] font-black">
            <img src={coinSilver} alt="moedas" className="w-3.5 h-3.5 drop-shadow" /> {opponent.coins}
          </div>
        </div>
      </div>

      <div className="flex gap-1 mt-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="w-6 h-9 bg-slate-800 rounded-md border border-slate-700 flex items-center justify-center">
            <div className="w-3 h-3 border border-slate-600 rotate-45 opacity-20" />
          </div>
        ))}
      </div>

      {currentTurnId === opponent.id && opponent.is_bot && (
        <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span className="text-[9px] text-purple-400 font-black animate-pulse uppercase tracking-[0.2em]">Processando...</span>
        </div>
      )}
    </motion.div>
  );
});

const ActionBtn = memo(({ action, disabled, hasCard, isMyTurn, onClick }: any) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          disabled={disabled}
          variant="outline"
          className={cn(
            "h-12 sm:h-14 text-[9px] sm:text-[10px] font-black uppercase tracking-wider border-slate-800 bg-slate-900/50 hover:bg-purple-600 hover:text-white hover:border-purple-400 transition-all rounded-xl relative group",
            isMyTurn && !disabled && "border-slate-700 ring-1 ring-white/5",
            ["Coup", "Assassinate"].includes(action) && "hover:bg-red-600 hover:border-red-400"
          )}
          onClick={onClick}
        >
          {ACTION_LABELS[action] || action}
          <Info className="absolute top-1 right-1 w-2.5 h-2.5 opacity-20 group-hover:opacity-100 transition-opacity" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="bg-slate-900 border-slate-800 text-white p-3 max-w-xs rounded-xl shadow-2xl">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="font-black text-xs uppercase tracking-widest text-purple-400">{ACTION_LABELS[action] || action}</p>
            {!hasCard && (
              <span className="text-[8px] bg-red-500/20 text-red-500 px-1.5 py-0.5 rounded font-black border border-red-500/30 uppercase">Carta Ausente</span>
            )}
          </div>
          <p className="text-[10px] leading-relaxed text-slate-300 font-medium">{ACTION_DESCRIPTIONS[action]}</p>
          {!hasCard && (
            <p className="text-[9px] text-red-400 font-bold uppercase mt-2">Você precisa da carta de {CARD_LABELS[ACTION_REQUIRED_CARDS[action]!] || ACTION_REQUIRED_CARDS[action]} para esta ação.</p>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

OpponentCard.displayName = "OpponentCard";
ActionBtn.displayName = "ActionBtn";
