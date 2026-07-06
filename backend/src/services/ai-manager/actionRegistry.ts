export type ManagerAiRole = "owner" | "admin";

export interface ActionRegistryContext {
  role: ManagerAiRole;
  route: string;
}

const OWNER_ACTIONS_BY_ROUTE: Array<{ prefix: string; actions: string[] }> = [
  {
    prefix: "/owner/dashboard",
    actions: ["get_dashboard_stats", "owner_get_revenue_structure", "export_revenue_report", "owner_analyze_reviews", "owner_voucher_draft", "owner_get_order_stats", "owner_get_top_services", "owner_manage_employees", "owner_view_employees"],
  },
  {
    prefix: "/owner/reviews",
    actions: ["get_dashboard_stats", "owner_analyze_reviews", "owner_review_reply_draft", "owner_review_reply_publish"],
  },
  {
    prefix: "/owner/vouchers",
    actions: ["get_dashboard_stats", "owner_voucher_draft"],
  },
  {
    prefix: "/owner/profile",
    actions: ["get_dashboard_stats", "owner_get_revenue_structure", "owner_manage_employees", "owner_view_employees"],
  },
];

const ADMIN_ACTIONS_BY_ROUTE: Array<{ prefix: string; actions: string[] }> = [
  {
    prefix: "/admin/dashboard",
    actions: ["get_dashboard_stats", "export_revenue_report", "admin_create_system_voucher"],
  },
  {
    prefix: "/admin/users",
    actions: ["get_dashboard_stats", "admin_user_lock"],
  },
  {
    prefix: "/admin/owners",
    actions: ["get_dashboard_stats", "admin_location_review", "admin_user_lock"],
  },
  {
    prefix: "/admin/locations",
    actions: ["get_dashboard_stats", "admin_location_review"],
  },
  {
    prefix: "/admin/owner-services",
    actions: ["get_dashboard_stats", "admin_location_review"],
  },
  {
    prefix: "/admin/reviews",
    actions: ["get_dashboard_stats", "admin_location_review"],
  },
  {
    prefix: "/admin/vouchers",
    actions: ["get_dashboard_stats", "admin_location_review", "admin_create_system_voucher"],
  },
  {
    prefix: "/admin/system-vouchers",
    actions: ["get_dashboard_stats", "admin_location_review", "admin_create_system_voucher"],
  },
  {
    prefix: "/admin/owner-vouchers",
    actions: ["get_dashboard_stats", "admin_location_review"],
  },
  {
    prefix: "/admin/finance",
    actions: ["get_dashboard_stats", "admin_user_lock"],
  },
];

function normalizeRoute(route: string): string {
  const value = String(route || "").trim().toLowerCase();
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
