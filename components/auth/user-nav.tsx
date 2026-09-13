"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  User as UserIcon,
  Package,
  Heart,
  LogOut,
  ChevronDown,
  Loader2,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/defaultbutton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function UserNav() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, logout } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside or pressing Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("You have been logged out successfully.");
      setIsOpen(false);
      window.location.href = "/";
      router.refresh();
    } catch {
      toast.error("Logout failed. Please try again.");
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!isInitialized) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground opacity-50 cursor-default"
        aria-label="Account"
        disabled
      >
        <UserIcon className="h-5 w-5" />
      </Button>
    );
  }

  // Unauthenticated: Show only user icon linked to /auth
  if (!isAuthenticated || !user) {
    return (
      <Link
        href="/auth"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "text-muted-foreground hover:text-foreground relative transition-colors inline-flex items-center justify-center"
        )}
        aria-label="Sign in or register"
      >
        <UserIcon className="h-5 w-5" />
      </Link>
    );
  }

  // Display name formatting
  const displayName =
    user.firstName ||
    user.displayName ||
    user.username ||
    user.email.split("@")[0];

  const initials = (
    user.firstName
      ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ""}`
      : displayName.slice(0, 2)
  ).toUpperCase();

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger: User icon + User Name */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "flex items-center gap-2 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all duration-200 border",
          isOpen
            ? "bg-accent border-border text-foreground shadow-sm"
            : "border-transparent hover:bg-accent/70 text-muted-foreground hover:text-foreground"
        )}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User menu"
      >
        {/* Avatar badge */}
        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-semibold flex items-center justify-center border border-primary/20 shrink-0">
          {initials}
        </span>
        <span className="max-w-[110px] truncate font-medium text-xs sm:text-sm text-foreground">
          {displayName}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180 text-foreground"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          aria-orientation="vertical"
          className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-1.5 shadow-xl ring-1 ring-black/5 dark:ring-white/10 z-50 animate-in fade-in-0 zoom-in-95 duration-150"
        >
          {/* Header Info */}
          <div className="px-3 py-2.5 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center border border-primary/20">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">
                  {user.displayName || displayName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
            </div>
            {user.roles && user.roles.length > 0 && (
              <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 text-primary" />
                <span>{user.roles.join(", ")}</span>
              </div>
            )}
          </div>

          {/* Nav Items */}
          <div className="py-1 space-y-0.5">
            <Link
              href="/account"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm text-foreground hover:bg-accent transition-colors group"
            >
              <UserCheck className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>My Account</span>
            </Link>

            <Link
              href="/account/orders"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm text-foreground hover:bg-accent transition-colors group"
            >
              <Package className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Orders & Purchases</span>
            </Link>

            <Link
              href="/wishlist"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm text-foreground hover:bg-accent transition-colors group"
            >
              <Heart className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span>Saved Wishlist</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="my-1 border-t border-border/60" />

          {/* Logout Action */}
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs sm:text-sm text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 text-left cursor-pointer"
          >
            {isLoggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin text-destructive" />
            ) : (
              <LogOut className="h-4 w-4 text-destructive" />
            )}
            <span className="font-medium">
              {isLoggingOut ? "Signing out..." : "Sign Out"}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
