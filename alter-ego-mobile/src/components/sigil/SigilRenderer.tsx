import React from "react";
import type { SigilProps } from "./sigilTypes";
import { Sigil1 } from "./Sigil1";
import { Sigil2 } from "./Sigil2";
import { Sigil3 } from "./Sigil3";
import { Sigil4 } from "./Sigil4";
import { Sigil5 } from "./Sigil5";
import { Sigil6 } from "./Sigil6";
import { Sigil7 } from "./Sigil7";
import { Sigil8 } from "./Sigil8";
import { Sigil9 } from "./Sigil9";
import { Sigil10 } from "./Sigil10";

const SIGILS: React.FC<SigilProps>[] = [
  Sigil1,
  Sigil2,
  Sigil3,
  Sigil4,
  Sigil5,
  Sigil6,
  Sigil7,
  Sigil8,
  Sigil9,
  Sigil10,
];

export function SigilRenderer({ level, ...props }: SigilProps & { level: number }) {
  const L = Math.min(10, Math.max(1, level));
  const Comp = SIGILS[L - 1];
  return <Comp {...props} />;
}
