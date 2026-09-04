"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { updateOwnStudentPhone } from "@/lib/domain/student-enrollment";
import {
  STUDENT_ENROLLMENT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec";

interface StudentPhoneFormProps {
  isActive: boolean;
  phone: string | null;
}

export function StudentPhoneForm({ isActive, phone: initialPhone }: StudentPhoneFormProps) {
  const router = useRouter();
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isActive) {
      return;
    }

    startTransition(async () => {
      const result = await updateOwnStudentPhone({ phone: phone || null });
      if (!result.success) {
        setError(result.error ?? STUDENT_ENROLLMENT_MESSAGES.PHONE_SAVE_FAILURE);
        return;
      }

      setError(null);
      toast.success(TOAST_MESSAGES.STUDENT_PHONE_UPDATED);
      router.refresh();
    });
  }

  return (
    <form className="max-w-xl" onSubmit={handleSubmit}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="student-profile-phone">
            {STUDENT_ENROLLMENT_MESSAGES.PHONE_LABEL}
          </FieldLabel>
          <Input
            disabled={!isActive || isPending}
            id="student-profile-phone"
            maxLength={30}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            value={phone}
          />
          {error ? <FieldError>{error}</FieldError> : null}
        </Field>
        {isActive ? (
          <Button disabled={isPending} type="submit">
            {isPending
              ? STUDENT_ENROLLMENT_MESSAGES.UPDATING
              : STUDENT_ENROLLMENT_MESSAGES.UPDATE_PHONE_ACTION}
          </Button>
        ) : null}
      </FieldGroup>
    </form>
  );
}
