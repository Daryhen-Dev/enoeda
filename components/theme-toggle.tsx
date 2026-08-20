"use client"

import { useEffect, useState } from "react"
import { MoonIcon, SunIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const isDarkTheme = resolvedTheme === "dark"
  const nextTheme = isDarkTheme ? "light" : "dark"
  const nextAction = `Cambiar a modo ${nextTheme === "dark" ? "oscuro" : "claro"}`

  return (
    <Button
      variant="ghost"
      size="icon"
      type="button"
      onClick={() => setTheme(nextTheme)}
      aria-label={nextAction}
    >
      {isDarkTheme ? (
        <SunIcon aria-hidden="true" />
      ) : (
        <MoonIcon aria-hidden="true" />
      )}
      <span className="sr-only">{nextAction}</span>
    </Button>
  )
}
