import { useState, useCallback, useRef } from "react";
import {
  onboardingService,
  type InterestNormalisationRejection,
} from "@/services/onboarding";
import { useUserStore } from "@/store/userStore";

export interface OnboardingAnswer {
  question_key: string;
  answer_json: Record<string, unknown>;
}

export interface ArchetypeResult {
  archetype: string;
  archetype_name: string;
  archetype_tagline: string;
  archetype_reveal_message: string;
  twin_first_message?: string;
  interests_processed: number;
  quit_targets_processed: number;
  interest_rejections?: InterestNormalisationRejection[];
  self_harm_interest_detected?: boolean;
}

export function useOnboarding() {
  const [isSaving, setIsSaving] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archetypeResult, setArchetypeResult] = useState<ArchetypeResult | null>(
    null
  );
  const [profileCreated, setProfileCreated] = useState(false);

  const usernameCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(
    null
  );
  const [usernameSuggestion, setUsernameSuggestion] = useState<string | null>(
    null
  );
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  const fetchProfile = useUserStore((state) => state.fetchProfile);

  const initializeProfile = useCallback(async () => {
    if (profileCreated) return;
    try {
      await onboardingService.createProfile();
      setProfileCreated(true);
    } catch {
      setProfileCreated(true);
    }
  }, [profileCreated]);

  const saveAnswer = useCallback(async (answer: OnboardingAnswer) => {
    setIsSaving(true);
    try {
      await onboardingService.saveStep({
        question_key: answer.question_key,
        answer_json: answer.answer_json,
      });
    } catch (err) {
      console.warn("Failed to save onboarding step:", err);
    } finally {
      setIsSaving(false);
    }
  }, []);

  const checkUsername = useCallback((username: string) => {
    if (usernameCheckTimeout.current) {
      clearTimeout(usernameCheckTimeout.current);
    }
    if (!username || username.length < 3) {
      setUsernameAvailable(null);
      setUsernameSuggestion(null);
      return;
    }
    setIsCheckingUsername(true);
    usernameCheckTimeout.current = setTimeout(async () => {
      try {
        const result = await onboardingService.checkUsername(username);
        setUsernameAvailable(result.available);
        setUsernameSuggestion(result.suggestion);
      } catch {
        setUsernameAvailable(null);
      } finally {
        setIsCheckingUsername(false);
      }
    }, 300);
  }, []);

  const completeOnboarding = useCallback(async (): Promise<ArchetypeResult | null> => {
    setIsCompleting(true);
    setError(null);
    try {
      const result = await onboardingService.complete();
      const mapped: ArchetypeResult = {
        archetype: result.archetype,
        archetype_name: result.archetype_name,
        archetype_tagline: result.archetype_tagline,
        archetype_reveal_message: result.archetype_reveal_message,
        twin_first_message: result.twin_first_message,
        interests_processed: result.interests_processed,
        quit_targets_processed: result.quit_targets_processed,
        interest_rejections: result.interest_rejections,
        self_harm_interest_detected:
          Boolean(result.self_harm_interest_detected) ||
          Boolean(result.self_harm_quit_detected),
      };
      setArchetypeResult(mapped);
      await fetchProfile();
      return mapped;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      return null;
    } finally {
      setIsCompleting(false);
    }
  }, [fetchProfile]);

  return {
    isSaving,
    isCompleting,
    error,
    archetypeResult,
    usernameAvailable,
    usernameSuggestion,
    isCheckingUsername,
    initializeProfile,
    saveAnswer,
    checkUsername,
    completeOnboarding,
  };
}
