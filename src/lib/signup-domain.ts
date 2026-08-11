/** Only this email domain may create new Fold accounts. */
export const ALLOWED_SIGNUP_DOMAIN = "acts2.network";

export function isAllowedSignupEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  if (at < 1) return false;
  return normalized.slice(at + 1) === ALLOWED_SIGNUP_DOMAIN;
}

export function signupDomainErrorMessage(): string {
  return `Only @${ALLOWED_SIGNUP_DOMAIN} email addresses can create an account.`;
}
