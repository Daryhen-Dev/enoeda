"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  completeStudentEnrollment,
  setStudentEnrollmentPassword,
} from "@/lib/domain/student-enrollment";
import {
  STUDENT_ENROLLMENT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec";

interface EnrollmentFlowProps {
  email: string;
  passwordConfigured: boolean;
}

export function EnrollmentFlow({
  email,
  passwordConfigured: initialPasswordConfigured,
}: EnrollmentFlowProps) {
  const router = useRouter();
  const [passwordConfigured, setPasswordConfigured] = useState(
    initialPasswordConfigured
  );
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [surname, setSurname] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [phone, setPhone] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await setStudentEnrollmentPassword({ password });
      if (!result.success) {
        setActionError(result.error ?? STUDENT_ENROLLMENT_MESSAGES.PASSWORD_SAVE_FAILURE);
        return;
      }

      setActionError(null);
      setPassword("");
      setPasswordConfigured(true);
      toast.success(TOAST_MESSAGES.PASSWORD_CHANGED);
      router.refresh();
    });
  }

  function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(async () => {
      const result = await completeStudentEnrollment({
        date_of_birth: dateOfBirth,
        first_name: firstName,
        national_id: nationalId,
        phone: phone || undefined,
        surname,
      });
      if (!result.success) {
        setActionError(result.error ?? STUDENT_ENROLLMENT_MESSAGES.ENROLLMENT_SAVE_FAILURE);
        return;
      }

      setActionError(null);
      toast.success(TOAST_MESSAGES.STUDENT_ENROLLMENT_COMPLETED);
      router.replace("/student");
      router.refresh();
    });
  }

  return (
    <section className="w-full max-w-xl rounded-lg border bg-card p-6 shadow-sm">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {passwordConfigured
            ? STUDENT_ENROLLMENT_MESSAGES.ENROLLMENT_TITLE
            : STUDENT_ENROLLMENT_MESSAGES.PASSWORD_TITLE}
        </h1>
        <p className="text-sm text-muted-foreground">
          {passwordConfigured
            ? STUDENT_ENROLLMENT_MESSAGES.ENROLLMENT_DESCRIPTION
            : STUDENT_ENROLLMENT_MESSAGES.PASSWORD_DESCRIPTION}
        </p>
      </div>

      {actionError ? (
        <Alert className="mt-6" variant="destructive">
          <AlertTitle>{STUDENT_ENROLLMENT_MESSAGES.ENROLLMENT_TITLE}</AlertTitle>
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      ) : null}

      {passwordConfigured ? (
        <form className="mt-6" onSubmit={handleProfileSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="student-enrollment-first-name">
                {STUDENT_ENROLLMENT_MESSAGES.FIRST_NAME_LABEL}
              </FieldLabel>
              <Input
                disabled={isPending}
                id="student-enrollment-first-name"
                onChange={(event) => setFirstName(event.target.value)}
                required
                value={firstName}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="student-enrollment-surname">
                {STUDENT_ENROLLMENT_MESSAGES.SURNAME_LABEL}
              </FieldLabel>
              <Input
                disabled={isPending}
                id="student-enrollment-surname"
                onChange={(event) => setSurname(event.target.value)}
                required
                value={surname}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="student-enrollment-national-id">
                {STUDENT_ENROLLMENT_MESSAGES.NATIONAL_ID_LABEL}
              </FieldLabel>
              <Input
                disabled={isPending}
                id="student-enrollment-national-id"
                maxLength={30}
                onChange={(event) => setNationalId(event.target.value)}
                required
                value={nationalId}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="student-enrollment-date-of-birth">
                {STUDENT_ENROLLMENT_MESSAGES.DATE_OF_BIRTH_LABEL}
              </FieldLabel>
              <Input
                disabled={isPending}
                id="student-enrollment-date-of-birth"
                onChange={(event) => setDateOfBirth(event.target.value)}
                required
                type="date"
                value={dateOfBirth}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="student-enrollment-email">
                {STUDENT_ENROLLMENT_MESSAGES.EMAIL_LABEL}
              </FieldLabel>
              <Input
                aria-describedby="student-enrollment-email-description"
                disabled
                id="student-enrollment-email"
                readOnly
                type="email"
                value={email}
              />
              <p id="student-enrollment-email-description" className="text-sm text-muted-foreground">
                {STUDENT_ENROLLMENT_MESSAGES.PROFILE_EMAIL_DESCRIPTION}
              </p>
            </Field>
            <Field>
              <FieldLabel htmlFor="student-enrollment-phone">
                {STUDENT_ENROLLMENT_MESSAGES.PHONE_LABEL}
              </FieldLabel>
              <Input
                disabled={isPending}
                id="student-enrollment-phone"
                maxLength={30}
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                value={phone}
              />
            </Field>
            <Button disabled={isPending} type="submit">
              {isPending
                ? STUDENT_ENROLLMENT_MESSAGES.UPDATING
                : STUDENT_ENROLLMENT_MESSAGES.ENROLLMENT_TITLE}
            </Button>
          </FieldGroup>
        </form>
      ) : (
        <form className="mt-6" onSubmit={handlePasswordSubmit}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="student-enrollment-password">
                {STUDENT_ENROLLMENT_MESSAGES.PASSWORD_LABEL}
              </FieldLabel>
              <Input
                autoComplete="new-password"
                disabled={isPending}
                id="student-enrollment-password"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </Field>
            <Button disabled={isPending} type="submit">
              {isPending
                ? STUDENT_ENROLLMENT_MESSAGES.UPDATING
                : STUDENT_ENROLLMENT_MESSAGES.PASSWORD_TITLE}
            </Button>
          </FieldGroup>
        </form>
      )}
    </section>
  );
}
