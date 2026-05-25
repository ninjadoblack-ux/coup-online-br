
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { CardType } from "@/types/game";
import { CARD_LABELS } from "@/lib/game-logic";

interface GameCardProps {
  type?: CardType;
  isRevealed?: boolean;
  isSelectable?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}

const cardImages: Record<CardType, string> = {
  Duke: "https://i.pinimg.com/1200x/0b/e6/69/0be6699e901ea7686e2823647ff8bb48.jpg",
  Assassin: "https://i.pinimg.com/1200x/a7/8f/50/a78f500bd983f8de67a1d52de72eb191.jpg",
  Ambassador: "https://i.pinimg.com/1200x/a9/51/57/a95157c351c8117431dd511e8580e293.jpg",
  Captain: "https://i.pinimg.com/1200x/23/5e/5b/235e5b19a15a7eea951f7a4bd7fbeadf.jpg",
  Contessa: "https://i.pinimg.com/736x/68/69/b0/6869b0c7afcd9cb4bfec32c3b8e6aa51.jpg",
};

const cardColors: Record<CardType, string> = {
  Duke: "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]",
  Assassin: "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]",
  Ambassador: "border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.4)]",
  Captain: "border-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.4)]",
  Contessa: "border-pink-500 shadow-[0_0_15px_rgba(236,72,153,0.4)]",
};

// ... keep existing code


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
        <div className="absolute inset-0 z-0">
          <img 
            src="https://i.pinimg.com/736x/63/6f/0c/636f0c08a66f7b07a21e4016fb049d67.jpg" 
            alt="Card Back" 
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-slate-950/20" />
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border-2 border-white/10 flex items-center justify-center relative bg-black/20 backdrop-blur-sm">
             <div className="absolute inset-0 border border-purple-500/20 rounded-full animate-[spin_10s_linear_infinite]" />
             <span className="text-4xl font-black text-white/20 tracking-tighter italic group-hover:text-purple-500/40 transition-colors">C</span>
          </div>
        </div>
        <div className="absolute bottom-2 inset-x-0 flex justify-center opacity-30 z-10">
           <span className="text-[6px] font-black uppercase tracking-[0.4em] text-white">Neural Protocol Active</span>
        </div>
      </motion.div>
    );
  }

  const image = type ? cardImages[type] : null;
  const colorClass = type ? cardColors[type] : "";

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      className={cn(
        "relative w-24 h-36 md:w-32 md:h-48 rounded-[1.5rem] border-2 bg-slate-950 flex flex-col items-center justify-between transition-all shadow-2xl overflow-hidden group",
        colorClass,
        compact && "w-16 h-24 md:w-20 md:h-30 rounded-xl",
        className
      )}
    >
      {/* Background Image */}
      {image && (
        <div className="absolute inset-0 z-0">
          <img 
            src={image} 
            alt={type} 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-slate-950/20" />
        </div>
      )}

      <div className="absolute top-0 left-0 w-full h-12 bg-gradient-to-b from-white/10 to-transparent pointer-events-none z-10" />
      
      <div className="flex flex-col items-center gap-1 z-10 pt-4">
        <span className={cn(
          "text-[10px] md:text-[12px] font-black uppercase tracking-[0.2em] text-white drop-shadow-lg", 
          compact && "text-[8px] tracking-widest pt-2"
        )}>
          {type ? cardNames[type] : ""}
        </span>
        <div className="w-8 h-[1px] bg-white/40" />
      </div>

      <div className="flex flex-col items-center gap-2 z-10 w-full pb-4">
        <div className="w-full flex justify-center items-center gap-1 px-4">
           <div className="h-[1px] flex-1 bg-white/20" />
           <div className="px-2 py-0.5 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm">
              <span className={cn("text-[8px] font-black text-white uppercase tracking-tighter", compact && "hidden")}>
                Active Unit
              </span>
           </div>
           <div className="h-[1px] flex-1 bg-white/20" />
         </div>
      </div>
    </motion.div>
  );
};
