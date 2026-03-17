import {
  buildNamespaceTree,
  buildTypeFirstTree,
  getNodeIcon,
} from "./tree-utils";

describe("tree-utils", () => {
  test("puts primitive namespace folders first and resource folders after them", () => {
    const tree = buildNamespaceTree([
      { id: "app.tasks.createUser" },
      { id: "app.resources.cache" },
      { id: "app.events.userCreated" },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe("app");
    expect(tree[0].folderType).toBe("mixed");
    expect(tree[0].children.map((child) => child.label)).toEqual([
      "events",
      "tasks",
      "resources",
    ]);
    expect(tree[0].children[0].folderType).toBe("event");
    expect(tree[0].children[2].folderType).toBe("resource");
  });

  test("inherits a folder semantic type from uniform descendants", () => {
    const tree = buildNamespaceTree([
      { id: "app.core.resources.cache" },
      { id: "app.core.resources.logger" },
    ]);

    expect(tree[0].folderType).toBe("resource");
    expect(tree[0].children[0].folderType).toBe("resource");
  });

  test("shows resources first in type-first trees", () => {
    const tree = buildTypeFirstTree([
      { id: "app.tasks.createUser" },
      { id: "app.resources.cache" },
      { id: "app.events.userCreated" },
    ]);

    expect(tree.map((node) => node.label)).toEqual([
      "Resources",
      "Events",
      "Tasks",
    ]);
    expect(tree[0].folderType).toBe("resource");
  });

  test("uses type icons for typed folders such as tasks/resources", () => {
    const tree = buildNamespaceTree([
      { id: "app.tasks.createUser" },
      { id: "app.resources.cache" },
    ]);

    const tasksFolder = tree[0].children.find((node) => node.label === "tasks");
    const resourcesFolder = tree[0].children.find(
      (node) => node.label === "resources"
    );

    expect(tasksFolder?.folderType).toBe("task");
    expect(resourcesFolder?.folderType).toBe("resource");
    expect(getNodeIcon(tasksFolder!)).toBe("▶️");
    expect(getNodeIcon(resourcesFolder!)).toBe("🧱");
  });

  test("keeps namespace roots expandable when the root is also a concrete element", () => {
    const tree = buildNamespaceTree([
      { id: "runner", type: "resource" },
      { id: "runner.logger", type: "resource" },
      { id: "runner.metrics", type: "resource" },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe("runner");
    expect(tree[0].type).toBe("folder");
    expect(tree[0].folderType).toBe("resource");
    expect(tree[0].children.map((child) => child.label)).toEqual([
      "logger",
      "metrics",
    ]);
    expect(tree[0].count).toBe(3);
  });

  test("sorts namespace children as primitive folders, resource folders, direct resources, then the rest", () => {
    const tree = buildNamespaceTree([
      { id: "app.tasks.createUser" },
      { id: "app.r2", type: "resource" },
      { id: "app.r2.childTask", type: "task" },
      { id: "app.r1", type: "resource" },
      { id: "app.zeta", type: "task" },
      { id: "app.alpha", type: "task" },
    ]);

    expect(tree).toHaveLength(1);
    expect(tree[0].children.map((child) => child.label)).toEqual([
      "tasks",
      "r2",
      "r1",
      "alpha",
      "zeta",
    ]);
    expect(tree[0].children[0].type).toBe("folder");
    expect(tree[0].children[1].children.map((child) => child.label)).toEqual([
      "childTask",
    ]);
  });

  test("uses folder icons only for resource and mixed namespace folders", () => {
    const tree = buildNamespaceTree([
      { id: "app.r2", type: "resource" },
      { id: "app.r2.childTask", type: "task" },
      { id: "app.tasks.createUser", type: "task" },
    ]);

    const resourceFolder = tree[0].children.find((node) => node.label === "r2");
    const tasksFolder = tree[0].children.find((node) => node.label === "tasks");

    expect(resourceFolder?.type).toBe("folder");
    expect(
      getNodeIcon(resourceFolder!, { preferNamespaceFolderIcon: true })
    ).toBe("📁");
    expect(getNodeIcon(resourceFolder!)).toBe("🧱");

    expect(tasksFolder?.type).toBe("folder");
    expect(tasksFolder?.folderType).toBe("task");
    expect(getNodeIcon(tasksFolder!, { preferNamespaceFolderIcon: true })).toBe(
      "▶️"
    );
  });

  test("uses explicit element types for namespace icons instead of falling back to task", () => {
    const tree = buildNamespaceTree([
      { id: "system", type: "resource" },
      { id: "system.health", type: "resource" },
      { id: "app.errors.invalidInput", type: "error" },
      { id: "app.identity", type: "async-context" },
    ]);

    const systemNode = tree.find((node) => node.id === "system");
    const appNode = tree.find((node) => node.id === "app");
    const errorsFolder = appNode?.children.find((node) => node.label === "errors");
    const errorNode = errorsFolder?.children.find(
      (node) => node.label === "invalidInput"
    );
    const asyncContextNode = appNode?.children.find(
      (node) => node.label === "identity"
    );

    expect(systemNode?.folderType).toBe("resource");
    expect(getNodeIcon(systemNode!)).toBe("🧱");
    expect(errorsFolder?.folderType).toBe("error");
    expect(getNodeIcon(errorsFolder!)).toBe("🚨");
    expect(errorNode?.type).toBe("error");
    expect(getNodeIcon(errorNode!)).toBe("🚨");
    expect(asyncContextNode?.type).toBe("async-context");
    expect(getNodeIcon(asyncContextNode!)).toBe("🔄");
  });

  test("uses typed icons for non-resource namespace folders such as asyncContexts", () => {
    const tree = buildNamespaceTree([
      { id: "app.asyncContexts.identity", type: "async-context" },
    ]);

    const asyncContextsFolder = tree[0].children.find(
      (node) => node.label === "asyncContexts"
    );

    expect(asyncContextsFolder?.type).toBe("folder");
    expect(asyncContextsFolder?.folderType).toBe("async-context");
    expect(
      getNodeIcon(asyncContextsFolder!, { preferNamespaceFolderIcon: true })
    ).toBe("🔄");
  });
});
