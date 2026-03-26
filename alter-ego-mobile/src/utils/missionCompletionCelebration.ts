/**
 * Shared UI reactions after a mission completes (Home swipe or journal bridge).
 */

import type { QueryClient } from "@tanstack/react-query";
import type { CompleteMissionResponse, Mission } from "@/services/missions";
import type { XPProgressBarRef } from "@/components/XPProgressBar";
import { SIGIL_KEYS } from "@/hooks/useSigil";
import { parseStatTag, type AbilityStatKey } from "@/constants/stats";
import type { StatGains } from "@/services/stats";
import type React from "react";

function getTwinCompletionNote(mission: Mission): string | undefined {
  if (mission.twin_completed === false) return "You got there first.";
  if (!mission.twin_completed) return undefined;
  const hour = mission.twin_completed_at_hour;
  if (hour == null || typeof hour !== "number") {
    return "Your Twin was done with this before noon.";
  }
  const now = new Date().getHours();
  const hoursAgo = Math.max(0, now - hour);
  if (hoursAgo === 0) return "Your Twin just finished this.";
  if (hoursAgo === 1) return "Your Twin finished this an hour ago.";
  if (hoursAgo < 5) return `Your Twin finished this ${hoursAgo} hours ago.`;
  return "Your Twin was done with this before noon.";
}

function buildSpToastGains(
  gains: StatGains | undefined
): Array<{ statKey: AbilityStatKey; amount: number }> {
  if (!gains) return [];
  const out: Array<{ statKey: AbilityStatKey; amount: number }> = [];
  const pk = gains.primary_stat ? parseStatTag(gains.primary_stat) : undefined;
  if (pk && gains.primary_sp > 0) {
    out.push({ statKey: pk, amount: gains.primary_sp });
  }
  if (gains.discipline_sp > 0) {
    out.push({ statKey: "discipline", amount: gains.discipline_sp });
  }
  if (gains.willpower_bonus_sp > 0) {
    out.push({ statKey: "willpower", amount: gains.willpower_bonus_sp });
  }
  return out;
}

export type MissionCompletionCelebrationContext = {
  xpBarRef: React.RefObject<XPProgressBarRef | null>;
  queryClient: QueryClient;
  missionById: Map<string, Mission>;
  setStreakAnimationData: React.Dispatch<
    React.SetStateAction<{
      show: boolean;
      count: number;
      tier: string;
    } | null>
  >;
  setEvolutionStageName: React.Dispatch<React.SetStateAction<string>>;
  setEvolutionData: React.Dispatch<
    React.SetStateAction<{ new_stage: number; new_stage_name: string } | null>
  >;
  setEvolutionOverlayVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setStageTwinMessageVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setStageTwinMessageStageName: React.Dispatch<React.SetStateAction<string>>;
  setPetEvolutionData: React.Dispatch<
    React.SetStateAction<{ new_stage: number; new_pet_name: string } | null>
  >;
  setMilestoneCard: React.Dispatch<
    React.SetStateAction<{
      interestName: string;
      milestoneNumber: number;
      milestoneName: string;
      twinCongratulation: string;
    } | null>
  >;
  setSpToast: React.Dispatch<
    React.SetStateAction<{
      k: number;
      gains: Array<{ statKey: AbilityStatKey; amount: number }>;
      footerNote?: string;
    } | null>
  >;
  setAetherToastAmount: React.Dispatch<React.SetStateAction<number>>;
  setAetherToastVisible: React.Dispatch<React.SetStateAction<boolean>>;
  setSurgeJustActivated: React.Dispatch<React.SetStateAction<boolean>>;
  setSigilLevelUp: React.Dispatch<
    React.SetStateAction<{ level: number; name: string } | null>
  >;
};

export function runMissionCompletionCelebrationUI(
  result: CompleteMissionResponse,
  source: { missionId?: string },
  ctx: MissionCompletionCelebrationContext
) {
  if (!result.already_completed && !result.stage_evolved) {
    requestAnimationFrame(() => {
      ctx.xpBarRef.current?.animateXpGain();
    });
  }

  if (result.streak_animation?.show) {
    ctx.setStreakAnimationData({
      show: true,
      count: result.streak_animation.streak_count,
      tier: result.streak_animation.animation_tier,
    });
  }
  if (result.stage_evolved) {
    ctx.setEvolutionStageName(result.stage_evolved.new_stage_name);
    ctx.setEvolutionData(result.stage_evolved);
    ctx.setStageTwinMessageStageName(result.stage_evolved.new_stage_name);
    ctx.setStageTwinMessageVisible(true);
  }
  if (result.pet_evolved) {
    ctx.setPetEvolutionData(result.pet_evolved);
  }
  if (result.milestone_reached != null) {
    ctx.setMilestoneCard({
      interestName: "",
      milestoneNumber: result.milestone_reached,
      milestoneName: `Streak milestone: ${result.milestone_reached} days`,
      twinCongratulation: "Your Twin noticed.",
    });
  }

  let spToastWillShow = false;
  if (!result.already_completed) {
    const mid = source.missionId;
    const doneMission = mid ? ctx.missionById.get(mid) : undefined;
    const twinNote = doneMission ? getTwinCompletionNote(doneMission) : undefined;
    const tg = buildSpToastGains(result.stat_gains);
    const footerNote = result.completion_copy ?? twinNote ?? undefined;
    spToastWillShow = tg.length > 0 || !!footerNote;
    if (spToastWillShow) {
      ctx.setSpToast({ k: Date.now(), gains: tg, footerNote });
    }
  }

  const sigil = result?.sigil;
  if (sigil && typeof sigil === "object") {
    ctx.queryClient.invalidateQueries({ queryKey: SIGIL_KEYS.all });
    const aetherAmt =
      typeof sigil.aether_awarded === "number" ? sigil.aether_awarded : 0;
    if (aetherAmt > 0) {
      const showAether = () => {
        ctx.setAetherToastAmount(aetherAmt);
        ctx.setAetherToastVisible(true);
      };
      // SP toast uses same top area; run Aether after SP dismisses (~2.4s) to avoid overlap.
      if (spToastWillShow) {
        setTimeout(showAether, 2600);
      } else {
        showAether();
      }
    }
    if (sigil.surge_activated === true) {
      ctx.setSurgeJustActivated(true);
    }
    if (
      sigil.level_up === true &&
      typeof sigil.new_level === "number" &&
      typeof sigil.new_level_name === "string" &&
      sigil.new_level_name.length > 0
    ) {
      ctx.setSigilLevelUp({ level: sigil.new_level, name: sigil.new_level_name });
    }
  }
}
