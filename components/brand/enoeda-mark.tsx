import Image from "next/image"

import logo from "@/assets/Logo Enoeda Dojo_Rojo.png"

interface EnoedaMarkProps {
  className?: string
}

/**
 * Brand mark: the real Enoeda Dojo emblem. Decorative by default — the
 * visible "Enoeda Dojo" text sits next to it, so it is aria-hidden.
 */
export function EnoedaMark({ className }: EnoedaMarkProps) {
  return (
    <Image
      src={logo}
      alt=""
      aria-hidden="true"
      sizes="32px"
      className={className}
    />
  )
}
