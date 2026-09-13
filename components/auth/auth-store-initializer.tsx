"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/store/auth-store";

export function AuthStoreInitializer() {
  useEffect(() => {
    useAuthStore.getState().initAuth();
  }, []);

  return null;
}
