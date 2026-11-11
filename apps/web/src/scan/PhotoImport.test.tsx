import type { CardScanResult } from '@golf-sg/shared';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account } from '../auth/context';
import { renderWithProviders } from '../test/render';
import { ScanRejectedError } from '../sync/api';
import { PhotoImport } from './PhotoImport';

const account = vi.hoisted((): { current: Partial<Account> } => ({ current: {} }));
vi.mock('../auth/context', () => ({ useAccount: () => account.current }));
vi.mock('./image', () => ({
  preparePhoto: () => Promise.resolve({ mediaType: 'image/jpeg', image: 'AAAA' }),
}));

const result: CardScanResult = { courseName: 'Pebble Creek', tees: '', holes: [] };
const file = new File(['x'], 'card.jpg', { type: 'image/jpeg' });
const profile = { sub: '1', email: 'a@b.c', name: 'Al' };

beforeEach(() => {
  account.current = { enabled: true, profile: null };
});

describe('PhotoImport', () => {
  it('stays hidden without sign-in support and asks signed-out golfers to sign in', () => {
    account.current = { enabled: false, profile: null };
    const { container } = renderWithProviders(<PhotoImport onRead={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
    account.current = { enabled: true, profile: null };
    renderWithProviders(<PhotoImport onRead={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/account');
  });

  it('reads the photo straight away when there is signal', async () => {
    const onRead = vi.fn();
    account.current = { enabled: true, profile, scanCard: () => Promise.resolve(result) };
    renderWithProviders(<PhotoImport onRead={onRead} />);
    await userEvent.upload(screen.getByLabelText('Fill from a photo of my card'), file);
    await waitFor(() => {
      expect(onRead).toHaveBeenCalledWith(result);
    });
  });

  it('keeps the photo for later when the request fails for lack of signal', async () => {
    const queueScan = vi.fn(() => Promise.resolve());
    account.current = {
      enabled: true,
      profile,
      scanCard: () => Promise.reject(new TypeError('Failed to fetch')),
      queueScan,
    };
    renderWithProviders(<PhotoImport onRead={vi.fn()} />, { route: '/new', path: '/new' });
    await userEvent.upload(screen.getByLabelText('Fill from a photo of my card'), file);
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    expect(queueScan).toHaveBeenCalledWith({ mediaType: 'image/jpeg', image: 'AAAA' });
  });

  it('explains a photo the reader rejects', async () => {
    account.current = {
      enabled: true,
      profile,
      scanCard: () => Promise.reject(new ScanRejectedError("We couldn't read that scorecard.")),
    };
    renderWithProviders(<PhotoImport onRead={vi.fn()} />);
    await userEvent.upload(screen.getByLabelText('Fill from a photo of my card'), file);
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't read that scorecard.");
  });
});
