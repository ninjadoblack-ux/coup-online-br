I will build a high-fidelity "Coup Online" multiplayer game using React, Tailwind CSS, and Supabase for real-time synchronization.

### Technical Architecture
- **State Management**: Supabase Realtime for syncing game state across players.
- **Backend**: Supabase Database for persistent storage (rooms, players, logs).
- **Frontend**: React with Framer Motion for smooth transitions and neon-themed UI.
- **Game Logic**: A state-machine approach to handle turn-based actions, challenges, and blocks.

### Step-by-Step Implementation

1. **Phase 1: Foundation & Auth**
    - Set up Supabase client and basic authentication (anonymous or simple name-based).
    - Create a reusable UI kit (Neon buttons, cards, containers).

2. **Phase 2: Lobby System**
    - Implement `HomeView`: Room creation with random 5-letter codes and joining existing rooms.
    - Implement `LobbyView`: Real-time player list updates using Supabase subscriptions.
    - Implement the "Start Game" logic: Distributing cards and coins, initializing game state.

3. **Phase 3: Core Game Interface**
    - `GameView` layout: Main table, opponent cards, local player space.
    - Implementation of action buttons with validation (e.g., Coup requires 7 coins).
    - Animated card components for revealing and flipping.

4. **Phase 4: Game Mechanics & Real-time Flow**
    - Action system: Sending actions to Supabase and notifying other players.
    - Reaction Modal: The timer-based popup for challenges/blocks.
    - Resolution logic: Handling challenges, revealed cards, and updating player influence/coins.
    - Ambassador exchange interface.

5. **Phase 5: Polish & Vibe**
    - Sound effect placeholders (visual cues).
    - Neon glow effects and transitions.
    - Game log for tracking history.
    - Victory/GameOver screen.

### Technical Details
- **Card Deck**: Handled on room start by the host, shuffled and distributed.
- **Real-time Sync**: Each player subscribes to the `rooms`, `players`, `player_cards`, and `game_actions` tables for their specific `room_id`.
- **Timer**: Managed by client-side local state triggered by a timestamp in the `game_actions` record to ensure all players see the same countdown.
