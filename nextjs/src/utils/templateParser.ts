/**
 * Template parser utility
 * Handles parsing and replacing {{variables}} in templates
 */

/**
 * Default variables that are automatically provided by the system
 * These don't need to be created in the database
 */
export const DEFAULT_VARIABLES = ['video-id'] as const;

/**
 * Checks if a variable name is a default variable
 */
export function isDefaultVariable(variableName: string): boolean {
  return DEFAULT_VARIABLES.includes(variableName as any);
}

/**
 * Extracts all unique variable names from template content
 * @param content - Template content with {{variable}} placeholders
 * @returns Array of unique variable names (without braces)
 */
export function parseVariables(content: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g;
  const matches: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const variableName = match[1]?.trim();
    if (variableName && !matches.includes(variableName)) {
      matches.push(variableName);
    }
  }

  return matches;
}

/**
 * Extracts only user-defined variables (excludes default variables)
 * @param content - Template content with {{variable}} placeholders
 * @returns Array of unique user-defined variable names
 */
export function parseUserVariables(content: string): string[] {
  const allVariables = parseVariables(content);
  return allVariables.filter(varName => !isDefaultVariable(varName));
}

/**
 * Replaces all {{variables}} in content with their values
 * @param content - Template content with {{variable}} placeholders
 * @param variables - Object mapping variable names to their values
 * @returns Content with variables replaced
 */
export function replaceVariables(
  content: string,
  variables: Record<string, string>
): string {
  return content.replace(/\{\{([^}]+)\}\}/g, (match, variableName) => {
    const trimmedName = variableName.trim();
    return variables[trimmedName] !== undefined
      ? variables[trimmedName]
      : match; // Keep original if no value provided
  });
}

/**
 * Builds final description by concatenating templates and replacing variables
 * @param templates - Array of template objects with content, in order
 * @param variables - Object mapping variable names to their values
 * @param separator - Text to use between templates (default: '\n\n')
 * @param videoId - Optional video ID for default variables
 * @returns Final description with all variables replaced
 */
export function buildDescription(
  templates: Array<{ content: string }>,
  variables: Record<string, string>,
  separator: string = '\n\n',
  videoId?: string
): string {
  // Concatenate all template content with the specified separator
  const combined = templates.map((t) => t.content).join(separator);

  // Merge user variables with default variables
  const allVariables = {
    ...variables,
    'video-id': videoId || '', // Add video-id default variable
  };

  // Replace all variables
  return replaceVariables(combined, allVariables);
}

/**
 * Validates that all required variables have values
 * @param content - Template content
 * @param variables - Object mapping variable names to their values
 * @returns Array of missing variable names
 */
export function findMissingVariables(
  content: string,
  variables: Record<string, string>
): string[] {
  const requiredVars = parseVariables(content);
  return requiredVars.filter(
    (varName) => !variables[varName] || variables[varName].trim() === ''
  );
}
