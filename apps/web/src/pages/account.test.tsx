import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountProvider } from '../auth/context';
import { sessionFromToken, type AuthClient } from '../auth/google';
import { fakeServer } from '../test/fake-server';
import { par4, roundInput } from '../test/fixtures';
import { createTestStore, renderWithProviders } from '../test/render';
import { Account } from './Account';

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

describe('Account page', () => {
  it('explains that accounts are off when no client ID is configured', () => {
    setup(fakeClient(false));
    expect(screen.getByText(/isn't available in this build/)).toBeInTheDocument();
  });

  it('signs in and uploads rounds already on the device without showing sync controls', async () => {
    const { store, server } = setup();
    await store.saveRound(roundInput([par4]));
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    expect(await screen.findByText('Pat Golfer')).toBeInTheDocument();
    await waitFor(() => {
      expect(server.items.size).toBe(1);
    });
    expect(screen.queryByRole('button', { name: 'Sync now' })).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('signs out and removes uploaded rounds from the device', async () => {
    const { store } = setup();
    await store.saveRound(roundInput([par4]));
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Fake Google' })).toBeInTheDocument();
    expect(await store.db.rounds.count()).toBe(0);
  });

  it('deletes account data on the server and the device after confirmation', async () => {
    const { store, server } = setup();
    await store.saveRound(roundInput([par4]));
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    await waitFor(() => {
      expect(server.items.size).toBe(1);
    });
    const section = screen.getByRole('heading', { name: 'Delete account data' }).parentElement;
    await userEvent.click(within(section!).getByRole('button', { name: 'Delete account data' }));
    expect(
      await screen.findByRole('button', { name: 'Fake Google' }, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(server.items.size).toBe(0);
    expect(await store.db.rounds.count()).toBe(0);
  });

  it('removes uploaded rounds on sign-out even when the last upload fails', async () => {
    const { store, server } = setup();
    await store.saveRound(roundInput([par4]));
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    await waitFor(() => {
      expect(server.items.size).toBe(1);
    });
    server.api.push = () => Promise.reject(new Error('No signal'));
    const unsent = await store.saveRound(roundInput([par4]));
    await userEvent.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Fake Google' })).toBeInTheDocument();
    expect((await store.db.rounds.toArray()).map((r) => r.id)).toEqual([unsent.round.id]);
  });

  it('keeps unsent rounds on sign-out and uploads them at the next sign-in', async () => {
    const { store, server } = setup();
    const push = server.api.push.bind(server.api);
    server.api.push = () => Promise.reject(new Error('No signal'));
    await store.saveRound(roundInput([par4]));
    await userEvent.click(await screen.findByRole('button', { name: 'Fake Google' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: 'Fake Google' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(await store.db.rounds.count()).toBe(1);

    server.api.push = push;
    await userEvent.click(screen.getByRole('button', { name: 'Fake Google' }));
    await waitFor(() => {
      expect(server.items.size).toBe(1);
    });
  });
});
