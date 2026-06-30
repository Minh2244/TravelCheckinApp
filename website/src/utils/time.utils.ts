export const isLocationOpen = (openingHours: any): boolean => {
  if (!openingHours) return true;
  let parsed = openingHours;
  if (typeof openingHours === "string") {
    try { parsed = JSON.parse(openingHours); } catch { return true; }
  }
  if (!parsed || typeof parsed !== "object" || !parsed.open || !parsed.close) return true;

  const openStr = String(parsed.open);
  const closeStr = String(parsed.close);

  if (openStr === "00:00" && (closeStr === "23:59" || closeStr === "00:00")) return true;

  const parseMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
  };

  const openMins = parseMins(openStr);
  const closeMins = parseMins(closeStr);
  
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  if (openMins <= closeMins) {
    return nowMins >= openMins && nowMins <= closeMins;
  } else {
    return nowMins >= openMins || nowMins <= closeMins;
  }
};
