"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/lib/store/auth-store";
import { forgotPasswordAction } from "@/lib/actions/auth";
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  CheckCircle2,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/defaultbutton";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register" | "forgot-password";

interface AuthFormProps {
  initialMode?: AuthMode;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24">
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

export function AuthForm({ initialMode = "login" }: AuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnUrl = searchParams.get("returnUrl") || "/account";

  const { login, register, isLoading } = useAuthStore();

  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Form states
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [regFirstName, setRegFirstName] = useState("");
  const [regLastName, setRegLastName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirmPassword, setRegConfirmPassword] = useState("");

  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotSubmitting, setIsForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);

  // Handle Login Submit
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !loginPassword) {
      toast.error("Please enter both email/username and password.");
      return;
    }

    const res = await login({
      emailOrUsername: loginEmail,
      password: loginPassword,
    });

    if (!res.success) {
      toast.error(res.error || "Login failed. Please check your credentials.");
      return;
    }

    toast.success("Welcome back! Signed in successfully.");
    router.push(returnUrl);
    router.refresh();
  };

  // Handle Register Submit
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regFirstName.trim()) {
      toast.error("Please enter your first name.");
      return;
    }
    if (!regEmail.trim()) {
      toast.error("Please enter a valid email address.");
      return;
    }
    if (regPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (regPassword !== regConfirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const res = await register({
      firstName: regFirstName,
      lastName: regLastName,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirmPassword,
    });

    if (useAuthStore.getState().isAuthenticated) {
      toast.success("Welcome! Your account was created and you are now signed in.");
      router.push(returnUrl);
      router.refresh();
      return;
    }

    // Otherwise, transition to login tab with email prefilled
    toast.success(
      res.message || "Account created successfully! Please sign in."
    );
    setLoginEmail(regEmail);
    setLoginPassword(regPassword);
    setMode("login");
  };

  // Handle Forgot Password Submit
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Please enter your email address.");
      return;
    }

    setIsForgotSubmitting(true);
    try {
      const res = await forgotPasswordAction(forgotEmail);
      if (!res.success) {
        toast.error(res.error || "Failed to request password reset.");
      } else {
        setForgotSuccess(true);
        toast.success(res.message || "Password reset instructions sent!");
      }
    } catch {
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsForgotSubmitting(false);
    }
  };

  const handleGooglePlaceholder = () => {
    toast.info("Google Sign-In is ready to be configured with your OAuth client.");
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Outer Card Container */}
      <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-6 sm:p-8 shadow-xl shadow-black/5 dark:shadow-black/30 transition-all">
        
        {/* Mode Switcher Tabs (Only visible when not on Forgot Password) */}
        {mode !== "forgot-password" && (
          <div className="grid grid-cols-2 p-1 mb-8 rounded-xl bg-muted/60 border border-border/40">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={cn(
                "py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                mode === "login"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={cn(
                "py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer",
                mode === "register"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Create Account
            </button>
          </div>
        )}

        {/* ─── 1. SIGN IN VIEW ────────────────────────────────────────────── */}
        {mode === "login" && (
          <div>
            <div className="text-center mb-6">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
                Welcome Back
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Sign in to manage your orders, wishlist, and profile.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="login-email"
                  className="text-xs font-medium text-foreground block"
                >
                  Email or Username
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-email"
                    type="text"
                    placeholder="name@example.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="pl-9 h-10 text-sm"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="text-xs font-medium text-foreground block"
                  >
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(loginEmail);
                      setForgotSuccess(false);
                      setMode("forgot-password");
                    }}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="pl-9 pr-9 h-10 text-sm"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-2 text-sm font-medium gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Social Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGooglePlaceholder}
              className="w-full h-10 text-sm font-medium gap-2.5 hover:bg-muted/70 transition-colors border-border/80"
            >
              <GoogleIcon />
              <span>Continue with Google</span>
            </Button>

            <div className="mt-6 text-center text-xs sm:text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("register")}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                Sign up now
              </button>
            </div>
          </div>
        )}

        {/* ─── 2. REGISTER VIEW ───────────────────────────────────────────── */}
        {mode === "register" && (
          <div>
            <div className="text-center mb-6">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight">
                Create Account
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Join us for faster checkout and order tracking.
              </p>
            </div>

            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-first-name"
                    className="text-xs font-medium text-foreground block"
                  >
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="reg-first-name"
                      type="text"
                      placeholder="Jane"
                      value={regFirstName}
                      onChange={(e) => setRegFirstName(e.target.value)}
                      className="pl-9 h-10 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="reg-last-name"
                    className="text-xs font-medium text-foreground block"
                  >
                    Last Name
                  </label>
                  <Input
                    id="reg-last-name"
                    type="text"
                    placeholder="Doe"
                    value={regLastName}
                    onChange={(e) => setRegLastName(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reg-email"
                  className="text-xs font-medium text-foreground block"
                >
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="name@example.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="pl-9 h-10 text-sm"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reg-password"
                  className="text-xs font-medium text-foreground block"
                >
                  Password (min. 6 characters)
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="reg-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="pl-9 pr-9 h-10 text-sm"
                    autoComplete="new-password"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="reg-confirm-password"
                  className="text-xs font-medium text-foreground block"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="reg-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    className="pl-9 pr-9 h-10 text-sm"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-10 mt-2 text-sm font-medium gap-2 shadow-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            {/* Social Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground font-medium">
                  Or continue with
                </span>
              </div>
            </div>

            {/* Google Sign-In Button */}
            <Button
              type="button"
              variant="outline"
              onClick={handleGooglePlaceholder}
              className="w-full h-10 text-sm font-medium gap-2.5 hover:bg-muted/70 transition-colors border-border/80"
            >
              <GoogleIcon />
              <span>Sign up with Google</span>
            </Button>

            <div className="mt-6 text-center text-xs sm:text-sm text-muted-foreground">
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-primary hover:underline font-semibold cursor-pointer"
              >
                Sign in
              </button>
            </div>
          </div>
        )}

        {/* ─── 3. FORGOT PASSWORD VIEW ────────────────────────────────────── */}
        {mode === "forgot-password" && (
          <div>
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <KeyRound className="h-6 w-6" />
              </div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">
                Reset Password
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">
                Enter your email address and we&apos;ll send you instructions to reset
                your password.
              </p>
            </div>

            {forgotSuccess ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-3">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                <p className="text-xs sm:text-sm text-foreground font-medium">
                  If an account exists for{" "}
                  <span className="font-semibold">{forgotEmail}</span>, you will
                  receive a password reset email shortly.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setLoginEmail(forgotEmail);
                    setMode("login");
                  }}
                  className="mt-2 text-xs"
                >
                  Return to Sign In
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="forgot-email"
                    className="text-xs font-medium text-foreground block"
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="name@example.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      className="pl-9 h-10 text-sm"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isForgotSubmitting}
                  className="w-full h-10 text-sm font-medium gap-2 shadow-sm"
                >
                  {isForgotSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending instructions...
                    </>
                  ) : (
                    "Send Reset Instructions"
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-xs text-muted-foreground hover:text-foreground font-medium hover:underline cursor-pointer"
                  >
                    &larr; Back to Sign In
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
