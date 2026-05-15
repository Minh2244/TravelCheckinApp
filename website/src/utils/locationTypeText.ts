export const locationTypeToVi = (raw: unknown): string => {
  const t = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (!t) return "-";

  if (t === "hotel") return "Khách sạn";
  if (t === "resort") return "Resort";
  if (t === "restaurant" || t === "cafe") return "Ăn uống";
  if (t === "tourist") return "Du lịch";
  if (t === "other") return "Khác";

  return t;
};
