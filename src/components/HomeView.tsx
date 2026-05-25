
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, Plus } from "lucide-react";
import { generateRoomCode } from "@/lib/game-logic";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface HomeViewProps {
  onRoomCreated: (roomId: string) => void;
  onRoomJoined: (roomId: string) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onRoomCreated, onRoomJoined }) => {
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para criar uma sala.");
        return;
      }

      const code = generateRoomCode();
      const { data: room, error } = await supabase
        .from('rooms')
        .insert([{ code, created_by: user.id }])
        .select()
        .single();

      if (error) throw error;
      
      // Add creator as player
      const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
      
      await supabase.from('players').insert([{
        room_id: room.id,
        user_id: user.id,
        name: profile?.display_name || user.email?.split('@')[0] || "Jogador",
        is_host: true
      }]);

      onRoomCreated(room.id);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar sala.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async () => {
    if (!joinCode || joinCode.length < 5) {
      toast.error("Código inválido.");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado para entrar em uma sala.");
        return;
      }

      const { data: room, error } = await supabase
        .from('rooms')
        .select('id, status')
        .eq('code', joinCode.toUpperCase())
        .single();

      if (error || !room) {
        toast.error("Sala não encontrada.");
        return;
      }

      if (room.status !== 'waiting') {
        toast.error("A partida já começou ou terminou nesta sala.");
        return;
      }

      // Check if already in room
      const { data: existingPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('room_id', room.id)
        .eq('user_id', user.id)
        .single();

      if (!existingPlayer) {
        const { data: profile } = await supabase.from('profiles').select('display_name').eq('id', user.id).single();
        await supabase.from('players').insert([{
          room_id: room.id,
          user_id: user.id,
          name: profile?.display_name || user.email?.split('@')[0] || "Jogador",
          is_host: false
        }]);
      }

      onRoomJoined(room.id);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao entrar na sala.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-12 px-4">
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center"
      >
        <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-purple-700 drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]">
          COUP ONLINE
        </h1>
        <p className="mt-4 text-slate-400 tracking-[0.3em] uppercase text-sm font-bold">
          Blefe • Dedução • Dominação
        </p>
      </motion.div>

      <div className="flex flex-col gap-6 w-full max-w-sm">
        {!isJoining ? (
          <>
            <Button
              size="lg"
              className="h-16 text-xl font-bold rounded-2xl bg-purple-600 hover:bg-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all hover:scale-105"
              onClick={handleCreateRoom}
              disabled={loading}
            >
              <Plus className="mr-2 h-6 w-6" /> CRIAR NOVA SALA
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-xl font-bold rounded-2xl border-purple-500/50 text-purple-400 hover:bg-purple-950/30 transition-all"
              onClick={() => setIsJoining(true)}
              disabled={loading}
            >
              <LogIn className="mr-2 h-6 w-6" /> ENTRAR EM SALA
            </Button>
          </>
        ) : (
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-4"
          >
            <Input
              placeholder="CÓDIGO DA SALA"
              className="h-16 text-2xl font-black text-center tracking-[0.5em] uppercase border-2 border-purple-500 bg-slate-900 rounded-2xl focus-visible:ring-purple-500"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              maxLength={5}
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                className="flex-1 h-12 text-slate-400"
                onClick={() => setIsJoining(false)}
              >
                VOLTAR
              </Button>
              <Button
                className="flex-[2] h-12 bg-purple-600 hover:bg-purple-500"
                onClick={handleJoinRoom}
                disabled={loading}
              >
                CONFIRMAR
              </Button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
