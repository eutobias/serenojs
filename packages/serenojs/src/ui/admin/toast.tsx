"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Box } from "../box.js";
import { Text } from "../text.js";
import { useI18n } from "./i18n.js";

export type ToastTone = "success" | "error" | "info";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ToastContextValue = {
  show: (message: string, tone?: ToastTone) => void;
  success: (message: string) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast precisa estar dentro de <ToastProvider>.");
  }
  return context;
};

const toneStyles: Record<ToastTone, { container: string; icon: string; glyph: string }> = {
  success: {
    container: "border-emerald-200 bg-white",
    icon: "bg-emerald-100 text-emerald-700",
    glyph: "✓",
  },
  error: {
    container: "border-red-200 bg-white",
    icon: "bg-red-100 text-red-700",
    glyph: "!",
  },
  info: {
    container: "border-gray-200 bg-white",
    icon: "bg-gray-100 text-gray-700",
    glyph: "i",
  },
};

/**
 * Toast notifications provider. Renders a fixed viewport (top-right on desktop,
 * full-width on mobile) and exposes `useToast()`.
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = (nextId.current += 1);
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      show,
      success: (message: string) => show(message, "success"),
      error: (message: string) => show(message, "error"),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <Box className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
        {toasts.map((toast) => {
          const tone = toneStyles[toast.tone];
          return (
            <Box
              key={toast.id}
              role="status"
              aria-live="polite"
              className={`pointer-events-auto w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${tone.container}`}
            >
              <Box
                className={`mt-0.5 h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tone.icon}`}
              >
                <span aria-hidden>{tone.glyph}</span>
              </Box>
              <Text size="caption" className="flex-1 pt-1 text-gray-800">
                {toast.message}
              </Text>
              <Box
                as="button"
                type="button"
                aria-label={t("common.closeNotification")}
                onClick={() => dismiss(toast.id)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                ×
              </Box>
            </Box>
          );
        })}
      </Box>
    </ToastContext.Provider>
  );
};
