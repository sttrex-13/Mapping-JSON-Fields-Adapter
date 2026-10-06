# Mapping Prototype

A small Vue app for mapping source JSON fields into a target output structure.

## Features

- Import source JSON data from a file
- Paste JSON manually in the editor
- Clear the current data and start over
- Select source fields and map them to target paths
- Choose output data type before adding a rule
- Drag mapping rows to reorder output JSON keys
- Preview generated JSON in real time

## Getting started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open the local URL shown in the terminal.

## How to use

### 1. Load data

You can load data in either of these ways:

- Upload a JSON file using the "Upload data" button
- Paste JSON into the manual editor and click "Apply JSON"

Example input:

```json
{
  "programGroup": "TITLE_LOAN",
  "basicInformation": {
    "programCode": "Program_Car_01",
    "programName": "test"
  },
  "customer": {
    "requiredFieldCheckDetail": [
      { "type": "HOME", "meta": { "priority": 1 } },
      { "type": "WORKPLACE", "meta": { "priority": 2 } }
    ]
  },
  "pricing": {
    "minAmount": 50000,
    "maxAmount": 2000000
  }
}
```

### 2. Select a source field

The left panel lists all discovered fields from the JSON.

Examples:

- `programGroup`
- `basicInformation.programCode`
- `pricing.minAmount`
- `customer.requiredFieldCheckDetail[].type`

### 3. Set target path and type

In the middle panel:

- choose the output target path, for example `meta.group`
- choose the output type, such as `string`, `number`, or `array`
- click "Add mapping"

### 4. Review mappings

Added mappings appear in the middle panel. You can:

- remove a mapping
- drag rows to reorder the final JSON structure

### 5. Preview output

The right panel shows the generated output JSON automatically.

Example output:

```json
{
  "meta": {
    "group": "TITLE_LOAN"
  },
  "program": {
    "code": "Program_Car_01",
    "name": "test"
  },
  "amount": {
    "min": 50000,
    "max": 2000000
  },
  "fieldCheck": {
    "details": [
      {
        "checkType": "HOME",
        "meta": {
          "priority": 1
        }
      },
      {
        "checkType": "WORKPLACE",
        "meta": {
          "priority": 2
        }
      }
    ]
  }
}
```

## Clear data

Use the "Clear data" button to reset:

- imported source fields
- source values
- mappings
- preview output

## Build for production

```bash
npm run build
```

## Notes

- The app expects the source data to be a JSON object at the top level.
- Array fields are expanded into item-based mappings when possible.
- The preview updates after each mapping change.
