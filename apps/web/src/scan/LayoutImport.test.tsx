import type { CardLayoutResult } from '@golf-sg/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '../auth/context';
import { ScanRejectedError } from '../sync/api';
import { renderWithProviders } from '../test/render';
import { LayoutImport } from './LayoutImport';

const account = vi.hoisted((): { current: Partial<Account> } => ({ current: {} }));
vi.mock('../auth/context', () => ({ useAccount: () => account.current }));
vi.mock('./image', () => ({
  preparePhoto: () => Promise.resolve({ mediaType: 'image/jpeg', image: 'AAAA' }),
}));

const layout: CardLayoutResult = {
  courseName: 'Pebble Creek',
  pars: [4, 3],
  tees: [
    { name: 'Blue', yardages: [410, 180] },
    { name: 'White', yardages: [380, 150] },
  ],
};
const file = new File(['x'], 'card.jpg', { type: 'image/jpeg' });
const profile = { sub: '1', email: 'a@b.c', name: 'Al' };
const snap = () => screen.getByLabelText(/Snap the scorecard/);

beforeEach(() => {
  account.current = { enabled: true, profile: null };
});

describe('LayoutImport', () => {
  it('asks signed-out golfers to sign in', () => {
    renderWithProviders(<LayoutImport onRead={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account');
  });

  it('asks which tees when the card has several rows', async () => {
    const onRead = vi.fn();
    account.current = { enabled: true, profile, readLayout: () => Promise.resolve(layout) };
    renderWithProviders(<LayoutImport onRead={onRead} />);
    await userEvent.upload(snap(), file);
    await userEvent.click(await screen.findByRole('button', { name: /White/ }));
    expect(onRead).toHaveBeenCalledWith(layout, 1);
  });

  it('uses the only tee row without asking', async () => {
    const onRead = vi.fn();
    const one = { ...layout, tees: layout.tees.slice(0, 1) };
    account.current = { enabled: true, profile, readLayout: () => Promise.resolve(one) };
    renderWithProviders(<LayoutImport onRead={onRead} />);
    await userEvent.upload(snap(), file);
    await waitFor(() => {
      expect(onRead).toHaveBeenCalledWith(one, 0);
    });
  });

  it('shows the limit message and falls back to typing without signal', async () => {
    account.current = {
      enabled: true,
      profile,
      readLayout: () => Promise.reject(new ScanRejectedError("You've used today's card photos.")),
    };
    const { unmount } = renderWithProviders(<LayoutImport onRead={vi.fn()} />);
    await userEvent.upload(snap(), file);
    expect(await screen.findByRole('alert')).toHaveTextContent("today's card photos");
    unmount();
    account.current = {
      enabled: true,
      profile,
      readLayout: () => Promise.reject(new TypeError('Failed to fetch')),
    };
    renderWithProviders(<LayoutImport onRead={vi.fn()} />);
    await userEvent.upload(snap(), file);
    expect(await screen.findByRole('alert')).toHaveTextContent('No signal');
  });
});
