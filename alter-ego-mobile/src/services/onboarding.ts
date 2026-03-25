import { apiClient } from "@/services/api";

export interface OnboardingStepRequest {
  question_key: string;
  answer_json: Record<string, unknown>;
}

export interface OnboardingProgressResponse {
  onboarding_complete: boolean;
  answers: Record<string, Record<string, unknown>>;
}

export interface UsernameCheckResponse {
  available: boolean;
  username: string;
  suggestion: string | null;
  reason?: string;
}

export interface CreateProfileResponse {
  created: boolean;
  username: string;
  user_id: string;
}

export type InterestNormalisationRejection = {
  rejection_type: "self_harm" | "redirect_to_quit" | "invalid_input";
  message: string;
};

export interface OnboardingCompleteResponse {
  success: boolean;
  archetype: string;
  archetype_name: string;
  archetype_tagline: string;
  archetype_reveal_message: string;
  twin_first_message: string;
  interests_processed: number;
  quit_targets_processed: number;
  interest_rejections?: InterestNormalisationRejection[];
  self_harm_interest_detected?: boolean;
  self_harm_quit_detected?: boolean;
}

export const onboardingService = {
  saveStep: (data: OnboardingStepRequest) =>
    apiClient.post<{ saved: boolean; question_key: string }>(
      "/api/v1/onboarding/step",
      data
    ),

  getProgress: () =>
    apiClient.get<OnboardingProgressResponse>("/api/v1/onboarding/progress"),

  checkUsername: (username: string) =>
    apiClient.get<UsernameCheckResponse>(
      `/api/v1/users/check-username?username=${encodeURIComponent(username)}`
    ),

  createProfile: () =>
    apiClient.post<CreateProfileResponse>("/api/v1/users/create-profile"),

  complete: () =>
    apiClient.post<OnboardingCompleteResponse>("/api/v1/onboarding/complete"),
};
