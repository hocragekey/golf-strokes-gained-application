import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { par3ThreePutt, par4, roundInput } from '../test/fixtures';
import { createTestStore, renderWithProviders } from '../test/render';
import { Backup } from './Backup';
import { CardGuide } from './CardGuide';
import { Dashboard } from './Dashboard';
import { RoundDetail } from './RoundDetail';
import { RoundEntry } from './RoundEntry';
import { Rounds } from './Rounds';

async function seeded() {
  const store = createTestStore();
  const { round } = await store.saveRound({
    ...roundInput([par4, par3ThreePutt]),
    notes: 'Windy',
  });
  return { store, round };
}

describe('Dashboard', () => {
  it('shows the hero and how it works when there are no rounds', async () => {
    renderWithProviders(<Dashboard />);
    expect(
      await screen.findByRole('heading', { name: 'Improve your golf game' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get the card guide & QR code' })).toHaveAttribute(
      'href',
      '/guide',
    );
    expect(screen.getByRole('link', { name: 'Enter a round' })).toHaveAttribute(
      'href',
      '/rounds/new',
    );
    expect(screen.getByRole('list', { name: 'How it works' })).toBeInTheDocument();
  });

  it('shows strokes gained, priorities and buckets', async () => {
    const { store } = await seeded();
    renderWithProviders(<Dashboard />, { store });
    expect(await screen.findByText('Practice priorities')).toBeInTheDocument();
    expect(screen.getByText('1 round, 2 holes')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Practice this first' })).toHaveTextContent('Drill');
    expect(screen.getByText('Enter another round to see a trend.')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Strokes gained by category' })).toHaveTextContent(
      'Putting',
    );
    expect(screen.getByText('100–150 yds')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Range'), '0');
    expect(screen.getByLabelText('Range')).toHaveValue('0');
  });

  it('switches the comparison baseline', async () => {
    const { store } = await seeded();
    renderWithProviders(<Dashboard />, { store });
    expect(await screen.findByText(/vs PGA Tour baseline/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Compare against'), 'scratch');
    expect(await screen.findByText(/vs Scratch \(est\.\) baseline/)).toBeInTheDocument();
    expect(localStorage.getItem('golf-sg.baseline')).toBe('scratch');
    localStorage.clear();
  });

  it('shows errors', async () => {
    const store = createTestStore();
    vi.spyOn(store, 'getStats').mockRejectedValue(new Error('storage unavailable'));
    renderWithProviders(<Dashboard />, { store });
    expect(await screen.findByRole('alert')).toHaveTextContent('storage unavailable');
  });
});

describe('Rounds', () => {
  it('lists rounds with SG columns', async () => {
    const { store, round } = await seeded();
    renderWithProviders(<Rounds />, { store });
    const link = await screen.findByRole('link', { name: '2026-05-01' });
    expect(link).toHaveAttribute('href', `/rounds/${round.id}`);
    expect(screen.getByText('8 (+1)')).toBeInTheDocument();
    expect(screen.getByText('(2 holes)')).toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    renderWithProviders(<Rounds />);
    expect(await screen.findByText('No rounds yet.')).toBeInTheDocument();
  });
});

describe('RoundDetail', () => {
  it('renders the round and deletes it', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { store, round } = await seeded();
    renderWithProviders(<RoundDetail />, {
      store,
      route: `/rounds/${round.id}`,
      path: '/rounds/:id',
    });
    expect(await screen.findByText('Pebble Creek')).toBeInTheDocument();
    expect(screen.getByText(/Windy/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      `/rounds/${round.id}/edit`,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    expect(await store.listRounds()).toEqual([]);
  });

  it('shows not found', async () => {
    renderWithProviders(<RoundDetail />, { route: '/rounds/nope', path: '/rounds/:id' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Round not found');
  });
});

describe('RoundEntry', () => {
  const button = (name: string | RegExp) => screen.getByRole('button', { name });

  it('asks one question at a time without any course setup', async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    renderWithProviders(<RoundEntry />, { store, route: '/rounds/new', path: '/rounds/new' });
    await user.click(await screen.findByRole('button', { name: 'Start with hole 1' }));

    expect(screen.getByRole('heading', { name: 'Hole 1: par and yardage?' })).toBeInTheDocument();
    expect(button('Next')).toBeDisabled();
    await user.type(screen.getByLabelText('Yards'), '410');
    await user.click(button('Next'));

    await user.click(button('5 Bogey'));
    expect(screen.getByRole('heading', { name: 'Where did your drive finish?' })).toBeVisible();
    await user.click(button('Right'));
    await user.type(screen.getByLabelText('Approach yards'), '165');
    await user.click(button('Rough'));
    await user.click(button('Next'));
    await user.click(button('Missed short'));
    await user.click(button('1'));
    await user.type(screen.getByLabelText('Short-game yards'), '15');
    await user.click(button('Bunker'));
    await user.click(button('Next'));
    await user.click(button('1'));
    await user.type(screen.getByLabelText('First putt'), '4');
    await user.click(button('Next'));
    await user.click(button('None'));

    expect(screen.getByRole('heading', { name: 'Hole 1 summary' })).toBeInTheDocument();
    expect(screen.getByText('5 R 165r Sh 1@15s 1@4')).toBeInTheDocument();
    expect(screen.getByText('Looks good.')).toBeInTheDocument();
    expect(button('Go to hole 1')).toHaveClass('done');

    await user.click(button('Finish after 1 hole'));
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    const [saved] = await store.listRounds();
    expect(saved).toMatchObject({ score: 5, toPar: 1, holesPlayed: 1, courseName: '' });
    expect(await store.db.courses.count()).toBe(0);
  });

  it('accepts the card line as a shortcut', async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    renderWithProviders(<RoundEntry />, { store, route: '/rounds/new', path: '/rounds/new' });
    await user.type(await screen.findByLabelText('Course (optional)'), 'Pebble Creek');
    await user.click(button('Start with hole 1'));
    await user.click(button('Par 4'));
    await user.type(screen.getByLabelText('Yards'), '400');
    await user.click(button('Next'));

    expect(screen.getByRole('heading', { name: 'What did you score?' })).toBeInTheDocument();
    await user.click(screen.getByText('Type the card line instead'));
    await user.type(screen.getByLabelText('Card line'), 'nonsense');
    await user.click(button('Apply'));
    expect(screen.getByText(/Start with the score/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Card line'));
    await user.type(screen.getByLabelText('Card line'), '5 R 165r Sh 1@15s 1@4{Enter}');
    expect(screen.getByText('Looks good.')).toBeInTheDocument();
    await user.click(button('Finish after 1 hole'));
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    const [saved] = await store.listRounds();
    expect(saved).toMatchObject({ courseName: 'Pebble Creek', score: 5 });
    expect(await store.db.courses.count()).toBe(0);
  });
});

describe('Backup', () => {
  it('downloads all data as a JSON file', async () => {
    const createObjectURL = vi.fn(() => 'blob:data');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { store } = await seeded();
    renderWithProviders(<Backup />, { store });
    expect(screen.queryByLabelText(/Import/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download my data' }));
    expect(await screen.findByText('Downloaded 1 round.')).toBeInTheDocument();
    expect(click).toHaveBeenCalled();
  });
});

describe('App shell', () => {
  it('redirects the old backup link to My data', async () => {
    renderWithProviders(<App />, { route: '/backup' });
    expect(await screen.findByRole('heading', { name: 'My data' })).toBeInTheDocument();
  });

  it('prints the card guide', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderWithProviders(<CardGuide />);
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
    expect(screen.getByText('1st putt')).toBeInTheDocument();
    expect(screen.getByText('5 R 165r Sh 1@15s 1@4')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'QR code linking to the card guide' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(7 + 1 + 3 + 18 + 1);
  });

  it('shows not found and the offline badge', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderWithProviders(<App />, { route: '/nope' });
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Card guide' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'My data' })).toHaveAttribute('href', '/data');
    });
  });
});
