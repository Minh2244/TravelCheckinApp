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
      className={`relative w-full aspect-[1.58/1] rounded-2xl shadow-[0_10px_20px_rgba(0,0,0,0.2)] overflow-hidden group transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] ${isInteractive ? 'mb-2 cursor-pointer' : 'cursor-default shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.6)]'}`}
      onClick={() => isInteractive && setIsPreviewOpen(true)}
      title={isInteractive ? "Bấm để phóng to thẻ" : ""}
    >
      {/* Base Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${cardGradient}`}
      />
      
      {/* Gloss / Shine Effect (3D Reflection) */}
      <div className="absolute top-0 left-0 w-[150%] h-[150%] -rotate-45 bg-gradient-to-b from-transparent via-white/20 to-transparent translate-y-[100%] group-hover:translate-y-[-100%] transition-transform duration-1000 ease-in-out pointer-events-none z-0" />
      
      {/* Card Content */}
      <div className="relative h-full w-full p-6 flex flex-col justify-between text-white z-10 drop-shadow-md">
        {/* Top Row: Bank Name & Contactless Icon */}
        <div className="flex justify-between items-start">
          <span className="font-bold text-lg tracking-widest text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]">
            {bankName ? bankName.toUpperCase() : "BANK NAME"}
          </span>
          <svg
            className="w-6 h-6 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
        </div>

        {/* Middle: EMV Chip */}
        <div className="my-2">
          <svg
            className="w-12 h-12 text-yellow-400 drop-shadow-[0_3px_3px_rgba(0,0,0,0.4)]"
            viewBox="0 0 48 48"
            fill="currentColor"
          >
            <path d="M12 8h24c2.2 0 4 1.8 4 4v24c0 2.2-1.8 4-4 4H12c-2.2 0-4-1.8-4-4V12c0-2.2 1.8-4 4-4zm18 4h-12v6h12v-6zm0 10h-12v6h12v-6zm0 10h-12v6h12v-6zm10-18H32v4h8v-4zm0 8H32v4h8v-4zm0 8H32v4h8v-4zM8 14h8v4H8v-4zm0 8h8v4H8v-4zm0 8h8v4H8v-4z" />
          </svg>
        </div>

        {/* Account Number */}
        <div className="mb-2">
          <p className="font-mono text-2xl tracking-widest text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]">
            {formattedAccount}
          </p>
        </div>

        {/* Bottom: Account Holder & Embedded QR */}
        <div className="flex justify-between items-end">
          <div className="pb-1">
            <p className="text-[10px] uppercase tracking-widest opacity-80 mb-0.5 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
              Chủ tài khoản
            </p>
            <p className="font-bold text-base tracking-wider uppercase drop-shadow-[0_2px_2px_rgba(0,0,0,0.5)] truncate max-w-[250px]">
              {accountName || "YOUR NAME"}
            </p>
          </div>
          
          {/* Embedded QR Code */}
          {qrUrl && (
            <div className="bg-white/95 backdrop-blur-sm p-2 rounded-xl shadow-lg border border-white/20 hover:scale-105 transition-transform duration-300 origin-bottom-right">
              <img
                src={qrUrl}
                alt="VietQR"
                className="w-20 h-20 sm:w-24 sm:h-24 object-contain rounded-lg mix-blend-multiply"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto space-y-6">
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
            className="w-full max-w-md scale-100 sm:scale-125 md:scale-150 transition-transform duration-300 cursor-default"
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
