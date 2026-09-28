import React from "react";
import dpcLogo from "../../assets/DPC-management-icon.png";

interface ChurchLogoProps {
  className?: string;
  size?: number | string;
  variant?: "badge" | "icon-only" | "light" | "gold" | "plain";
  alt?: string;
}

/**
 * Daet Presbyterian Church - Official Brand Emblem & Logo
 * Displays the official DPC Management System Icon across all UI components.
 */
export const ChurchLogo: React.FC<ChurchLogoProps> = ({ 
  className = "w-6 h-6", 
  size,
  variant = "icon-only",
  alt = "Daet Presbyterian Church"
}) => {
  const iconStyle = size ? { width: size, height: size } : undefined;

  if (variant === "badge") {
    return (
      <div 
        className={`rounded-xl bg-amber-500/15 p-0.5 flex items-center justify-center shadow-xs ring-1 ring-amber-400/30 text-indigo-950 shrink-0 overflow-hidden ${className}`}
        style={iconStyle}
      >
        <img 
          src={dpcLogo} 
          alt={alt}
          className="w-full h-full object-contain select-none pointer-events-none drop-shadow-xs"
        />
      </div>
    );
  }

  return (
    <img 
      src={dpcLogo} 
      alt={alt}
      className={`object-contain shrink-0 select-none ${className}`}
      style={iconStyle}
    />
  );
};

export default ChurchLogo;

