
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
        whileHover={isSelectable ? { scale: 1.05, y: -5 } : {}}
        onClick={isSelectable ? onClick : undefined}
        className={cn(
          "relative w-24 h-36 md:w-32 md:h-48 rounded-xl border-2 border-slate-700 bg-slate-900 overflow-hidden cursor-default",
          isSelectable && "cursor-pointer border-purple-500/50 hover:border-purple-400",
          isSelected && "ring-4 ring-purple-500 border-purple-400",
          compact && "w-16 h-24 md:w-20 md:h-30",
          className
        )}
      >
        <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 to-slate-950">
          <div className="w-12 h-12 rounded-full border border-slate-700 flex items-center justify-center opacity-30">
            <span className="text-2xl font-bold text-slate-500 italic">C</span>
          </div>
        </div>
      </motion.div>
    );
  }

  const icon = type ? cardIcons[type] : null;
  const colorClass = type ? cardColors[type] : "";

  return (
    <motion.div
      initial={{ rotateY: 90 }}
      animate={{ rotateY: 0 }}
      className={cn(
        "relative w-24 h-36 md:w-32 md:h-48 rounded-xl border-2 bg-slate-900 flex flex-col items-center justify-between py-4 transition-all",
        colorClass,
        compact && "w-16 h-24 md:w-20 md:h-30 py-2",
        className
      )}
    >
      <span className={cn("text-xs md:text-sm font-bold uppercase tracking-wider", compact && "text-[10px]")}>
        {type}
      </span>
      <div className={cn("my-2", compact && "my-1 scale-75")}>
        {icon}
      </div>
      <div className="flex flex-col items-center gap-1">
        <div className="w-8 h-1 bg-slate-700 rounded-full" />
        <span className={cn("text-[8px] md:text-[10px] text-slate-500 uppercase", compact && "hidden")}>
          Influence
        </span>
      </div>
    </motion.div>
  );
};
