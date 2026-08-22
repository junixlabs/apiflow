// cm:why The TYPES of a shape live with the format, the CODE that derives one lives in the scanner:
// a FieldNode carries `type`, so anything reading an .apimap needs this union, while `shapeOf` needs
// a response body and belongs to the half that has one.
// cm:edge contract -> packages/scan/src/shape.ts — shapeOf/mergeShapes/isDictionary produce these.
export type ShapeType = 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array' | 'unknown';

export interface ShapeField {
  path: string;
  type: ShapeType;
  nullable?: boolean;
  optional?: boolean;
  keys?: number;
}
