
import React, { useState, useEffect } from "react";
import { useGameState } from "@/hooks/useGameState";
import { HomeView } from "./HomeView";
import { LobbyView } from "./LobbyView";
import { GameView } from "./GameView";
import { AuthOverlay } from "./AuthOverlay";
import { TutorialDialog } from "./TutorialDialog";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export const GameContainer: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('coup_room_id');
    }
    return null;
  });
  const [session, setSession] = useState<any>(null);
  const { room, players, myPlayer, myCards, actions, logs, loading } = useGameState(roomId);

  useEffect(() => {
    if (roomId) {
      localStorage.setItem('coup_room_id', roomId);
    } else {
      localStorage.removeItem('coup_room_id');
    }
  }, [roomId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Clear room if it doesn't exist or is finished (and we are not just loading)
  useEffect(() => {
    if (!loading && roomId && (!room || room.status === 'finished')) {
      setRoomId(null);
    }
  }, [room, roomId, loading]);

  if (!session) {
    return <AuthOverlay />;
  }

  const handleLeaveRoom = () => {
    setRoomId(null);
  };

  if (roomId && loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-slate-950 cyber-grid">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-slate-900 border-t-purple-600 rounded-full animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-10 h-10 border-2 border-slate-800 border-b-purple-400 rounded-full animate-[spin_1s_linear_infinite_reverse]" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-white font-black tracking-[0.3em] uppercase text-sm">Sincronizando Rede</span>
          <span className="text-slate-600 font-bold tracking-widest uppercase text-[10px] animate-pulse">Aguardando Resposta do Satélite...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <TutorialDialog />
      {(!roomId || !room) ? (
        <HomeView onRoomCreated={setRoomId} onRoomJoined={setRoomId} />
      ) : room.status === 'waiting' ? (
        <LobbyView room={room} players={players} myPlayer={myPlayer} onLeaveRoom={handleLeaveRoom} />
      ) : (
        <GameView 
          room={room} 
          players={players} 
          myPlayer={myPlayer} 
          myCards={myCards} 
          actions={actions} 
          logs={logs} 
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </>
  );
};
