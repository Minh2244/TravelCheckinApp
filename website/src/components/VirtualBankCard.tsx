import React, { useState } from "react";

interface VirtualBankCardProps {
  bankName: string;
  accountNumber: string;
  accountName: string;
  qrUrl: string;
  title?: string; // e.g. "MÃ QR VIETQR CỦA BẠN"
}

// Hàm lấy dải màu gradient tùy theo tên ngân hàng
const getCardGradient = (bankName: string = ""): string => {
  const name = bankName.toLowerCase();
  
  if (name.includes("vietcombank") || name.includes("vcb")) {
    return "from-emerald-600 to-green-500";
  }
  if (name.includes("techcombank") || name.includes("tcb")) {
    return "from-red-600 to-rose-500";
  }
  if (name.includes("mb") || name.includes("quân đội")) {
    return "from-blue-700 to-indigo-600";
  }
  if (name.includes("acb")) {
    return "from-blue-600 to-sky-500";
  }
  if (name.includes("vib")) {
    return "from-orange-500 to-amber-400";
  }
  if (name.includes("tpbank") || name.includes("tpb")) {
    return "from-purple-600 to-fuchsia-500";
  }
  if (name.includes("agribank")) {
    return "from-orange-700 to-red-600";
  }
  if (name.includes("sacombank")) {
    return "from-blue-800 to-blue-600";
  }
  if (name.includes("vietinbank")) {
    return "from-sky-700 to-blue-500";
  }
  if (name.includes("bidv")) {
    return "from-teal-700 to-cyan-600";
  }
  
  // Default gradient (Dark/Premium style)
  return "from-slate-800 to-slate-900";
};

// Format số tài khoản: 1234 5678 9012
const formatAccountNumber = (number: string): string => {
  if (!number) return "XXXX XXXX XXXX";
  // Add space every 4 digits for readability
  return number.replace(/(.{4})/g, "$1 ").trim();
};

const VirtualBankCard: React.FC<VirtualBankCardProps> = ({
  bankName,
  accountNumber,
  accountName,
  qrUrl,
  title = "MÃ QR VIETQR",
}) => {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const cardGradient = getCardGradient(bankName);
  const formattedAccount = formatAccountNumber(accountNumber);

  const renderCard = (isInteractive: boolean = true) => (
    <div 
      className={`bank-card-3d group relative w-full aspect-[1.58/1] rounded-2xl overflow-hidden transform-gpu transition-all duration-500 ${isInteractive ? 'mb-2 cursor-pointer' : 'bank-card-3d-preview cursor-default'}`}
      onClick={() => isInteractive && setIsPreviewOpen(true)}
      title={isInteractive ? "Bấm để phóng to thẻ" : ""}
    >
      {/* Base Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${cardGradient}`}
      />
      
      {/* Gloss / Shine Effect (3D Reflection) */}
      <div className="bank-card-shine pointer-events-none absolute inset-0 z-0" />
      <div className="bank-card-rim pointer-events-none absolute inset-0 z-0 rounded-2xl" />
      
      {/* Card Content */}
      <div className="relative z-10 flex h-full w-full flex-col p-5 text-white">
        {/* Top Row: Bank Name & Contactless Icon */}
        <div className="flex justify-between items-start gap-4">
          <span className={`${isInteractive ? "text-base" : "text-lg md:text-xl"} font-extrabold tracking-widest text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]`}>
            {bankName ? bankName.toUpperCase() : "BANK NAME"}
          </span>
          <svg
            className={`${isInteractive ? "h-6 w-6" : "h-7 w-7 md:h-8 md:w-8"} shrink-0 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.35)]`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        </div>

        {/* Middle: EMV Chip */}
        <div className="mt-5">
          <svg
            className={`${isInteractive ? "h-10 w-10" : "h-12 w-12 md:h-14 md:w-14"} text-yellow-400 drop-shadow-[0_3px_3px_rgba(0,0,0,0.35)]`}
            viewBox="0 0 48 48"
            fill="currentColor"
          >
            <path d="M12 8h24c2.2 0 4 1.8 4 4v24c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4V12c0-2.2 1.8-4 4-4zm18 4h-12v6h12v-6zm0 10h-12v6h12v-6zm0 10h-12v6h12v-6zm10-18H32v4h8v-4zm0 8H32v4h8v-4zm0 8H32v4h8v-4zM8 14h8v4H8v-4zm0 8h8v4H8v-4zm0 8h8v4H8v-4z" />
          </svg>
        </div>

        {/* Account Number */}
        <div className="mt-4 pr-28">
          <p className={`${isInteractive ? "text-xl" : "text-2xl md:text-3xl"} font-mono font-semibold tracking-widest text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.45)]`}>
            {formattedAccount}
          </p>
        </div>

        {/* Bottom: Account Holder & Embedded QR */}
        <div className="mt-auto flex min-h-[66px] items-end justify-between gap-4 pr-28">
          <div className="min-w-0 pb-1">
            <p className={`${isInteractive ? "text-[10px]" : "text-xs md:text-sm"} mb-1 uppercase tracking-widest text-white/85 drop-shadow-[0_1px_1px_rgba(0,0,0,0.35)]`}>
              Chủ tài khoản
            </p>
            <p className={`${isInteractive ? "text-sm" : "text-base md:text-lg"} max-w-[260px] truncate font-extrabold uppercase tracking-wide text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.45)]`}>
              {accountName || "YOUR NAME"}
            </p>
          </div>
          
          {/* Embedded QR Code */}
          {qrUrl && (
            <div className={`${isInteractive ? "h-[92px] w-[92px]" : "h-[112px] w-[112px] md:h-[126px] md:w-[126px]"} absolute bottom-4 right-4 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-[0_14px_28px_rgba(15,23,42,0.28)] transition-transform duration-300 origin-bottom-right hover:scale-105`}>
              <img
                src={qrUrl}
                alt="Ma QR thanh toan"
                className="h-full w-full scale-[1.16] object-cover"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="bank-card-stage flex w-full max-w-[400px] flex-col items-center justify-center mx-auto space-y-5">
        {/* Title */}
        <h3 className="text-sm font-bold text-slate-500 tracking-widest uppercase">
          {title}
        </h3>

        {renderCard(true)}
      </div>

      {/* Overlay Phóng To Thẻ */}
      {isPreviewOpen && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 cursor-zoom-out"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div 
            className="bank-card-stage w-full max-w-[560px] scale-100 sm:scale-110 md:scale-125 transition-transform duration-300 cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {renderCard(false)}
          </div>
          
          {/* Nút đóng */}
          <button 
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/40 hover:bg-black/80 rounded-full p-2 transition-colors cursor-pointer"
            onClick={() => setIsPreviewOpen(false)}
            title="Đóng"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
};

export default VirtualBankCard;
