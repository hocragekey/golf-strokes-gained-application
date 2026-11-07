import { useState, type ChangeEvent } from 'react';
import { useStore } from '../data/context';
import { useImportBackup } from '../data/hooks';

export function Backup() {
  const store = useStore();
  const importBackup = useImportBackup();
  const [message, setMessage] = useState<string | null>(null);

  async function handleExport() {
    const backup = await store.exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `strokes-gained-backup-${backup.exportedAt.slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`Exported ${backup.courses.length} courses and ${backup.rounds.length} rounds.`);
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('Importing replaces all courses and rounds on this device. Continue?')) {
      return;
    }
    try {
      const result = await importBackup.mutateAsync(JSON.parse(await file.text()) as unknown);
      setMessage(`Imported ${result.courses} courses and ${result.rounds} rounds.`);
    } catch (err) {
      setMessage(`Import failed: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  return (
    <section className="card stack">
      <div>
        <h2>Backup &amp; restore</h2>
        <p className="muted">
          Your rounds are stored on this device and work without an internet connection. Export a
          backup file regularly, or to move your data to another device.
        </p>
      </div>
      <div className="actions">
        <button className="primary" onClick={() => void handleExport()}>
          Export backup
        </button>
        <label className="button">
          Import backup
          <input
            className="sr-only"
            type="file"
            accept="application/json,.json"
            onChange={(e) => void handleImport(e)}
          />
        </label>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
