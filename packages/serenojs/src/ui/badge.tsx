import { Box, type BoxProps } from "./box.js";

export type BadgeTone = "gray" | "green" | "amber" | "blue" | "red" | "purple";

export type BadgeProps = BoxProps<"span"> & {
  tone?: BadgeTone;
};

const tones: Record<BadgeTone, string> = {
  gray: "bg-gray-100 text-gray-700",
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  blue: "bg-blue-100 text-blue-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

/**
 * Small pill label built on `Box`.
 */
export const Badge = ({ tone = "gray", className = "", ...props }: BadgeProps) => (
  <Box
    as="span"
    className={`w-fit items-center rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]} ${className}`}
    {...props}
  />
);
