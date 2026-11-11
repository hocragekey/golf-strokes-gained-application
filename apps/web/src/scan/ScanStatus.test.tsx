import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTestStore, renderWithProviders } from '../test/render';
import { enqueueScan } from './queue';
import { ScanStatus } from './ScanStatus';

const enabled = vi.hoisted(() => ({ value: true }));
vi.mock('./features', () => ({ cardScanEnabled: () => enabled.value }));

afterEach(() => {
  localStorage.clear();
  enabled.value = true;
});

describe('ScanStatus', () => {
  it('says a queued photo is waiting for signal', async () => {
    const store = createTestStore();
    await enqueueScan(store.db, { mediaType: 'image/jpeg', image: 'AAAA' });
    renderWithProviders(<ScanStatus />, { store });
    expect(await screen.findByText(/read as soon as you have signal/)).toBeInTheDocument();
  });

  it('shows and dismisses a notice about a photo that could not be read', async () => {
    localStorage.setItem('golf-sg.scan-notice', "We couldn't read that scorecard.");
    renderWithProviders(<ScanStatus />);
    expect(screen.getByText(/We couldn't read that scorecard/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText(/We couldn't read that scorecard/)).not.toBeInTheDocument();
  });

  it('shows nothing while card reading is switched off', () => {
    enabled.value = false;
    localStorage.setItem('golf-sg.scan-notice', 'x');
    const { container } = renderWithProviders(<ScanStatus />);
    expect(container).toBeEmptyDOMElement();
  });
});
