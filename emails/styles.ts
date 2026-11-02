// Signal Terminal palette for email clients (inline styles only; IMPLEMENTATION_PLAN §8.1).
export const colors = {
  canvas: "#0a0b0d",
  surface: "#111318",
  border: "#23262e",
  text: "#f5f7fa",
  muted: "#9aa3b2",
  accent: "#00e5a0",
};

export const body = {
  backgroundColor: colors.canvas,
  color: colors.text,
  fontFamily: "Inter, Arial, sans-serif",
  margin: 0,
};
export const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px 20px",
};
export const card = {
  backgroundColor: colors.surface,
  border: `1px solid ${colors.border}`,
  borderRadius: "8px",
  padding: "16px",
  marginBottom: "12px",
};
export const muted = {
  color: colors.muted,
  fontSize: "14px",
  lineHeight: "1.55",
  margin: "4px 0 0",
};
export const link = { color: colors.text, textDecoration: "underline" };
export const button = {
  backgroundColor: colors.accent,
  color: colors.canvas,
  borderRadius: "6px",
  padding: "8px 12px",
  fontSize: "13px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
  marginTop: "10px",
};
export const footer = {
  color: colors.muted,
  fontSize: "12px",
  lineHeight: "1.5",
  marginTop: "24px",
};
