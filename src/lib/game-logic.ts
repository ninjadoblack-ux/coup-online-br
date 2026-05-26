
import { CardType } from "@/types/game";

export const CARDS: CardType[] = ['Duke', 'Assassin', 'Ambassador', 'Captain', 'Contessa'];

export const INITIAL_DECK: CardType[] = [
  ...CARDS,
  ...CARDS,
  ...CARDS
];

export function shuffleDeck(deck: CardType[]): CardType[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export const ACTION_LABELS: Record<string, string> = {
  'Income': 'Renda',
  'Foreign Aid': 'Ajuda Externa',
  'Tax': 'Taxa',
  'Steal': 'Extorquir',
  'Assassinate': 'Assassinar',
  'Exchange': 'Trocar',
  'Coup': 'Golpe de Estado',
  'Block': 'Bloquear',
  'Challenge': 'Contestar',
  'Challenge Block': 'Contestar Bloqueio'
};

export const CARD_LABELS: Record<string, string> = {
  'Duke': 'Duque',
  'Assassin': 'Assassino',
  'Ambassador': 'Embaixador',
  'Captain': 'Capitão',
  'Contessa': 'Condessa'
};

export const ACTION_DESCRIPTIONS: Record<string, string> = {
  'Income': 'Recebe 1 moeda do banco. Não pode ser bloqueado ou contestado.',
  'Foreign Aid': 'Recebe 2 moedas do banco. Pode ser bloqueado por quem tiver o Duque.',
  'Tax': 'Recebe 3 moedas do banco. Ação do Duque. Pode ser contestada.',
  'Steal': 'Rouba 2 moedas de um oponente. Ação do Capitão. Pode ser bloqueada pelo Capitão ou Embaixador.',
  'Assassinate': 'Paga 3 moedas para eliminar uma carta de um oponente. Ação do Assassino. Pode ser bloqueada pela Condessa.',
  'Exchange': 'Troca cartas com o baralho. Ação do Embaixador. Pode ser contestada.',
  'Coup': 'Paga 7 moedas para eliminar obrigatoriamente uma carta de um oponente. Não pode ser contestado ou bloqueado.'
};

export const ACTION_REQUIRED_CARDS: Record<string, CardType | null> = {
  'Income': null,
  'Foreign Aid': null,
  'Tax': 'Duke',
  'Steal': 'Captain',
  'Assassinate': 'Assassin',
  'Exchange': 'Ambassador',
  'Coup': null
};

export const BLOCKABLE_ACTIONS: Record<string, CardType[]> = {
  'Foreign Aid': ['Duke'],
  'Steal': ['Captain', 'Ambassador'],
  'Assassinate': ['Contessa']
};

export const getNextPlayerId = (players: any[], currentId: string) => {
  const alivePlayers = players
    .filter(p => p.status === 'alive')
    .sort((a, b) => (a.turn_order || 0) - (b.turn_order || 0));

  if (alivePlayers.length <= 1) return currentId;

  const currentIndex = alivePlayers.findIndex(p => p.id === currentId);
  if (currentIndex === -1) return alivePlayers[0].id;

  const nextIndex = (currentIndex + 1) % alivePlayers.length;
  return alivePlayers[nextIndex].id;
};
