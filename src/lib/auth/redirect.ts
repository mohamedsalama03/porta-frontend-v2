export function safeReturnPath(value: string | null | undefined, fallback = '/dashboard'): string {
  if (!value) return fallback;
  try {
    let decoded = value;
    for (let pass = 0; pass < 3; pass++) {
      if (
        !decoded.startsWith('/') ||
        decoded.startsWith('//') ||
        /[\\\u0000-\u001f\u007f]/.test(decoded)
      )
        return fallback;
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    }
    if (
      !decoded.startsWith('/') ||
      decoded.startsWith('//') ||
      /[\\\u0000-\u001f\u007f]/.test(decoded)
    )
      return fallback;
    const parsed = new URL(decoded, 'https://return-path.invalid');
    if (parsed.origin !== 'https://return-path.invalid' || /^\/login(?:\/|$)/.test(parsed.pathname))
      return fallback;
    const original = new URL(value, 'https://return-path.invalid');
    return `${original.pathname}${original.search}${original.hash}`;
  } catch {
    return fallback;
  }
}

export function loginRedirectUrl(returnTo?: string, expired = false): string {
  const params = new URLSearchParams({ returnTo: safeReturnPath(returnTo) });
  if (expired) params.set('reason', 'expired');
  return `/login?${params.toString()}`;
}
