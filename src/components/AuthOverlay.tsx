
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl"
      >
        <h2 className="text-3xl font-black text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-purple-600">
          {isLogin ? "ENTRAR NO JOGO" : "CRIAR CONTA"}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="email"
            placeholder="Seu Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 bg-slate-800 border-slate-700 text-white rounded-xl focus:ring-purple-500"
            required={!loading}
          />
          <Input
            type="password"
            placeholder="Sua Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 bg-slate-800 border-slate-700 text-white rounded-xl focus:ring-purple-500"
            required={!loading}
          />
          <Button 
            className="w-full h-12 bg-purple-600 hover:bg-purple-500 font-bold text-lg rounded-xl"
            disabled={loading}
          >
            {loading ? "CARREGANDO..." : (isLogin ? "ENTRAR" : "CADASTRAR")}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-slate-800"></span>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-slate-900 px-2 text-slate-500 font-bold">Ou</span>
          </div>
        </div>

        <Button 
          variant="outline"
          className="w-full h-12 border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white font-bold text-lg rounded-xl"
          onClick={handleGuestLogin}
          disabled={loading}
        >
          {loading ? "CARREGANDO..." : "ENTRAR COMO CONVIDADO"}
        </Button>
        
        <div className="mt-6 text-center">
          <button 
            className="text-slate-400 hover:text-purple-400 text-sm font-bold uppercase tracking-wider"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin ? "Não tem uma conta? Cadastre-se" : "Já tem conta? Entre aqui"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
