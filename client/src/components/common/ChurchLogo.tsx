import React from "react";

interface ChurchLogoProps {
  className?: string;
  size?: number | string;
  variant?: "badge" | "icon-only" | "light" | "gold";
}

/**
 * Daet Presbyterian Church - Official Professional Brand Emblem
 * Features an elegant Christian Cross integrated with an Open Bible and radiant light rays.
 */
export const ChurchLogo: React.FC<ChurchLogoProps> = ({ 
  className = "w-6 h-6", 
  size,
  variant = "icon-only" 
}) => {
  const iconStyle = size ? { width: size, height: size } : undefined;

  if (variant === "badge") {
    return (
      <div 
        className={`rounded-xl bg-gradient-to-tr from-amber-500 via-amber-400 to-amber-300 flex items-center justify-center shadow-md ring-1 ring-amber-400/40 text-indigo-950 shrink-0 ${className}`}
        style={iconStyle}
      >
        <svg 
          viewBox="0 0 48 48" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg" 
          className="w-3/4 h-3/4 drop-shadow-xs"
        >
          {/* Subtle Sanctuary Arch Background */}
          <path 
            d="M8 42V20C8 11.163 15.163 4 24 4C32.837 4 40 11.163 40 20V42" 
            stroke="#1e1b4b" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeOpacity="0.35"
          />
          
          {/* Holy Cross */}
          <path 
            d="M24 8V30M16 15H32" 
            stroke="#1e1b4b" 
            strokeWidth="3.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />

          {/* Open Bible Pages */}
          <path 
            d="M10 38C15 35 21 36 24 38C27 36 33 35 38 38V28C33 25 27 26 24 28C21 26 15 25 10 28V38Z" 
            fill="#1e1b4b" 
            fillOpacity="0.15" 
            stroke="#1e1b4b" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
          />
          {/* Open Bible Spine */}
          <path 
            d="M24 28V38" 
            stroke="#1e1b4b" 
            strokeWidth="2.5" 
            strokeLinecap="round" 
          />

          {/* Radiant Light Rays */}
          <path d="M24 4V6" stroke="#1e1b4b" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.6"/>
          <path d="M33 7L31.5 8.5" stroke="#1e1b4b" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
          <path d="M15 7L16.5 8.5" stroke="#1e1b4b" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.6"/>
        </svg>
      </div>
    );
  }

  // Pure SVG icon variant
  return (
    <svg 
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg" 
      className={className}
      style={iconStyle}
    >
      {/* Sanctuary Arch */}
      <path 
        d="M8 42V20C8 11.163 15.163 4 24 4C32.837 4 40 11.163 40 20V42" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeOpacity="0.3"
      />
      
      {/* Holy Cross */}
      <path 
        d="M24 8V30M16 15H32" 
        stroke="currentColor" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />

      {/* Open Bible Pages */}
      <path 
        d="M10 38C15 35 21 36 24 38C27 36 33 35 38 38V28C33 25 27 26 24 28C21 26 15 25 10 28V38Z" 
        fill="currentColor" 
        fillOpacity="0.2" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      {/* Open Bible Center Spine */}
      <path 
        d="M24 28V38" 
        stroke="currentColor" 
        strokeWidth="2.5" 
        strokeLinecap="round" 
      />

      {/* Radiant Rays */}
      <path d="M24 4V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
      <path d="M33 7L31.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
      <path d="M15 7L16.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.7"/>
    </svg>
  );
};
export default ChurchLogo;
