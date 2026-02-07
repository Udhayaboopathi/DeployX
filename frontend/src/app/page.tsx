"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store";
import { fetchPlatformStatus } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await fetchPlatformStatus();
        if (!data.has_admin) {
          // No users yet → first-time onboarding
          router.replace("/auth/register");
        } else if (isAuthenticated) {
          router.replace("/dashboard");
        } else {
          router.replace("/auth/login");
        }
      } catch {
        // Backend not ready yet — fallback
        router.replace("/auth/login");
      } finally {
        setChecking(false);
      }
    })();
  }, [isAuthenticated, router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-100">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-gray-500 text-sm">Initializing DeployX…</p>
        </div>
      </div>
    );
  }

  return null;
}
