"use client";

import { useEffect, type ReactNode } from "react";

import { Box } from "./box.js";
import { Text } from "./text.js";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string | undefined;
  children?: ReactNode;
  footer?: ReactNode;
  width?: "md" | "lg";
};

const widths = {
  md: "max-w-md",
  lg: "max-w-2xl",
};

/**
 * Right-side sliding panel used for create/edit forms and confirmations.
 * Built on top of `Box`/`Text`.
 */
export const Drawer = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: DrawerProps) => {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <Box
      aria-hidden={!open}
      className={`fixed inset-0 z-50 ${
        open ? "" : "pointer-events-none"
      }`}
    >
      <Box
        onClick={onClose}
        className={`absolute inset-0 bg-gray-900/40 transition-opacity duration-200 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      <Box
        as="aside"
        className={`absolute right-0 top-0 h-full w-full flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${
          widths[width]
        } ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        <Box className="items-start justify-between border-b border-gray-200 px-6 py-4">
          <Box className="flex-col gap-0.5">
            <Text size="subtitle" className="font-semibold text-gray-900">
              {title}
            </Text>
            {description ? (
              <Text size="caption" className="text-gray-500">
                {description}
              </Text>
            ) : null}
          </Box>
          <Box
            as="button"
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="items-center justify-center rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
          >
            <Text as="span" size="subtitle" className="leading-none">
              ×
            </Text>
          </Box>
        </Box>

        <Box className="flex-1 flex-col overflow-y-auto px-6 py-5">{children}</Box>

        {footer ? (
          <Box className="items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-6 py-4">
            {footer}
          </Box>
        ) : null}
      </Box>
    </Box>
  );
};
