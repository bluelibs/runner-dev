export const formatSchema = (schema: string | null | undefined): string => {
  if (!schema) return 'No schema defined';
  
  try {
    const parsed = JSON.parse(schema);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return schema;
  }
};

export const formatConfig = (config: string | null | undefined): string => {
  if (!config) return 'No configuration';
  
  try {
    const parsed = JSON.parse(config);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return config;
  }
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

export const formatFilePath = (filePath: string | null | undefined): string => {
  if (!filePath) return 'Unknown location';
  
  const parts = filePath.split('/');
  if (parts.length > 3) {
    return '.../' + parts.slice(-3).join('/');
  }
  return filePath;
};

export const getSeverityColor = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'error':
      return '#e74c3c';
    case 'warning':
      return '#f39c12';
    case 'info':
      return '#3498db';
    default:
      return '#95a5a6';
  }
};

export const getSeverityIcon = (severity: string): string => {
  switch (severity.toLowerCase()) {
    case 'error':
      return '❌';
    case 'warning':
      return '⚠️';
    case 'info':
      return 'ℹ️';
    default:
      return '📝';
  }
};

export const formatId = (id: string): string => {
  return id.replace(/\./g, ' › ');
};

export const formatArray = (arr: string[] | null | undefined): string => {
  if (!arr || arr.length === 0) return 'None';
  if (arr.length === 1) return arr[0];
  if (arr.length <= 3) return arr.join(', ');
  return `${arr.slice(0, 3).join(', ')} and ${arr.length - 3} more`;
};