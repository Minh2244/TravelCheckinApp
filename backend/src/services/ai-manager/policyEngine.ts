import type { ManagerAiRole } from "./actionRegistry";

export interface ManagerAiPolicyInput {
  role: ManagerAiRole;
  actualRole?: string;
  route: string;
}

export interface ManagerAiPolicyDecision {
  allowed: boolean;
  reason?: string;
  disabledReason?: string;
}

const OWNER_BLOCKED_ROUTE_PREFIXES = [
  "/owner/front-office",
  "/owner/bookings",
  "/owner/payments",
  "/owner/location-ops",
  "/owner/services",
  "/owner/bank",
  "/owner/employees",
];

function normalizeRoute(route: string): string {
  const value = String(route || "").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

export function isOwnerManagerAiRouteBlocked(route: string): boolean {
  const normalized = normalizeRoute(route).toLowerCase();
  return OWNER_BLOCKED_ROUTE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function isManagerAiEnabled(role: ManagerAiRole): boolean {
  const globalFlag = process.env.OWNER_ADMIN_AI_ENABLED;
  const roleFlag = role === "owner" ? process.env.OWNER_AI_ENABLED : process.env.ADMIN_AI_ENABLED;

  if (globalFlag === "false" || roleFlag === "false") return false;
  if (globalFlag === "true" || roleFlag === "true") return true;

  return process.env.NODE_ENV !== "production";
}

export function evaluateManagerAiPolicy(input: ManagerAiPolicyInput): ManagerAiPolicyDecision {
  if (!isManagerAiEnabled(input.role)) {
    return {
      allowed: false,
      disabledReason: "MANAGER_AI_DISABLED",
      reason: "AI Manager Bot đang tắt bằng cấu hình môi trường.",
    };
  }

  if (input.role === "owner") {
    if (input.actualRole !== "owner") {
      return {
        allowed: false,
        disabledReason: "OWNER_AI_OWNER_ONLY",
        reason: "AI Owner chỉ dành cho tài khoản owner, không dành cho employee.",
      };
    }

    if (isOwnerManagerAiRouteBlocked(input.route)) {
      return {
        allowed: false,
        disabledReason: "OWNER_AI_DISABLED_ON_OPERATIONS_ROUTE",
        reason: "Owner AI không hoạt động trên màn vận hành, booking, payment, dịch vụ hoặc bảo mật.",
      };
    }
  }

  if (input.role === "admin" && input.actualRole !== "admin") {
    return {
      allowed: false,
      disabledReason: "ADMIN_AI_ADMIN_ONLY",
      reason: "AI Admin chỉ dành cho tài khoản admin.",
    };
  }

  return { allowed: true };
}

export function validateReturnedAction(
  role: ManagerAiRole,
  actionKey: string | undefined,
  availableActions: string[],
): ManagerAiPolicyDecision {
  if (!actionKey || actionKey === "blocked" || actionKey === "ask_clarification") {
    return { allowed: true };
  }

  if (!availableActions.includes(actionKey)) {
    return {
      allowed: false,
      disabledReason: "ACTION_NOT_IN_REGISTRY",
      reason: `Bot trả action ${actionKey}, nhưng action này không nằm trong registry của ${role}.`,
    };
  }

  return { allowed: true };
}
