import React, { useState, useEffect } from "react";
import { Minus, Square, Copy, X } from "lucide-react";

interface WindowControlsProps {
  className?: string;
  buttonClassName?: string;
  closeButtonClassName?: string;
}

export const WindowControls: React.FC<WindowControlsProps> = ({
  className = "",
  buttonClassName = "w-11 sm:w-12 h-8 sm:h-9 flex items-center justify-center text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 transition-colors duration-150 cursor-pointer",
  closeButtonClassName = "w-12 sm:w-13 h-8 sm:h-9 flex items-center justify-center text-white/90 hover:text-white hover:bg-red-600 active:bg-red-700 transition-colors duration-150 cursor-pointer group"
}) => {
  const [isMaximized, setIsMaximized] = useState(false);
  const isElectron = typeof window !== "undefined" && Boolean(window.electronAPI?.isElectron);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.isMaximized?.().then((max) => {
      setIsMaximized(Boolean(max));
    });

    const cleanup = window.electronAPI.onMaximizeChange?.((max) => {
      setIsMaximized(max);
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  if (!isElectron) {
    return null;
  }

  const handleMinimize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI?.minimize();
  };

  const handleMaximize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI?.maximize();
  };

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.electronAPI?.close();
  };

  const noDragStyle = {
    WebkitAppRegion: "no-drag",
    pointerEvents: "auto",
    userSelect: "none"
  } as React.CSSProperties;

  return (
    <div
      className={`flex items-stretch select-none z-50 ${className}`}
      style={noDragStyle}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Minimize Button */}
      <button
        type="button"
        style={noDragStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleMinimize}
        title="Minimize"
        aria-label="Minimize"
        className={buttonClassName}
      >
        <Minus className="w-4 h-4 stroke-[2.5]" />
      </button>

      {/* Maximize / Restore Button */}
      <button
        type="button"
        style={noDragStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleMaximize}
        title={isMaximized ? "Restore Down" : "Maximize"}
        aria-label={isMaximized ? "Restore" : "Maximize"}
        className={buttonClassName}
      >
        {isMaximized ? (
          <Copy className="w-3.5 h-3.5 stroke-[2.2] rotate-180" />
        ) : (
          <Square className="w-3.5 h-3.5 stroke-[2.2]" />
        )}
      </button>

      {/* Close Button */}
      <button
        type="button"
        style={noDragStyle}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={handleClose}
        title="Close"
        aria-label="Close"
        className={closeButtonClassName}
      >
        <X className="w-4 h-4 stroke-[2.5] group-hover:scale-110 transition-transform duration-150" />
      </button>
    </div>
  );
};
