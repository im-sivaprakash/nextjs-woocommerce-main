import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { Loader2 } from "lucide-react";

export const metadata: Metadata = {
  title: "Create Account",
  description: "Register a new customer account.",
};

export default function RegisterPage() {
  return (
    <div className="container mx-auto px-4 py-12 sm:py-16 flex items-center justify-center min-h-[calc(100vh-16rem)]">
      <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
        <AuthForm initialMode="register" />
      </Suspense>
    </div>
  );
}
