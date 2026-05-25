
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
  logs 
}) => {
  const [isSelectingTarget, setIsSelectingTarget] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  
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
    <div className="relative w-full h-[calc(100vh-80px)] overflow-hidden flex flex-col">
      {/* Top Bar - Opponents */}
      <div className="flex justify-center gap-4 p-4">
        {players.filter(p => p.id !== myPlayer?.id).map(opponent => (
          <div 
            key={opponent.id} 
            onClick={() => isSelectingTarget && handleAction(isSelectingTarget, opponent.id)}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-900/80 border border-slate-800 transition-all",
              room.current_turn_player_id === opponent.id && "border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)] scale-110",
              opponent.status === 'dead' && "grayscale opacity-50",
              isSelectingTarget && opponent.status === 'alive' && "cursor-pointer border-red-500 animate-pulse hover:scale-110"
            )}
          >
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs">
                {opponent.name[0].toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-300">{opponent.name}</span>
            </div>
            <div className="flex gap-1">
              {/* Back of cards */}
              <GameCard compact className="scale-75" />
              <GameCard compact className="scale-75" />
            </div>
            <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold">
              <Coins className="w-3 h-3" /> {opponent.coins}
            </div>
          </div>
        ))}
      </div>

      {/* Center Area - Game Log & Table State */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg aspect-video rounded-[100px] border-[10px] border-slate-800 bg-slate-900/30 relative flex flex-col items-center justify-center">
          {isSelectingTarget && (
            <div className="absolute inset-0 z-10 bg-black/40 rounded-[90px] flex flex-col items-center justify-center gap-4">
               <h4 className="text-xl font-black text-red-500 uppercase tracking-widest">Selecione o Alvo</h4>
               <Button variant="ghost" className="text-slate-400" onClick={() => setIsSelectingTarget(null)}>Cancelar</Button>
            </div>
          )}
          <div className="absolute top-4 flex items-center gap-2 text-yellow-500/50">
             <Coins className="w-6 h-6" />
             <span className="text-2xl font-black">BANCO</span>
          </div>

          <ScrollArea className="h-32 w-full max-w-xs p-2">
            <div className="flex flex-col gap-1 text-center">
              {logs.map(log => (
                <div key={log.id} className="text-[10px] text-slate-400 font-mono">
                  {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })} - {log.message}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* Action Modal (Reaction Overlay) */}
      <AnimatePresence>
        {pendingAction && pendingAction.player_id !== myPlayer?.id && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <div className="bg-slate-900 border-2 border-red-500 rounded-3xl p-8 max-w-sm w-full shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <div className="flex items-center justify-between mb-6">
                <span className="text-red-500 font-black uppercase tracking-widest text-sm flex items-center gap-2">
                  <Timer className="w-4 h-4 animate-pulse" /> REAÇÃO NECESSÁRIA
                </span>
                <span className="text-slate-500 font-mono">{timeLeft}s</span>
              </div>
              
              <h3 className="text-xl font-bold text-center mb-2 text-slate-100">
                {players.find(p => p.id === pendingAction.player_id)?.name} está reivindicando {pendingAction.action_type}!
              </h3>
              
              <div className="flex flex-col gap-3 mt-8">
                <Button 
                  className="h-12 bg-red-600 hover:bg-red-500 font-bold"
                  onClick={() => handleReaction('challenge')}
                >
                  CONTESTAR!
                </Button>
                <div className="flex gap-2">
                   <Button variant="outline" className="flex-1 border-slate-700 text-slate-400" onClick={() => handleReaction('allow')}>
                    PERMITIR
                  </Button>
                  <Button variant="outline" className="flex-1 border-slate-700 text-slate-400">
                    BLOQUEAR
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Area - Player Space */}
      <div className="bg-slate-900/90 border-t border-slate-800 p-6">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-8">
          {/* My Cards & Info */}
          <div className="flex items-center gap-6">
            <div className="flex gap-3">
              {myCards.map(card => (
                <GameCard 
                  key={card.id} 
                  type={card.card_type} 
                  isRevealed={true} // In our game, own cards are always visible
                  className={cn(card.is_revealed && "grayscale opacity-50 ring-2 ring-red-500")}
                />
              ))}
              {myCards.length === 0 && (
                <div className="w-32 h-48 border-2 border-dashed border-slate-800 rounded-xl" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 px-4 py-2 rounded-full">
                <Coins className="w-5 h-5 text-yellow-500" />
                <span className="text-2xl font-black text-yellow-500">{myPlayer?.coins || 0}</span>
              </div>
              <span className="text-xs uppercase tracking-widest font-bold text-slate-500 ml-1">Suas Moedas</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
            {Object.keys(ACTION_DESCRIPTIONS).map((action) => (
              <Button
                key={action}
                disabled={!isMyTurn || pendingAction !== null}
                variant="outline"
                className={cn(
                  "h-12 text-[10px] md:text-xs font-bold uppercase tracking-tighter border-slate-700 bg-slate-800/50 hover:bg-purple-950/30 hover:border-purple-500 transition-all",
                  isMyTurn && "border-slate-500"
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
  );
};
