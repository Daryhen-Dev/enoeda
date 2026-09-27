"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { PublicBranchOption } from "@/lib/domain/student-registration";
import {
  PUBLIC_STUDENT_REGISTRATION_MESSAGES,
  STUDENT_ENROLLMENT_MESSAGES,
} from "@/lib/localization/es-ec";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

interface PublicStudentRegistrationFormProps {
  branches: PublicBranchOption[];
}

function getResponseError(body: unknown): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }

  return PUBLIC_STUDENT_REGISTRATION_MESSAGES.GENERIC_FAILURE;
}

export function PublicStudentRegistrationForm({
  branches,
}: PublicStudentRegistrationFormProps) {
  const router = useRouter();
  const [actionError, setActionError] = useState<string | null>(null);
  const [isCaptchaReady, setIsCaptchaReady] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const hasActiveBranches = branches.length > 0;

  useEffect(() => {
    let cancelled = false;

    void import("altcha")
      .then(() => {
        if (!cancelled) {
          setIsCaptchaReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActionError(PUBLIC_STUDENT_REGISTRATION_MESSAGES.CAPTCHA_FAILURE);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCaptchaReady || isPending || !hasActiveBranches) {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    if (typeof email !== "string" || typeof password !== "string") {
      setActionError(PUBLIC_STUDENT_REGISTRATION_MESSAGES.GENERIC_FAILURE);
      return;
    }

    setActionError(null);
    setIsPending(true);

    try {
      const response = await fetch("/api/public/student-registration", {
        body: formData,
        method: "POST",
      });
      if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        setActionError(getResponseError(body));
        return;
      }

      const supabase = createBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || data.user === null) {
        setActionError(PUBLIC_STUDENT_REGISTRATION_MESSAGES.SIGN_IN_FAILURE);
        return;
      }

      router.replace("/student");
      router.refresh();
    } catch {
      setActionError(PUBLIC_STUDENT_REGISTRATION_MESSAGES.GENERIC_FAILURE);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form aria-busy={isPending} className="mt-6" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="public-registration-branch">
            {PUBLIC_STUDENT_REGISTRATION_MESSAGES.BRANCH_LABEL}
          </FieldLabel>
          <select
            className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
            defaultValue=""
            disabled={!hasActiveBranches || isPending}
            id="public-registration-branch"
            name="branch_id"
            required
          >
            <option disabled value="">
              {PUBLIC_STUDENT_REGISTRATION_MESSAGES.BRANCH_LABEL}
            </option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
          {!hasActiveBranches ? (
            <p className="text-sm text-muted-foreground">
              {PUBLIC_STUDENT_REGISTRATION_MESSAGES.NO_ACTIVE_BRANCHES}
            </p>
          ) : null}
        </Field>

        <Field>
          <FieldLabel htmlFor="public-registration-first-name">
            {STUDENT_ENROLLMENT_MESSAGES.FIRST_NAME_LABEL}
          </FieldLabel>
          <Input
            autoComplete="given-name"
            disabled={isPending}
            id="public-registration-first-name"
            maxLength={100}
            name="first_name"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="public-registration-surname">
            {STUDENT_ENROLLMENT_MESSAGES.SURNAME_LABEL}
          </FieldLabel>
          <Input
            autoComplete="family-name"
            disabled={isPending}
            id="public-registration-surname"
            maxLength={100}
            name="surname"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="public-registration-national-id">
            {STUDENT_ENROLLMENT_MESSAGES.NATIONAL_ID_LABEL}
          </FieldLabel>
          <Input
            disabled={isPending}
            id="public-registration-national-id"
            maxLength={30}
            name="national_id"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="public-registration-date-of-birth">
            {STUDENT_ENROLLMENT_MESSAGES.DATE_OF_BIRTH_LABEL}
          </FieldLabel>
          <Input
            autoComplete="bday"
            disabled={isPending}
            id="public-registration-date-of-birth"
            name="date_of_birth"
            required
            type="date"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="public-registration-email">
            {STUDENT_ENROLLMENT_MESSAGES.EMAIL_LABEL}
          </FieldLabel>
          <Input
            autoComplete="email"
            disabled={isPending}
            id="public-registration-email"
            name="email"
            required
            type="email"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="public-registration-password">
            {STUDENT_ENROLLMENT_MESSAGES.PASSWORD_LABEL}
          </FieldLabel>
          <Input
            autoComplete="new-password"
            disabled={isPending}
            id="public-registration-password"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="public-registration-phone">
            {STUDENT_ENROLLMENT_MESSAGES.PHONE_LABEL}
          </FieldLabel>
          <Input
            autoComplete="tel"
            disabled={isPending}
            id="public-registration-phone"
            maxLength={30}
            name="phone"
            required
            type="tel"
          />
        </Field>

        <Field>
          <FieldLabel>{PUBLIC_STUDENT_REGISTRATION_MESSAGES.CAPTCHA_LABEL}</FieldLabel>
          <altcha-widget
            aria-label={PUBLIC_STUDENT_REGISTRATION_MESSAGES.CAPTCHA_LABEL}
            challenge="/api/public/altcha/challenge"
            className="block min-h-12"
            name="altcha"
          />
          {!isCaptchaReady ? (
            <p aria-live="polite" className="text-sm text-muted-foreground" role="status">
              {PUBLIC_STUDENT_REGISTRATION_MESSAGES.CAPTCHA_LOADING}
            </p>
          ) : null}
        </Field>

        {actionError ? (
          <Alert variant="destructive">
            <AlertTitle>{PUBLIC_STUDENT_REGISTRATION_MESSAGES.TITLE}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        ) : null}

        <Button
          aria-busy={isPending}
          disabled={!hasActiveBranches || !isCaptchaReady || isPending}
          type="submit"
        >
          {isPending
            ? PUBLIC_STUDENT_REGISTRATION_MESSAGES.REGISTERING
            : PUBLIC_STUDENT_REGISTRATION_MESSAGES.REGISTER_ACTION}
        </Button>
      </FieldGroup>
    </form>
  );
}
