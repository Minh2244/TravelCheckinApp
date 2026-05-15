import axios from "axios";

export type AnyRecord = Record<string, unknown>;

export function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

export function getErrorMessage(error: unknown, fallback = "Có lỗi xảy ra") {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (typeof data === "string" && data.trim()) return data;

    const record = asRecord(data);
    const message = record.message;
    if (typeof message === "string" && message.trim()) return message;

    if (typeof error.message === "string" && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }

  if (error instanceof Error && error.message.trim()) return error.message;

  return fallback;
}
