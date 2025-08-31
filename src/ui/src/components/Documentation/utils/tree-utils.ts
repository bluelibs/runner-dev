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
    | "tag";
  icon: string;
  children: TreeNode[];
  count?: number;
  elementId?: string; // Original element ID for navigation
  element?: any; // Original element data
  isExpanded?: boolean;
}

export interface Element {
  id: string;
  [key: string]: any;
}

/**
 * Parse namespaced ID into parts (e.g., "app.tasks.createUser" -> ["app", "tasks", "createUser"])
 */
export function parseNamespace(id: string): string[] {
  return id.split(".");
}

/**
 * Get element type from ID or explicit type property
 */
export function getElementType(
  element: Element
): "task" | "resource" | "event" | "hook" | "middleware" | "tag" {
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
  }

  // Fallback to explicit type if available
  if (element.type) return element.type;

  // Default fallback
  return "task";
}

/**
 * Get icon for element type
 */
export function getTypeIcon(type: string): string {
  const icons = {
    folder: "📁",
    task: "⚙️",
    resource: "🔧",
    event: "📡",
    hook: "🪝",
    middleware: "🔗",
    tag: "🏷️",
  };
  return icons[type as keyof typeof icons] || "📄";
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
      .map((node) => ({
        ...node,
        children: sortAndCount(node.children),
        count: node.type === "folder" ? countLeafNodes(node) : undefined,
      }))
      .sort((a, b) => {
        // Folders first, then by name
        if (a.type === "folder" && b.type !== "folder") return -1;
        if (a.type !== "folder" && b.type === "folder") return 1;
        return a.label.localeCompare(b.label);
      });
  };

  return sortAndCount(rootNodes);
}

/**
 * Count leaf nodes (actual elements) in a tree
 */
function countLeafNodes(node: TreeNode): number {
  if (node.children.length === 0) return 1;
  return node.children.reduce((sum, child) => sum + countLeafNodes(child), 0);
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
        children: prefixed(typeTree),
        count: typeElements.length,
        isExpanded: false,
      });
    }
  });

  return typeNodes.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Filter tree nodes based on search term
 */
export function filterTree(nodes: TreeNode[], searchTerm: string): TreeNode[] {
  if (!searchTerm.trim()) return nodes;

  const term = searchTerm.toLowerCase();

  const filterNode = (node: TreeNode): TreeNode | null => {
    const matches =
      node.label.toLowerCase().includes(term) ||
      (node.elementId && node.elementId.toLowerCase().includes(term));

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
