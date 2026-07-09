export const PUBLIC_LOUNGE_ID = 'public-lounge';
export const PUBLIC_LOUNGE_NAME = 'Open Lounge';

export const PUBLIC_LOUNGE_ROOM = {
  id: PUBLIC_LOUNGE_ID,
  name: PUBLIC_LOUNGE_NAME,
  userCount: 0,
  persistent: true,
  isDefault: true,
  isPublic: true,
};

/** Every WiFi host always has the open lounge — show it even before the API responds. */
export function withPublicLounge(rooms = []) {
  const list = Array.isArray(rooms) ? [...rooms] : [];
  const loungeIdx = list.findIndex((r) => r.id === PUBLIC_LOUNGE_ID);
  if (loungeIdx === -1) return [PUBLIC_LOUNGE_ROOM, ...list];

  const merged = { ...PUBLIC_LOUNGE_ROOM, ...list[loungeIdx] };
  const rest = list.filter((r) => r.id !== PUBLIC_LOUNGE_ID);
  return [merged, ...rest];
}

export function roomListCount(rooms = []) {
  return withPublicLounge(rooms).length;
}
