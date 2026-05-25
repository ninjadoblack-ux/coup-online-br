
import React, { useState, useEffect } from "react";
import { useGameState } from "@/hooks/useGameState";
import { HomeView } from "./HomeView";
import { LobbyView } from "./LobbyView";
import { GameView } from "./GameView";
import { AuthOverlay } from "./AuthOverlay";
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
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
        <span className="text-slate-400 font-bold tracking-widest uppercase text-xs">Carregando Sala...</span>
      </div>
    );
  }

  if (!roomId || !room) {
    return <HomeView onRoomCreated={setRoomId} onRoomJoined={setRoomId} />;
  }

  if (room.status === 'waiting') {
    return <LobbyView room={room} players={players} myPlayer={myPlayer} />;
  }

  return (
    <GameView 
      room={room} 
      players={players} 
      myPlayer={myPlayer} 
      myCards={myCards} 
      actions={actions} 
      logs={logs} 
    />
  );
};
