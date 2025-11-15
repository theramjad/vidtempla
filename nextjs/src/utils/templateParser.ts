/**
 * Template parser utility
 * Handles parsing and replacing {{variables}} in templates
 */

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
    const variableName = match[1].trim();
    if (!matches.includes(variableName)) {
      matches.push(variableName);
    }
  }

  return matches;
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
 * @returns Final description with all variables replaced
 */
export function buildDescription(
  templates: Array<{ content: string }>,
  variables: Record<string, string>
): string {
  // Concatenate all template content
  const combined = templates.map((t) => t.content).join('\n\n');

  // Replace all variables
  return replaceVariables(combined, variables);
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
