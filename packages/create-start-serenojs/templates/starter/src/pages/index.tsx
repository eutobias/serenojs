"use client";

import { type FormEvent, useEffect, useState } from "react";

type Todo = {
  id: number;
  title: string;
  priority?: string;
  done?: boolean;
  dueDate?: string;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const priorityLabels: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function formatDueDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  const monthName = month ? MONTHS[Number(month) - 1] : undefined;
  if (!year || !monthName || !day) return value;
  return `${monthName} ${Number(day)}, ${year}`;
}

async function readTodos(): Promise<Todo[]> {
  const response = await fetch("/api/todos?limit=100");
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  const json = (await response.json()) as { items?: Todo[] };
  return json.items ?? [];
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setTodos(await readTodos());
    } catch {
      setError("Could not load tasks.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const mutate = async (
    action: () => Promise<void>,
    failureMessage: string,
  ): Promise<boolean> => {
    setError(null);
    try {
      await action();
      setTodos(await readTodos());
      return true;
    } catch {
      setError(failureMessage);
      return false;
    }
  };

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const value = title.trim();
    if (!value) return;

    const saved = await mutate(async () => {
      const response = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    }, "Could not add the task.");

    if (saved) setTitle("");
  };

  const toggle = (todo: Todo) =>
    mutate(async () => {
      const response = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: !todo.done }),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    }, "Could not update the task.");

  const remove = (id: number) =>
    mutate(async () => {
      const response = await fetch(`/api/todos/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    }, "Could not remove the task.");

  const startEdit = (todo: Todo) => {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  };

  const saveEdit = async () => {
    const value = editTitle.trim();
    if (!value || editingId === null) return;

    const saved = await mutate(async () => {
      const response = await fetch(`/api/todos/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: value }),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    }, "Could not save the task.");

    if (saved) setEditingId(null);
  };

  const remaining = todos.filter((todo) => !todo.done).length;
  const countLabel =
    remaining === 0
      ? "All done"
      : `${remaining} open ${remaining === 1 ? "task" : "tasks"}`;

  return (
    <main className="app">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand-mark" aria-hidden="true">
            S
          </span>
          <span className="brand-name">SerenoJS</span>
          <span className="brand-tag">Starter</span>
        </a>
        <a className="admin-link" href="/admin">
          Open admin
        </a>
      </header>

      <section className="intro">
        <h1>Tasks</h1>
        <p>A minimal CRUD app on top of the SerenoJS public API.</p>
      </section>

      <section className="panel" aria-label="Task list">
        <form className="composer" onSubmit={(event) => void add(event)}>
          <label htmlFor="todo-title">New task</label>
          <div className="composer-row">
            <input
              id="todo-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. review the posts schema"
            />
            <button className="btn btn-primary" type="submit">
              Add
            </button>
          </div>
          <p className="hint">
            The task is created by the API at <code>/api/todos</code>.
          </p>
        </form>

        <div className="list-head">
          <h2>Your tasks</h2>
          <span className="count" aria-live="polite">
            {loading ? "Loading" : countLabel}
          </span>
        </div>

        {error ? (
          <div className="state" role="alert">
            <strong>Something went wrong</strong>
            <p>{error}</p>
            <button
              className="btn btn-ghost btn-small"
              type="button"
              onClick={() => void load()}
            >
              Try again
            </button>
          </div>
        ) : loading ? (
          <div className="skeleton" role="status" aria-label="Loading tasks">
            {[0, 1, 2].map((index) => (
              <div className="skeleton-row" key={index} aria-hidden="true">
                <span className="skeleton-dot" />
                <span className="skeleton-line" />
              </div>
            ))}
          </div>
        ) : todos.length === 0 ? (
          <div className="state">
            <strong>No tasks yet</strong>
            <p>Add the first one above to see the API in action.</p>
          </div>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => {
              const done = Boolean(todo.done);
              const priority = todo.priority
                ? (priorityLabels[todo.priority] ?? todo.priority)
                : null;
              const priorityClass =
                todo.priority && priorityLabels[todo.priority]
                  ? `chip chip-${todo.priority}`
                  : "chip";

              return (
                <li className={done ? "todo is-done" : "todo"} key={todo.id}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={() => void toggle(todo)}
                    />
                    <span className="box" aria-hidden="true" />
                    <span className="sr-only">
                      {done ? "Reopen" : "Complete"} {todo.title}
                    </span>
                  </label>

                  <div className="todo-body">
                    {editingId === todo.id ? (
                      <input
                        className="edit-input"
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        aria-label="Edit title"
                        autoFocus
                      />
                    ) : (
                      <span className="todo-title">{todo.title}</span>
                    )}

                    <div className="todo-meta">
                      {priority ? (
                        <span className={priorityClass}>{priority}</span>
                      ) : null}
                      {todo.dueDate ? (
                        <span className="due">
                          {formatDueDate(todo.dueDate)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="todo-actions">
                    {editingId === todo.id ? (
                      <>
                        <button
                          className="btn btn-small btn-primary"
                          type="button"
                          onClick={() => void saveEdit()}
                        >
                          Save
                        </button>
                        <button
                          className="btn btn-small btn-ghost"
                          type="button"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="btn btn-small btn-ghost"
                          type="button"
                          onClick={() => startEdit(todo)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-small btn-danger"
                          type="button"
                          onClick={() => void remove(todo.id)}
                        >
                          Remove
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="foot">
        Powered by <code><a href="https://www.npmjs.com/package/@eutobias/serenojs">@eutobias/serenojs</a></code>
      </footer>
    </main>
  );
}
