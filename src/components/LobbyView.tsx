
import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Copy, Play, Users, Bot, X, Brain, Plus } from "lucide-react";
import { Player, Room, BotDifficulty } from "@/types/game";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { INITIAL_DECK, shuffleDeck } from "@/lib/game-logic";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LobbyViewProps {
  room: Room;
  players: Player[];
  myPlayer: Player | null;
  onLeaveRoom: () => void;
}

export const LobbyView: React.FC<LobbyViewProps> = ({ room, players, myPlayer, onLeaveRoom }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<BotDifficulty>('moderate');
  const isHost = myPlayer?.is_host || false;
  const canStart = players.length >= 2;


  const copyCode = () => {
    navigator.clipboard.writeText(room.code);
    toast.success("Código copiado!");
  };

  const handleAddBot = async () => {
    if (players.length >= 6) {
      toast.error("A sala está cheia.");
      return;
    }

    const botNames = ["Bot Alpha", "Bot Beta", "Bot Gamma", "Bot Delta", "Bot Sigma"];
    const existingBotNames = players.filter(p => p.is_bot).map(p => p.name);
    const nextName = botNames.find(name => !existingBotNames.includes(name)) || `Bot ${players.length + 1}`;

    try {
      await supabase.from('players').insert([{
        room_id: room.id,
        user_id: null,
        name: nextName,
        is_host: false,
        is_bot: true,
        bot_difficulty: selectedDifficulty
      }]);
      toast.success(`${nextName} (${selectedDifficulty}) adicionado!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao adicionar robô.");
    }
  };


  const handleRemoveBot = async (botId: string) => {
    try {
      await supabase.from('players').delete().eq('id', botId);
      toast.success("Robô removido.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover robô.");
    }
  };

  const handleStartGame = async () => {
    if (!canStart) {
      toast.error("Mínimo de 2 jogadores para iniciar.");
      return;
    }

    try {
      // Shuffled deck
      const deck = shuffleDeck(INITIAL_DECK);
      
      // Distribute 2 cards to each player
      const cardInserts = [];
      let deckIdx = 0;
      
      const sortedPlayers = [...players].sort((a, b) => {
        if (a.is_host) return -1;
        if (b.is_host) return 1;
        return 0;
      });

      for (const player of sortedPlayers) {
        cardInserts.push({ player_id: player.id, card_type: deck[deckIdx++], slot_index: 0 });
        cardInserts.push({ player_id: player.id, card_type: deck[deckIdx++], slot_index: 1 });
      }

      const remainingDeck = deck.slice(deckIdx);

      // Update room status and current turn
      await supabase
        .from('rooms')
        .update({ 
          status: 'playing', 
          current_turn_player_id: sortedPlayers[0].id,
          deck: remainingDeck
        })
        .eq('id', room.id);

      // Insert cards
      await supabase.from('player_cards').insert(cardInserts);

      // Log start
      await supabase.from('game_logs').insert([{
        room_id: room.id,
        message: "A partida começou!"
      }]);

    } catch (err) {
      console.error(err);
      toast.error("Erro ao iniciar a partida.");
    }
  };

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-8 md:gap-12 px-4 py-8 md:py-12 min-h-screen relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
      
      <div className="text-center space-y-4 w-full">
        <h2 className="text-slate-500 uppercase tracking-[0.3em] text-[10px] font-black">Interface de Sala // Protocolo Ativado</h2>
        <div 
          className="relative inline-flex items-center gap-4 md:gap-6 bg-slate-950/80 border-2 border-slate-800 px-6 md:px-12 py-4 md:py-6 rounded-[2rem] md:rounded-[2.5rem] cursor-pointer hover:border-purple-500/50 transition-all group overflow-hidden shadow-2xl"
          onClick={copyCode}
        >
          <div className="absolute inset-0 bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="flex flex-col items-center">
             <span className="text-4xl md:text-6xl font-black tracking-[0.2em] text-white group-hover:scale-105 transition-transform drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              {room.code}
            </span>
            <span className="text-[10px] text-slate-500 font-bold mt-2 group-hover:text-purple-400 transition-colors uppercase tracking-widest">Clique para copiar</span>
          </div>
          <div className="p-3 bg-slate-900 rounded-2xl border border-slate-800 group-hover:border-purple-500/50 transition-all">
            <Copy className="w-6 h-6 text-slate-500 group-hover:text-purple-400" />
          </div>
        </div>
      </div>

      <div className="w-full glass-card rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4">
           <div className="flex items-center gap-2 px-3 py-1 bg-slate-900/50 rounded-full border border-slate-800">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rede Ativa</span>
           </div>
        </div>

        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-purple-600/20 rounded-lg border border-purple-500/30">
            <Users className="w-6 h-6 text-purple-500" />
          </div>
          <div>
            <h3 className="text-xl md:text-2xl font-black uppercase tracking-tighter text-white">Jogadores</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{players.length} de 6 conectados</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AnimatePresence mode="popLayout">
            {players.map((player, idx) => (
              <motion.div
                key={player.id}
                layout
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 20, stiffness: 300 }}
                className={cn(
                  "flex items-center gap-3 sm:gap-4 bg-slate-900/50 p-4 sm:p-5 rounded-[1.5rem] sm:rounded-3xl border transition-all relative group",
                  player.is_bot ? 'border-purple-500/30 shadow-[inset_0_0_20px_rgba(168,85,247,0.05)]' : 'border-slate-800 hover:border-slate-700'
                )}
              >
                <div className={cn(
                  "w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center font-black text-xl sm:text-2xl shadow-lg transition-transform group-hover:scale-110",
                  player.is_bot ? 'bg-gradient-to-br from-purple-500 to-purple-900' : 'bg-gradient-to-br from-slate-700 to-slate-900'
                )}>
                  {player.is_bot ? <Bot className="w-6 h-6 sm:w-8 sm:h-8 text-white" /> : player.name[0].toUpperCase()}
                </div>
                <div className="flex flex-col flex-1">
                  <span className={cn(
                    "font-black text-base sm:text-lg tracking-tight truncate max-w-[120px]",
                    player.is_bot ? 'text-purple-300' : 'text-white'
                  )}>{player.name}</span>
                  <div className="flex items-center gap-2">
                    {player.is_host && (
                      <span className="text-[9px] px-2 py-0.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-full font-black uppercase tracking-tighter">Host</span>
                    )}
                    {player.is_bot && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] px-2 py-0.5 bg-slate-800 text-slate-400 border border-slate-700 rounded-full font-black uppercase tracking-tighter">IA</span>
                        <span className={cn(
                          "text-[9px] font-black uppercase tracking-tighter",
                          player.bot_difficulty === 'easy' ? 'text-green-500' :
                          player.bot_difficulty === 'moderate' ? 'text-yellow-500' : 'text-red-500'
                        )}>
                          {player.bot_difficulty === 'easy' ? 'Fácil' :
                           player.bot_difficulty === 'moderate' ? 'Moderado' : 'Difícil'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                {isHost && player.is_bot && (
                  <button
                    onClick={() => handleRemoveBot(player.id)}
                    className="absolute -top-2 -right-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-500 hover:text-red-500 hover:border-red-500/50 opacity-0 group-hover:opacity-100 transition-all shadow-xl"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
            {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="h-[88px] border-2 border-dashed border-slate-800/50 rounded-3xl flex items-center justify-center text-slate-700 font-black uppercase tracking-widest text-[10px]">
                Slot Livre
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="w-full max-w-sm space-y-6">
        {isHost ? (
          <div className="flex flex-col gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                className="w-full h-16 sm:h-20 text-xl sm:text-2xl font-black rounded-[1.5rem] sm:rounded-3xl bg-purple-600 hover:bg-purple-500 shadow-[0_0_40px_rgba(168,85,247,0.4)] transition-all border-t border-purple-400/50 disabled:opacity-50 disabled:grayscale"
                onClick={handleStartGame}
                disabled={!canStart}
              >
                <Play className="mr-3 h-8 w-8 fill-current" /> INICIAR
              </Button>
            </motion.div>
            
            {players.length < 6 && (
              <div className="bg-slate-950/50 rounded-[2rem] p-6 border border-slate-800 backdrop-blur-sm space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.2em] flex items-center gap-2">
                    <Brain className="w-3 h-3 text-purple-500" /> Configurar Robô
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  <Select 
                    value={selectedDifficulty} 
                    onValueChange={(v) => setSelectedDifficulty(v as BotDifficulty)}
                  >
                    <SelectTrigger className="h-12 border-slate-800 bg-slate-900/50 text-sm font-bold rounded-xl focus:ring-purple-500/30">
                      <SelectValue placeholder="Dificuldade" />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-900 border-slate-800 text-white rounded-xl">
                      <SelectItem value="easy" className="focus:bg-purple-500/20 focus:text-purple-300">Nível Fácil</SelectItem>
                      <SelectItem value="moderate" className="focus:bg-purple-500/20 focus:text-purple-300">Nível Moderado</SelectItem>
                      <SelectItem value="hard" className="focus:bg-purple-500/20 focus:text-purple-300">Nível Difícil</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    className="w-full h-12 border-purple-500/20 bg-purple-500/5 text-purple-400 hover:bg-purple-500/10 hover:border-purple-500/40 rounded-xl font-black uppercase text-xs tracking-widest transition-all"
                    onClick={handleAddBot}
                  >
                    <Plus className="mr-2 h-4 w-4" /> Adicionar IA
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center p-8 bg-slate-950/50 rounded-[2.5rem] border border-slate-800 text-slate-500 flex flex-col items-center gap-4">
            <div className="w-10 h-10 rounded-full border-2 border-slate-800 border-t-purple-500 animate-spin" />
            <p className="font-black uppercase tracking-widest text-[10px]">Aguardando conexão do host...</p>
          </div>
        )}
        
        <div className="flex flex-col items-center gap-4 pt-4">
           {!canStart && isHost && (
            <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.2em] animate-pulse">
              Protocolo requer no mínimo 2 jogadores
            </p>
          )}
          <Button
            variant="ghost"
            className="text-slate-600 hover:text-red-500 font-bold uppercase tracking-widest text-[10px] hover:bg-transparent"
            onClick={onLeaveRoom}
          >
            Abortar Missão
          </Button>
        </div>
      </div>
    </div>
  );
};
