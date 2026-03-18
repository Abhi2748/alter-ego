"""
XP/PF/Level Audit Script — B35

Validates that all stored values match spec constants.
Run manually to catch any drift before beta.

Usage (from alter-ego-backend/):
    python -m app.services.audit_service
"""

from __future__ import annotations

import logging

from app.core.constants import (
    DAILY_PF_CAPS,
    DAILY_XP_CAPS,
    MISSION_XP,
    PET_NAMES,
    PF_THRESHOLDS,
    STAGE_NAMES,
    TOTAL_CHARACTER_STAGES,
    TOTAL_PET_STAGES,
    XP_THRESHOLDS,
)
from app.core.supabase_client import supabase_admin

logger = logging.getLogger(__name__)


def run_audit() -> dict:
    """
    Runs all validation checks. Returns a report dict.
    """
    issues = []
    warnings = []

    # ── Check 1: XP thresholds are ascending ─────────────────────────────
    for i in range(len(XP_THRESHOLDS) - 1):
        if XP_THRESHOLDS[i] >= XP_THRESHOLDS[i + 1]:
            issues.append(
                f"XP_THRESHOLDS not ascending at index {i}: "
                f"{XP_THRESHOLDS[i]} >= {XP_THRESHOLDS[i+1]}"
            )

    # ── Check 2: PF thresholds are ascending ──────────────────────────────
    for i in range(len(PF_THRESHOLDS) - 1):
        if PF_THRESHOLDS[i] >= PF_THRESHOLDS[i + 1]:
            issues.append(
                f"PF_THRESHOLDS not ascending at index {i}: "
                f"{PF_THRESHOLDS[i]} >= {PF_THRESHOLDS[i+1]}"
            )

    # ── Check 3: Stage names count matches ────────────────────────────────
    if len(STAGE_NAMES) != TOTAL_CHARACTER_STAGES:
        issues.append(
            f"STAGE_NAMES count ({len(STAGE_NAMES)}) != "
            f"TOTAL_CHARACTER_STAGES ({TOTAL_CHARACTER_STAGES})"
        )

    if len(PET_NAMES) != TOTAL_PET_STAGES:
        issues.append(
            f"PET_NAMES count ({len(PET_NAMES)}) != "
            f"TOTAL_PET_STAGES ({TOTAL_PET_STAGES})"
        )

    # ── Check 4: Daily caps exist for all stages ─────────────────────────
    for stage in range(1, TOTAL_CHARACTER_STAGES + 1):
        if stage not in DAILY_XP_CAPS:
            issues.append(f"DAILY_XP_CAPS missing stage {stage}")
        if stage not in DAILY_PF_CAPS:
            issues.append(f"DAILY_PF_CAPS missing stage {stage}")

    # ── Check 5: Mission XP values are positive ───────────────────────────
    for tier, xp in MISSION_XP.items():
        if xp <= 0:
            issues.append(f"MISSION_XP[{tier}] = {xp} is not positive")

    # ── Check 6: Validate users in DB against thresholds ─────────────────
    try:
        users_result = (
            supabase_admin.table("users")
            .select(
                "id, total_xp, character_stage, total_pf, pet_stage, pet_unlocked"
            )
            .eq("onboarding_complete", True)
            .execute()
        )
        users = users_result.data or []

        for user in users:
            uid = user["id"]
            total_xp = user.get("total_xp", 0) or 0
            stage = user.get("character_stage", 1) or 1
            total_pf = user.get("total_pf", 0) or 0
            pet_stage = user.get("pet_stage", 0) or 0

            if stage > 1 and total_xp < XP_THRESHOLDS[stage - 1]:
                issues.append(
                    f"User {uid}: stage={stage} but total_xp={total_xp} < "
                    f"threshold={XP_THRESHOLDS[stage-1]}"
                )

            if (
                stage < TOTAL_CHARACTER_STAGES
                and total_xp >= XP_THRESHOLDS[stage]
            ):
                warnings.append(
                    f"User {uid}: total_xp={total_xp} >= next threshold="
                    f"{XP_THRESHOLDS[stage]} but stage={stage} not updated"
                )

            if user.get("pet_unlocked") and pet_stage > 0:
                if (
                    pet_stage > 1
                    and total_pf < PF_THRESHOLDS[pet_stage - 1]
                ):
                    issues.append(
                        f"User {uid}: pet_stage={pet_stage} but total_pf="
                        f"{total_pf} < threshold={PF_THRESHOLDS[pet_stage-1]}"
                    )

            if stage < 1 or stage > TOTAL_CHARACTER_STAGES:
                issues.append(
                    f"User {uid}: character_stage={stage} out of bounds"
                )

            if pet_stage < 0 or pet_stage > TOTAL_PET_STAGES:
                issues.append(
                    f"User {uid}: pet_stage={pet_stage} out of bounds"
                )

    except Exception as e:
        warnings.append(f"Could not validate users: {e}")

    # ── Report ────────────────────────────────────────────────────────────
    passed = len(issues) == 0
    report = {
        "passed": passed,
        "issues": issues,
        "warnings": warnings,
        "constants_validated": {
            "xp_thresholds": XP_THRESHOLDS,
            "pf_thresholds": PF_THRESHOLDS,
            "stage_names": STAGE_NAMES,
            "pet_names": PET_NAMES,
        },
    }

    if passed:
        print("✅ Audit passed. All values within spec.")
    else:
        print(f"❌ Audit failed. {len(issues)} issue(s) found:")
        for issue in issues:
            print(f"  ISSUE: {issue}")

    if warnings:
        print(f"⚠️  {len(warnings)} warning(s):")
        for w in warnings:
            print(f"  WARN: {w}")

    return report


if __name__ == "__main__":
    run_audit()
