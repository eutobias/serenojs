import type { ComponentType } from "react";

import type { CollectionIconName } from "../../core/types.js";
import {
  FiArchive,
  FiBox,
  FiFileText,
  FiFolder,
  FiGrid,
  FiImage,
  FiLayout,
  FiSettings,
  FiStar,
  FiTag,
  FiUser,
  FiUsers,
} from "react-icons/fi";

/**
 * Curated registry of Feather icons available as collection icons.
 *
 * Add a new icon here (and to the map) to make it selectable in a
 * `CollectionDef`. Only registered icons are bundled.
 */
export const collectionIcons: Record<CollectionIconName, ComponentType<{ className?: string | undefined; "aria-hidden"?: boolean | undefined }>> = {
  archive: FiArchive,
  box: FiBox,
  fileText: FiFileText,
  folder: FiFolder,
  grid: FiGrid,
  image: FiImage,
  layout: FiLayout,
  settings: FiSettings,
  star: FiStar,
  tag: FiTag,
  user: FiUser,
  users: FiUsers,
} as const;



export const DEFAULT_COLLECTION_ICON: CollectionIconName = "grid";

export function isCollectionIconName(
  value: string | undefined,
): value is CollectionIconName {
  return value !== undefined && value in collectionIcons;
}

export type CollectionIconProps = {
  name?: CollectionIconName | undefined;
  className?: string | undefined;
};

type IconComponent = ComponentType<{
  className?: string | undefined;
  "aria-hidden"?: boolean | undefined;
}>;

/**
 * Renders the Feather icon for a collection, falling back to a default icon.
 */
export const CollectionIcon = ({ name, className }: CollectionIconProps) => {
  const Icon: IconComponent =
    collectionIcons[name ?? DEFAULT_COLLECTION_ICON] ??
    collectionIcons[DEFAULT_COLLECTION_ICON];

  return <Icon aria-hidden className={className} />;
};
