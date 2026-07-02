import type { Request, Response } from "express";

import { getAvailableManagerAiActions, type ManagerAiRole } from "../services/ai-manager/actionRegistry";
import {
  chatWithManagerBot,
  getManagerBotHealth,
  getManagerBotSuggestions,
  planManagerBotAction,
  type ManagerBotPayload,
} from "../services/ai-manager/managerBotClient";
import {
  evaluateManagerAiPolicy,
  validateReturnedAction,
} from "../services/ai-manager/policyEngine";
import { sanitizeManagerAiContext } from "../services/ai-manager/contextSanitizer";

function getRouteFromRequest(req: Request): string {
  return String(req.query.route || req.body?.route || req.headers["x-manager-ai-route"] || "");
}

function getMessageFromRequest(req: Request): string {
  return String(req.body?.message || req.body?.text || "").trim();
}

function getActionKey(result: Record<string, unknown>): string | undefined {
  const actionPlan = result.action_plan;
  if (!actionPlan || typeof actionPlan !== "object") return undefined;
  return String((actionPlan as { action_key?: unknown }).action_key || "");
}

function buildBotPayload(req: Request, role: ManagerAiRole, route: string): ManagerBotPayload {
  const screenContext = sanitizeManagerAiContext(req.body?.screen_context || req.body?.context || {});
  const mockContext =
    process.env.NODE_ENV === "production"
      ? {}
      : sanitizeManagerAiContext(req.body?.mock_context || {});

  return {
    role,
    route,
    message: getMessageFromRequest(req),
    screen_context: screenContext,
    mock_context: mockContext,
    available_actions: getAvailableManagerAiActions({ role, route }),
  };
}

function sendPolicyBlocked(res: Response, decision: ReturnType<typeof evaluateManagerAiPolicy>): void {
  res.status(403).json({
    success: false,
    code: decision.disabledReason || "MANAGER_AI_BLOCKED",
    message: decision.reason || "Yêu cầu AI Manager Bot bị chặn bởi policy.",
  });
}

function handleBotError(res: Response, error: unknown): void {
  const err = error as {
    response?: { status?: number; data?: unknown };
    code?: string;
    message?: string;
  };

  res.status(502).json({
    success: false,
    code: "AI_MANAGER_BOT_UNAVAILABLE",
    message: "Không gọi được AI Manager Bot. Kiểm tra service ai-manager-bot có đang chạy chưa.",
    detail: err.response?.data || err.code || err.message || "unknown_error",
  });
}

export function createOwnerAdminAiController(role: ManagerAiRole) {
  return {
    health: async (req: Request, res: Response): Promise<void> => {
      const route = getRouteFromRequest(req);
      const policy = evaluateManagerAiPolicy({ role, actualRole: req.userRole, route });

      try {
        const bot = await getManagerBotHealth();
        res.json({
          success: true,
          enabled: policy.allowed,
          disabled_reason: policy.disabledReason || null,
          bot,
        });
      } catch (error) {
        handleBotError(res, error);
      }
    },

    suggestions: async (req: Request, res: Response): Promise<void> => {
      const route = getRouteFromRequest(req);
      const policy = evaluateManagerAiPolicy({ role, actualRole: req.userRole, route });

      if (!policy.allowed) {
        res.json({
          success: true,
          role,
          route,
          suggestions: [],
          disabled_reason: policy.disabledReason || "MANAGER_AI_BLOCKED",
          message: policy.reason,
        });
        return;
      }

      try {
        const data = await getManagerBotSuggestions(role, route);
        res.json({ success: true, ...data });
      } catch (error) {
        handleBotError(res, error);
      }
    },

    chat: async (req: Request, res: Response): Promise<void> => {
      const route = getRouteFromRequest(req);
      const policy = evaluateManagerAiPolicy({ role, actualRole: req.userRole, route });
      if (!policy.allowed) {
        sendPolicyBlocked(res, policy);
        return;
      }

      const payload = buildBotPayload(req, role, route);
      if (!payload.message) {
        res.status(400).json({
          success: false,
          message: "message hoặc text là bắt buộc.",
        });
        return;
      }

      try {
        const data = await chatWithManagerBot(payload);
        const actionPolicy = validateReturnedAction(role, getActionKey(data), payload.available_actions || []);
        if (!actionPolicy.allowed) {
          sendPolicyBlocked(res, actionPolicy);
          return;
        }
        res.json({ success: true, ...data });
      } catch (error) {
        handleBotError(res, error);
      }
    },

    planAction: async (req: Request, res: Response): Promise<void> => {
      const route = getRouteFromRequest(req);
      const policy = evaluateManagerAiPolicy({ role, actualRole: req.userRole, route });
      if (!policy.allowed) {
        sendPolicyBlocked(res, policy);
        return;
      }

      const payload = buildBotPayload(req, role, route);
      if (!payload.message) {
        res.status(400).json({
          success: false,
          message: "message hoặc text là bắt buộc.",
        });
        return;
      }

      try {
        const data = await planManagerBotAction(payload);
        const actionPolicy = validateReturnedAction(role, getActionKey(data), payload.available_actions || []);
        if (!actionPolicy.allowed) {
          sendPolicyBlocked(res, actionPolicy);
          return;
        }
        res.json({ success: true, preview_only: true, ...data });
      } catch (error) {
        handleBotError(res, error);
      }
    },
  };
}
