import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

// ============ HELPER FUNCTIONS (fuera de la clase) ============

function flattenObject(
  obj: Record<string, unknown>,
  prefix: string,
  separator: string
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}${separator}${key}` : key;

    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, newKey, separator)
      );
    } else if (Array.isArray(value)) {
      result[newKey] = value.join(',');
    } else {
      result[newKey] = value;
    }
  }

  return result;
}

function escapeValue(value: string, delimiter: string): string {
  if (value.includes(delimiter) || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function convertObjectToToon(
  obj: Record<string, unknown>,
  delimiter: string,
  nestedSeparator: string,
  includeSchema: boolean
): string {
  const flattenedPairs = flattenObject(obj, '', nestedSeparator);
  const keys = Object.keys(flattenedPairs);
  const values = Object.values(flattenedPairs).map((v) =>
    escapeValue(String(v ?? ''), delimiter)
  );

  let result = '';
  if (includeSchema) {
    result += `@schema${delimiter}${keys.join(delimiter)}\n`;
  }
  result += values.join(delimiter);

  return result;
}

function convertArrayToToon(
  arr: unknown[],
  delimiter: string,
  includeSchema: boolean
): string {
  if (arr.length === 0) return '';

  const firstItem = arr[0] as Record<string, unknown>;
  const keys = Object.keys(firstItem);

  let result = '';
  if (includeSchema) {
    result += `@schema${delimiter}${keys.join(delimiter)}\n`;
  }

  for (const item of arr) {
    const record = item as Record<string, unknown>;
    const values = keys.map((key) =>
      escapeValue(String(record[key] ?? ''), delimiter)
    );
    result += values.join(delimiter) + '\n';
  }

  return result.trim();
}

function estimateTokenSavings(jsonStr: string, toonStr: string): string {
  const jsonTokens = Math.ceil(jsonStr.length / 4);
  const toonTokens = Math.ceil(toonStr.length / 4);
  const savings = ((jsonTokens - toonTokens) / jsonTokens) * 100;
  return `~${savings.toFixed(1)}% token reduction`;
}

// ============ NODE CLASS ============

export class JsonToToon implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'JSON to TOON',
    name: 'JsonToToon',
    icon: 'file:JsonToToon.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Convert JSON to TOON format for token-efficient LLM prompts',
    defaults: {
      name: 'JSON to TOON',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Convert Object',
            value: 'convertObject',
            description: 'Convert a JSON object to TOON format',
          },
          {
            name: 'Convert Array',
            value: 'convertArray',
            description: 'Convert a JSON array to TOON tabular format',
          },
        ],
        default: 'convertObject',
      },
      {
        displayName: 'JSON Input',
        name: 'jsonInput',
        type: 'json',
        default: '{}',
        required: true,
        description: 'The JSON data to convert to TOON format',
      },
      {
        displayName: 'Options',
        name: 'options',
        type: 'collection',
        placeholder: 'Add Option',
        default: {},
        options: [
          {
            displayName: 'Include Schema Header',
            name: 'includeSchema',
            type: 'boolean',
            default: true,
            description: 'Whether to include the TOON schema header',
          },
          {
            displayName: 'Delimiter',
            name: 'delimiter',
            type: 'string',
            default: '|',
            description: 'Delimiter character for TOON values',
          },
          {
            displayName: 'Nested Separator',
            name: 'nestedSeparator',
            type: 'string',
            default: '.',
            description: 'Separator for nested object paths',
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
        const operation = this.getNodeParameter('operation', i) as string;
        const jsonInput = this.getNodeParameter('jsonInput', i) as object;
        const options = this.getNodeParameter('options', i) as {
          includeSchema?: boolean;
          delimiter?: string;
          nestedSeparator?: string;
        };

        const delimiter = options.delimiter || '|';
        const nestedSeparator = options.nestedSeparator || '.';
        const includeSchema = options.includeSchema !== false;

        let toonOutput: string;

        if (operation === 'convertArray') {
          toonOutput = convertArrayToToon(
            jsonInput as unknown[],
            delimiter,
            includeSchema
          );
        } else {
          toonOutput = convertObjectToToon(
            jsonInput as Record<string, unknown>,
            delimiter,
            nestedSeparator,
            includeSchema
          );
        }

        returnData.push({
          json: {
            toon: toonOutput,
            originalJson: jsonInput,
            tokenSavingsEstimate: estimateTokenSavings(
              JSON.stringify(jsonInput),
              toonOutput
            ),
          },
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