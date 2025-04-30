import AppLayout from "@/components/AppLayout";
import type { ReactNode } from "react";

export default function AuthenticatedAppLayout({ children }: { children: ReactNode }) {
  return <AppLayout>{children}</AppLayout>;
}
