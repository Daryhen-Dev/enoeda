"use client"

import Image from "next/image"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { useEffect, useRef, useState, type KeyboardEvent } from "react"

import enoedaLogo from "@/assets/Logo Enoeda Dojo_Rojo.png"
import { MARKETING_NAVIGATION } from "@/components/marketing/navigation"

const MOBILE_MENU_ID = "marketing-mobile-menu"

export function MarketingHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const firstMenuLinkRef = useRef<HTMLAnchorElement>(null)
  const lastMenuLinkRef = useRef<HTMLAnchorElement>(null)
  const mobileHomeLinkRef = useRef<HTMLAnchorElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const shouldRestoreFocusRef = useRef(true)
  const wasMenuOpenRef = useRef(false)

  useEffect(() => {
    if (isMenuOpen) {
      wasMenuOpenRef.current = true
      firstMenuLinkRef.current?.focus()
      return
    }

    if (wasMenuOpenRef.current && shouldRestoreFocusRef.current) {
      menuButtonRef.current?.focus()
    }

    shouldRestoreFocusRef.current = true
    wasMenuOpenRef.current = false
  }, [isMenuOpen])

  function closeMenuAfterNavigation() {
    shouldRestoreFocusRef.current = false
    setIsMenuOpen(false)
  }

  function handleMobileMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setIsMenuOpen(false)
    }
  }

  function trapFocusFromMobileHomeLink(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === "Tab" && event.shiftKey) {
      event.preventDefault()
      lastMenuLinkRef.current?.focus()
    }
  }

  function trapFocusFromLastMenuLink(event: KeyboardEvent<HTMLAnchorElement>) {
    if (event.key === "Tab" && !event.shiftKey) {
      event.preventDefault()
      mobileHomeLinkRef.current?.focus()
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b-2 border-marketing-section-border bg-marketing-surface/85 backdrop-blur-lg">
      <div className="mx-auto flex h-18 max-w-360 items-center justify-between px-5 sm:px-8 lg:px-16">
        <Link
          aria-label="Ir al inicio de ENOEDA Dojo"
          className="inline-flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-foreground"
          href="/"
        >
          <Image
            alt=""
            className="h-14 w-14 object-contain"
            priority
            src={enoedaLogo}
          />
        </Link>

        <nav aria-label="Navegación principal" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {MARKETING_NAVIGATION.map((item) => (
              <li key={item.href}>
                <a
                  className="font-marketing-body text-sm font-bold uppercase tracking-[0.14em] text-marketing-menu-foreground underline-offset-6 transition-colors hover:text-marketing-accent focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-menu-foreground"
                  href={item.href}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <button
          aria-controls={MOBILE_MENU_ID}
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Cerrar navegación" : "Abrir navegación"}
          className="grid size-11 place-items-center border-2 border-marketing-menu-border text-marketing-menu-foreground transition-colors hover:bg-marketing-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-foreground md:hidden"
          onClick={() => setIsMenuOpen((isOpen) => !isOpen)}
          ref={menuButtonRef}
          type="button"
        >
          {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
      </div>

      {isMenuOpen ? (
        <div
          aria-label="Navegación móvil"
          className="fixed inset-0 z-50 flex min-h-dvh flex-col bg-marketing-surface/90 px-5 py-6 text-marketing-menu-foreground backdrop-blur-xl sm:px-8"
          id={MOBILE_MENU_ID}
          onKeyDown={handleMobileMenuKeyDown}
          role="navigation"
        >
          <div className="flex items-center justify-between border-b-2 border-marketing-menu-border pb-5">
            <Link
              aria-label="Ir al inicio de ENOEDA Dojo"
              className="inline-flex shrink-0 items-center focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-foreground"
              href="/"
              onClick={closeMenuAfterNavigation}
              onKeyDown={trapFocusFromMobileHomeLink}
              ref={mobileHomeLinkRef}
            >
              <Image
                alt=""
                className="h-14 w-14 object-contain"
                priority
                src={enoedaLogo}
              />
            </Link>
            <button
              aria-label="Cerrar navegación"
              className="grid size-11 place-items-center border-2 border-marketing-menu-border text-marketing-menu-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-surface"
              onClick={() => setIsMenuOpen(false)}
              type="button"
            >
              <X aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Destinos de la navegación móvil" className="my-auto">
            <ul className="space-y-5">
              {MARKETING_NAVIGATION.map((item, index) => (
                <li key={item.href}>
                  <a
                    className="block border-b-2 border-marketing-menu-border pb-4 font-marketing-display text-6xl leading-none tracking-[0.02em] text-marketing-menu-foreground focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-surface"
                    href={item.href}
                    onClick={closeMenuAfterNavigation}
                    onKeyDown={
                      index === MARKETING_NAVIGATION.length - 1
                        ? trapFocusFromLastMenuLink
                        : undefined
                    }
                    ref={
                      index === 0
                        ? firstMenuLinkRef
                        : index === MARKETING_NAVIGATION.length - 1
                          ? lastMenuLinkRef
                          : undefined
                    }
                  >
                    {item.label.toUpperCase()}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <p className="font-marketing-body text-sm font-bold uppercase tracking-[0.16em]">
            Disciplina en movimiento
          </p>
        </div>
      ) : null}
    </header>
  )
}
