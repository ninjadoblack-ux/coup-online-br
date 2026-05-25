
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardType } from "@/types/game";
import { Shield, Sword, Crown, UserRound, Coins } from "lucide-react";

interface GameCardProps {
  type?: CardType;
  isRevealed?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

const cardIcons: Record<CardType, React.ReactNode> = {
  Duke: <Crown className="w-8 h-8 text-purple-400" />,
  Assassin: <Sword className="w-8 h-8 text-red-400" />,
  Ambassador: <Shield className="w-8 h-8 text-cyan-400" />,
  Captain: <Coins className="w-8 h-8 text-yellow-400" />,
  Contessa: <UserRound className="w-8 h-8 text-pink-400" />,
};

const cardColors: Record<CardType, string> = {
  Duke: "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]",
  Assassin: "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]",
  Ambassador: "border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]",
  Captain: "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]",
  Contessa: "border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]",
};

export const GameCard: React.FC<GameCardProps> = ({
  type,
  isRevealed = false,
  isSelectable = false,
  isSelected = false,
  onClick,
  className,
  compact = false,
}) => {
  if (!isRevealed) {
    return (
      <motion.div
        whileHover={isSelectable ? { scale: 1.05, y: -10 } : {}}
        onClick={isSelectable ? onClick : undefined}
        className={cn(
          "relative w-24 h-36 md:w-32 md:h-48 rounded-[1.5rem] border-2 border-slate-800 bg-slate-950 overflow-hidden cursor-default shadow-2xl group",
          isSelectable && "cursor-pointer border-purple-500/50 hover:border-purple-400",
          isSelected && "ring-4 ring-purple-500 border-purple-400 scale-105",
          compact && "w-16 h-24 md:w-20 md:h-30 rounded-xl",
          className
        )}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_oklch(0.3_0.1_260),_transparent)] opacity-50" />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-slate-900 flex items-center justify-center relative">
             <div className="absolute inset-0 border border-purple-500/10 rounded-full animate-[spin_10s_linear_infinite]" />
             <span className="text-4xl font-black text-slate-800 tracking-tighter italic group-hover:text-purple-900 transition-colors">C</span>
          </div>
          <div className="mt-4 flex gap-1">
             <div className="w-1 h-1 rounded-full bg-slate-800" />
             <div className="w-1 h-1 rounded-full bg-slate-800" />
             <div className="w-1 h-1 rounded-full bg-slate-800" />
          </div>
        </div>
        <div className="absolute bottom-2 inset-x-0 flex justify-center opacity-10">
           <span className="text-[6px] font-black uppercase tracking-[0.4em]">Security Layer v4.2</span>
        </div>
      </motion.div>
    );
  }

  const icon = type ? cardIcons[type] : null;
  const colorClass = type ? cardColors[type] : "";

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      className={cn(
        "relative w-24 h-36 md:w-32 md:h-48 rounded-[1.5rem] border-2 bg-slate-950 flex flex-col items-center justify-between p-4 transition-all shadow-2xl overflow-hidden",
        colorClass,
        compact && "w-16 h-24 md:w-20 md:h-30 p-2 rounded-xl",
        className
      )}
    >
      <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-white/5 to-transparent pointer-events-none" />
      
      <div className="flex flex-col items-center gap-1 z-10">
        <span className={cn("text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] text-white", compact && "text-[8px] tracking-widest")}>
          {type}
        </span>
        <div className="w-8 h-[1px] bg-white/20" />
      </div>

      <div className={cn("my-2 relative z-10", compact && "my-1 scale-75")}>
        <div className="absolute inset-0 blur-xl opacity-20 bg-current rounded-full" />
        {icon}
      </div>

      <div className="flex flex-col items-center gap-2 z-10 w-full">
        <div className="w-full flex justify-center items-center gap-1">
           <div className="h-[1px] flex-1 bg-white/5" />
           <div className="px-2 py-0.5 rounded-full border border-white/10 bg-white/5">
              <span className={cn("text-[8px] font-black text-white/40 uppercase tracking-tighter", compact && "hidden")}>
                Card Data
              </span>
           </div>
           <div className="h-[1px] flex-1 bg-white/5" />
        </div>
      </div>
    </motion.div>
  );
};
