/**
 * Where to send someone after they follow an emailed link. Only a page on this site is allowed: a path that starts
 * with a single slash. Anything else (another website, a protocol-relative "//evil.com", a backslash trick) goes Home.
 */
export function safeNext(value: string | null | undefined): string {
  if (!value) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  // Control characters and spaces can be used to disguise an address.
  if (/[\u0000-\u001f\u007f\s]/.test(value)) return "/";
  return value;
}
