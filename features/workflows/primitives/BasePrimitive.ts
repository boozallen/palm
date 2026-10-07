/**
 * Base abstract class for all workflow primitives
 */

import {
  Primitive,
  PrimitiveConfig,
  PrimitiveContext,
  PrimitiveResult,
  PrimitiveType,
} from '@/features/workflows/types/primitive';

export abstract class BasePrimitive implements Primitive {
  readonly type: PrimitiveType;
  readonly config: PrimitiveConfig;

  constructor(config: PrimitiveConfig) {
    this.type = config.type;
    this.config = config;
  }

  /**
   * Execute the primitive - must be implemented by subclasses
   */
  abstract execute(context: PrimitiveContext): Promise<PrimitiveResult>;

  /**
   * Validate the primitive configuration - can be overridden by subclasses
   */
  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const errors: string[] = [];

    if (!this.config.id) {
      errors.push('Primitive ID is required');
    }

    if (!this.config.name) {
      errors.push('Primitive name is required');
    }

    if (!this.config.type) {
      errors.push('Primitive type is required');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Check if the primitive should execute based on its condition
   */
  protected shouldExecute(context: PrimitiveContext): boolean {
    if (!this.config.condition) {
      return true;
    }

    const { field, operator, value } = this.config.condition;
    const fieldValue = this.getFieldValue(context.input, field);

    switch (operator) {
      case 'equals':
        return fieldValue === value;
      case 'not_equals':
        return fieldValue !== value;
      case 'contains':
        return (
          typeof fieldValue === 'string' && fieldValue.includes(String(value))
        );
      case 'greater_than':
        return Number(fieldValue) > Number(value);
      case 'less_than':
        return Number(fieldValue) < Number(value);
      default:
        return true;
    }
  }

  /**
   * Get a field value from an object using dot notation
   */
  protected getFieldValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Set a field value in an object using dot notation
   */
  protected setFieldValue(
    obj: Record<string, any>,
    path: string,
    value: any
  ): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((current, key) => {
      if (!current[key]) {
        current[key] = {};
      }
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Create a success result
   */
  protected success(
    output: Record<string, any>,
    metadata?: Record<string, any>
  ): PrimitiveResult {
    return {
      output,
      status: 'success',
      metadata,
    };
  }

  /**
   * Create an error result
   */
  protected error(
    error: string,
    output: Record<string, any> = {}
  ): PrimitiveResult {
    return {
      output,
      status: 'error',
      error,
    };
  }

}
