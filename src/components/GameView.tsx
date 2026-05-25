
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Player, Room, PlayerCard, GameAction, GameLog } from "@/types/game";
import { GameCard } from "./GameCard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Coins, History, Timer } from "lucide-react";
import { ACTION_DESCRIPTIONS } from "@/lib/game-logic";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useBotLogic } from "@/hooks/useBotLogic";
import { Bot } from "lucide-react";

interface GameViewProps {
  room: Room;
  players: Player[];
  myPlayer: Player | null;
  myCards: PlayerCard[];
  actions: GameAction[];
  logs: GameLog[];
  onLeaveRoom: () => void;
}

export const GameView: React.FC<GameViewProps> = ({ 
  room, 
  players, 
  myPlayer, 
  myCards, 
  actions, 
  logs,
  onLeaveRoom
}) => {
  const [isSelectingTarget, setIsSelectingTarget] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Bot Logic Hook
  useBotLogic(room, players, myPlayer, actions);
  
  const opponents = players.filter(p => p.id !== myPlayer?.id && p.status === 'alive');
  const isMyTurn = room.current_turn_player_id === myPlayer?.id;
  const pendingAction = actions.length > 0 ? actions[0] : null;

  useEffect(() => {
    if (pendingAction?.expires_at) {
      const interval = setInterval(() => {
        const expires = new Date(pendingAction.expires_at!).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, Math.floor((expires - now) / 1000));
        setTimeLeft(diff);
        if (diff <= 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setTimeLeft(null);
    }
  }, [pendingAction?.expires_at]);

  const handleAction = async (actionType: string, targetId: string | null = null) => {
    if (!myPlayer || !isMyTurn) return;

    // Check if targeting is needed
    if (['Assassinate', 'Steal', 'Coup'].includes(actionType) && !targetId) {
      setIsSelectingTarget(actionType);
      return;
    }

    try {
      await supabase.from('game_actions').insert([{
        room_id: room.id,
        player_id: myPlayer.id,
        target_id: targetId,
        action_type: actionType,
        status: 'pending',
        expires_at: new Date(Date.now() + 10000).toISOString()
      }]);

      await supabase.from('game_logs').insert([{
        room_id: room.id,
        message: `${myPlayer.name} anunciou ${actionType}${targetId ? ` contra ${players.find(p => p.id === targetId)?.name}` : ''}.`
      }]);

      setIsSelectingTarget(null);

    } catch (err) {
      console.error(err);
      toast.error("Erro ao realizar ação.");
    }
  };

  const handleReaction = async (type: 'allow' | 'challenge' | 'block') => {
    if (!pendingAction || !myPlayer) return;

    try {
      if (type === 'allow') {
        // Just logic to mark this player as "allowed"
        // For MVP, if anyone clicks Challenge/Block it stops, otherwise it proceeds on timer
        toast.info("Você permitiu a ação.");
      } else if (type === 'challenge') {
        await supabase
          .from('game_actions')
          .update({ status: 'challenged' })
          .eq('id', pendingAction.id);
        
        await supabase.from('game_logs').insert([{
          room_id: room.id,
          message: `${myPlayer.name} CONTESTOU ${players.find(p => p.id === pendingAction.player_id)?.name}!`
        }]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col bg-slate-950 cyber-grid">
      <div className="scanline" />
      
      {/* Header Info */}
      <div className="flex items-center justify-between p-4 z-20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
            <span className="text-xl font-black text-purple-400">C</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-widest uppercase">Protocolo // Coup</h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Neural Sync: Active</p>
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
      <div className="flex justify-center gap-6 px-4 py-2">
        {players.filter(p => p.id !== myPlayer?.id).map(opponent => (
          <motion.div 
            key={opponent.id} 
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            onClick={() => isSelectingTarget && handleAction(isSelectingTarget, opponent.id)}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-[2rem] bg-slate-900/40 backdrop-blur-md border transition-all relative group",
              room.current_turn_player_id === opponent.id ? "border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.2)]" : "border-slate-800",
              opponent.status === 'dead' && "grayscale opacity-30",
              isSelectingTarget && opponent.status === 'alive' && "cursor-pointer border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse"
            )}
          >
            {room.current_turn_player_id === opponent.id && (
               <div className="absolute -top-1 -left-1 -right-1 -bottom-1 border border-purple-500 rounded-[2.1rem] animate-pulse pointer-events-none" />
            )}

            <div className="flex items-center gap-2">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg shadow-inner",
                opponent.is_bot ? "bg-gradient-to-br from-purple-500 to-purple-800" : "bg-gradient-to-br from-slate-700 to-slate-900"
              )}>
                {opponent.is_bot ? <Bot className="w-5 h-5 text-white" /> : opponent.name[0].toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className={cn(
                  "text-xs font-black uppercase tracking-tighter",
                  opponent.is_bot ? "text-purple-300" : "text-slate-100"
                )}>{opponent.name}</span>
                <div className="flex items-center gap-1 text-yellow-500 text-[10px] font-black">
                  <Coins className="w-3 h-3" /> {opponent.coins}
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

            {room.current_turn_player_id === opponent.id && opponent.is_bot && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                <span className="text-[9px] text-purple-400 font-black animate-pulse uppercase tracking-[0.2em]">Processando...</span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Main Table Area */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-2xl aspect-[2/1] rounded-[200px] border-[1px] border-slate-800 bg-gradient-to-b from-slate-900/20 to-slate-950/40 relative shadow-2xl flex flex-col items-center justify-center group overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.5_0.2_280_/_0.03),_transparent)]" />
          
          {/* Decorative center element */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5">
             <div className="w-[80%] h-[80%] border-2 border-dashed border-purple-500 rounded-full animate-[spin_20s_linear_infinite]" />
             <div className="absolute w-40 h-40 border-2 border-purple-500 rounded-full" />
          </div>

          {isSelectingTarget && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-md rounded-[200px] flex flex-col items-center justify-center gap-6"
            >
               <h4 className="text-3xl font-black text-red-500 uppercase tracking-[0.3em] drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">Selecionar Alvo</h4>
               <Button 
                variant="ghost" 
                className="text-slate-400 font-black uppercase tracking-widest text-xs hover:text-white"
                onClick={() => setIsSelectingTarget(null)}
               >
                Cancelar Operação
               </Button>
            </motion.div>
          )}

          <div className="flex flex-col items-center gap-1 z-10 opacity-40">
             <Coins className="w-12 h-12 text-yellow-500/50" />
             <span className="text-3xl font-black text-yellow-500 tracking-[0.5em] ml-4">BANCO</span>
          </div>

          <div className="w-full max-w-sm h-32 mt-4 z-10">
            <ScrollArea className="h-full w-full px-6">
              <div className="flex flex-col gap-2">
                <AnimatePresence>
                  {logs.slice(-10).map((log, i) => {
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
        </div>
      </div>

      {/* Action Overlay (Reaction) */}
      <AnimatePresence>
        {pendingAction && pendingAction.player_id !== myPlayer?.id && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-900 border-2 border-red-500/50 rounded-[3rem] p-10 max-w-md w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] text-center relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
              
              <div className="flex items-center justify-center gap-3 mb-8">
                <Timer className="w-5 h-5 text-red-500 animate-pulse" />
                <span className="text-red-500 font-black uppercase tracking-[0.3em] text-xs">
                   Reação Necessária // {timeLeft}s
                </span>
              </div>
              
              <h3 className="text-2xl font-black text-white leading-tight uppercase tracking-tight">
                {players.find(p => p.id === pendingAction.player_id)?.name} <br/> 
                <span className="text-red-500">Reivindica {pendingAction.action_type}!</span>
              </h3>
              
              <div className="flex flex-col gap-4 mt-12">
                <Button 
                  size="lg"
                  className="h-16 bg-red-600 hover:bg-red-500 font-black text-xl rounded-2xl shadow-lg shadow-red-900/20 border-t border-red-400/30"
                  onClick={() => handleReaction('challenge')}
                >
                  CONTESTAR!
                </Button>
                <div className="grid grid-cols-2 gap-3">
                   <Button 
                    variant="outline" 
                    className="h-14 border-slate-700 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700" 
                    onClick={() => handleReaction('allow')}
                   >
                    PERMITIR
                  </Button>
                  <Button 
                    variant="outline" 
                    className="h-14 border-slate-700 bg-slate-800 text-slate-300 font-bold rounded-2xl hover:bg-slate-700"
                  >
                    BLOQUEAR
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Interface - Player Panel */}
      <div className="bg-slate-900/60 backdrop-blur-xl border-t border-slate-800/50 p-6 z-20">
        <div className="max-w-5xl mx-auto flex flex-col lg:flex-row items-center gap-10">
          
          {/* Player Info & Cards */}
          <div className="flex items-center gap-8">
            <div className="flex flex-col items-center gap-2">
               <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-700 p-[2px] shadow-lg">
                  <div className="w-full h-full bg-slate-900 rounded-[14px] flex flex-col items-center justify-center">
                    <Coins className="w-5 h-5 text-yellow-500" />
                    <span className="text-xl font-black text-white">{myPlayer?.coins || 0}</span>
                  </div>
               </div>
               <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Moedas</span>
            </div>

            <div className="flex gap-4">
              {myCards.map(card => (
                <GameCard 
                  key={card.id} 
                  type={card.card_type} 
                  isRevealed={true}
                  className={cn(
                    "shadow-2xl transition-transform hover:-translate-y-4 hover:rotate-2",
                    card.is_revealed && "grayscale opacity-50 ring-4 ring-red-500/50"
                  )}
                />
              ))}
              {myCards.length === 0 && (
                <div className="w-24 h-36 md:w-32 md:h-48 border-2 border-dashed border-slate-800 rounded-3xl flex items-center justify-center">
                   <span className="text-slate-800 font-black uppercase text-[10px] rotate-[-45deg]">Eliminado</span>
                </div>
              )}
            </div>
          </div>

          {/* Action Grid */}
          <div className="flex-1 w-full">
             <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isMyTurn ? "bg-purple-500 shadow-[0_0_10px_oklch(0.6_0.2_280)]" : "bg-slate-700")} />
                  <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isMyTurn ? "text-purple-400" : "text-slate-500")}>
                    {isMyTurn ? "Sua Vez // Escolha uma Ação" : "Aguardando Turno..."}
                  </span>
                </div>
             </div>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.keys(ACTION_DESCRIPTIONS).map((action) => (
                <Button
                  key={action}
                  disabled={!isMyTurn || pendingAction !== null}
                  variant="outline"
                  className={cn(
                    "h-14 text-[10px] font-black uppercase tracking-wider border-slate-800 bg-slate-900/50 hover:bg-purple-600 hover:text-white hover:border-purple-400 transition-all rounded-xl",
                    isMyTurn && "border-slate-700 ring-1 ring-white/5",
                    ["Coup", "Assassinate"].includes(action) && "hover:bg-red-600 hover:border-red-400"
                  )}
                  onClick={() => handleAction(action)}
                >
                  {action}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
