import axios from "axios";

export interface ManagerBotPayload {
  role: "owner" | "admin";
  route: string;
  text?: string;
  message?: string;
  screen_context?: Record<string, unknown>;
  available_actions?: string[];
  mock_context?: Record<string, unknown>;
}

const DEFAULT_BOT_URL = "http://127.0.0.1:8090";
const DEFAULT_TIMEOUT_MS = 8000;

function getBotBaseUrl(): string {
  return (process.env.AI_MANAGER_BOT_URL || DEFAULT_BOT_URL).replace(/\/+$/, "");
}

function getTimeoutMs(): number {
  const raw = Number(process.env.AI_MANAGER_BOT_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

async function get<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const response = await axios.get<T>(`${getBotBaseUrl()}${path}`, {
    params,
    timeout: getTimeoutMs(),
  });
  return response.data;
}

async function post<T>(path: string, payload: ManagerBotPayload): Promise<T> {
  const response = await axios.post<T>(`${getBotBaseUrl()}${path}`, payload, {
    timeout: getTimeoutMs(),
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
  return response.data;
}

export async function getManagerBotHealth(): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>("/health");
}

export async function getManagerBotSuggestions(
  role: "owner" | "admin",
  route: string,
): Promise<Record<string, unknown>> {
  return get<Record<string, unknown>>("/suggestions", { role, route });
}

export async function chatWithManagerBot(payload: ManagerBotPayload): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>("/chat", payload);
}

export async function planManagerBotAction(payload: ManagerBotPayload): Promise<Record<string, unknown>> {
  return post<Record<string, unknown>>("/plan-action", payload);
}
