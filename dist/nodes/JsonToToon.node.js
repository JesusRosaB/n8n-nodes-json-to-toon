"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonToToon = void 0;
const n8n_workflow_1 = require("n8n-workflow");
// ============ HELPER FUNCTIONS (fuera de la clase) ============
function flattenObject(obj, prefix, separator) {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}${separator}${key}` : key;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
            Object.assign(result, flattenObject(value, newKey, separator));
        }
        else if (Array.isArray(value)) {
            result[newKey] = value.join(',');
        }
        else {
            result[newKey] = value;
        }
    }
    return result;
}
function escapeValue(value, delimiter) {
    if (value.includes(delimiter) || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}
function convertObjectToToon(obj, delimiter, nestedSeparator, includeSchema) {
    const flattenedPairs = flattenObject(obj, '', nestedSeparator);
    const keys = Object.keys(flattenedPairs);
    const values = Object.values(flattenedPairs).map((v) => escapeValue(String(v ?? ''), delimiter));
    let result = '';
    if (includeSchema) {
        result += `@schema${delimiter}${keys.join(delimiter)}\n`;
    }
    result += values.join(delimiter);
    return result;
}
function convertArrayToToon(arr, delimiter, includeSchema) {
    if (arr.length === 0)
        return '';
    const firstItem = arr[0];
    const keys = Object.keys(firstItem);
    let result = '';
    if (includeSchema) {
        result += `@schema${delimiter}${keys.join(delimiter)}\n`;
    }
    for (const item of arr) {
        const record = item;
        const values = keys.map((key) => escapeValue(String(record[key] ?? ''), delimiter));
        result += values.join(delimiter) + '\n';
    }
    return result.trim();
}
function estimateTokenSavings(jsonStr, toonStr) {
    const jsonTokens = Math.ceil(jsonStr.length / 4);
    const toonTokens = Math.ceil(toonStr.length / 4);
    const savings = ((jsonTokens - toonTokens) / jsonTokens) * 100;
    return `~${savings.toFixed(1)}% token reduction`;
}
// ============ NODE CLASS ============
class JsonToToon {
    constructor() {
        this.description = {
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
    }
    async execute() {
        const items = this.getInputData();
        const returnData = [];
        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i);
                const jsonInput = this.getNodeParameter('jsonInput', i);
                const options = this.getNodeParameter('options', i);
                const delimiter = options.delimiter || '|';
                const nestedSeparator = options.nestedSeparator || '.';
                const includeSchema = options.includeSchema !== false;
                let toonOutput;
                if (operation === 'convertArray') {
                    toonOutput = convertArrayToToon(jsonInput, delimiter, includeSchema);
                }
                else {
                    toonOutput = convertObjectToToon(jsonInput, delimiter, nestedSeparator, includeSchema);
                }
                returnData.push({
                    json: {
                        toon: toonOutput,
                        originalJson: jsonInput,
                        tokenSavingsEstimate: estimateTokenSavings(JSON.stringify(jsonInput), toonOutput),
                    },
                });
            }
            catch (error) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: { error: error.message },
                    });
                    continue;
                }
                throw new n8n_workflow_1.NodeOperationError(this.getNode(), error, {
                    itemIndex: i,
                });
            }
        }
        return [returnData];
    }
}
exports.JsonToToon = JsonToToon;
//# sourceMappingURL=JsonToToon.node.js.map