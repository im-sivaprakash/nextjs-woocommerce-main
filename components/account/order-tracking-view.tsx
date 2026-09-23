"use client";

import { useState, useEffect, useCallback } from "react";
import { getOrderTrackingAction } from "@/lib/actions/account";
import type { OrderTrackingInfo } from "@/lib/woocommerce/shipping-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/defaultbutton";
import {
  Truck,
  Package,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  RotateCw,
  Navigation,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OrderTrackingViewProps {
  orderId: number;
  orderNumber?: string;
  orderStatus?: string;
}

function getTrackingStatusBadge(status?: string | null) {
  if (!status) {
    return (
      <Badge variant="outline" className="text-xs gap-1 border-border/80 text-muted-foreground">
        <Clock className="w-3 h-3" />
        Pending Fulfillment
      </Badge>
    );
  }

  const normalized = status.toLowerCase();

  if (normalized.includes("deliver")) {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5 text-xs font-semibold px-2.5 py-0.5">
        <CheckCircle2 className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  }

  if (normalized.includes("out for delivery")) {
    return (
      <Badge className="bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 gap-1.5 text-xs font-semibold px-2.5 py-0.5">
        <Truck className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  }

  if (
    normalized.includes("transit") ||
    normalized.includes("shipped") ||
    normalized.includes("picked") ||
    normalized.includes("dispatched")
  ) {
    return (
      <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30 gap-1.5 text-xs font-semibold px-2.5 py-0.5">
        <Navigation className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  }

  if (
    normalized.includes("cancel") ||
    normalized.includes("rto") ||
    normalized.includes("fail") ||
    normalized.includes("undelivered")
  ) {
    return (
      <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1.5 text-xs font-semibold px-2.5 py-0.5">
        <AlertCircle className="w-3.5 h-3.5" />
        {status}
      </Badge>
    );
  }

  return (
    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 text-xs font-semibold px-2.5 py-0.5">
      <Clock className="w-3.5 h-3.5" />
      {status}
    </Badge>
  );
}

export function OrderTrackingView({
  orderId,
  orderNumber,
  orderStatus,
}: OrderTrackingViewProps) {
  const [tracking, setTracking] = useState<OrderTrackingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTracking = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getOrderTrackingAction(orderId);
      if (res.success && res.tracking) {
        setTracking(res.tracking);
      } else {
        setError(res.error || "Unable to retrieve tracking details.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tracking.");
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  const handleCopyAwb = (awbText: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(awbText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-4 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-muted/80 rounded w-28" />
          <div className="h-5 bg-muted/80 rounded-full w-24" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="h-12 bg-muted/60 rounded-lg" />
          <div className="h-12 bg-muted/60 rounded-lg" />
          <div className="h-12 bg-muted/60 rounded-lg" />
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-3 bg-muted/60 rounded w-36" />
          <div className="h-16 bg-muted/40 rounded-lg" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchTracking}
          className="h-7 text-xs gap-1.5 self-start sm:self-auto border-destructive/30 hover:bg-destructive/10"
        >
          <RotateCw className="w-3 h-3" />
          Retry
        </Button>
      </div>
    );
  }

  const hasAwbOrStatus = Boolean(tracking?.awb || tracking?.status || tracking?.courier);
  const scans = tracking?.scans || [];

  return (
    <div className="rounded-xl border border-border/80 bg-gradient-to-b from-card to-muted/20 p-4 sm:p-5 space-y-5">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Truck className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-xs sm:text-sm text-foreground">
              Shipment Tracking
            </span>
            {tracking?.updatedAt && (
              <p className="text-[11px] text-muted-foreground">
                Updated: {new Date(tracking.updatedAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {getTrackingStatusBadge(tracking?.status || (orderStatus === "completed" ? "Dispatched" : orderStatus))}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchTracking}
            title="Refresh Tracking Status"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Tracking Overview Cards */}
      {hasAwbOrStatus ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* AWB Number Card */}
          <div className="rounded-lg bg-background/80 border border-border/60 p-3 flex flex-col justify-between space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Package className="w-3 h-3 text-primary" />
              AWB / Tracking Number
            </span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-semibold text-xs sm:text-sm text-foreground truncate">
                {tracking?.awb || "Pending Generation"}
              </span>
              {tracking?.awb && (
                <button
                  type="button"
                  onClick={() => handleCopyAwb(tracking.awb!)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy Tracking Number"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Courier Partner */}
          <div className="rounded-lg bg-background/80 border border-border/60 p-3 flex flex-col justify-between space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Truck className="w-3 h-3 text-primary" />
              Courier Partner
            </span>
            <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
              {tracking?.courier || "Shiprocket Express"}
            </span>
          </div>

          {/* Estimated Delivery Date (ETD) */}
          <div className="rounded-lg bg-background/80 border border-border/60 p-3 flex flex-col justify-between space-y-1.5">
            <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-primary" />
              Estimated Delivery
            </span>
            <span className="font-semibold text-xs sm:text-sm text-foreground truncate">
              {tracking?.etd ? (
                new Date(tracking.etd).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              ) : (
                "Standard Delivery (3-5 Days)"
              )}
            </span>
          </div>
        </div>
      ) : (
        /* Empty / Initial Pending State */
        <div className="rounded-xl border border-dashed border-border bg-card/40 p-5 text-center flex flex-col items-center justify-center space-y-2.5">
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-1 max-w-md">
            <h4 className="text-xs sm:text-sm font-semibold text-foreground">
              Shipment In Preparation
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your order #{orderNumber || orderId} is confirmed and currently being prepared for dispatch. Live tracking number and courier updates will appear here automatically once picked up.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-medium pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Fulfillment verified via Shiprocket</span>
          </div>
        </div>
      )}

      {/* Visual Scan Timeline */}
      {scans.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              Tracking Activity History ({scans.length})
            </span>
          </div>

          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-border">
            {scans.map((scan, index) => {
              const isLatest = index === 0;
              return (
                <div key={`${scan.date}-${index}`} className="relative group text-xs">
                  {/* Timeline Dot */}
                  <div
                    className={cn(
                      "absolute -left-6 top-1 w-4 h-4 rounded-full flex items-center justify-center transition-all",
                      isLatest
                        ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                        : "bg-muted-foreground/30 text-background"
                    )}
                  >
                    <div
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isLatest ? "bg-white" : "bg-muted-foreground"
                      )}
                    />
                  </div>

                  {/* Scan Content */}
                  <div className="bg-card/70 border border-border/60 rounded-lg p-3 space-y-1.5 hover:border-primary/30 transition-colors">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span
                        className={cn(
                          "font-semibold text-xs sm:text-sm",
                          isLatest ? "text-primary" : "text-foreground"
                        )}
                      >
                        {scan.activity || scan.sr_status_label || "Checkpoint Passed"}
                      </span>
                      {scan.date && (
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(scan.date).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>

                    {scan.location && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <MapPin className="w-3 h-3 text-muted-foreground/80 shrink-0" />
                        <span>{scan.location}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
