export interface TreeNode {
  id: string;
  label: string;
  type:
    | "folder"
    | "task"
    | "resource"
    | "event"
    | "hook"
    | "middleware"
    | "tag"
    | "error"
    | "async-context";
  icon: string;
  children: TreeNode[];
  folderType?: FolderSemanticType;
  count?: number;
  elementId?: string; // Original element ID for navigation
  element?: any; // Original element data
  isExpanded?: boolean;
}

export interface Element {
  id: string;
  [key: string]: any;
}

export type ElementType =
  | "task"
  | "resource"
  | "event"
  | "hook"
  | "middleware"
  | "tag"
  | "error"
  | "async-context";

export type FolderSemanticType = ElementType | "mixed";

import { getDocumentationIcon } from "../config/documentationIcons";
import { parseSearchQuery, treeNodeMatchesParsed } from "./search-utils";

/**
 * Parse namespaced ID into parts (e.g., "app.tasks.createUser" -> ["app", "tasks", "createUser"])
 */
export function parseNamespace(id: string): string[] {
  return id.split(".");
}

/**
 * Get element type from ID or explicit type property
 */
export function getElementType(element: Element): ElementType {
  if (element.type) return element.type;

  // Try to infer from ID pattern first
  const parts = parseNamespace(element.id);
  if (parts.length >= 2) {
    const typeSegment = parts[parts.length - 2]; // Second to last segment
    if (["tasks", "task"].includes(typeSegment)) return "task";
    if (["resources", "resource"].includes(typeSegment)) return "resource";
    if (["events", "event"].includes(typeSegment)) return "event";
    if (["hooks", "hook"].includes(typeSegment)) return "hook";
    if (["middlewares", "middleware"].includes(typeSegment))
      return "middleware";
    if (["tags", "tag"].includes(typeSegment)) return "tag";
    if (["errors", "error"].includes(typeSegment)) return "error";
    if (
      ["asyncContexts", "asyncContext", "async-context"].includes(typeSegment)
    ) {
      return "async-context";
    }
  }

  // Default fallback
  return "task";
}

/**
 * Get icon for element type
 */
export function getTypeIcon(type: string): string {
  return getDocumentationIcon(type);
}

export function getNodeIcon(
  node: TreeNode,
  options?: { preferNamespaceFolderIcon?: boolean }
): string {
  if (
    options?.preferNamespaceFolderIcon &&
    node.type === "folder" &&
    node.children.length > 0 &&
    (!node.folderType ||
      node.folderType === "mixed" ||
      node.folderType === "resource")
  ) {
    return getTypeIcon("folder");
  }

  if (
    node.type === "folder" &&
    node.folderType &&
    node.folderType !== "mixed"
  ) {
    return getTypeIcon(node.folderType);
  }

  return node.icon;
}

/**
 * Build namespace-based tree from elements
 */
export function buildNamespaceTree(elements: Element[]): TreeNode[] {
  const tree: Map<string, TreeNode> = new Map();

  // Create root nodes and build hierarchy
  elements.forEach((element) => {
    const parts = parseNamespace(element.id);
    const elementType = getElementType(element);

    let currentPath = "";
    let currentLevel = tree;

    // Build the path up to the element
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}.${part}` : part;

      if (!currentLevel.has(currentPath)) {
        const isLastPart = i === parts.length - 1;
        const nodeType = isLastPart ? elementType : "folder";

        const node: TreeNode = {
          id: currentPath,
          label: part,
          type: nodeType,
          icon: getTypeIcon(nodeType),
          children: [],
          elementId: isLastPart ? element.id : undefined,
          element: isLastPart ? element : undefined,
          isExpanded: false,
        };

        currentLevel.set(currentPath, node);

        // Add to parent's children if not root
        if (i > 0) {
          const parentPath = parts.slice(0, i).join(".");
          const parent = tree.get(parentPath);
          if (
            parent &&
            !parent.children.find((child) => child.id === currentPath)
          ) {
            parent.children.push(node);

            // A node can be both a concrete element id and a namespace parent
            // (for example "runner" and "runner.logger"). In that case it
            // must behave like a folder so the subtree stays visible.
            if (parent.type !== "folder") {
              parent.type = "folder";
              parent.icon = getTypeIcon("folder");
            }
          }
        }
      }

      currentLevel = tree;
    }
  });

  // Get root nodes (those without parents in the tree)
  const rootNodes = Array.from(tree.values()).filter((node) => {
    const parts = parseNamespace(node.id);
    return parts.length === 1;
  });

  // Sort children recursively and add counts
  const sortAndCount = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .map((node) => {
        const children = sortAndCount(node.children);
        const nextNode: TreeNode = {
          ...node,
          children,
          count: node.type === "folder" ? countLeafNodes(node) : undefined,
        };

        if (node.type === "folder") {
          nextNode.folderType = getFolderSemanticType(nextNode);
        }

        return nextNode;
      })
      .sort(compareNamespaceTreeNodes);
  };

  return sortAndCount(rootNodes);
}

/**
 * Count leaf nodes (actual elements) in a tree
 */
function countLeafNodes(node: TreeNode): number {
  const selfCount = node.elementId ? 1 : 0;
  if (node.children.length === 0) return selfCount;
  return (
    selfCount +
    node.children.reduce((sum, child) => sum + countLeafNodes(child), 0)
  );
}

/**
 * Build type-first tree (group by element type first, then by namespace)
 */
export function buildTypeFirstTree(elements: Element[]): TreeNode[] {
  const typeGroups: Map<string, Element[]> = new Map();

  // Group elements by type
  elements.forEach((element) => {
    const type = getElementType(element);
    if (!typeGroups.has(type)) {
      typeGroups.set(type, []);
    }
    typeGroups.get(type)!.push(element);
  });

  // Build tree for each type
  const typeNodes: TreeNode[] = [];

  typeGroups.forEach((typeElements, type) => {
    const typeTree = buildNamespaceTree(typeElements);

    const prefix = `type:${type}`;

    const prefixed = (nodes: TreeNode[]): TreeNode[] =>
      nodes.map((node) => ({
        ...node,
        id: `${prefix}.${node.id}`,
        // elementId should remain the original element id for navigation
        children: prefixed(node.children),
      }));

    // If there's only one root namespace, flatten it
    if (typeTree.length === 1 && typeTree[0].children.length > 0) {
      typeNodes.push({
        id: type,
        label: capitalizeFirst(type + "s"),
        type: "folder",
        icon: getTypeIcon(type),
        folderType: type as ElementType,
        children: prefixed(typeTree[0].children),
        count: typeElements.length,
        isExpanded: false,
      });
    } else {
      typeNodes.push({
        id: type,
        label: capitalizeFirst(type + "s"),
        type: "folder",
        icon: getTypeIcon(type),
        folderType: type as ElementType,
        children: prefixed(typeTree),
        count: typeElements.length,
        isExpanded: false,
      });
    }
  });

  return typeNodes.sort(compareTypeTreeNodes);
}

/**
 * Filter tree nodes based on search term
 */
export function filterTree(nodes: TreeNode[], searchTerm: string): TreeNode[] {
  if (!searchTerm.trim()) return nodes;

  // Advanced search: commas = AND, || = OR; leading ':' = tag search
  const parsed = parseSearchQuery(searchTerm);

  const filterNode = (node: TreeNode): TreeNode | null => {
    const matches = treeNodeMatchesParsed(
      {
        label: node.label,
        elementId: node.elementId,
        element: node.element,
        type: node.type,
      },
      parsed
    );

    const filteredChildren = node.children
      .map(filterNode)
      .filter((child): child is TreeNode => child !== null);

    if (matches || filteredChildren.length > 0) {
      return {
        ...node,
        children: filteredChildren,
        isExpanded: filteredChildren.length > 0, // Auto-expand if has matching children
      };
    }

    return null;
  };

  return nodes
    .map(filterNode)
    .filter((node): node is TreeNode => node !== null);
}

/**
 * Expand/collapse node in tree
 */
export function toggleNodeExpansion(
  nodes: TreeNode[],
  nodeId: string,
  expanded?: boolean
): TreeNode[] {
  return nodes.map((node) => {
    if (node.id === nodeId) {
      return {
        ...node,
        isExpanded: expanded !== undefined ? expanded : !node.isExpanded,
      };
    }

    if (node.children.length > 0) {
      return {
        ...node,
        children: toggleNodeExpansion(node.children, nodeId, expanded),
      };
    }

    return node;
  });
}

/**
 * Find node by ID in tree
 */
export function findNode(nodes: TreeNode[], nodeId: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) return node;

    if (node.children.length > 0) {
      const found = findNode(node.children, nodeId);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Expand all parent nodes leading to a specific node
 */
export function expandPathToNode(
  nodes: TreeNode[],
  targetNodeId: string
): TreeNode[] {
  const expandPath = (
    currentNodes: TreeNode[],
    path: string[] = []
  ): TreeNode[] => {
    return currentNodes.map((node) => {
      const newPath = [...path, node.id];

      // Check if this node or any of its children contain the target
      const containsTarget =
        node.id === targetNodeId ||
        findNode(node.children, targetNodeId) !== null;

      if (containsTarget) {
        return {
          ...node,
          isExpanded: true,
          children: expandPath(node.children, newPath),
        };
      }

      return {
        ...node,
        children: expandPath(node.children, newPath),
      };
    });
  };

  return expandPath(nodes);
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function compareNamespaceTreeNodes(a: TreeNode, b: TreeNode): number {
  const priorityDelta =
    getNamespaceNodeSortPriority(a) - getNamespaceNodeSortPriority(b);
  if (priorityDelta !== 0) return priorityDelta;
  return a.label.localeCompare(b.label);
}

function compareTypeTreeNodes(a: TreeNode, b: TreeNode): number {
  const semanticTypeA = getNodeSemanticType(a);
  const semanticTypeB = getNodeSemanticType(b);
  const priorityDelta =
    getNodeSortPriority(semanticTypeA) - getNodeSortPriority(semanticTypeB);

  if (priorityDelta !== 0) return priorityDelta;
  return a.label.localeCompare(b.label);
}

function getNodeSemanticType(
  node: TreeNode
): FolderSemanticType | "folder" | undefined {
  if (node.type === "folder") {
    return node.folderType;
  }

  return node.type;
}

function getNodeSortPriority(type: FolderSemanticType | "folder" | undefined) {
  if (type === "resource") return 0;
  if (type === "folder" || type === "mixed") return 1;
  return 2;
}

function getNamespaceNodeSortPriority(node: TreeNode): number {
  const hasChildren = node.children.length > 0;

  if (hasChildren) {
    return node.folderType === "resource" ? 1 : 0;
  }

  if (node.type === "resource") return 2;

  return 3;
}

function getFolderSemanticType(node: TreeNode): FolderSemanticType {
  if (node.element) {
    return getElementType(node.element);
  }

  const explicitType = getFolderTypeFromNamespace(node.id);
  if (explicitType) return explicitType;

  const descendantTypes = new Set<ElementType>();

  for (const child of node.children) {
    if (child.type === "folder") {
      if (child.folderType && child.folderType !== "mixed") {
        descendantTypes.add(child.folderType);
      }
      continue;
    }

    descendantTypes.add(child.type);
  }

  if (descendantTypes.size === 1) {
    return Array.from(descendantTypes)[0];
  }

  return "mixed";
}

function getFolderTypeFromNamespace(nodeId: string): ElementType | undefined {
  const parts = parseNamespace(nodeId);
  const lastSegment = parts[parts.length - 1];
  if (!lastSegment) return undefined;

  if (["tasks", "task"].includes(lastSegment)) return "task";
  if (["resources", "resource"].includes(lastSegment)) return "resource";
  if (["events", "event"].includes(lastSegment)) return "event";
  if (["hooks", "hook"].includes(lastSegment)) return "hook";
  if (["middlewares", "middleware"].includes(lastSegment)) return "middleware";
  if (["tags", "tag"].includes(lastSegment)) return "tag";
  if (["errors", "error"].includes(lastSegment)) return "error";
  if (
    ["asyncContexts", "asyncContext", "async-context"].includes(lastSegment)
  ) {
    return "async-context";
  }

  return undefined;
}
