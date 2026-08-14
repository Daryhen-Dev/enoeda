"use client"

import { useState } from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { CreatedAccountCredentials } from "@/lib/domain/roles/actions"
import { ROLE_CREATION_MESSAGES } from "@/lib/localization/es-ec"

interface CreatedAccountDialogProps {
  credentials: CreatedAccountCredentials | null
  onClose: () => void
}

/**
 * Displays newly created account credentials exactly once. The temporary
 * password is never persisted client-side beyond this dialog's lifetime
 * and is not retrievable again after closing.
 */
export function CreatedAccountDialog({
  credentials,
  onClose,
}: CreatedAccountDialogProps) {
  const [copied, setCopied] = useState<"email" | "password" | null>(null)

  function handleCopy(field: "email" | "password", value: string) {
    void navigator.clipboard.writeText(value)
    setCopied(field)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <Dialog
      open={credentials !== null}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose()
      }}
    >
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{ROLE_CREATION_MESSAGES.CREDENTIALS_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>
            {ROLE_CREATION_MESSAGES.CREDENTIALS_DIALOG_DESCRIPTION}
          </DialogDescription>
        </DialogHeader>

        {credentials && (
          <div className="mt-4 space-y-3">
            <Field>
              <FieldLabel htmlFor="created-account-email">
                {ROLE_CREATION_MESSAGES.CREDENTIALS_EMAIL_LABEL}
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="created-account-email"
                  readOnly
                  value={credentials.email}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => handleCopy("email", credentials.email)}
                  aria-label={ROLE_CREATION_MESSAGES.COPY_ACTION}
                >
                  {copied === "email" ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
            </Field>
            <Field>
              <FieldLabel htmlFor="created-account-password">
                {ROLE_CREATION_MESSAGES.CREDENTIALS_PASSWORD_LABEL}
              </FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="created-account-password"
                  readOnly
                  value={credentials.temporaryPassword}
                  className="font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() =>
                    handleCopy("password", credentials.temporaryPassword)
                  }
                  aria-label={ROLE_CREATION_MESSAGES.COPY_ACTION}
                >
                  {copied === "password" ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
            </Field>
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button type="button" onClick={onClose}>
            {ROLE_CREATION_MESSAGES.CLOSE_ACTION}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
