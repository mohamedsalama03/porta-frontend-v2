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
    if (/^\/driver(?:\/|$)/.test(parsed.pathname)) {
      // Driver return links may carry only harmless operational filters, never contacts.
      const filters = new URLSearchParams();
      const perPage = original.searchParams.get('per_page');
      if (perPage && /^[1-9]\d{0,2}$/.test(perPage) && Number(perPage) <= 100)
        filters.set('per_page', perPage);
      const status = original.searchParams.get('status');
      if (status && /^[A-Z_]{1,40}$/.test(status)) filters.set('status', status);
      const tripId = original.searchParams.get('trip_id');
      if (tripId && /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(tripId)) filters.set('trip_id', tripId);
      return `${original.pathname}${filters.size ? `?${filters.toString()}` : ''}`;
    }
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
