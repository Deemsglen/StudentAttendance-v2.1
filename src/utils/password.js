export function passwordStrength(value = "") {
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/\d/.test(value) && /[^\w\s]/.test(value)) score++;
  if (/^(password|qwerty|123456|abcdef|letmein)/i.test(value))
    score = Math.min(score, 1);
  return {
    score,
    label: value
      ? ["Very weak", "Weak", "Fair", "Good", "Strong"][score]
      : "Not entered",
    hint: "Prefer 12+ characters with a mix of words, uppercase, numbers and symbols. This meter is guidance, not a security guarantee.",
  };
}
