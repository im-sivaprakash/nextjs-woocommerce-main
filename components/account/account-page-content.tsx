"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/lib/store/auth-store";
import {
  getUserAuthMethodsAction,
  forgotPasswordAction,
} from "@/lib/actions/auth";
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
  ShieldCheck,
  KeyRound,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/defaultbutton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

function GoogleSmallIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

export function AccountPageContent() {
  const router = useRouter();
  const { user, isAuthenticated, isInitialized, logout, isLoading } =
    useAuthStore();

  const [authMethods, setAuthMethods] = useState<string[]>([]);
  const [hasPassword, setHasPassword] = useState<boolean>(true);
  const [hasGoogle, setHasGoogle] = useState<boolean>(false);
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    if (isInitialized && !isAuthenticated) {
      router.push("/auth?returnUrl=/account");
    }
  }, [isInitialized, isAuthenticated, router]);

  useEffect(() => {
    if (user?.id) {
      getUserAuthMethodsAction(user.id).then((res) => {
        if (res.success) {
          setAuthMethods(res.authMethods);
          setHasPassword(res.hasPassword);
          setHasGoogle(res.hasGoogle);
        }
      });
    }
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Signed out successfully");
      window.location.href = "/";
      router.refresh();
    } catch {
      toast.error("Logout failed. Please try again.");
    }
  };

  const handlePasswordRequest = async () => {
    if (!user?.email) {
      toast.error("Email address not found on profile.");
      return;
    }

    setIsSendingReset(true);
    try {
      const res = await forgotPasswordAction(user.email);
      if (res.success) {
        setResetSent(true);
        toast.success(
          hasPassword
            ? "Password change instructions sent to your email!"
            : "Password setup instructions sent to your email!"
        );
      } else {
        toast.error(res.error || "Failed to send password instructions.");
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsSendingReset(false);
    }
  };

  if (!isInitialized || (!isAuthenticated && !user)) {
    return (
      <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-sm text-muted-foreground">
          Loading your account details...
        </p>
      </div>
    );
  }

  const displayName =
    user?.firstName ||
    (user?.displayName && !/^user_[a-z0-9_]+$/i.test(user.displayName)
      ? user.displayName
      : undefined) ||
    (user?.username && !/^user_[a-z0-9_]+$/i.test(user.username)
      ? user.username
      : undefined) ||
    user?.email?.split("@")[0] ||
    "Customer";

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
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-primary/10 text-primary text-xl sm:text-2xl font-bold flex items-center justify-center border border-primary/20 shadow-inner overflow-hidden shrink-0">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={displayName}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                initials
              )}
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
                  {user?.displayName && !/^user_[a-z0-9_]+$/i.test(user.displayName)
                    ? user.displayName
                    : displayName}
                </h1>
                {user?.roles && user.roles.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="capitalize text-xs font-semibold"
                  >
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
                  <span>
                    Member since{" "}
                    {new Date(user.registeredDate).toLocaleDateString()}
                  </span>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Overview Details */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm">
          <h3 className="font-heading text-lg font-semibold mb-6 flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <span>Profile Information</span>
          </h3>

          <div className="space-y-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Display Name
              </span>
              <p className="font-medium text-foreground">
                {user?.displayName && !/^user_[a-z0-9_]+$/i.test(user.displayName)
                  ? user.displayName
                  : displayName}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Username
              </span>
              <p className="font-medium text-foreground">
                {user?.username && !/^user_[a-z0-9_]+$/i.test(user.username)
                  ? user.username
                  : user?.email?.split("@")[0] || "—"}
              </p>
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

        {/* Sign-in Methods & Security Section */}
        <div className="rounded-2xl border border-border/80 bg-card p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-heading text-lg font-semibold mb-6 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              <span>Sign-In & Security</span>
            </h3>

            {/* Active Sign-in Methods */}
            <div className="space-y-2 mb-6">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
                Active Sign-In Methods
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {(hasGoogle || authMethods.includes("google")) && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 py-1 px-2.5 text-xs font-medium bg-background border-border/80"
                  >
                    <GoogleSmallIcon />
                    <span>Google</span>
                  </Badge>
                )}
                {(hasPassword || authMethods.includes("password")) && (
                  <Badge
                    variant="outline"
                    className="gap-1.5 py-1 px-2.5 text-xs font-medium bg-background border-border/80"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-primary" />
                    <span>Password</span>
                  </Badge>
                )}
              </div>
            </div>

            {/* Password Configuration Flow */}
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                  <KeyRound className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-foreground">
                    {hasPassword ? "Password Authentication" : "Set an Account Password"}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {hasPassword
                      ? "You have a password configured. You can update it anytime via email reset."
                      : "You currently sign in using Google. Set a password to also enable standard email/password login."}
                  </p>
                </div>
              </div>

              {resetSent ? (
                <div className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>
                    Instructions sent to <strong>{user?.email}</strong>. Please check your inbox.
                  </span>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSendingReset}
                  onClick={handlePasswordRequest}
                  className="mt-4 text-xs font-medium h-9 w-full sm:w-auto"
                >
                  {isSendingReset ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Sending Instructions...
                    </>
                  ) : hasPassword ? (
                    "Send Change Password Email"
                  ) : (
                    "Set a Password"
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

