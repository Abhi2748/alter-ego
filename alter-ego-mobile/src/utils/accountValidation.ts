/**
 * Email + password rules for Account → guest upgrade (email/password).
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmailFormat(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 5 || s.length > 254) return false;
  return EMAIL_RE.test(s);
}

export type PasswordCriteria = {
  id: string;
  label: string;
  met: boolean;
};

const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{}|;:,.<>?/\\]/;

export function evaluatePasswordStrength(password: string): {
  criteria: PasswordCriteria[];
  isStrong: boolean;
} {
  const criteria: PasswordCriteria[] = [
    {
      id: "len",
      label: "At least 8 characters",
      met: password.length >= 8,
    },
    {
      id: "upper",
      label: "One uppercase letter",
      met: /[A-Z]/.test(password),
    },
    {
      id: "lower",
      label: "One lowercase letter",
      met: /[a-z]/.test(password),
    },
    {
      id: "digit",
      label: "One number",
      met: /\d/.test(password),
    },
    {
      id: "special",
      label: "One special character (!@#$…)",
      met: SPECIAL_RE.test(password),
    },
  ];
  const isStrong = criteria.every((c) => c.met);
  return { criteria, isStrong };
}
