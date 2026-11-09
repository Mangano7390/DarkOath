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

// Pouvoirs du Roi (plateau Trahison, selon le nombre de joueurs)
export const POWER_ICONS = { INVESTIGATE: '🔍', PEEK: '👁️', SPECIAL_ELECTION: '🗳️', EXECUTE: '🪓' };
export const POWER_LABELS = {
  INVESTIGATE: 'Enquête',
  PEEK: 'Regard sur la pioche',
  SPECIAL_ELECTION: 'Élection spéciale',
  EXECUTE: 'Exécution',
};

// { slot: icon } for the Trahison track, from the server's power_board
export const powerMarks = (board) => {
  const marks = { 6: '☠️' };
  Object.entries(board || {}).forEach(([slot, power]) => { marks[Number(slot)] = POWER_ICONS[power] || '✦'; });
  return marks;
};

// Complot des Traîtres au 2e Décret de Trahison (ajouté à l'icône du Roi s'il y en a une)
export const PLOT_SLOT = 2;
export const plotMark = (board) => {
  const king = (board || {})[String(PLOT_SLOT)];
  return { [PLOT_SLOT]: king ? `${POWER_ICONS[king] || ''}🗡️` : '🗡️' };
};

export const powerLegend = (board) => {
  const seen = [];
  Object.values(board || {}).forEach((p) => { if (!seen.includes(p)) seen.push(p); });
  return seen.map((p) => `${POWER_ICONS[p]} ${POWER_LABELS[p]}`).join(' · ');
};
