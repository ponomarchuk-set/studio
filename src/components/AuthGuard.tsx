"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login"); // Redirect to login if not authenticated
    }
  }, [user, loading, router]);

  if (loading || !user) {
     // Show loading state or redirect placeholder while checking auth
     return (
         <div className="flex items-center justify-center min-h-screen">
              <Skeleton className="h-12 w-1/2 rounded-md" />
         </div>
        );
  }

  return <>{children}</>;
}
