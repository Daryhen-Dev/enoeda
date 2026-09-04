import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

interface StudentLayoutProps {
  children: ReactNode;
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <div className="min-h-screen bg-muted/40">
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <p className="font-semibold">{STUDENT_ENROLLMENT_MESSAGES.STUDENT_AREA_TITLE}</p>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
