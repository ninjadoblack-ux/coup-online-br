
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const COLORS = {
  background: "#0a0a0c",
  card: "#16161a",
  primary: "#9b87f5", // Purple neon
  danger: "#ea384c",  // Red neon
  success: "#0ea5e9", // Cyan neon
  accent: "#d946ef",  // Pink neon
};
