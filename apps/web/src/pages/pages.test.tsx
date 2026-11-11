import { cleanup, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { ResumeRound } from '../components/ResumeRound';
import { par3ThreePutt, par4, roundInput } from '../test/fixtures';
import { createTestStore, renderWithProviders } from '../test/render';
import { CardGuide } from './CardGuide';
import { Dashboard } from './Dashboard';
import { RoundDetail } from './RoundDetail';
import { RoundEntry } from './RoundEntry';
import { Rounds } from './Rounds';

afterEach(() => {
  localStorage.clear();
});

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
    expect(screen.getByRole('link', { name: 'How to mark your card' })).toHaveAttribute(
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
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Range')).toHaveValue('0');
  });

  it('switches the comparison baseline', async () => {
    const { store } = await seeded();
    renderWithProviders(<Dashboard />, { store });
    expect(await screen.findByText(/vs PGA Tour baseline/)).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Compare against'), 'scratch');
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
    expect(screen.getByText('Practice priorities')).toBeInTheDocument();
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
    expect(
      screen.getByRole('heading', { name: 'Did you chip, pitch or play from a bunker?' }),
    ).toBeVisible();
    await user.click(button('Short'));
    await user.click(button('1'));
    await user.type(screen.getByLabelText('Short-game yards'), '15');
    await user.click(button('Bunker'));
    await user.click(button('Next'));
    await user.click(button('1'));
    await user.type(screen.getByLabelText('First putt'), '4');
    await user.click(button('Next'));
    await user.click(button('None'));

    expect(screen.getByRole('heading', { name: 'Hole 1 summary' })).toBeInTheDocument();
    expect(screen.getByText('5 R 1 165 / s15 / 4')).toBeInTheDocument();
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
    expect(screen.getByText(/Type score, drive, putts/)).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Card line'));
    await user.type(screen.getByLabelText('Card line'), '5 R 2 165 / s15 / 4{Enter}');
    expect(screen.getByText('Looks good.')).toBeInTheDocument();
    await user.click(button('Finish after 1 hole'));
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    const [saved] = await store.listRounds();
    expect(saved).toMatchObject({ courseName: 'Pebble Creek', score: 5 });
    expect(await store.db.courses.count()).toBe(0);
  });

  it('keeps a round in progress on the device and resumes at the next hole', async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    const first = renderWithProviders(<RoundEntry />, {
      store,
      route: '/rounds/new',
      path: '/rounds/new',
    });
    await user.type(await screen.findByLabelText('Course (optional)'), 'Pebble Creek');
    await user.click(button('Start with hole 1'));
    await user.click(button('Par 3'));
    await user.type(screen.getByLabelText('Yards'), '160');
    await user.click(button('Next'));
    await user.click(button('3 Par'));
    await user.click(button('None'));
    await user.click(button('2'));
    await user.type(screen.getByLabelText('First putt'), '20');
    await user.click(button('Next'));
    await user.click(button('None'));
    expect(screen.getByText('3 2 20')).toBeInTheDocument();
    first.unmount();

    renderWithProviders(<ResumeRound />);
    expect(screen.getByRole('link', { name: 'Resume at hole 2' })).toBeInTheDocument();
    expect(screen.getByText('Pebble Creek')).toBeInTheDocument();
    cleanup();

    renderWithProviders(<RoundEntry />, { store, route: '/rounds/new', path: '/rounds/new' });
    expect(
      await screen.findByRole('heading', { name: 'Hole 2: par and yardage?' }),
    ).toBeInTheDocument();
    expect(button('Go to hole 1')).toHaveClass('done');
    await user.click(button('Finish after 1 hole'));
    expect(await screen.findByText('navigated')).toBeInTheDocument();
    expect(localStorage.getItem('golf-sg.round-in-progress')).toBeNull();
  });

  it('resumes an unfinished hole, and keeps par and yardage typed before the first score', async () => {
    const user = userEvent.setup();
    const first = renderWithProviders(<RoundEntry />, {
      route: '/rounds/new',
      path: '/rounds/new',
    });
    await user.click(await screen.findByRole('button', { name: 'Start with hole 1' }));
    await user.click(button('Par 3'));
    await user.type(screen.getByLabelText('Yards'), '160');
    first.unmount();

    const second = renderWithProviders(<RoundEntry />, {
      route: '/rounds/new',
      path: '/rounds/new',
    });
    expect(await screen.findByLabelText('Yards')).toHaveValue(160);
    await user.click(button('Next'));
    await user.click(button('4 Bogey'));
    second.unmount();

    renderWithProviders(<RoundEntry />, { route: '/rounds/new', path: '/rounds/new' });
    expect(await screen.findByRole('heading', { name: 'Hole 1 summary' })).toBeInTheDocument();
  });
});

describe('App shell', () => {
  it('sends old data links home', async () => {
    renderWithProviders(<App />, { route: '/backup' });
    expect(
      await screen.findByRole('heading', { name: 'Improve your golf game' }),
    ).toBeInTheDocument();
  });

  it('shows how to mark the course scorecard, with a QR code to share it', () => {
    renderWithProviders(<CardGuide />);
    expect(screen.getByRole('heading', { name: 'How to mark your scorecard' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Example front nine/ })).toBeInTheDocument();
    expect(screen.getByText('175 / s15 / 8')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'QR code linking to the card guide' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Scan to open this guide')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print' })).not.toBeInTheDocument();
  });

  it('shows not found without surfacing storage or connectivity', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderWithProviders(<App />, { route: '/nope' });
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Card guide' })).toBeInTheDocument();
    expect(screen.queryByText(/Offline/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'My data' })).not.toBeInTheDocument();
  });
});
