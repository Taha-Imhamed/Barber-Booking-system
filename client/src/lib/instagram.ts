export function normalizeInstagramUrl(input?: string | null): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;

  const withoutAt = raw.startsWith("@") ? raw.slice(1) : raw;
  if (/^https?:\/\//i.test(withoutAt)) return withoutAt;

  if (withoutAt.includes("instagram.com")) {
    const cleaned = withoutAt.replace(/^\/+/, "").replace(/^https?:\/\//i, "");
    return `https://${cleaned}`;
  }

  return `https://www.instagram.com/${withoutAt.replace(/^\/+/, "")}`;
}
