"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      richColors
      closeButton
      position="top-right"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "rgba(117,188,139,0.18)",
          "--success-text": "var(--foreground)",
          "--success-border": "rgba(117,188,139,0.24)",
          "--info-bg": "rgba(127,184,201,0.18)",
          "--info-text": "var(--foreground)",
          "--info-border": "rgba(127,184,201,0.24)",
          "--warning-bg": "rgba(198,168,106,0.18)",
          "--warning-text": "var(--foreground)",
          "--warning-border": "rgba(198,168,106,0.24)",
          "--error-bg": "rgba(224,122,79,0.16)",
          "--error-text": "var(--foreground)",
          "--error-border": "rgba(224,122,79,0.24)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
