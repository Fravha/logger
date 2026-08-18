import type { Router } from "express";

import type {
  DocType,
  DocTypeDependencies,
  DocTypeDescriptor,
  RegisteredDocType,
} from "./doc-type.js";

export class DocTypeRegistry {
  private readonly registered = new Map<string, RegisteredDocType>();
  private readonly descriptors = new Map<string, DocTypeDescriptor>();

  constructor(private readonly dependencies: DocTypeDependencies) {}

  registerAll(docTypes: readonly DocType[]): void {
    const definitions = new Map<string, DocType>();

    for (const docType of docTypes) {
      this.assertDefinition(docType, definitions);
      definitions.set(docType.name, docType);
    }

    const pending = new Map(definitions);

    while (pending.size > 0) {
      let registeredInPass = 0;

      for (const [name, docType] of pending) {
        const required = docType.dependencies ?? [];
        if (!required.every((dependency) => this.registered.has(dependency))) {
          continue;
        }

        const registration = docType.register(
          this.dependencies,
          <TApi>(dependency: string) => this.resolve<TApi>(dependency),
        );

        this.registered.set(name, registration);
        this.descriptors.set(name, {
          name,
          route: docType.route,
          permissions: [...docType.permissions],
          dependencies: [...required],
        });
        pending.delete(name);
        registeredInPass++;
      }

      if (registeredInPass === 0) {
        const unresolved = [...pending.values()].map((docType) => ({
          name: docType.name,
          dependencies: docType.dependencies ?? [],
        }));
        throw new Error(`Unresolved docType dependencies: ${JSON.stringify(unresolved)}`);
      }
    }
  }

  mount(router: Router, apiPrefix: string): void {
    for (const descriptor of this.descriptors.values()) {
      const registration = this.registered.get(descriptor.name);
      if (!registration) {
        throw new Error(`docType '${descriptor.name}' is not registered`);
      }
      router.use(`${apiPrefix}${descriptor.route}`, registration.router);
    }
  }

  resolve<TApi>(name: string): TApi {
    const registration = this.registered.get(name);
    if (!registration) {
      throw new Error(`docType '${name}' is not registered`);
    }
    return registration.api as TApi;
  }

  list(): DocTypeDescriptor[] {
    return [...this.descriptors.values()];
  }

  private assertDefinition(
    docType: DocType,
    definitions: ReadonlyMap<string, DocType>,
  ): void {
    if (!docType.name.trim()) {
      throw new Error("docType name is required");
    }
    if (!/^\/[a-z0-9-]+$/.test(docType.route)) {
      throw new Error(`Invalid route for docType '${docType.name}'`);
    }
    if (definitions.has(docType.name) || this.registered.has(docType.name)) {
      throw new Error(`docType '${docType.name}' is already registered`);
    }
    if (
      [...definitions.values()].some((registered) => registered.route === docType.route)
      || [...this.descriptors.values()].some((registered) => registered.route === docType.route)
    ) {
      throw new Error(`docType route '${docType.route}' is already registered`);
    }
    const permissionCodes = docType.permissions.map(({ code }) => code);
    if (new Set(permissionCodes).size !== permissionCodes.length) {
      throw new Error(`docType '${docType.name}' declares duplicate permissions`);
    }
    const declaredPermissions = new Set(
      [...definitions.values()].flatMap((registered) =>
        registered.permissions.map(({ code }) => code)
      ),
    );
    const duplicatePermission = permissionCodes.find((code) =>
      declaredPermissions.has(code)
    );
    if (duplicatePermission) {
      throw new Error(`docType permission '${duplicatePermission}' is already registered`);
    }
    if (docType.permissions.some(({ code, name }) => !code.trim() || !name.trim())) {
      throw new Error(`docType '${docType.name}' declares an invalid permission`);
    }
  }
}
