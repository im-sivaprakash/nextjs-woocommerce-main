"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  User,
  Package,
  Heart,
  ShoppingBag,
  LogOut,
  Calendar,
  Mail,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/defaultbutton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function AccountPageContent() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, logout, isLoading } = useAuthStore();

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push("/auth?returnUrl=/account");
    }
  }, [isInitialized, isAuthenticated, router]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Logout failed. Please try again.");
    }
  };

  if (!isInitialized || (!isAuthenticated && !user)) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">Loading your account details...</p>
      </div>
    );
  }

  const displayName =
    user?.firstName || user?.displayName || user?.username || user?.email || "Customer";

  const initials = (
    user?.firstName
      ? `${user.firstName[0]}${user.lastName ? user.lastName[0] : ""}`
      : displayName.slice(0, 2)
  ).toUpperCase();

  return (
    <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 max-w-5xl">
      {/* Header Profile Section */}
      <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 text-primary text-xl sm:text-2xl font-bold flex items-center justify-center border border-primary/20 shadow-inner">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                  {user?.displayName || displayName}
                </h1>
                {user?.roles && user.roles.length > 0 && (
                  <Badge variant="secondary" className="capitalize text-xs font-semibold">
                    {user.roles[0]}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                <span>{user?.email}</span>
              </p>
              {user?.registeredDate && (
                <p className="text-xs text-muted-foreground/80 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Member since {new Date(user.registeredDate).toLocaleDateString()}</span>
                </p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleLogout}
            disabled={isLoading}
            className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20 text-xs sm:text-sm"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {/* Orders Card */}
        <Link
          href="/account/orders"
          className="group rounded-xl border border-border/70 bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Package className="h-5 w-5" />
            </div>
            <h2 className="font-heading font-semibold text-lg text-foreground mb-1">
              My Orders
            </h2>
            <p className="text-xs text-muted-foreground">
              Track recent orders, view purchase history, and receipts.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
            <span>View Orders</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Wishlist Card */}
        <Link
          href="/wishlist"
          className="group rounded-xl border border-border/70 bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Heart className="h-5 w-5" />
            </div>
            <h2 className="font-heading font-semibold text-lg text-foreground mb-1">
              Wishlist
            </h2>
            <p className="text-xs text-muted-foreground">
              Access your saved fragrances and wishlist items.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
            <span>View Wishlist</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Shop Card */}
        <Link
          href="/shop"
          className="group rounded-xl border border-border/70 bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <h2 className="font-heading font-semibold text-lg text-foreground mb-1">
              Continue Shopping
            </h2>
            <p className="text-xs text-muted-foreground">
              Explore our curated collection of luxury fragrances.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between text-xs font-medium text-primary">
            <span>Browse Products</span>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Profile Overview Details */}
      <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
        <h3 className="font-heading text-lg font-semibold mb-6 flex items-center gap-2">
          <User className="h-5 w-5 text-primary" />
          <span>Profile Information</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Display Name
            </span>
            <p className="font-medium text-foreground">{user?.displayName || "—"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Username
            </span>
            <p className="font-medium text-foreground">{user?.username || "—"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Email Address
            </span>
            <p className="font-medium text-foreground">{user?.email || "—"}</p>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Account Role
            </span>
            <p className="font-medium text-foreground capitalize">
              {user?.roles?.[0] || "Customer"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
