// Pages builds without VITE_LEADERBOARD_URL still talk to the live worker.
// Vite dev and the browser tests stay on the local leaderboard unless the
// variable is set, so a missing worker does not change those runs.
export const WORKER_ORIGIN = 'https://ponpon-leaderboard.402711701.workers.dev';

export function workerUrl() {
  const configured = String(import.meta.env.VITE_LEADERBOARD_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  if (import.meta.env.DEV) return '';
  return WORKER_ORIGIN;
}
