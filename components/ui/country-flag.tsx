import * as React from "react";
import { cn } from "@/lib/utils";

interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

export function CountryFlag({ countryCode, className }: CountryFlagProps) {
  const code = (countryCode || "").toUpperCase().trim();

  // Return specific SVG for known countries, or a clean fallback
  switch (code) {
    case "IN":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 16"
          className={cn("inline-block h-3.5 w-5 shrink-0 rounded-xs border border-border/40 shadow-xs", className)}
          aria-hidden="true"
        >
          {/* Top saffron band */}
          <rect width="24" height="5.33" fill="#FF9933" />
          {/* Middle white band */}
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          {/* Bottom green band */}
          <rect y="10.67" width="24" height="5.33" fill="#138808" />
          {/* Ashoka Chakra */}
          <circle cx="12" cy="8" r="2.1" fill="none" stroke="#000088" strokeWidth="0.5" />
          <circle cx="12" cy="8" r="0.5" fill="#000088" />
          {/* 24 spokes (represented cleanly by cross lines) */}
          <path
            d="M12 5.9v4.2M9.9 8h4.2M10.5 6.5l3 3M10.5 9.5l3-3M11.2 6.1l1.6 3.8M12.8 6.1l-1.6 3.8M10.1 7.2l3.8 1.6M10.1 8.8l3.8-1.6"
            stroke="#000088"
            strokeWidth="0.25"
          />
        </svg>
      );

    case "GB":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 16"
          className={cn("inline-block h-3.5 w-5 shrink-0 rounded-xs border border-border/40 shadow-xs", className)}
          aria-hidden="true"
        >
          <clipPath id="gb-clip">
            <rect width="24" height="16" />
          </clipPath>
          <g clipPath="url(#gb-clip)">
            <rect width="24" height="16" fill="#012169" />
            <path d="M0 0l24 16M24 0L0 16" stroke="#FFFFFF" strokeWidth="3.2" />
            <path d="M0 0l24 16M24 0L0 16" stroke="#C8102E" strokeWidth="1.6" />
            <path d="M12 0v16M0 8h24" stroke="#FFFFFF" strokeWidth="5.2" />
            <path d="M12 0v16M0 8h24" stroke="#C8102E" strokeWidth="3.2" />
          </g>
        </svg>
      );

    case "AE":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 16"
          className={cn("inline-block h-3.5 w-5 shrink-0 rounded-xs border border-border/40 shadow-xs", className)}
          aria-hidden="true"
        >
          {/* Top green */}
          <rect width="24" height="5.33" fill="#00732F" />
          {/* Middle white */}
          <rect y="5.33" width="24" height="5.34" fill="#FFFFFF" />
          {/* Bottom black */}
          <rect y="10.67" width="24" height="5.33" fill="#000000" />
          {/* Hoist red */}
          <rect width="6" height="16" fill="#FF0000" />
        </svg>
      );

    case "US":
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 16"
          className={cn("inline-block h-3.5 w-5 shrink-0 rounded-xs border border-border/40 shadow-xs", className)}
          aria-hidden="true"
        >
          {/* Stripes */}
          <rect width="24" height="16" fill="#B22234" />
          <path
            d="M0 2.46h24M0 4.92h24M0 7.38h24M0 9.85h24M0 12.31h24M0 14.77h24"
            stroke="#FFFFFF"
            strokeWidth="1.23"
          />
          {/* Canton */}
          <rect width="9.6" height="8.62" fill="#3C3B6E" />
          {/* Small star representation */}
          <circle cx="4.8" cy="4.31" r="1.5" fill="#FFFFFF" />
        </svg>
      );

    default:
      // Neutral flag fallback with 2-letter country code
      return (
        <span
          className={cn(
            "inline-flex h-3.5 w-5 shrink-0 items-center justify-center rounded-xs border border-border/60 bg-muted/60 text-[8px] font-bold uppercase tracking-wider text-muted-foreground shadow-xs select-none",
            className
          )}
          aria-hidden="true"
        >
          {code.slice(0, 2) || "—"}
        </span>
      );
  }
}
