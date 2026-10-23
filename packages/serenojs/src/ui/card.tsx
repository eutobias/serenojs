import { type ElementType } from "react";
import { Box, type BoxProps } from "./box.js";

export type CardProps<T extends ElementType = "div"> = BoxProps<T>;

/**
 * Container component that groups card header, body, and footer.
 *
 * @example
 * <Card className="shadow-md">
 *   <CardHeader>Title</CardHeader>
 *   <CardBody>Content</CardBody>
 *   <CardFooter>Actions</CardFooter>
 * </Card>
 */
export const Card = ({ className = "", children, ...props }: CardProps) => {
  return (
    <Box
      className={`flex-col overflow-hidden rounded-lg border border-gray-200 bg-white ${className}`}
      {...props}
    >
      {children}
    </Box>
  );
};

export type CardHeaderProps<T extends ElementType = "div"> = BoxProps<T>;

/**
 * Header section of a Card, typically holding titles or actions.
 *
 * @example
 * <CardHeader className="border-b">
 *   <Text size="title">Title</Text>
 * </CardHeader>
 */
export const CardHeader = ({
  className = "",
  children,
  ...props
}: CardHeaderProps) => {
  return (
    <Box className={`items-center gap-4 px-6 py-4 ${className}`} {...props}>
      {children}
    </Box>
  );
};

export type CardBodyProps<T extends ElementType = "div"> = BoxProps<T>;

/**
 * Main content section of a Card.
 *
 * @example
 * <CardBody className="gap-2">
 *   <Text>Content</Text>
 * </CardBody>
 */
export const CardBody = ({
  className = "",
  children,
  ...props
}: CardBodyProps) => {
  return (
    <Box className={`flex-1 flex-col px-6 py-4 ${className}`} {...props}>
      {children}
    </Box>
  );
};

export type CardFooterProps<T extends ElementType = "div"> = BoxProps<T>;

/**
 * Footer section of a Card, typically holding actions.
 *
 * @example
 * <CardFooter className="justify-end gap-2">
 *   <button>Cancel</button>
 *   <button>Save</button>
 * </CardFooter>
 */
export const CardFooter = ({
  className = "",
  children,
  ...props
}: CardFooterProps) => {
  return (
    <Box className={`items-center gap-2 px-6 py-4 ${className}`} {...props}>
      {children}
    </Box>
  );
};
