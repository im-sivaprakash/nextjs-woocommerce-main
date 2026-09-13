import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign In or Register",
  description: "Sign in to your account or create a new account.",
};

function AuthLoading() {
  return (
    <div className="w-full max-w-md mx-auto p-12 rounded-2xl border border-border/70 bg-card flex flex-col items-center justify-center min-h-[400px]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:py-16 flex items-center justify-center min-h-[calc(100vh-16rem)]">
      <Suspense fallback={<AuthLoading />}>
        <AuthForm initialMode="login" />
      </Suspense>
    </div>
  );
}
