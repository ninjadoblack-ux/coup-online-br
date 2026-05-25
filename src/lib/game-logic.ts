
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

export const ACTION_DESCRIPTIONS: Record<string, string> = {
  'Income': 'Recebe 1 moeda do banco.',
  'Foreign Aid': 'Recebe 2 moedas do banco (pode ser bloqueado pelo Duque).',
  'Tax': 'Recebe 3 moedas do banco (requer Duque).',
  'Steal': 'Rouba 2 moedas de um oponente (requer Capitão, pode ser bloqueado pelo Capitão ou Embaixador).',
  'Assassinate': 'Paga 3 moedas para eliminar um cartão de um oponente (requer Assassino, pode ser bloqueado pela Condessa).',
  'Exchange': 'Troca cartas com o baralho (requer Embaixador).',
  'Coup': 'Paga 7 moedas para eliminar um cartão de um oponente (não pode ser contestado ou bloqueado).'
};
