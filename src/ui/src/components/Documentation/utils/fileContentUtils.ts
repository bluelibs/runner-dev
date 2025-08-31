import { graphqlRequest } from './graphqlClient';

export interface ElementFileContent {
  id: string;
  filePath: string | null;
  fileContents: string | null;
}

// Universal query to find any element by ID and get its file contents
const UNIVERSAL_ELEMENT_QUERY = `
  query UniversalElementFile($idIncludes: ID!, $startLine: Int, $endLine: Int) {
    all(idIncludes: $idIncludes) {
      id
      filePath
      fileContents(startLine: $startLine, endLine: $endLine)
      __typename
    }
  }
`;

// GraphQL queries for different element types (fallback)
const ELEMENT_FILE_QUERIES = {
  task: `
    query TaskFile($id: ID!, $startLine: Int, $endLine: Int) {
      task(id: $id) {
        id
        filePath
        fileContents(startLine: $startLine, endLine: $endLine)
      }
    }
  `,
  resource: `
    query ResourceFile($id: ID!, $startLine: Int, $endLine: Int) {
      resource(id: $id) {
        id
        filePath
        fileContents(startLine: $startLine, endLine: $endLine)
      }
    }
  `,
  middleware: `
    query MiddlewareFile($id: ID!, $startLine: Int, $endLine: Int) {
      middleware(id: $id) {
        id
        filePath
        fileContents(startLine: $startLine, endLine: $endLine)
      }
    }
  `,
  event: `
    query EventFile($id: ID!, $startLine: Int, $endLine: Int) {
      event(id: $id) {
        id
        filePath
        fileContents(startLine: $startLine, endLine: $endLine)
      }
    }
  `,
  hook: `
    query HookFile($id: ID!, $startLine: Int, $endLine: Int) {
      hook(id: $id) {
        id
        filePath
        fileContents(startLine: $startLine, endLine: $endLine)
      }
    }
  `,
  tag: `
    query TagFile($id: ID!, $startLine: Int, $endLine: Int) {
      tag(id: $id) {
        id
        filePath
        fileContents(startLine: $startLine, endLine: $endLine)
      }
    }
  `,
};

export type ElementType = keyof typeof ELEMENT_FILE_QUERIES;

/**
 * Fetches file contents using universal search (more reliable)
 */
export async function fetchElementFileContentsBySearch(
  elementId: string,
  startLine?: number,
  endLine?: number
): Promise<ElementFileContent | null> {
  try {
    const variables: Record<string, unknown> = { idIncludes: elementId };
    if (startLine !== undefined) variables.startLine = startLine;
    if (endLine !== undefined) variables.endLine = endLine;

    const response = await graphqlRequest<{ all: ElementFileContent[] }>(
      UNIVERSAL_ELEMENT_QUERY,
      variables
    );

    // Find exact match first, then partial match
    const elements = response.all || [];
    const exactMatch = elements.find(el => el.id === elementId);
    if (exactMatch) return exactMatch;

    // Return first partial match if no exact match
    return elements.length > 0 ? elements[0] : null;
  } catch (error) {
    console.error(`Failed to fetch file contents for element: ${elementId}`, error);
    return null;
  }
}

/**
 * Fetches file contents for a specific element (legacy approach)
 */
export async function fetchElementFileContents(
  elementId: string,
  elementType: ElementType,
  startLine?: number,
  endLine?: number
): Promise<ElementFileContent | null> {
  try {
    const query = ELEMENT_FILE_QUERIES[elementType];
    if (!query) {
      throw new Error(`Unsupported element type: ${elementType}`);
    }

    const variables: Record<string, unknown> = { id: elementId };
    if (startLine !== undefined) variables.startLine = startLine;
    if (endLine !== undefined) variables.endLine = endLine;

    const response = await graphqlRequest<Record<string, ElementFileContent>>(
      query,
      variables
    );

    return response[elementType] || null;
  } catch (error) {
    console.error(`Failed to fetch file contents for ${elementType}:${elementId}`, error);
    return null;
  }
}

/**
 * Parse @references from text and return array of references
 */
export interface ElementReference {
  originalText: string; // The full @reference text (e.g., "@myTask")
  elementId: string;
  elementType: ElementType;
  startIndex: number;
  endIndex: number;
}

export function parseElementReferences(
  text: string,
  availableElements: {
    tasks: Array<{ id: string; name: string }>;
    resources: Array<{ id: string; name: string }>;
    events: Array<{ id: string; name: string }>;
    hooks: Array<{ id: string; name: string }>;
    middlewares: Array<{ id: string; name: string }>;
    tags: Array<{ id: string; name: string }>;
  }
): ElementReference[] {
  const references: ElementReference[] = [];
  const atMentionRegex = /@([\w\.]+)/g; // Updated to include dots for element IDs like "globals.middleware.retry.task"
  
  let match;
  while ((match = atMentionRegex.exec(text)) !== null) {
    const mentionText = match[0]; // Full match including @
    const mentionName = match[1]; // Just the name part
    const startIndex = match.index;
    const endIndex = match.index + mentionText.length;

    // Find which element type this reference belongs to
    for (const [elementType, elements] of Object.entries(availableElements)) {
      const element = elements.find(el => el.name === mentionName || el.id === mentionName);
      if (element) {
        // Convert plural type to singular (tasks -> task)
        const singularType = elementType.slice(0, -1) as ElementType;
        
        references.push({
          originalText: mentionText,
          elementId: element.id,
          elementType: singularType,
          startIndex,
          endIndex,
        });
        break; // Found match, no need to check other types
      }
    }
  }

  return references;
}

/**
 * Inject file contents for @references in text
 */
export async function injectFileContentsForReferences(
  text: string,
  availableElements: {
    tasks: Array<{ id: string; name: string }>;
    resources: Array<{ id: string; name: string }>;
    events: Array<{ id: string; name: string }>;
    hooks: Array<{ id: string; name: string }>;
    middlewares: Array<{ id: string; name: string }>;
    tags: Array<{ id: string; name: string }>;
  }
): Promise<string> {
  const references = parseElementReferences(text, availableElements);
  
  if (references.length === 0) {
    return text;
  }

  // Fetch file contents for all references
  const fileContentsPromises = references.map(ref =>
    fetchElementFileContents(ref.elementId, ref.elementType)
  );
  
  const fileContentsResults = await Promise.all(fileContentsPromises);
  
  // Build the new text with injected contexts
  let result = text;
  let offset = 0; // Track how much we've added to the text
  
  for (let i = 0; i < references.length; i++) {
    const ref = references[i];
    const fileContent = fileContentsResults[i];
    
    if (fileContent && fileContent.fileContents) {
      const contextBlock = `\n\n========= ELEMENT ID: ${ref.elementId} =========\n${fileContent.fileContents}\n=========\n\n`;
      
      // Replace the @reference with the @reference + context
      const insertPosition = ref.endIndex + offset;
      result = result.slice(0, insertPosition) + contextBlock + result.slice(insertPosition);
      offset += contextBlock.length;
    }
  }
  
  return result;
}