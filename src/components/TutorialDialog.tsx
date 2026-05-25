
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, ChevronLeft, Check, BookOpen, Shield, Sword, Coins, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface TutorialStep {
  title: string;
  content: string;
  icon: React.ReactNode;
  color: string;
}

const tutorialSteps: TutorialStep[] = [
  {
    title: "Bem-vindo ao Coup Online",
    content: "Você está prestes a entrar em um mundo de intriga, blefe e traição. Coup é um jogo de dedução onde seu objetivo é ser o último sobrevivente na mesa.",
    icon: <Users className="w-12 h-12" />,
    color: "bg-purple-600"
  },
  {
    title: "Cartas e Influência",
    content: "Cada jogador começa com 2 cartas viradas para baixo. Cada carta representa um personagem com poderes únicos. Se você perder uma influência (carta), deve revelá-la. Perdeu as duas? Você está fora!",
    icon: <BookOpen className="w-12 h-12" />,
    color: "bg-blue-600"
  },
  {
    title: "Ações do Jogo",
    content: "No seu turno, você pode escolher uma ação: Renda (1 moeda), Ajuda Externa (2 moedas) ou Golpe de Estado (7 moedas). O Golpe elimina uma influência de um adversário instantaneamente.",
    icon: <Coins className="w-12 h-12" />,
    color: "bg-yellow-600"
  },
  {
    title: "Personagens e Poderes",
    content: "Duque: Pega 3 moedas (Taxa). Assassino: Paga 3 moedas para eliminar alguém. Capitão: Rouba 2 moedas. Embaixador: Troca cartas. Condessa: Bloqueia assassinatos.",
    icon: <Sword className="w-12 h-12" />,
    color: "bg-red-600"
  },
  {
    title: "A Arte do Blefe",
    content: "O segredo? Você pode declarar QUALQUER ação, mesmo sem ter a carta! Mas cuidado: se alguém te contestar e você estiver mentindo, perde uma carta. Se você falar a verdade, quem contestou perde uma!",
    icon: <Shield className="w-12 h-12" />,
    color: "bg-green-600"
  },
  {
    title: "Bloqueios",
    content: "Algumas ações podem ser bloqueadas por outros personagens. O Duque bloqueia Ajuda Externa. O Capitão ou Embaixador bloqueiam Roubos. A Condessa bloqueia o Assassino.",
    icon: <Shield className="w-12 h-12" />,
    color: "bg-indigo-600"
  }
];

export const TutorialDialog: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from('profiles')
          .select('has_completed_tutorial')
          .eq('id', user.id)
          .single();

        const forceShow = localStorage.getItem('force_show_tutorial') === 'true';
        if (forceShow || (profile && !profile.has_completed_tutorial)) {
          setIsOpen(true);
          if (forceShow) localStorage.removeItem('force_show_tutorial');
        }
      } catch (err) {
        console.error("Erro ao verificar status do tutorial:", err);
      } finally {
        setLoading(false);
      }
    };

    checkTutorialStatus();
  }, []);

  const handleNext = () => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setIsOpen(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({ has_completed_tutorial: true })
          .eq('id', user.id);
      }
    } catch (err) {
      console.error("Erro ao salvar status do tutorial:", err);
    }
  };

  if (loading || !isOpen) return null;

  const step = tutorialSteps[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="w-[95%] sm:max-w-[500px] bg-slate-950 border-purple-500/30 text-white overflow-hidden rounded-[2rem]">
        <DialogHeader>
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">
              Tutorial • Parte {currentStep + 1} de {tutorialSteps.length}
            </span>
            <div className="flex gap-1">
              {tutorialSteps.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1 rounded-full transition-all ${idx <= currentStep ? 'w-4 bg-purple-500' : 'w-2 bg-slate-800'}`}
                />
              ))}
            </div>
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-purple-400">
            {step.title}
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 sm:py-8 flex flex-col items-center text-center gap-4 sm:gap-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: -20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className={`p-6 rounded-3xl ${step.color} shadow-[0_0_30px_rgba(0,0,0,0.5)]`}
            >
              {React.cloneElement(step.icon as React.ReactElement, { className: "w-8 h-8 sm:w-12 sm:h-12" })}
            </motion.div>
          </AnimatePresence>

          <AnimatePresence mode="wait">
            <motion.p
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="text-slate-300 text-base sm:text-lg leading-relaxed font-medium"
            >
              {step.content}
            </motion.p>
          </AnimatePresence>
        </div>

        <DialogFooter className="flex flex-row justify-between items-center gap-2 sm:gap-4 mt-4">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={currentStep === 0}
            className="text-slate-400 hover:text-white hover:bg-white/5"
          >
            <ChevronLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
          
          <Button
            onClick={handleNext}
            className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-4 sm:px-8 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
          >
            {currentStep === tutorialSteps.length - 1 ? (
              <>Começar <Check className="ml-2 h-4 w-4" /></>
            ) : (
              <>Próximo <ChevronRight className="ml-2 h-4 w-4" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
