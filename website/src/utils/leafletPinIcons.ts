import L from "leaflet";

const iconCache = new Map<string, L.DivIcon>();

export const PIN_COLORS = {
  owner: "#3b82f6",
  ownerSelected: "#2563eb",
  userCreated: "#f59e0b",
  userCreatedSelected: "#d97706",
  search: "#22c55e",
  picked: "#fbbf24",
  myPosition: "#ef4444",
} as const;

export type PinKind = keyof typeof PIN_COLORS;

export const createPinIcon = (color: string, scale = 1): L.DivIcon => {
  const key = `${color}::${scale.toFixed(3)}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const width = Math.round(26 * scale);
  const height = Math.round(42 * scale);
  const anchorX = Math.round(width / 2);
  const anchorY = height;

  const icon = L.divIcon({
    className: "",
    html: `
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="${width}"
        height="${height}"
        viewBox="0 0 26 42"
        style="display:block;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35));"
      >
        <path
          d="M13 41c-.5 0-1-.2-1.3-.6C9.1 37.2 2 28.5 2 19.3 2 9.3 6.9 2 13 2s11 7.3 11 17.3c0 9.2-7.1 17.9-9.7 21.1-.3.4-.8.6-1.3.6z"
          fill="${color}"
          stroke="#ffffff"
          stroke-width="2"
        />
        <circle cx="13" cy="15" r="5" fill="#ffffff" opacity="0.95" />
      </svg>
    `.trim(),
    iconSize: [width, height],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, Math.round(-34 * scale)],
  });

  iconCache.set(key, icon);
  return icon;
};

export const getPinIconByKind = (kind: PinKind): L.DivIcon => {
  const scale = kind.endsWith("Selected") ? 1.1 : 1;
  return createPinIcon(PIN_COLORS[kind], scale);
};

export const getLocationPinIcon = (opts: {
  isUserCreated: boolean;
  isSelected: boolean;
}): L.DivIcon => {
  const kind: PinKind = opts.isUserCreated
    ? opts.isSelected
      ? "userCreatedSelected"
      : "userCreated"
    : opts.isSelected
      ? "ownerSelected"
      : "owner";
  return getPinIconByKind(kind);
};
