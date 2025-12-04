# n8n-nodes-toon

Convert between JSON and TOON (Token-Oriented Object Notation) format in n8n workflows.

TOON is a token-efficient data format that reduces LLM prompt tokens by 30-60% compared to JSON.

## Installation

    npm install n8n-nodes-json-to-toon


Or in n8n community nodes settings, search for `n8n-nodes-json-to-toon`.

## Nodes

### JSON to TOON
Converts JSON objects/arrays to compact TOON format.

**Features:**
- Object flattening with configurable separator
- Array to tabular TOON conversion
- Token savings estimation
- Custom delimiters

### TOON to JSON
Parses TOON format back to JSON.

**Features:**
- Auto-detection of format
- Type inference (numbers, booleans)
- Nested object reconstruction
- Schema-aware parsing

## Example

**JSON Input:**
    {"name": "John", "age": 30, "city": "Madrid"}

**TOON Output:**
    @schema|name|age|city
    John|30|Madrid

## License
MIT