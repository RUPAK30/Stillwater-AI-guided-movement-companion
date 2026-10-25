// Validation for the onboarding name field. Shared so the rule is unit-testable
// and identical wherever a name is accepted from the dedicated input.
export type NameCheck = { ok: true; name: string } | { ok: false; message: string };
const NAME = /^\p{L}[\p{L}\p{M}'’-]*(?: \p{L}[\p{L}\p{M}'’-]*)?$/u;

export function validateName(raw: string): NameCheck {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (!name) return { ok: false, message: 'Type a name, or choose “Skip the name”.' };
  if (name.length > 24) return { ok: false, message: 'Keep it to 24 characters or fewer.' };
  if (!NAME.test(name)) return { ok: false, message: 'Just a first name in letters. Hyphens and apostrophes are fine.' };
  return { ok: true, name };
}

/** The message the field sends: explicit, so any valid name is read as a name. */
export const nameMessage = (name: string) => `My name is ${name}`;
