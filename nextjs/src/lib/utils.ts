import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRandomGradient(seed: string): string {
  // Create a deterministic gradient based on the seed
  const hash = seed.split("").reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);

  const hue1 = hash % 360;
  const hue2 = (hue1 + 40) % 360;

  return `linear-gradient(45deg, hsl(${hue1}, 80%, 60%), hsl(${hue2}, 80%, 60%))`;
}
