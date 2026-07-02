export type ManagerAiRole = "owner" | "admin";

export interface ActionRegistryContext {
  role: ManagerAiRole;
  route: string;
}

const OWNER_ACTIONS_BY_ROUTE: Array<{ prefix: string; actions: string[] }> = [
  {
    prefix: "/owner/dashboard",
    actions: ["owner_revenue_summary", "owner_review_summary", "owner_voucher_draft"],
  },
  {
    prefix: "/owner/reviews",
    actions: ["owner_review_summary", "owner_review_reply_draft", "owner_review_reply_publish"],
  },
  {
    prefix: "/owner/vouchers",
    actions: ["owner_voucher_draft"],
  },
  {
    prefix: "/owner/profile",
    actions: ["owner_revenue_summary"],
  },
];

const ADMIN_ACTIONS_BY_ROUTE: Array<{ prefix: string; actions: string[] }> = [
  {
    prefix: "/admin/dashboard",
    actions: ["admin_revenue_analysis"],
  },
  {
    prefix: "/admin/users",
    actions: ["admin_revenue_analysis", "admin_user_lock"],
  },
  {
    prefix: "/admin/owners",
    actions: ["admin_revenue_analysis", "admin_location_review", "admin_user_lock"],
  },
  {
    prefix: "/admin/locations",
    actions: ["admin_revenue_analysis", "admin_location_review"],
  },
  {
    prefix: "/admin/reviews",
    actions: ["admin_revenue_analysis", "admin_location_review"],
  },
  {
    prefix: "/admin/vouchers",
    actions: ["admin_revenue_analysis", "admin_location_review"],
  },
  {
    prefix: "/admin/finance",
    actions: ["admin_revenue_analysis", "admin_user_lock"],
  },
];

function normalizeRoute(route: string): string {
  const value = String(route || "").trim();
  return value.startsWith("/") ? value : `/${value}`;
}

function actionsForRoute(
  route: string,
  entries: Array<{ prefix: string; actions: string[] }>,
): string[] {
  const normalized = normalizeRoute(route);
  const matched = entries.find((entry) => normalized.startsWith(entry.prefix));
  return matched ? [...matched.actions] : [];
}

export function getAvailableManagerAiActions(context: ActionRegistryContext): string[] {
  if (context.role === "owner") {
    return actionsForRoute(context.route, OWNER_ACTIONS_BY_ROUTE);
  }

  return actionsForRoute(context.route, ADMIN_ACTIONS_BY_ROUTE);
}
