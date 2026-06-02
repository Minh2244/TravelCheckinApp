export const formatDateVi = (value: unknown): string => {
  if (value == null || value === "") return "-";

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "-";
    return value.toLocaleDateString("vi-VN");
  }

  if (typeof value === "number") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("vi-VN");
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "-";

    // YYYY-MM-DD (treat as local date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map((x) => Number(x));
      const dt = new Date(y, m - 1, d);
      if (Number.isNaN(dt.getTime())) return "-";
      return dt.toLocaleDateString("vi-VN");
    }

    // YYYY-MM (represent as 01/MM/YYYY to keep DD/MM/YYYY format)
    if (/^\d{4}-\d{2}$/.test(s)) {
      const [y, m] = s.split("-").map((x) => Number(x));
      const dt = new Date(y, m - 1, 1);
      if (Number.isNaN(dt.getTime())) return "-";
      return dt.toLocaleDateString("vi-VN");
    }

    // YYYY (represent as 01/01/YYYY to keep DD/MM/YYYY format)
    if (/^\d{4}$/.test(s)) {
      const y = Number(s);
      const dt = new Date(y, 0, 1);
      if (Number.isNaN(dt.getTime())) return "-";
      return dt.toLocaleDateString("vi-VN");
    }

    // ISO or other parseable timestamps
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      return dt.toLocaleDateString("vi-VN");
    }

    return s;
  }

  return "-";
};

export const formatDateTimeVi = (value: unknown): string => {
  if (value == null || value === "") return "-";

  const toOut = (dt: Date) => {
    if (Number.isNaN(dt.getTime())) return "-";
    return dt.toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  if (value instanceof Date) return toOut(value);

  if (typeof value === "number") {
    const dt = new Date(value);
    return toOut(dt);
  }

  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return "-";

    // YYYY-MM-DD (treat as local date at 00:00)
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map((x) => Number(x));
      const dt = new Date(y, m - 1, d, 0, 0, 0);
      return toOut(dt);
    }

    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return toOut(dt);

    return s;
  }

  return "-";
};
