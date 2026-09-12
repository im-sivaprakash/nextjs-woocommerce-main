import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your account password.",
};

export default function ForgotPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:py-16 flex items-center justify-center min-h-[calc(100vh-16rem)]">
      <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
        <AuthForm initialMode="forgot-password" />
      </Suspense>
    </div>
  );
}
