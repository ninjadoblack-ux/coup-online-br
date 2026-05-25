
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

export const AuthOverlay: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (error) throw error;
        toast.success("Verifique seu email para confirmar o cadastro.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      toast.success("Entrando como convidado...");
    } catch (err: any) {
      toast.error("Erro ao entrar como convidado: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-xl px-4 cyber-grid">
      <div className="scanline opacity-20" />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border-2 border-slate-800 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
      >
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm"
            >
              <div className="relative flex items-center justify-center">
                <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
                <div className="absolute inset-0 w-12 h-12 border-4 border-purple-500/20 rounded-full" />
              </div>
              <p className="mt-4 text-[10px] text-purple-400 font-black uppercase tracking-[0.3em] animate-pulse">
                Processando Dados...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-500 to-transparent" />
        
        <div className="text-center mb-6 sm:mb-10">
           <div className="w-12 h-12 sm:w-16 sm:h-16 bg-purple-600/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl sm:text-3xl font-black text-purple-500">C</span>
           </div>
           <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter">
            {isLogin ? "Identificação" : "Nova Conta"}
          </h2>
          <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.3em] mt-1">Sincronização Requerida</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Diretório Email</label>
            <Input
              type="email"
              placeholder="user@neural.link"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 bg-slate-950/50 border-slate-800 text-white rounded-2xl focus:ring-purple-500 focus:border-purple-500 transition-all font-mono"
              required={!loading}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] uppercase font-black text-slate-500 tracking-widest ml-1">Chave de Acesso</label>
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 bg-slate-950/50 border-slate-800 text-white rounded-2xl focus:ring-purple-500 focus:border-purple-500 transition-all font-mono"
              required={!loading}
            />
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              className="w-full h-14 sm:h-16 bg-purple-600 hover:bg-purple-500 font-black text-lg sm:text-xl rounded-2xl shadow-lg shadow-purple-900/20 border-t border-purple-400/30 mt-4"
              disabled={loading}
            >
              {loading ? "PROCESSANDO..." : (isLogin ? "CONECTAR" : "REGISTRAR")}
            </Button>
          </motion.div>
        </form>

        <div className="relative my-10">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-800"></span>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
            <span className="bg-slate-900 px-4 text-slate-600">Protocolo Alternativo</span>
          </div>
        </div>

        <Button 
          variant="outline"
          className="w-full h-14 border-slate-800 bg-slate-950/50 text-slate-400 hover:bg-slate-800 hover:text-white font-black text-xs rounded-2xl uppercase tracking-widest transition-all"
          onClick={handleGuestLogin}
          disabled={loading}
        >
          {loading ? "PROCESSANDO..." : "Entrar como Convidado"}
        </Button>
        
        <div className="mt-8 text-center">
          <button 
            className="text-slate-500 hover:text-purple-400 text-[10px] font-black uppercase tracking-widest transition-colors"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Ainda não registrado? Criar Perfil" : "Já possui registro? Acessar"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
