"use client";

import { Toaster } from "sonner";

export function NotificationProvider() {
  return (
    <Toaster
      position="top-right"
      theme="dark"
      className="toaster-group"
      toastOptions={{
        style: {
          background: "hsl(var(--background))",
          color: "hsl(var(--foreground))",
          border: "1px solid hsl(var(--border))",
        },
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          success:
            "group-[.toast]:bg-green-50 group-[.toast]:border-green-200 group-[.toast]:text-green-900 dark:group-[.toast]:bg-green-950 dark:group-[.toast]:border-green-800 dark:group-[.toast]:text-green-100",
          error:
            "group-[.toast]:bg-red-50 group-[.toast]:border-red-200 group-[.toast]:text-red-900 dark:group-[.toast]:bg-red-950 dark:group-[.toast]:border-red-800 dark:group-[.toast]:text-red-100",
          warning:
            "group-[.toast]:bg-yellow-50 group-[.toast]:border-yellow-200 group-[.toast]:text-yellow-900 dark:group-[.toast]:bg-yellow-950 dark:group-[.toast]:border-yellow-800 dark:group-[.toast]:text-yellow-100",
          info: "group-[.toast]:bg-blue-50 group-[.toast]:border-blue-200 group-[.toast]:text-blue-900 dark:group-[.toast]:bg-blue-950 dark:group-[.toast]:border-blue-800 dark:group-[.toast]:text-blue-100",
        },
      }}
      closeButton
      richColors
      expand={false}
      visibleToasts={5}
      offset="16px"
    />
  );
}
