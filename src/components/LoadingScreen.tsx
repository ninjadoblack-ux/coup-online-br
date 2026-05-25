
import React from "react";
import { motion } from "framer-motion";

interface LoadingScreenProps {
  status?: string;
  subStatus?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ 
  status = "Sincronizando Rede", 
  subStatus = "Aguardando Resposta do Satélite..." 
}) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 bg-slate-950 cyber-grid overflow-hidden relative">
      <div className="scanline opacity-20 pointer-events-none" />
      
      {/* Background Glows */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-purple-600/10 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative">
        {/* Outer Ring */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="w-32 h-32 border-[1px] border-slate-800 rounded-full flex items-center justify-center"
        >
          <div className="w-[90%] h-[90%] border-t-2 border-purple-500 rounded-full" />
        </motion.div>
        
        {/* Inner Ring */}
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <div className="w-20 h-20 border-[1px] border-slate-800 rounded-full flex items-center justify-center">
            <div className="w-[85%] h-[85%] border-b-2 border-purple-400/50 rounded-full" />
          </div>
        </motion.div>
        
        {/* Center Dot */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div 
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-3 h-3 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(168,85,247,0.5)]"
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-1"
        >
          <span className="text-white font-black tracking-[0.5em] uppercase text-xs sm:text-sm pl-[0.5em]">
            {status}
          </span>
          <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-purple-500 to-transparent my-2" />
          <span className="text-slate-500 font-bold tracking-widest uppercase text-[9px] sm:text-[10px] animate-pulse text-center px-4 max-w-[280px]">
            {subStatus}
          </span>
        </motion.div>
        
        {/* Simple Progress Bar */}
        <div className="w-48 h-[2px] bg-slate-900 rounded-full mt-4 overflow-hidden border border-slate-800/50">
          <motion.div 
            initial={{ x: "-100%" }}
            animate={{ x: "100%" }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-full h-full bg-gradient-to-r from-transparent via-purple-500 to-transparent"
          />
        </div>
      </div>
      
      {/* Decorative Text */}
      <div className="absolute bottom-10 left-0 w-full flex justify-between px-10 pointer-events-none opacity-20 hidden sm:flex">
        <span className="text-[10px] text-slate-500 font-mono tracking-tighter">SEC_PROTOCOL_v4.2</span>
        <span className="text-[10px] text-slate-500 font-mono tracking-tighter">NEURAL_LINK_ESTABLISHED</span>
      </div>
    </div>
  );
};
