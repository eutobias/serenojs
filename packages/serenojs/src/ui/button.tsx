import type { ReactNode } from "react";

import { Box, type BoxProps } from "./box.js";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "icon";

export type ButtonProps = BoxProps<"button"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "border-gray-900 bg-gray-900 text-white hover:bg-gray-800 hover:border-gray-800",
  secondary:
    "border-gray-300 bg-white text-gray-900 hover:bg-gray-50 hover:border-gray-400",
  ghost:
    "border-transparent bg-transparent text-gray-700 hover:bg-gray-100 hover:text-gray-900",
  danger:
    "border-red-600 bg-red-600 text-white hover:bg-red-500 hover:border-red-500",
};

const sizes: Record<ButtonSize, string> = {
  sm: "gap-1.5 px-2.5 py-1.5 text-xs",
  md: "gap-2 px-3.5 py-2 text-sm",
  icon: "h-8 w-8 p-0 text-base",
};

/**
 * Button built on top of `Box`.
 *
 * @example
 * <Button variant="primary" onClick={save}>Salvar</Button>
 * <Button variant="ghost" size="sm">Cancelar</Button>
 */
export const Button = ({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) => {
  return (
    <Box
      as="button"
      type="button"
      className={`cursor-pointer select-none items-center justify-center rounded-md border font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
};

export type IconButtonProps = ButtonProps & {
  label: string;
  children: ReactNode;
};

/**
 * Square icon-only button. The label is exposed to assistive tech via
 * `aria-label` and shown as a native tooltip via `title`.
 */
export const IconButton = ({
  label,
  children,
  variant = "ghost",
  ...props
}: IconButtonProps) => (
  <Button
    aria-label={label}
    title={label}
    variant={variant}
    size="icon"
    {...props}
  >
    {children}
  </Button>
);
