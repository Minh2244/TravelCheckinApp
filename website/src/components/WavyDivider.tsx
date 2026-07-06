import React from "react";

interface WavyDividerProps {
  position: "left" | "top"; // 'left' for Web (vertical), 'top' for Mobile (horizontal)
  className?: string;
}

export const WavyDivider: React.FC<WavyDividerProps> = ({ position, className = "" }) => {
  if (position === "left") {
    // Vertical wave on the left edge of the right panel
    return (
      <svg
        className={`absolute left-0 top-0 h-full w-24 -translate-x-[99%] text-white drop-shadow-[-10px_0_15px_rgba(0,0,0,0.1)] ${className}`}
        viewBox="0 0 100 1000"
        preserveAspectRatio="none"
        fill="currentColor"
      >
        <path d="M100,0 C-20,50 150,150 100,200 C-20,250 150,350 100,400 C-20,450 150,550 100,600 C-20,650 150,750 100,800 C-20,850 150,950 100,1000 L100,1000 L100,0 Z" />
      </svg>
    );
  }

  // Horizontal wave on the top edge of the bottom panel (Mobile)
  return (
    <svg
      className={`absolute left-0 top-0 w-full h-12 -translate-y-[99%] text-white drop-shadow-[0_-5px_10px_rgba(0,0,0,0.1)] ${className}`}
      viewBox="0 0 1000 100"
      preserveAspectRatio="none"
      fill="currentColor"
    >
      <path d="M0,100 C50,-20 150,150 200,100 C250,-20 350,150 400,100 C450,-20 550,150 600,100 C650,-20 750,150 800,100 C850,-20 950,150 1000,100 L1000,100 L0,100 Z" />
    </svg>
  );
};
