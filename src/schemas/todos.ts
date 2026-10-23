import type { CollectionDef } from "@eutobias/serenojs/config";

export const todos: CollectionDef = {
  slug: "todos",
  label: "To Dos",
  icon: "box",
  description: "Lista de tarefas de exemplo.",
  access: { read: "public", create: "public", update: "public", delete: "public" },
  list: ["id", "title", "priority", "done", "dueDate", "createdAt"],
  fields: [
    {
      name: "title",
      label: "Title",
      type: "text",
      required: true,
      localized: false,
    },
    {
      name: "description",
      label: "Description",
      type: "textarea",
      localized: false,
    },
    {
      name: "priority",
      label: "Priority",
      type: "select",
      defaultValue: "medium",
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    },
    { name: "done", label: "Done", type: "boolean", defaultValue: false },
    { name: "dueDate", label: "Due Date", type: "date" },
  ],
};
