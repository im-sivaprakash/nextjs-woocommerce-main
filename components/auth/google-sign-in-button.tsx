"use client";

import { useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/defaultbutton";

// Extend Window interface for Google Identity Services
declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              logo_alignment?: "left" | "center";
              width?: string | number;
              locale?: string;
            }
          ) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
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

interface GoogleSignInButtonProps {
  mode?: "login" | "register";
  disabled?: boolean;
  onSuccess?: () => void;
}

export function GoogleSignInButton({
  mode = "login",
  disabled = false,
  onSuccess,
}: GoogleSignInButtonProps) {
  const { googleLogin, isLoading: storeLoading } = useAuthStore();
  const [isGsiLoaded, setIsGsiLoaded] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const googleBtnContainerRef = useRef<HTMLDivElement>(null);

  const clientId =
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
    process.env.PUBLIC_GOOGLE_CLIENT_ID;

  // Initialize and render GSI button
  useEffect(() => {
    if (!clientId) return;

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;

    const renderGsiButton = () => {
      if (!googleBtnContainerRef.current || !window.google?.accounts?.id || !isMounted) return;

      const container = googleBtnContainerRef.current;
      const parentWidth =
        container.clientWidth ||
        container.parentElement?.clientWidth ||
        (typeof window !== "undefined" ? Math.min(window.innerWidth - 48, 380) : 320);

      // Google Identity Services supports width between 200px and 400px
      const targetWidth = Math.min(Math.max(Math.floor(parentWidth), 200), 400);

      container.innerHTML = "";
      try {
        window.google.accounts.id.renderButton(container, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: mode === "register" ? "signup_with" : "signin_with",
          shape: "rectangular",
          logo_alignment: "center",
          width: targetWidth,
        });
      } catch (err) {
        console.warn("[GoogleSignInButton] Error rendering button:", err);
      }
    };

    const initializeGsi = () => {
      if (!window.google?.accounts?.id || !isMounted) return;

      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (response.credential) {
              setIsSubmitting(true);
              try {
                const res = await googleLogin(response.credential);
                if (res.success) {
                  toast.success("Welcome! Signed in with Google.");
                  onSuccess?.();
                } else {
                  toast.error(res.error || "Google sign-in failed");
                }
              } catch {
                toast.error("An unexpected error occurred during Google sign-in.");
              } finally {
                setIsSubmitting(false);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        setIsGsiLoaded(true);
        renderGsiButton();

        // Responsive re-render on container size changes
        if (googleBtnContainerRef.current && typeof ResizeObserver !== "undefined") {
          let resizeTimeout: NodeJS.Timeout;
          resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
              if (entry.contentRect.width > 0) {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                  if (isMounted) renderGsiButton();
                }, 150);
              }
            }
          });
          resizeObserver.observe(googleBtnContainerRef.current);
        }
      } catch (err) {
        console.warn("[GoogleSignInButton] Error initializing GSI:", err);
      }
    };

    // Check if script is already in document
    if (window.google?.accounts?.id) {
      initializeGsi();
    } else {
      const existingScript = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );

      if (existingScript) {
        existingScript.addEventListener("load", initializeGsi);
      } else {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = initializeGsi;
        document.head.appendChild(script);
      }
    }

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [clientId, mode, googleLogin, onSuccess]);

  const handleCustomClick = () => {
    if (!clientId) {
      toast.error(
        "Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env file."
      );
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt();
    } else {
      toast.info("Loading Google Sign-In, please try again in a moment...");
    }
  };

  const isLoading = storeLoading || isSubmitting;

  return (
    <div className="w-full my-3 flex justify-center max-w-full overflow-hidden">
      {/* Official GSI rendered button target */}
      <div
        ref={googleBtnContainerRef}
        className={`w-full max-w-full flex justify-center items-center min-h-[44px] overflow-hidden [&>div]:!max-w-full [&_iframe]:!max-w-full ${
          isGsiLoaded && !isLoading ? "flex" : "hidden"
        }`}
      />

      {/* Fallback & Loading state button */}
      {(!isGsiLoaded || isLoading) && (
        <Button
          type="button"
          variant="outline"
          disabled={disabled || isLoading}
          onClick={handleCustomClick}
          className="w-full h-11 text-sm font-medium gap-2.5 hover:bg-muted/70 transition-colors border-border/80"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span>Signing in with Google...</span>
            </>
          ) : (
            <>
              <GoogleIcon />
              <span>
                {mode === "register" ? "Sign up with Google" : "Continue with Google"}
              </span>
            </>
          )}
        </Button>
      )}
    </div>
  );
}
