
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Copy, Play, Users, Bot, X, Brain } from "lucide-react";
import { Player, Room, BotDifficulty } from "@/types/game";
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
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-8 px-4 py-8">
      <div className="text-center space-y-2">
        <h2 className="text-slate-400 uppercase tracking-widest text-sm font-bold">Código da Sala</h2>
        <div 
          className="flex items-center gap-4 bg-slate-900 border-2 border-purple-500/30 px-8 py-4 rounded-3xl cursor-pointer hover:border-purple-500 transition-all group"
          onClick={copyCode}
        >
          <span className="text-5xl font-black tracking-[0.2em] text-purple-400 group-hover:scale-110 transition-transform">
            {room.code}
          </span>
          <Copy className="w-6 h-6 text-slate-500 group-hover:text-purple-400" />
        </div>
      </div>

      <div className="w-full bg-slate-900/50 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-6">
          <Users className="w-5 h-5 text-purple-500" />
          <h3 className="text-xl font-bold uppercase tracking-tight">Jogadores ({players.length}/6)</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {players.map((player, idx) => (
            <motion.div
              key={player.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: idx * 0.1 }}
              className={`flex items-center gap-4 bg-slate-800/50 p-4 rounded-2xl border ${player.is_bot ? 'border-purple-500/30' : 'border-slate-700/50'} relative group`}
            >
              <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${player.is_bot ? 'from-purple-600 to-purple-900' : 'from-purple-500 to-purple-800'} flex items-center justify-center font-black text-xl`}>
                {player.is_bot ? <Bot className="w-6 h-6 text-white" /> : player.name[0].toUpperCase()}
              </div>
              <div className="flex flex-col">
                <span className={`font-bold ${player.is_bot ? 'text-purple-300' : 'text-slate-200'}`}>{player.name}</span>
                {player.is_host && (
                  <span className="text-[10px] uppercase font-bold text-purple-400 tracking-wider">Host</span>
                )}
                {player.is_bot && (
                  <span className="text-[10px] uppercase font-bold text-purple-400/70 tracking-wider">IA</span>
                )}
              </div>
              
              {isHost && player.is_bot && (
                <button
                  onClick={() => handleRemoveBot(player.id)}
                  className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </motion.div>
          ))}
          {Array.from({ length: Math.max(0, 4 - players.length) }).map((_, i) => (
            <div key={i} className="h-20 border-2 border-dashed border-slate-800 rounded-2xl flex items-center justify-center text-slate-700">
              Aguardando...
            </div>
          ))}
        </div>
      </div>

      <div className="w-full max-w-xs space-y-4">
        <Button
          variant="ghost"
          className="w-full text-slate-500 hover:text-red-400"
          onClick={onLeaveRoom}
        >
          SAIR DA SALA
        </Button>
        {isHost ? (
          <div className="flex flex-col gap-3">
            <Button
              size="lg"
              className="w-full h-16 text-xl font-bold rounded-2xl bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:scale-105"
              onClick={handleStartGame}
              disabled={!canStart}
            >
              <Play className="mr-2 h-6 w-6" /> INICIAR PARTIDA
            </Button>
            
            {players.length < 6 && (
              <Button
                variant="outline"
                className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-950/20 rounded-xl"
                onClick={handleAddBot}
              >
                <Bot className="mr-2 h-4 w-4" /> + ADICIONAR ROBÔ
              </Button>
            )}
          </div>
        ) : (
          <div className="text-center p-4 bg-slate-900/50 rounded-2xl border border-slate-800 text-slate-400 italic">
            Aguardando o host iniciar a partida...
          </div>
        )}
        {!canStart && isHost && (
          <p className="text-center text-xs text-red-400 uppercase font-bold tracking-tighter">
            Mínimo de 2 jogadores necessários
          </p>
        )}
      </div>
    </div>
  );
};
