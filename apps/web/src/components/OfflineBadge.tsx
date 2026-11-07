import { useSyncExternalStore } from 'react';

function subscribe(callback: () => void) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

export function OfflineBadge() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine);
  if (online) return null;
  return (
    <span className="offline-badge" role="status" title="Your data is stored on this device">
      Offline · everything still works
    </span>
  );
}
