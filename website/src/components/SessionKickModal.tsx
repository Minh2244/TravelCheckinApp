interface SessionKickModalProps {
  open: boolean;
  message: string;
  onConfirm: () => void;
}

const SessionKickModal = ({
  open,
  message,
  onConfirm,
}: SessionKickModalProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/70 px-4">
      <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-2xl">
        <div className="mb-3 text-base font-semibold uppercase tracking-[0.2em] text-slate-400">
          Thông báo
        </div>
        <h2 className="text-3xl font-bold text-slate-900">
          Phiên đăng nhập đã kết thúc
        </h2>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          {message || "Tài khoản đang được đăng nhập tại nơi khác."}
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-6 w-full rounded-full bg-slate-900 px-4 py-3 text-base font-semibold text-white transition hover:bg-slate-800"
        >
          Đăng nhập lại
        </button>
      </div>
    </div>
  );
};

export default SessionKickModal;
