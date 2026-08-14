import { redirect } from "next/navigation"

import { getPersonaHome } from "@/lib/auth/redirect"
import { fetchCurrentRoles } from "@/lib/auth/server-roles"

export default async function Home() {
  const roles = await fetchCurrentRoles()
  redirect(getPersonaHome(roles))
}
