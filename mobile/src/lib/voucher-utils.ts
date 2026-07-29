import type { LocationVoucher } from "../services/user.api";

export function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getVoucherId(voucher: LocationVoucher): number {
  return Number(voucher.voucher_id ?? 0);
}

export function voucherStillUsable(voucher: LocationVoucher) {
  if (Boolean(voucher.is_exhausted)) return false;

  const poolRemaining = Number(voucher.pool_remaining);
  if (
    voucher.pool_remaining != null &&
    Number.isFinite(poolRemaining) &&
    poolRemaining <= 0
  ) {
    return false;
  }

  const remaining = Number(voucher.remaining);
  if (voucher.remaining != null && Number.isFinite(remaining) && remaining <= 0) return false;

  const userRemaining = Number(voucher.user_remaining_uses);
  if (
    voucher.user_remaining_uses != null &&
    Number.isFinite(userRemaining) &&
    userRemaining <= 0
  ) {
    return false;
  }

  const maxUses = Number(voucher.max_uses_per_user);
  const used = Number(voucher.user_used_count ?? 0);
  if (voucher.max_uses_per_user != null && Number.isFinite(maxUses) && maxUses > 0 && Number.isFinite(used)) {
    return used < maxUses;
  }

  return true;
}

export function calculateVoucherDiscount(voucher: LocationVoucher | null, total: number) {
  if (!voucher || total <= 0) return 0;

  const minOrder = asNumber(voucher.min_order_value, 0);
  if (total < minOrder) return 0;

  const discountValue = asNumber(voucher.discount_value, 0);
  const type = String(voucher.discount_type || "").toLowerCase();
  let discount =
    type === "percent" || type === "percentage"
      ? (total * discountValue) / 100
      : discountValue;

  const maxDiscount = asNumber(voucher.max_discount_amount, 0);
  if (maxDiscount > 0) discount = Math.min(discount, maxDiscount);

  return Math.max(0, Math.min(total, Math.round(discount)));
}
