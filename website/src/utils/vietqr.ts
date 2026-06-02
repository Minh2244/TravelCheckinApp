const normalizeBankKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/vietcombank/g, "vcb")
    .replace(/vietinbank/g, "ctg")
    .replace(/bidv/g, "bidv")
    .replace(/agribank/g, "vba");

// Common Vietnamese bank BIN codes used by VietQR.
const BANK_BIN_MAP: Record<string, string> = {
  vcb: "970436",
  ctg: "970415",
  bidv: "970418",
  vba: "970405",
  acb: "970416",
  tcb: "970407",
  mb: "970422",
  vpbank: "970432",
  tpbank: "970423",
  sacombank: "970403",
  vpb: "970432",
  shb: "970443",
  hdbank: "970437",
  ocb: "970448",
  msb: "970426",
  eximbank: "970431",
  seabank: "970440",
};

export const buildVietQrImageUrl = (opts: {
  bankName?: string | null;
  bankAccount?: string | null;
  accountHolder?: string | null;
  amount?: number | null;
  addInfo?: string | null;
  template?: "qr_only" | "compact2";
}): { url: string | null; error: string | null } => {
  const bankName = String(opts.bankName || "").trim();
  const bankAccount = String(opts.bankAccount || "").trim();
  const accountHolder = String(opts.accountHolder || "").trim();
  const template = opts.template || "compact2";

  if (!bankName || !bankAccount) return { url: null, error: null };

  const inferredBin = BANK_BIN_MAP[normalizeBankKey(bankName)] || "";
  if (!inferredBin) {
    return {
      url: null,
      error:
        "Không xác định được mã BIN theo tên ngân hàng. Vui lòng cập nhật tên ngân hàng đúng chuẩn.",
    };
  }

  const addInfo = String(opts.addInfo || "Thanh toan").trim() || "Thanh toan";
  const amountNum =
    opts.amount == null
      ? null
      : Number.isFinite(Number(opts.amount))
        ? Number(opts.amount)
        : null;

  const url = new URL(
    `https://img.vietqr.io/image/${inferredBin}-${encodeURIComponent(
      bankAccount,
    )}-${template}.png`,
  );
  url.searchParams.set("addInfo", addInfo);
  if (amountNum != null && amountNum > 0) {
    url.searchParams.set("amount", String(Math.trunc(amountNum)));
  }
  if (accountHolder) {
    url.searchParams.set("accountName", accountHolder);
  }
  return { url: url.toString(), error: null };
};
