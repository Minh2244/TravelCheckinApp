const normalizeBankKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/vietcombank/g, "vcb")
    .replace(/vietinbank/g, "ctg")
    .replace(/agribank/g, "vba");

const BANK_BIN_MAP: Record<string, string> = {
  vcb: "970436",
  ctg: "970415",
  bidv: "970418",
  vba: "970405",
  acb: "970416",
  tcb: "970407",
  mb: "970422",
  vpbank: "970432",
  vpb: "970432",
  tpbank: "970423",
  sacombank: "970403",
  shb: "970443",
  hdbank: "970437",
  ocb: "970448",
  msb: "970426",
  eximbank: "970431",
  seabank: "970440",
};

export function buildVietQrImageUrl(opts: {
  bankName?: string | null;
  bankAccount?: string | null;
  accountHolder?: string | null;
  amount?: number | null;
  addInfo?: string | null;
  template?: "qr_only" | "compact2";
}) {
  const bankName = String(opts.bankName || "").trim();
  const bankAccount = String(opts.bankAccount || "").trim();
  const accountHolder = String(opts.accountHolder || "").trim();
  const template = opts.template || "compact2";

  if (!bankName || !bankAccount) {
    return { url: null as string | null, error: null as string | null };
  }

  const bin = BANK_BIN_MAP[normalizeBankKey(bankName)] || "";
  if (!bin) {
    return {
      url: null as string | null,
      error: "Không xác định được mã BIN theo tên ngân hàng.",
    };
  }

  const amount = Number(opts.amount || 0);
  const url = new URL(
    `https://img.vietqr.io/image/${bin}-${encodeURIComponent(bankAccount)}-${template}.png`,
  );
  url.searchParams.set("addInfo", String(opts.addInfo || "Thanh toan").trim());
  if (Number.isFinite(amount) && amount > 0) {
    url.searchParams.set("amount", String(Math.trunc(amount)));
  }
  if (accountHolder) {
    url.searchParams.set("accountName", accountHolder);
  }

  return { url: url.toString(), error: null as string | null };
}
