"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
        ),
      }}
      // Toasts float above content, so they are glass (solid under reduced transparency); see .toaster in globals.css.
      // Placed under the floating nav so they never cover it.
      offset={{ top: "var(--sticky-top)", right: 16 }}
      mobileOffset={{ top: "var(--sticky-top)", left: 12, right: 12 }}
      style={
        {
          "--normal-bg": "var(--glass-bg-thick)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--glass-rim)",
          "--border-radius": "var(--radius-card-lg)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
          description: "text-foreground/75!",
          success: "[&_[data-icon]]:text-success",
          error: "[&_[data-icon]]:text-danger",
          warning: "[&_[data-icon]]:text-warning",
          info: "[&_[data-icon]]:text-accent-link",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
