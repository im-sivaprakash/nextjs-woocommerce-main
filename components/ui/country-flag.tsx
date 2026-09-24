"use client";

import Image from "next/image";
import * as React from "react";
import { cn } from "@/lib/utils";

interface CountryFlagProps {
  countryCode: string;
  className?: string;
}

export function CountryFlag({ countryCode, className }: CountryFlagProps) {
  const code = (countryCode || "").toUpperCase().trim();
  const [hasAsset, setHasAsset] = React.useState(true);

  React.useEffect(() => {
    setHasAsset(true);
  }, [code]);

  if (hasAsset && /^[A-Z]{2}$/.test(code)) {
    return (
      <Image
        src={`/flags/${code.toLowerCase()}.svg`}
        alt=""
        aria-hidden="true"
        width={20}
        height={14}
        className={cn(
          "inline-block h-3.5 w-5 shrink-0 rounded-xs border border-border/40 object-cover shadow-xs",
          className
        )}
        onError={() => setHasAsset(false)}
      />
    );
  }

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
