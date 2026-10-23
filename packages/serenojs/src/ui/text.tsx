import {
  type ElementType,
  type ComponentPropsWithoutRef,
  type ReactElement,
} from "react";

/** Design-system type scale (see docs/design.md). */
export type TextSize =
  | "display"
  | "heading"
  | "subheading"
  | "cardTitle"
  | "lead"
  | "body"
  | "small"
  | "mono"
  | "monoSm"
  | "monoXs"
  // Legacy aliases kept for the admin UI.
  | "title/xl"
  | "title/lg"
  | "title"
  | "subtitle"
  | "caption";

export type TextFont = "sans" | "mono";

export type TextProps<T extends ElementType = "span"> = {
  size?: TextSize;
  font?: TextFont;
  as?: T;
  className?: string;
} & ComponentPropsWithoutRef<T>;

const sizeStyles: Record<TextSize, string> = {
  display: "text-[30px] leading-[1.2] tracking-[-0.02em] font-extrabold sm:text-[48px]",
  heading: "text-[28px] leading-[1.3] tracking-[-0.01em] font-extrabold sm:text-[36px]",
  subheading: "text-[24px] leading-[1.3] font-bold sm:text-[28px]",
  cardTitle: "text-[20px] leading-[1.4] font-bold",
  lead: "text-[18px] leading-[1.6] font-medium",
  body: "text-[16px] leading-[1.6] font-medium",
  small: "text-[14px] leading-[1.5] font-medium",
  mono: "text-[14px] leading-[1.6] font-medium",
  monoSm: "text-[12px] leading-[1.5] font-medium",
  monoXs: "text-[10px] leading-[1.4] font-medium",
  // Legacy
  "title/xl": "text-[30px] leading-[1.2] font-extrabold sm:text-[48px]",
  "title/lg": "text-[28px] leading-[1.3] font-extrabold sm:text-[36px]",
  title: "text-[24px] leading-[1.3] font-bold sm:text-[28px]",
  subtitle: "text-[20px] leading-[1.4] font-bold",
  caption: "text-[14px] leading-[1.5]",
};

const monoFonts = new Set<TextSize>([
  "mono",
  "monoSm",
  "monoXs",
  "display",
  "heading",
  "subheading",
  "cardTitle",
]);

/**
 * Typography primitive driven by the design-system type scale.
 *
 * Colors and other surface decisions belong to the components that compose
 * `Text` (passed through `className`).
 */
export const Text = <T extends ElementType = "div">({
  size = "body",
  font,
  as,
  className = "",
  children,
  ...props
}: TextProps<T>): ReactElement => {
  const Tag = as ?? "p";
  const family = font ?? (monoFonts.has(size) ? "mono" : "sans");

  return (
    <Tag
      className={`${sizeStyles[size]} ${
        family === "mono" ? "font-mono" : "font-sans"
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  );
};

export { sizeStyles };
