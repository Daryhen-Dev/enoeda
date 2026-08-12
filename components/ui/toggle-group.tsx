"use client"

import { createContext, useContext } from "react"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { type VariantProps } from "class-variance-authority"

import { toggleVariants } from "@/components/ui/toggle"
import { cn } from "@/lib/utils"

const TOGGLE_GROUP_ORIENTATIONS = {
  HORIZONTAL: "horizontal",
  VERTICAL: "vertical",
} as const

type ToggleGroupVariantProps = VariantProps<typeof toggleVariants>
type ToggleGroupOrientation =
  (typeof TOGGLE_GROUP_ORIENTATIONS)[keyof typeof TOGGLE_GROUP_ORIENTATIONS]

interface ToggleGroupContextValue {
  variant: ToggleGroupVariantProps["variant"]
  size: ToggleGroupVariantProps["size"]
  spacing: number
  orientation: ToggleGroupOrientation
}

interface ToggleGroupProps extends ToggleGroupPrimitive.Props {
  variant?: ToggleGroupVariantProps["variant"]
  size?: ToggleGroupVariantProps["size"]
  spacing?: number
}

interface ToggleGroupItemProps extends TogglePrimitive.Props {
  variant?: ToggleGroupVariantProps["variant"]
  size?: ToggleGroupVariantProps["size"]
}

const ToggleGroupContext = createContext<ToggleGroupContextValue>({
  size: "default",
  variant: "default",
  spacing: 2,
  orientation: TOGGLE_GROUP_ORIENTATIONS.HORIZONTAL,
})

function ToggleGroup({
  className,
  variant,
  size,
  spacing = 2,
  orientation = TOGGLE_GROUP_ORIENTATIONS.HORIZONTAL,
  style,
  children,
  ...props
}: ToggleGroupProps) {
  const groupStyle =
    typeof style === "function"
      ? (state: ToggleGroupPrimitive.State) => ({
          gap: spacing,
          ...style(state),
        })
      : { gap: spacing, ...style }

  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-spacing={spacing}
      data-orientation={orientation}
      style={groupStyle}
      className={cn(
        "group/toggle-group flex w-fit flex-row items-center rounded-lg data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch",
        className
      )}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{ variant, size, spacing, orientation }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: ToggleGroupItemProps) {
  const context = useContext(ToggleGroupContext)
  const itemVariant = context.variant ?? variant
  const itemSize = context.size ?? size

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      data-variant={itemVariant}
      data-size={itemSize}
      data-spacing={context.spacing}
      className={cn(
        "shrink-0 focus:z-10 focus-visible:z-10 group-data-[spacing=0]/toggle-group:rounded-none group-data-[spacing=0]/toggle-group:px-2 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-end]:pr-1.5 group-data-[spacing=0]/toggle-group:has-data-[icon=inline-start]:pl-1.5 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:first:rounded-l-lg group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:first:rounded-t-lg group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:last:rounded-r-lg group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:last:rounded-b-lg group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-l-0 group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:border-t-0 group-data-[orientation=horizontal]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-l group-data-[orientation=vertical]/toggle-group:data-[spacing=0]:data-[variant=outline]:first:border-t",
        toggleVariants({ variant: itemVariant, size: itemSize }),
        className
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
