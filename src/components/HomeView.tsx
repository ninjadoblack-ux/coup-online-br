
import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LogIn, Plus, BookOpen } from "lucide-react";
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
      const { data: profileData } = await (supabase.from('profiles') as any).select('display_name').eq('id', user.id).single();
      const profile = profileData as { display_name: string | null } | null;
      
      await supabase.from('players').insert([{
        room_id: room.id,
        user_id: user.id,
        name: profile?.display_name || user.email?.split('@')[0] || (user.is_anonymous ? "Convidado" : "Jogador"),
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
        const { data: profileData } = await (supabase.from('profiles') as any).select('display_name').eq('id', user.id).single();
        const profile = profileData as { display_name: string | null } | null;
        await supabase.from('players').insert([{
          room_id: room.id,
          user_id: user.id,
          name: profile?.display_name || user.email?.split('@')[0] || (user.is_anonymous ? "Convidado" : "Jogador"),
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
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-16 px-4 relative cyber-grid">
      <div className="scanline" />
      
      <div className="absolute top-4 right-4 z-20">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-500 hover:text-purple-400 gap-2 font-bold transition-all hover:bg-purple-500/10 rounded-full"
          onClick={() => {
            localStorage.setItem('force_show_tutorial', 'true');
            window.location.reload();
          }}
        >
          <BookOpen className="w-4 h-4" /> REVER TUTORIAL
        </Button>
      </div>

      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", duration: 1.2, bounce: 0.4 }}
        className="text-center relative"
      >
        <div className="absolute -inset-x-20 -inset-y-10 bg-purple-500/10 blur-[100px] rounded-full pointer-events-none" />
        <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-purple-300 to-purple-800 drop-shadow-[0_0_25px_rgba(168,85,247,0.4)] relative">
          COUP
          <span className="block text-4xl md:text-5xl mt-[-10px] non-italic tracking-[0.1em] font-light">ONLINE</span>
        </h1>
        <div className="mt-8 flex items-center justify-center gap-4">
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-slate-700" />
          <p className="text-slate-500 tracking-[0.4em] uppercase text-[10px] md:text-xs font-black">
            Blefe • Dedução • Dominação
          </p>
          <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-slate-700" />
        </div>
      </motion.div>

      <div className="flex flex-col gap-6 w-full max-w-sm z-10">
        {!isJoining ? (
          <div className="flex flex-col gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                size="lg"
                className="w-full h-16 text-xl font-black rounded-2xl bg-purple-600 hover:bg-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.3)] border-t border-purple-400/50 transition-all flex items-center justify-center gap-3"
                onClick={handleCreateRoom}
                disabled={loading}
              >
                <Plus className="h-6 w-6" /> CRIAR NOVA SALA
              </Button>
            </motion.div>
            
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
              <Button
                variant="outline"
                size="lg"
                className="w-full h-16 text-xl font-black rounded-2xl border-2 border-slate-800 bg-slate-950/50 backdrop-blur-md text-slate-300 hover:border-purple-500/50 hover:text-purple-400 transition-all flex items-center justify-center gap-3"
                onClick={() => setIsJoining(true)}
                disabled={loading}
              >
                <LogIn className="h-6 w-6" /> ENTRAR EM SALA
              </Button>
            </motion.div>
          </div>
        ) : (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-6 bg-slate-950/50 p-8 rounded-[2rem] border border-slate-800 shadow-2xl backdrop-blur-xl"
          >
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Inserir Código</label>
              <Input
                placeholder="00000"
                className="h-20 text-4xl font-black text-center tracking-[0.3em] uppercase border-2 border-slate-800 bg-slate-900/50 rounded-2xl focus-visible:ring-purple-500 transition-all"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
                autoFocus
              />
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 h-14 text-slate-500 font-bold hover:text-white"
                onClick={() => setIsJoining(false)}
              >
                CANCELAR
              </Button>
              <Button
                className="flex-[2] h-14 bg-purple-600 hover:bg-purple-500 font-black rounded-xl shadow-lg shadow-purple-900/20"
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
