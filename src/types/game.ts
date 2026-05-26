
export type CardType = 'Duke' | 'Assassin' | 'Ambassador' | 'Captain' | 'Contessa';

export type RoomStatus = 'waiting' | 'playing' | 'finished';

export type PlayerStatus = 'alive' | 'dead';

export type BotDifficulty = 'easy' | 'moderate' | 'hard';

export type ActionType = 
  | 'Income' 
  | 'Foreign Aid' 
  | 'Tax' 
  | 'Steal' 
  | 'Assassinate' 
  | 'Exchange' 
  | 'Coup'
  | 'Block'
  | 'Challenge';

export interface Player {
  id: string;
  room_id: string;
  user_id: string | null;
  name: string;
  avatar: string | null;
  coins: number;
  status: PlayerStatus;
  is_host: boolean;
  is_bot?: boolean;
  bot_difficulty?: BotDifficulty;
  turn_order: number | null;
  current_emote?: string | null;
  emote_at?: string | null;
}

export interface PlayerCard {
  id: string;
  player_id: string;
  card_type: CardType;
  is_revealed: boolean;
  slot_index: number;
}

export interface Room {
  id: string;
  code: string;
  status: RoomStatus;
  created_at: string;
  created_by: string | null;
  winner_id: string | null;
  current_turn_player_id: string | null;
  deck: CardType[];
}

export interface GameAction {
  id: string;
  room_id: string;
  player_id: string;
  target_id: string | null;
  action_type: ActionType;
  status: 'pending' | 'completed' | 'blocked' | 'challenged' | 'failed' | 'blocking' | 'block_challenged' | 'awaiting_reveal' | 'exchanging' | 'executing_final';
  challenger_id?: string | null;
  blocker_id?: string | null;
  acting_player_id?: string | null;
  next_status?: string | null;
  temporary_cards?: CardType[] | null;
  accepted_by?: string[] | null;
  created_at: string;
  expires_at: string | null;
}

export interface GameLog {
  id: string;
  room_id: string;
  message: string;
  created_at: string;
}
