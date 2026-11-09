/** A signed-in golfer as shown in the UI (from the Google ID token's claims). */
export interface Profile {
  sub: string;
  email: string;
  name: string;
  givenName?: string;
  picture?: string;
}

export interface Session {
  profile: Profile;
  token: string;
  /** Epoch ms. */
  expiresAt: number;
}

/** Sign-in provider seam: Google Identity Services in the app, a fake in tests. */
export interface AuthClient {
  readonly enabled: boolean;
  /** Renders the provider's button; `onSignIn` receives every new session. */
  renderButton(el: HTMLElement, onSignIn: (session: Session) => void): Promise<void>;
  /** Tries to get a fresh token without interaction; null if the golfer must click again. */
  refresh(): Promise<Session | null>;
  signOut(): void;
}

/** Reads the claims of a Google ID token. The API verifies the signature; this is display only. */
export function sessionFromToken(token: string): Session | null {
  try {
    const payload = token.split('.')[1] ?? '';
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(json, (c) => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const str = (k: string) => (typeof claims[k] === 'string' ? claims[k] : undefined);
    const sub = str('sub');
    if (!sub || typeof claims.exp !== 'number') return null;
    return {
      token,
      expiresAt: claims.exp * 1000,
      profile: {
        sub,
        email: str('email') ?? '',
        name: str('name') ?? str('email') ?? 'Golfer',
        givenName: str('given_name'),
        picture: str('picture'),
      },
    };
  } catch {
    return null;
  }
}

interface GoogleId {
  initialize(config: {
    client_id: string;
    callback: (r: { credential: string }) => void;
    auto_select?: boolean;
    use_fedcm_for_prompt?: boolean;
    itp_support?: boolean;
  }): void;
  renderButton(el: HTMLElement, options: Record<string, string | number>): void;
  prompt(listener?: (n: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void;
  disableAutoSelect(): void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';

/** Google Identity Services, loaded on demand so signed-out and offline use never touch Google. */
export function googleAuthClient(clientId: string): AuthClient {
  let ready: Promise<GoogleId> | undefined;
  const listeners = new Set<(s: Session) => void>();

  function load(): Promise<GoogleId> {
    ready ??= new Promise<GoogleId>((resolve, reject) => {
      const init = () => {
        const id = window.google?.accounts.id;
        if (!id) {
          reject(new Error('Google sign-in is unavailable'));
          return;
        }
        id.initialize({
          client_id: clientId,
          auto_select: true,
          use_fedcm_for_prompt: true,
          itp_support: true,
          callback: ({ credential }) => {
            const session = sessionFromToken(credential);
            if (session) for (const l of listeners) l(session);
          },
        });
        resolve(id);
      };
      if (window.google?.accounts.id) {
        init();
        return;
      }
      const script = document.createElement('script');
      script.src = GSI_SRC;
      script.async = true;
      script.onload = init;
      script.onerror = () => {
        ready = undefined;
        reject(new Error('Could not reach Google sign-in'));
      };
      document.head.append(script);
    });
    return ready;
  }

  return {
    enabled: clientId !== '',
    async renderButton(el, onSignIn) {
      listeners.add(onSignIn);
      const id = await load();
      id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with' });
    },
    async refresh() {
      const id = await load().catch(() => null);
      if (!id) return null;
      return new Promise<Session | null>((resolve) => {
        const timer = setTimeout(() => {
          done(null);
        }, 15000);
        const done = (s: Session | null) => {
          clearTimeout(timer);
          listeners.delete(done);
          resolve(s);
        };
        listeners.add(done);
        id.prompt((n) => {
          if (n.isNotDisplayed() || n.isSkippedMoment()) done(null);
        });
      });
    },
    signOut() {
      window.google?.accounts.id.disableAutoSelect();
    },
  };
}
