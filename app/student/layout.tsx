import type { ReactNode } from "react";

import { LogoutButton } from "@/components/auth/logout-button";
import { EnoedaMark } from "@/components/brand/enoeda-mark";
import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

interface StudentLayoutProps {
  children: ReactNode;
}

export default function StudentLayout({ children }: StudentLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-primary-foreground">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <EnoedaMark className="size-7 shrink-0 rounded-full" />
            <p className="truncate font-semibold">
              {STUDENT_ENROLLMENT_MESSAGES.STUDENT_AREA_TITLE}
            </p>
          </div>
          {/* The outline LogoutButton renders on its own paper background from
              the shared tokens, and the wrapper keeps its rare error text off
              the ink bar, so both stay legible on ink without touching
              components/auth. */}
          <div className="rounded-md bg-background p-1">
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
