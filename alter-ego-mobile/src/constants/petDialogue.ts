export type PetDialogueContext =
  | "warm_default"
  | "mission_completed"
  | "missions_left"
  | "absence_return"
  | "low_progress";

const PET_DIALOGUE_LINES: Record<PetDialogueContext, string[]> = {
  warm_default: [
    "I love you.",
    "I'm proud of you.",
    "I'm right here with you.",
  ],
  mission_completed: [
    "I knew you could do this.",
    "Thanks for feeding me.",
    "That mission made me stronger.",
  ],
  missions_left: [
    "Complete your missions and feed me, please.",
    "I'm still hungry - one more mission?",
    "Let's finish today strong.",
  ],
  absence_return: [
    "I missed you.",
    "You came back. Thank you.",
    "Let's rebuild together.",
  ],
  low_progress: [
    "Start anywhere. I'll follow.",
    "One mission is enough to begin.",
  ],
};

function chooseRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  const index = Math.floor(Math.random() * items.length);
  return items[index] ?? null;
}

export function pickPetDialogue(
  context: PetDialogueContext,
  previousLine?: string | null,
  recentLines?: string[] | null
): string | null {
  const pool = PET_DIALOGUE_LINES[context] ?? PET_DIALOGUE_LINES.warm_default;
  const recentSet = new Set<string>();
  if (previousLine) recentSet.add(previousLine);
  for (const line of recentLines ?? []) {
    recentSet.add(line);
  }

  const filtered = pool.filter((line) => !recentSet.has(line));

  const selected = chooseRandom(filtered);
  if (selected) return selected;
  return chooseRandom(pool);
}

