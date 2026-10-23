import { Box, type CustomComponentTag } from "./box.js";
import { type ElementType } from "react";

export type ContainerProps<T extends ElementType = "div"> = {
  className?: string;
} & CustomComponentTag<T>;

/**
 * @example
 * <Container as="main" className="gap-4">
 *   <span>Item 1</span>
 *   <span>Item 2</span>
 * </Container>
 */
export const Container = <T extends ElementType = "div">({
  as,
  className = "",
  children,
  ...props
}: ContainerProps<T>) => {
  const Tag = as ?? "div";

  return (
    <Box as={Tag} className={`flex-col w-full min-h-screen ${className}`} {...props}>
      {children}
    </Box>
  );
};
