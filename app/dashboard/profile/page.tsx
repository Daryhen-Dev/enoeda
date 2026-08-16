import { redirect } from "next/navigation"
import { AlertCircleIcon, UserRoundIcon } from "lucide-react"

import { ProfileForm } from "@/components/profile/profile-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { fetchCurrentRoles } from "@/lib/auth/server-roles"
import { getOwnProfile } from "@/lib/domain/profile"
import { PROFILE_MESSAGES } from "@/lib/localization/es-ec"

export default async function ProfilePage() {
  const roles = await fetchCurrentRoles()
  const canManageProfile = roles.includes("admin") || roles.includes("teacher")
  if (!canManageProfile) redirect("/dashboard")

  const profileResult = await getOwnProfile()
  if (!profileResult.success) {
    return (
      <div className="flex flex-col gap-4 p-4 md:gap-6 md:p-6">
        <Alert variant="destructive">
          <AlertCircleIcon />
          <AlertTitle>{PROFILE_MESSAGES.PAGE_TITLE}</AlertTitle>
          <AlertDescription>{PROFILE_MESSAGES.LOAD_FAILURE}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const isSetup = profileResult.data === null
  return (
    <div className="flex flex-col gap-6 p-4 md:gap-8 md:p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          <UserRoundIcon className="size-5 text-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">{PROFILE_MESSAGES.PAGE_TITLE}</h1>
          <p className="text-sm text-muted-foreground">
            {isSetup ? PROFILE_MESSAGES.SETUP_DESCRIPTION : PROFILE_MESSAGES.PAGE_DESCRIPTION}
          </p>
        </div>
      </div>
      <ProfileForm profile={profileResult.data ?? null} />
    </div>
  )
}
