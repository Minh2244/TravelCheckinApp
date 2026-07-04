import axiosClient from "./axiosClient";

export type ManagerAiRole = "owner" | "admin";

export interface ManagerAiSuggestion {
  id: string;
  title: string;
  prompt: string;
  intent_hint?: string;
  risk_level?: string;
  requires_confirmation?: boolean;
}

export interface ManagerAiSuggestionsResponse {
  success: boolean;
  role: ManagerAiRole;
  route: string;
  suggestions: ManagerAiSuggestion[];
  disabled_reason?: string | null;
  message?: string;
}

export interface ManagerAiChatPayload {
  route: string;
  message: string;
  screen_context?: Record<string, unknown>;
  chat_history?: Array<{
    from: "user" | "bot";
    text: string;
  }>;
}

export interface ManagerAiActionPlan {
  command_id?: string;
  action_key?: string;
  requires_confirmation?: boolean;
  risk_level?: string;
  summary?: string;
  warnings?: string[];
  [key: string]: unknown;
}

export interface ManagerAiChatResponse {
  success: boolean;
  intent?: string;
  label?: string;
  confidence?: number;
  risk_level?: string;
  allowed?: boolean;
  answer?: string;
  action_plan?: ManagerAiActionPlan;
  warnings?: string[];
  message?: string;
}

export interface ManagerAiExecutePayload {
  command_id: string;
  action_key: string;
  action_plan: Record<string, unknown>;
}

export interface ManagerAiExecuteResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

function prefixForRole(role: ManagerAiRole) {
  return role === "owner" ? "/owner/ai" : "/admin/ai";
}

const managerAiApi = {
  getSuggestions: async (
    role: ManagerAiRole,
    route: string,
  ): Promise<ManagerAiSuggestionsResponse> => {
    const response = await axiosClient.get<ManagerAiSuggestionsResponse>(
      `${prefixForRole(role)}/suggestions`,
      { params: { route } },
    );
    return response.data;
  },

  chat: async (
    role: ManagerAiRole,
    payload: ManagerAiChatPayload,
  ): Promise<ManagerAiChatResponse> => {
    const response = await axiosClient.post<ManagerAiChatResponse>(
      `${prefixForRole(role)}/chat`,
      payload,
      {
        headers: {
          "x-manager-ai-route": payload.route,
        },
      },
    );
    return response.data;
  },

  executeAction: async (
    role: ManagerAiRole,
    route: string,
    payload: ManagerAiExecutePayload,
  ): Promise<ManagerAiExecuteResponse> => {
    const response = await axiosClient.post<ManagerAiExecuteResponse>(
      `${prefixForRole(role)}/execute-action`,
      payload,
      {
        headers: {
          "x-manager-ai-route": route,
        },
      },
    );
    return response.data;
  },
};

export default managerAiApi;
