// Plain TS builder: sensible defaults, override only what the test cares about.
export interface ExampleRecord {
  id: string;
  name: string;
}

let sequence = 0;

export function buildExampleRecord(overrides: Partial<ExampleRecord> = {}): ExampleRecord {
  sequence += 1;
  return { id: `example-${sequence}`, name: `Example ${sequence}`, ...overrides };
}
