
import React, { useState, useEffect } from "react";
import { useGameState } from "@/hooks/useGameState";
import { HomeView } from "./HomeView";
import { LobbyView } from "./LobbyView";
import { GameView } from "./GameView";
import { AuthOverlay } from "./AuthOverlay";
import { TutorialDialog } from "./TutorialDialog";
import { LoadingScreen } from "./LoadingScreen";
import { supabase } from "@/integrations/supabase/client";

export const GameContainer: React.FC = () => {
  const [roomId, setRoomId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('coup_room_id');
    }
    return null;
  });
  const [session, setSession] = useState<any | undefined>(undefined);
  const [authChecked, setAuthChecked] = useState(false);
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
      setAuthChecked(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Clear room if it doesn't exist or is finished (and we are not just loading)
  useEffect(() => {
    if (!loading && roomId && (!room || room.status === 'finished')) {
      setRoomId(null);
    }
  }, [room, roomId, loading]);

  if (!authChecked) {
    return <LoadingScreen status="Autenticando" subStatus="Verificando Credenciais na Rede..." />;
  }

  if (!session) {
    return <AuthOverlay />;
  }

  const handleLeaveRoom = () => {
    setRoomId(null);
  };

  if (roomId && loading) {
    return <LoadingScreen status="Sincronizando" subStatus="Baixando Dados da Partida..." />;
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
