import { useState } from 'react';
import { useStore } from '../data/context';

export function Backup() {
  const store = useStore();
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    const backup = await store.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strokes-gained-data-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(
      `Downloaded ${String(backup.rounds.length)} round${backup.rounds.length === 1 ? '' : 's'}.`,
    );
  }

  return (
    <section className="card stack">
      <div>
        <h2>My data</h2>
        <p className="muted">
          Your rounds are stored on this device and work without an internet connection. Sign in to
          keep them in your account across devices, or download a copy as a JSON file.
        </p>
      </div>
      <div className="actions">
        <button className="primary" onClick={() => void handleExport()}>
          Download my data
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
