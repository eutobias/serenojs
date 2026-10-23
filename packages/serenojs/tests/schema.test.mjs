import test from "node:test";
import assert from "node:assert/strict";

import { configureCms } from "../dist/runtime.js";
import {
  collectionLocales,
  emptyValues,
  fieldDefault,
  getCollection,
  getCollections,
  getSchemaTitle,
  isLocalizedField,
  itemLabel,
  relationIsMany,
  relationIsOne,
  tableName,
  valueForLocale,
} from "../dist/core/schema.js";

const authors = {
  slug: "authors",
  label: "Authors",
  fields: [{ name: "name", label: "Name", type: "text", localized: false }],
};

const posts = {
  slug: "posts",
  label: "Posts",
  locales: ["pt", "en"],
  fields: [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "slug", label: "Slug", type: "text", localized: false },
    { name: "views", label: "Views", type: "number", min: 0 },
    { name: "author", label: "Author", type: "relation", relation: { to: "authors", type: "one-to-one" } },
    { name: "contributors", label: "Contributors", type: "relation", relation: { to: "authors", type: "many-to-many" } },
  ],
};

configureCms({
  title: "Test CMS",
  collections: [posts, authors],
  defaultLocale: "pt",
  api: { path: "/api" },
  auth: { path: "/auth" },
  admin: { enabled: false },
});

test("exposes the configured collections and title", () => {
  assert.equal(getSchemaTitle(), "Test CMS");
  assert.deepEqual(getCollections().map((entry) => entry.slug), ["posts", "authors"]);
  assert.equal(getCollection("posts"), posts);
  assert.equal(getCollection("missing"), undefined);
});

test("resolves collection locales and localization defaults", () => {
  assert.deepEqual(collectionLocales(posts), ["pt", "en"]);
  assert.deepEqual(collectionLocales(authors), ["pt"]);

  assert.equal(isLocalizedField(posts, posts.fields[0]), true);
  assert.equal(isLocalizedField(posts, posts.fields[1]), false);
  assert.equal(isLocalizedField(posts, posts.fields[2]), false);
});

test("reads localized values", () => {
  const item = { title: { pt: "Olá", en: "Hello" } };
  assert.equal(valueForLocale(posts, posts.fields[0], item, "en"), "Hello");
  assert.equal(valueForLocale(posts, posts.fields[0], item), "Olá");
  assert.equal(valueForLocale(posts, posts.fields[0], item, "es"), null);
});

test("builds empty values with defaults per locale", () => {
  const values = emptyValues(posts);
  assert.deepEqual(values.title, { pt: "", en: "" });
  assert.equal(values.slug, "");
  assert.equal(values.views, 0);
  assert.equal(values.author, null);
  assert.deepEqual(values.contributors, []);
});

test("derives labels, table names and relation helpers", () => {
  assert.equal(tableName("posts"), "c_posts");
  assert.equal(tableName("my-post"), "c_my_post");
  assert.equal(relationIsOne(posts.fields[3]), true);
  assert.equal(relationIsMany(posts.fields[3]), false);
  assert.equal(relationIsMany(posts.fields[4]), true);
  assert.equal(fieldDefault(posts.fields[2]), 0);
  assert.equal(itemLabel(posts, { id: 7, title: { pt: "Olá", en: "Hello" } }), "Olá");
  assert.equal(itemLabel(posts, { id: 7 }), "#7");
});
