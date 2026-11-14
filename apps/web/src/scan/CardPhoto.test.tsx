import type { CardReadResult } from '@golf-sg/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '../auth/context';
import { ScanRejectedError } from '../sync/api';
import { renderWithProviders } from '../test/render';
import { CardPhoto } from './CardPhoto';

const account = vi.hoisted((): { current: Partial<Account> } => ({ current: {} }));
vi.mock('../auth/context', () => ({ useAccount: () => account.current }));
vi.mock('./image', () => ({
  preparePhoto: () => Promise.resolve({ mediaType: 'image/jpeg', image: 'AAAA' }),
}));

const card: CardReadResult = {
  courseName: 'Pebble Creek',
  pars: [4, 3],
  tees: [
    { name: 'Blue', yardages: [410, 180] },
    { name: 'White', yardages: [380, 150] },
  ],
  holes: [],
};
const file = new File(['x'], 'card.jpg', { type: 'image/jpeg' });
const profile = { sub: '1', email: 'a@b.c', name: 'Al' };
const snap = () => screen.getByLabelText('Snap your scorecard');

beforeEach(() => {
  account.current = { enabled: true, profile: null };
});

describe('CardPhoto', () => {
  it('stays hidden without sign-in support and asks signed-out golfers to sign in', () => {
    account.current = { enabled: false, profile: null };
    const { container } = renderWithProviders(<CardPhoto onRead={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    account.current = { enabled: true, profile: null };
    renderWithProviders(<CardPhoto onRead={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account');
  });

  it('asks which tees when the card has several rows', async () => {
    const onRead = vi.fn();
    account.current = { enabled: true, profile, readCard: () => Promise.resolve(card) };
    renderWithProviders(<CardPhoto onRead={onRead} />);
    await userEvent.upload(snap(), file);
    expect(await screen.findByText('Which tees are you playing?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /White/ }));
    expect(onRead).toHaveBeenCalledWith(card, 1);
  });

  it('asks which tees were played on a marked card, and skips asking with one row', async () => {
    const marked: CardReadResult = {
      ...card,
      holes: [
        {
          number: 1,
          par: 4,
          yardage: null,
          score: 5,
          drive: 'F',
          putts: 2,
          stats: '150 / 20',
          unsure: false,
        },
      ],
    };
    account.current = { enabled: true, profile, readCard: () => Promise.resolve(marked) };
    const { unmount } = renderWithProviders(<CardPhoto onRead={vi.fn()} />);
    await userEvent.upload(snap(), file);
    expect(await screen.findByText('Which tees did you play?')).toBeInTheDocument();
    unmount();

    const onRead = vi.fn();
    const one = { ...marked, tees: marked.tees.slice(0, 1) };
    account.current = { enabled: true, profile, readCard: () => Promise.resolve(one) };
    renderWithProviders(<CardPhoto onRead={onRead} />);
    await userEvent.upload(snap(), file);
    await waitFor(() => {
      expect(onRead).toHaveBeenCalledWith(one, 0);
    });
  });

  it('keeps the photo for later without signal', async () => {
    const queueScan = vi.fn(() => Promise.resolve());
    account.current = {
      enabled: true,
      profile,
      readCard: () => Promise.reject(new TypeError('Failed to fetch')),
      queueScan,
    };
    renderWithProviders(<CardPhoto onRead={vi.fn()} />, { route: '/new', path: '/new' });
    await userEvent.upload(snap(), file);
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    expect(queueScan).toHaveBeenCalledWith({ mediaType: 'image/jpeg', image: 'AAAA' });
  });

  it('shows the limit message', async () => {
    account.current = {
      enabled: true,
      profile,
      readCard: () => Promise.reject(new ScanRejectedError("You've used today's card photos.")),
    };
    renderWithProviders(<CardPhoto onRead={vi.fn()} />);
    await userEvent.upload(snap(), file);
    expect(await screen.findByRole('alert')).toHaveTextContent("today's card photos");
  });
});
