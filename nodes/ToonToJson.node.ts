import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

// ============ HELPER FUNCTIONS (fuera de la clase) ============

function parseDelimitedLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);

  return values;
}

function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
  separator: string
): void {
  const keys = path.split(separator);
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current)) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

function parseToon(
  toon: string,
  delimiter: string,
  nestedSeparator: string,
  outputFormat: string,
  parseNumbers: boolean,
  parseBooleans: boolean
): Record<string, unknown> | Record<string, unknown>[] {
  const lines = toon.trim().split('\n');

  if (lines.length === 0) {
    return outputFormat === 'array' ? [] : {};
  }

  const schemaLine = lines[0];
  let dataLines = lines.slice(1);
  let keys: string[];

  // Check if first line is schema
  if (schemaLine.startsWith('@schema')) {
    keys = schemaLine.replace('@schema' + delimiter, '').split(delimiter);
  } else {
    // No schema header, treat first line as data
    dataLines = lines;
    // Auto-generate keys
    const firstLineValues = parseDelimitedLine(lines[0], delimiter);
    keys = firstLineValues.map((_, idx) => `field${idx}`);
  }

  const records: Record<string, unknown>[] = [];

  for (const line of dataLines) {
    if (line.trim() === '') continue;

    const values = parseDelimitedLine(line, delimiter);
    const record: Record<string, unknown> = {};

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      let value: unknown = values[i] ?? '';

      // Type conversion
      if (parseNumbers && !isNaN(Number(value)) && value !== '') {
        value = Number(value);
      } else if (parseBooleans) {
        if (value === 'true') value = true;
        else if (value === 'false') value = false;
      }

      // Handle nested keys
      setNestedValue(record, key, value, nestedSeparator);
    }

    records.push(record);
  }

  // Determine output format
  if (outputFormat === 'auto') {
    return records.length === 1 ? records[0] : records;
  } else if (outputFormat === 'object') {
    return records[0] || {};
  }
  return records;
}

// ============ NODE CLASS ============

export class ToonToJson implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'TOON to JSON',
    name: 'ToonToJson',
    icon: 'file:ToonToJson.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["outputFormat"]}}',
    description: 'Convert TOON format back to JSON',
    defaults: {
      name: 'TOON to JSON',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'TOON Input',
        name: 'toonInput',
        type: 'string',
        default: '',
        required: true,
        typeOptions: {
          rows: 5,
        },
        description: 'The TOON data to convert to JSON',
      },
      {
        displayName: 'Output Format',
        name: 'outputFormat',
        type: 'options',
        options: [
          {
            name: 'Object',
            value: 'object',
            description: 'Parse as single object',
          },
          {
            name: 'Array',
            value: 'array',
            description: 'Parse as array of objects',
          },
          {
            name: 'Auto-detect',
            value: 'auto',
            description: 'Automatically detect format',
          },
        ],
        default: 'auto',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Delimiter',
            name: 'delimiter',
            type: 'string',
            default: '|',
            description: 'Delimiter character used in TOON',
          },
          {
            displayName: 'Nested Separator',
            name: 'nestedSeparator',
            type: 'string',
            default: '.',
            description: 'Separator for nested object paths',
          },
          {
            displayName: 'Parse Numbers',
            name: 'parseNumbers',
            type: 'boolean',
            default: true,
            description: 'Whether to parse numeric strings as numbers',
          },
          {
            displayName: 'Parse Booleans',
            name: 'parseBooleans',
            type: 'boolean',
            default: true,
            description: 'Whether to parse true/false strings as booleans',
          },
        ],
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      try {
        const toonInput = this.getNodeParameter('toonInput', i) as string;
        const outputFormat = this.getNodeParameter('outputFormat', i) as string;
        const options = this.getNodeParameter('options', i) as {
          delimiter?: string;
          nestedSeparator?: string;
          parseNumbers?: boolean;
          parseBooleans?: boolean;
        };

        const delimiter = options.delimiter || '|';
        const nestedSeparator = options.nestedSeparator || '.';
        const parseNumbers = options.parseNumbers !== false;
        const parseBooleans = options.parseBooleans !== false;

        const jsonOutput = parseToon(
          toonInput,
          delimiter,
          nestedSeparator,
          outputFormat,
          parseNumbers,
          parseBooleans
        );

        returnData.push({
          json: jsonOutput as INodeExecutionData['json'],
        });
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: { error: (error as Error).message },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, {
          itemIndex: i,
        });
      }
    }

    return [returnData];
  }
}