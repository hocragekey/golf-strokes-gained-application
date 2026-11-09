import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { courseInput, par3ThreePutt, par4 } from '../test/fixtures';
import { createTestStore, renderWithProviders } from '../test/render';
import { Backup } from './Backup';
import { CardGuide } from './CardGuide';
import { Courses } from './Courses';
import { Dashboard } from './Dashboard';
import { RoundDetail } from './RoundDetail';
import { RoundEntry } from './RoundEntry';
import { Rounds } from './Rounds';

async function seeded() {
  const store = createTestStore();
  const course = await store.saveCourse(courseInput);
  const { round } = await store.saveRound({
    courseId: course.id,
    playedOn: '2026-05-01',
    notes: 'Windy',
    holes: [par4, par3ThreePutt],
  });
  return { store, course, round };
}

describe('Dashboard', () => {
  it('shows onboarding when there are no rounds', async () => {
    renderWithProviders(<Dashboard />);
    expect(await screen.findByText('Welcome')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'card guide' })).toHaveAttribute('href', '/guide');
  });

  it('shows strokes gained, priorities and buckets', async () => {
    const { store } = await seeded();
    renderWithProviders(<Dashboard />, { store });
    expect(await screen.findByText('Practice priorities')).toBeInTheDocument();
    expect(screen.getByText('1 round, 2 holes')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Strokes gained by category' })).toHaveTextContent(
      'Putting',
    );
    expect(screen.getByText('100–150 yds')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Range'), '0');
    expect(screen.getByLabelText('Range')).toHaveValue('0');
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
  it('asks for a course first', async () => {
    renderWithProviders(<RoundEntry />);
    expect(await screen.findByText(/first so we know the par/)).toBeInTheDocument();
  });

  it('validates and saves a round', async () => {
    const user = userEvent.setup();
    const store = createTestStore();
    await store.saveCourse(courseInput);
    renderWithProviders(<RoundEntry />, { store, route: '/rounds/new', path: '/rounds/new' });
    const save = await screen.findByRole('button', { name: 'Calculate strokes gained' });

    await user.click(save);
    expect(await screen.findByText('Enter at least one hole')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Hole 1 score'), '4');
    await user.click(save);
    expect(await screen.findByText('1 hole need attention')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Hole 1 teeResult'), 'fairway');
    await user.type(screen.getByLabelText('Hole 1 approachYards'), '150');
    await user.click(screen.getByLabelText('Hole 1 gir'));
    expect(screen.getByLabelText('Hole 1 missDirection')).toBeDisabled();
    await user.type(screen.getByLabelText('Hole 1 firstPuttFeet'), '20');
    await user.type(screen.getByLabelText('Hole 1 putts'), '2');
    await user.click(save);

    expect(await screen.findByText('navigated')).toBeInTheDocument();
    const [saved] = await store.listRounds();
    expect(saved).toMatchObject({ score: 4, holesPlayed: 1 });
  });

  it('loads an existing round for editing', async () => {
    const { store, round } = await seeded();
    renderWithProviders(<RoundEntry />, {
      store,
      route: `/rounds/${round.id}/edit`,
      path: '/rounds/:id/edit',
    });
    expect(await screen.findByText('Edit round')).toBeInTheDocument();
    expect(await screen.findByLabelText('Hole 1 approachYards')).toHaveValue(150);
    expect(screen.getByLabelText('Hole 2 putts')).toHaveValue(3);
    await userEvent.click(screen.getByRole('button', { name: 'Save round' }));
    expect(await screen.findByText('navigated')).toBeInTheDocument();
  });
});

describe('Courses', () => {
  it('creates a nine-hole course', async () => {
    const user = userEvent.setup();
    const { store } = renderWithProviders(<Courses />);
    await user.click(await screen.findByRole('button', { name: 'Add course' }));
    await user.click(screen.getByRole('button', { name: 'Add course' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('name');

    await user.type(screen.getByLabelText('Course name'), 'Muni');
    await user.selectOptions(screen.getByLabelText('Holes'), '9');
    await user.selectOptions(screen.getByLabelText('Hole 2 par'), '3');
    const yards = screen.getByLabelText('Hole 2 yards');
    await user.clear(yards);
    await user.type(yards, '165');
    await user.click(screen.getByRole('button', { name: 'Add course' }));

    expect(await screen.findByText('Muni')).toBeInTheDocument();
    const [course] = await store.listCourses();
    expect(course?.holes).toHaveLength(9);
    expect(course?.holes[1]).toEqual({ number: 2, par: 3, yardage: 165 });
  });

  it('lists, edits and reports delete conflicts', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { store } = await seeded();
    renderWithProviders(<Courses />, { store });
    const item = (await screen.findByText('Pebble Creek')).closest('li');
    if (!item) throw new Error('expected list item');
    expect(item).toHaveTextContent('White · 9 holes · par 36');
    await user.click(within(item).getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('recorded rounds');
    await user.click(within(item).getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Course name')).toHaveValue('Pebble Creek');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByLabelText('Course name')).not.toBeInTheDocument();
  });
});

describe('Backup', () => {
  it('exports and imports a backup file', async () => {
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const createObjectURL = vi.fn(() => 'blob:backup');
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    const { store } = await seeded();
    const backup = JSON.stringify(await store.exportBackup());

    const target = createTestStore();
    renderWithProviders(<Backup />, { store: target });
    await user.click(screen.getByRole('button', { name: 'Export backup' }));
    expect(await screen.findByText('Exported 0 courses and 0 rounds.')).toBeInTheDocument();
    expect(click).toHaveBeenCalled();

    const file = new File([backup], 'backup.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText('Import backup'), file);
    expect(await screen.findByText('Imported 1 courses and 1 rounds.')).toBeInTheDocument();
    expect(await target.listRounds()).toHaveLength(1);

    await user.upload(
      screen.getByLabelText('Import backup'),
      new File(['{}'], 'bad.json', { type: 'application/json' }),
    );
    expect(await screen.findByText(/Import failed/)).toBeInTheDocument();
  });
});

describe('App shell', () => {
  it('prints the card guide', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderWithProviders(<CardGuide />);
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalled();
    expect(screen.getByText('1st putt')).toBeInTheDocument();
  });

  it('shows not found and the offline badge', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    renderWithProviders(<App />, { route: '/nope' });
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Card guide' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Backup' })).toHaveAttribute('href', '/backup');
    });
  });
});
