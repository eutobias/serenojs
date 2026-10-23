import test from "node:test";
import assert from "node:assert/strict";

import { configureCms } from "../dist/runtime.js";
import { coerceInput } from "../dist/core/validation.js";

const posts = {
  slug: "posts",
  label: "Posts",
  locales: ["pt", "en"],
  fields: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "slug", label: "Slug", type: "text", required: true, localized: false },
    { name: "views", label: "Views", type: "number", min: 0, max: 10, defaultValue: 0 },
    { name: "active", label: "Active", type: "boolean", defaultValue: false },
    {
      name: "category",
      label: "Category",
      type: "select",
      options: [
        { label: "News", value: "news" },
        { label: "Blog", value: "blog" },
      ],
    },
    { name: "email", label: "Email", type: "email", localized: false },
    { name: "tags", label: "Tags", type: "list", localized: false },
    { name: "cover", label: "Cover", type: "media" },
    { name: "gallery", label: "Gallery", type: "media-list" },
    { name: "author", label: "Author", type: "relation", relation: { to: "authors", type: "one-to-one" } },
    { name: "contributors", label: "Contributors", type: "relation", relation: { to: "authors", type: "many-to-many" } },
  ],
};

configureCms({
  collections: [posts],
  defaultLocale: "pt",
  admin: { enabled: false },
});

test("creates valid values, defaults and localized objects", () => {
  const result = coerceInput(
    posts,
    {
      title: { pt: "Olá", en: "Hello" },
      slug: "hello",
      views: "5",
      active: "true",
      category: "news",
      email: "ada@example.com",
      tags: ["one", "two"],
      cover: "/images/cover.png",
      gallery: [
        { url: "/files/a.png", primary: true },
        { url: "/images/b.jpg", primary: true },
      ],
      author: 3,
      contributors: [3, 4],
    },
    { partial: false },
  );

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.values.title, { pt: "Olá", en: "Hello" });
  assert.equal(result.values.slug, "hello");
  assert.equal(result.values.views, 5);
  assert.equal(result.values.active, true);
  assert.equal(result.values.category, "news");
  assert.equal(result.values.email, "ada@example.com");
  assert.deepEqual(result.values.tags, ["one", "two"]);
  assert.equal(result.values.cover, "/images/cover.png");
  assert.deepEqual(result.values.gallery, [
    { url: "/files/a.png", alt: "", primary: true },
    { url: "/images/b.jpg", alt: "", primary: false },
  ]);
  assert.equal(result.values.author, 3);
  assert.deepEqual(result.values.contributors, [3, 4]);
});

test("applies defaults on create for absent fields", () => {
  const result = coerceInput(
    posts,
    { title: { pt: "Olá", en: "Hello" }, slug: "hello" },
    { partial: false },
  );

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.values.views, 0);
  assert.equal(result.values.active, false);
  assert.equal(result.values.tags.length, 0);
  assert.equal(result.values.author, null);
  assert.deepEqual(result.values.contributors, []);
});

test("reports required, format and range errors", () => {
  const result = coerceInput(
    posts,
    {
      views: 20,
      category: "invalid",
      email: "not-an-email",
      cover: "/etc/passwd",
      gallery: [{ url: "/etc/passwd" }],
    },
    { partial: false },
  );

  assert.equal(result.ok, false);
  assert.equal(result.errors.title_pt, "Campo obrigatório.");
  assert.equal(result.errors.title_en, "Campo obrigatório.");
  assert.equal(result.errors.slug, "Campo obrigatório.");
  assert.match(result.errors.views, /Valor máximo/);
  assert.equal(result.errors.category, "Opção inválida.");
  assert.equal(result.errors.email, "E-mail inválido.");
  assert.equal(result.errors.cover, "Arquivo inválido.");
  assert.equal(result.errors.gallery, "Arquivo inválido.");
});

test("partial updates only touch keys and locales present", () => {
  const result = coerceInput(
    posts,
    { active: true, title: { en: "Updated" } },
    { partial: true },
  );

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(Object.keys(result.values).sort(), ["active", "title"]);
  assert.equal(result.values.active, true);
  assert.deepEqual(result.values.title, { en: "Updated" });
});

test("accepts list values from newline-separated strings", () => {
  const result = coerceInput(
    posts,
    {
      title: { pt: "Olá", en: "Hello" },
      slug: "hello",
      tags: "one\ntwo\n\nthree",
    },
    { partial: false },
  );

  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.values.tags, ["one", "two", "three"]);
});
