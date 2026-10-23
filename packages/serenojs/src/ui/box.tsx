import { type ElementType, type ComponentPropsWithoutRef, type ReactElement } from "react";

export type CustomComponentTag<T extends ElementType = "div"> = {
  as?: T;
} & ComponentPropsWithoutRef<T>;

export type BoxProps<T extends ElementType = "div"> = {
  className?: string;
} & CustomComponentTag<T>;

/**
 * Polymorphic layout component that renders as a flex container.
 *
 * @example
 * <Box as="section" className="gap-4">
 *   <span>Item 1</span>
 *   <span>Item 2</span>
 * </Box>
 */
export const Box = <T extends ElementType = "div">({
  as,
  className = "",
  children,
  ...props
}: BoxProps<T>): ReactElement => {
  const Tag = as ?? "div";

  return (
    <Tag className={`flex ${className}`} {...props}>
      {children}
    </Tag>
  );
};
