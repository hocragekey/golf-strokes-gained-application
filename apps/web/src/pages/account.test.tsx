import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '../auth/context';
import { sessionFromToken, type AuthClient } from '../auth/google';
import { fakeServer } from '../test/fake-server';
import { par4, roundInput } from '../test/fixtures';
import { createTestStore, renderWithProviders } from '../test/render';
import { Account, syncLabel } from './Account';

const b64url = (o: object) =>
  btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const token =
  b64url({ alg: 'RS256' }) +
  '.' +
  b64url({
    sub: 'g-123',
    email: 'pat@example.com',
    name: 'Pat Golfer',
    given_name: 'Pat',
    exp: Math.floor(Date.now() / 1000) + 3600,
  }) +
  '.sig';

function fakeClient(enabled = true): AuthClient {
  return {
    enabled,
    renderButton: (el, onSignIn) => {
      const button = document.createElement('button');
      button.textContent = 'Fake Google';
      button.onclick = () => {
        onSignIn(sessionFromToken(token)!);
      };
      el.replaceChildren(button);
      return Promise.resolve();
    },
    refresh: () => Promise.resolve(sessionFromToken(token)),
    signOut: vi.fn(),
  };
}

function setup(client = fakeClient()) {
  const store = createTestStore();
  const server = fakeServer();
  const view = renderWithProviders(
    <AccountProvider client={client} db={store.db} api={server.api}>
      <Account />
    </AccountProvider>,
    { store },
  );
  return { ...view, server };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('sessionFromToken', () => {
  it('reads display claims and expiry', () => {
    const s = sessionFromToken(token);
    expect(s?.profile).toMatchObject({ sub: 'g-123', name: 'Pat Golfer', givenName: 'Pat' });
    expect(sessionFromToken('garbage')).toBeNull();
  });
});

describe('syncLabel', () => {
  it('describes each sync state', () => {
    expect(syncLabel({ state: 'idle', pending: 0 })).toBe('Synced');
    expect(syncLabel({ state: 'idle', pending: 3 })).toBe('3 changes waiting');
    expect(syncLabel({ state: 'offline', pending: 1 })).toBe(
      'Offline, will sync later · 1 change waiting',
    );
    expect(syncLabel({ state: 'signin', pending: 0 })).toBe('Sign in again to sync');
  });
});

describe('Account page', () => {
  it('explains that accounts are off when no client ID is configured', () => {
    setup(fakeClient(false));
    expect(screen.getByText(/not set up in this build/)).toBeInTheDocument();
  });

  it('signs in, uploads rounds already on the device and shows the sync status', async () => {
    const { store, server } = setup();
    await store.saveRound(roundInput([par4]));
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    expect(await screen.findByText('Pat Golfer')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/^Synced/);
    });
    expect(server.items.size).toBe(2);
  });

  it('signs out and optionally removes rounds from the device', async () => {
    const { store } = setup();
    await store.saveRound(roundInput([par4]));
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Fake Google' })).toBeInTheDocument();
    expect(await store.db.rounds.count()).toBe(0);
  });

  it('deletes account data after confirmation and keeps local rounds', async () => {
    const { store, server } = setup();
    await store.saveRound(roundInput([par4]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    await waitFor(() => {
      expect(server.items.size).toBe(2);
    });
    const section = screen.getByRole('heading', { name: 'Delete account data' }).parentElement;
    await userEvent.click(within(section!).getByRole('button', { name: 'Delete account data' }));
    expect(
      await screen.findByRole('button', { name: 'Fake Google' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(server.items.size).toBe(0);
    expect(await store.db.rounds.count()).toBe(1);

    // Signing back in must not restore the deleted account data from this device.
    await userEvent.click(screen.getByRole('button', { name: 'Fake Google' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/^Synced/);
    });
    expect(server.items.size).toBe(0);
  });

  it('refuses to remove rounds from the device while changes have not uploaded', async () => {
    const { store, server } = setup();
    server.api.push = () => Promise.reject(new Error('No signal'));
    await store.saveRound(roundInput([par4]));
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/Sync problem/);
    });
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 changes have not uploaded yet/);
    expect(await store.db.rounds.count()).toBe(1);
    expect(screen.getByText('Pat Golfer')).toBeInTheDocument();
  });
});
