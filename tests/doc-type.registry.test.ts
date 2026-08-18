import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Router } from "express";

import type { DocType, DocTypeDependencies } from "../src/modules/doc-types/doc-type.js";
import { DocTypeRegistry } from "../src/modules/doc-types/doc-type.registry.js";

const dependencies = {} as DocTypeDependencies;

function definition(
  name: string,
  route: `/${string}`,
  api: string,
  required: readonly string[] = [],
): DocType<string> {
  return {
    name,
    route,
    permissions: [{ code: `${name}:read`, name: `Read ${name}` }],
    dependencies: required,
    register(_dependencies, resolve) {
      const dependencyApi = required.map((dependency) => resolve<string>(dependency));
      return { router: Router(), api: [...dependencyApi, api].join(":") };
    },
  };
}

describe("DocTypeRegistry", () => {
  it("registers dependencies before dependants and exposes their public API", () => {
    const registry = new DocTypeRegistry(dependencies);
    registry.registerAll([
      definition("orders", "/orders", "orders", ["products"]),
      definition("products", "/products", "products"),
    ]);

    assert.equal(registry.resolve<string>("products"), "products");
    assert.equal(registry.resolve<string>("orders"), "products:orders");
    assert.deepEqual(registry.list().map(({ name }) => name), ["products", "orders"]);
  });

  it("rejects duplicate routes", () => {
    const registry = new DocTypeRegistry(dependencies);
    assert.throws(
      () => registry.registerAll([
        definition("products", "/catalog", "products"),
        definition("orders", "/catalog", "orders"),
      ]),
      /already registered/,
    );
  });

  it("rejects permissions duplicated across docTypes", () => {
    const products = definition("products", "/products", "products");
    const orders = definition("orders", "/orders", "orders");
    orders.permissions = [{ code: "products:read", name: "Read products" }];

    const registry = new DocTypeRegistry(dependencies);
    assert.throws(
      () => registry.registerAll([products, orders]),
      /permission 'products:read' is already registered/,
    );
  });

  it("rejects missing or circular dependencies", () => {
    const registry = new DocTypeRegistry(dependencies);
    assert.throws(
      () => registry.registerAll([
        definition("orders", "/orders", "orders", ["products"]),
      ]),
      /Unresolved docType dependencies/,
    );
  });
});
