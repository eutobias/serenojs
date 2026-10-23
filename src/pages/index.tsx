"use client";

import { useEffect, useState } from "react";

import { Badge, Box, Button, Text, type BadgeTone } from "@eutobias/serenojs/ui";

type Todo = {
  id: number;
  title: string;
  priority?: string;
  done?: boolean;
};

const priorityMeta: Record<string, { label: string; tone: BadgeTone }> = {
  low: { label: "Baixa", tone: "gray" },
  medium: { label: "Média", tone: "blue" },
  high: { label: "Alta", tone: "red" },
};

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const load = async () => {
    const response = await fetch("/api/todos?limit=100");
    const json = (await response.json()) as { items?: Todo[] };
    setTodos(json.items ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;
    await fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    setTitle("");
    await load();
  };

  const toggle = async (todo: Todo) => {
    await fetch(`/api/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !todo.done }),
    });
    await load();
  };

  const remove = async (id: number) => {
    await fetch(`/api/todos/${id}`, { method: "DELETE" });
    await load();
  };

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  };

  const saveEdit = async () => {
    const value = editTitle.trim();
    if (!value || editingId === null) return;
    await fetch(`/api/todos/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: value }),
    });
    setEditingId(null);
    await load();
  };

  return (
    <Box className="mx-auto w-full max-w-2xl flex-col gap-6 p-6">
      <Text size="title" className="font-semibold text-gray-900">
        Tarefas
      </Text>

      <Box
        as="form"
        className="items-center gap-2"
        onSubmit={(event) => void add(event)}
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nova tarefa…"
          className="w-full flex-1 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        <Button type="submit" variant="primary">
          Adicionar
        </Button>
      </Box>

      {todos.length === 0 ? (
        <Box className="items-center justify-center rounded-lg border border-dashed border-gray-300 p-10">
          <Text size="caption" className="text-gray-400">
            Nenhuma tarefa cadastrada.
          </Text>
        </Box>
      ) : (
        <Box className="flex-col gap-3">
          {todos.map((todo) => {
            const done = Boolean(todo.done);
            const priority = todo.priority ?? "";
            const meta = priorityMeta[priority] ?? {
              label: priority || "—",
              tone: "gray" as const,
            };

            return (
              <Box
                key={todo.id}
                className={`items-center justify-between gap-3 rounded-lg border bg-white p-4 ${
                  done ? "border-gray-200 opacity-60" : "border-gray-300"
                }`}
              >
                <Box className="min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => void toggle(todo)}
                    className="h-4 w-4 cursor-pointer accent-gray-900"
                  />
                  {editingId === todo.id ? (
                    <Box className="min-w-0 flex-1 items-center gap-2">
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        className="w-full flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void saveEdit()}
                      >
                        Salvar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setEditingId(null)}
                      >
                        Cancelar
                      </Button>
                    </Box>
                  ) : (
                    <Box className="min-w-0 flex-1 items-center gap-2">
                      <Text
                        size="body"
                        className={`truncate text-gray-900 ${
                          done ? "line-through" : ""
                        }`}
                      >
                        {todo.title}
                      </Text>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Box>
                  )}
                </Box>

                <Box className="items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(todo)}
                  >
                    Editar
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="danger"
                    onClick={() => void remove(todo.id)}
                  >
                    Remover
                  </Button>
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
