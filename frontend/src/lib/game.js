// Shared helpers for the game UI.

export const LAST_ROOM_KEY = 'darkoath_last_room';

export const rememberRoom = (code) => {
  try { localStorage.setItem(LAST_ROOM_KEY, code); } catch {}
};

export const forgetRoom = () => {
  try { localStorage.removeItem(LAST_ROOM_KEY); } catch {}
};

// Turn an axios error into a French sentence for a toast.
export const errorMessage = (error, fallback = 'Une erreur est survenue.') => {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (status === 429) return 'Trop de tentatives — patientez un instant.';
  if (status === 401) return 'Session expirée — revenez à l\'accueil.';
  if (!error?.response) return 'Connexion au serveur perdue…';
  return fallback;
};

// Server clock: countdowns use the server's time so a phone with a wrong
// clock still shows the right number of seconds.
let _offset = 0;
export const syncServerClock = (serverTime) => {
  if (!serverTime) return;
  const next = serverTime - Date.now() / 1000;
  // smooth jitter from request latency
  _offset = Math.abs(next - _offset) > 2 ? next : _offset * 0.7 + next * 0.3;
};
export const serverNow = () => Date.now() / 1000 + _offset;

export const ROLE_LABELS = {
  LOYAL: 'Fidèle',
  CONJURE: 'Traître',
  USURPATEUR: 'Tyran',
};
