type Environment = {
  NODE_ENV?: string;
  NEXT_PUBLIC_APP_MODE?: string;
  NEXT_PUBLIC_API_BASE_URL?: string;
  NEXT_PUBLIC_AUTH_LOGIN_PATH?: string;
  NEXT_PUBLIC_AUTH_LOGOUT_PATH?: string;
  NEXT_PUBLIC_ENABLE_PREVIEW?: string;
};

function optionalPath(value: string | undefined, name: string): string | null {
  if (!value?.trim()) return null;
  if (!/^\/(?!\/)[^\\?#\s]*$/.test(value) || /(?:^|\/)\.\.(?:\/|$)/.test(value)) {
    throw new Error(`${name} must be an approved relative API path beginning with a single slash.`);
  }
  return value;
}

export function parseConfiguration(env: Environment) {
  const appMode = env.NEXT_PUBLIC_APP_MODE || 'connected';
  if (appMode !== 'connected' && appMode !== 'foundation') {
    throw new Error('NEXT_PUBLIC_APP_MODE must be connected or foundation.');
  }
  let apiBaseUrl: string | null = null;
  if (env.NEXT_PUBLIC_API_BASE_URL?.trim()) {
    let url: URL;
    try {
      url = new URL(env.NEXT_PUBLIC_API_BASE_URL);
    } catch {
      throw new Error('NEXT_PUBLIC_API_BASE_URL must be an absolute HTTP(S) API origin.');
    }
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/'
    ) {
      throw new Error(
        'NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) origin without credentials, a path, query or fragment.',
      );
    }
    apiBaseUrl = url.origin;
  }
  if (appMode === 'connected' && !apiBaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_API_BASE_URL is required in connected mode. Use NEXT_PUBLIC_APP_MODE=foundation only for independent frontend development.',
    );
  }
  if (
    env.NEXT_PUBLIC_ENABLE_PREVIEW &&
    !['true', 'false'].includes(env.NEXT_PUBLIC_ENABLE_PREVIEW)
  ) {
    throw new Error('NEXT_PUBLIC_ENABLE_PREVIEW must be true or false.');
  }
  return Object.freeze({
    appMode,
    apiBaseUrl: appMode === 'connected' ? apiBaseUrl : null,
    loginPath: optionalPath(env.NEXT_PUBLIC_AUTH_LOGIN_PATH, 'NEXT_PUBLIC_AUTH_LOGIN_PATH'),
    logoutPath: optionalPath(env.NEXT_PUBLIC_AUTH_LOGOUT_PATH, 'NEXT_PUBLIC_AUTH_LOGOUT_PATH'),
    previewEnabled: env.NODE_ENV === 'development' && env.NEXT_PUBLIC_ENABLE_PREVIEW === 'true',
  });
}

export const config = parseConfiguration({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_APP_MODE: process.env.NEXT_PUBLIC_APP_MODE,
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_AUTH_LOGIN_PATH: process.env.NEXT_PUBLIC_AUTH_LOGIN_PATH,
  NEXT_PUBLIC_AUTH_LOGOUT_PATH: process.env.NEXT_PUBLIC_AUTH_LOGOUT_PATH,
  NEXT_PUBLIC_ENABLE_PREVIEW: process.env.NEXT_PUBLIC_ENABLE_PREVIEW,
});
