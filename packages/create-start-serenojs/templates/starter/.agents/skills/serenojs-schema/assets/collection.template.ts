import type { CollectionDef } from "@eutobias/serenojs/config";

export const example: CollectionDef = {
  slug: "example",
  label: "Exemplo",
  icon: "box",
  description: "Descrição curta do que esta coleção guarda.",
  // access: { read: "public", create: "private", update: "private", delete: "private" },
  // standalone: true,
  // locales: ["pt", "en"],
  list: ["id", "title", "createdAt"],
  fields: [
    { name: "title", label: "Título", type: "text", required: true },
    { name: "description", label: "Descrição", type: "textarea" },
    {
      name: "status",
      label: "Status",
      type: "select",
      defaultValue: "draft",
      options: [
        { label: "Rascunho", value: "draft" },
        { label: "Publicado", value: "published" },
      ],
    },
    { name: "published", label: "Publicado", type: "boolean", defaultValue: false },
  ],
};
