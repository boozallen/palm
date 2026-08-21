/**
 * Factory for creating primitive instances
 */

import { Primitive, PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';
import { WebScraperPrimitive } from '@/features/workflows/primitives/WebScraperPrimitive';
import { PromptPrimitive } from '@/features/workflows/primitives/PromptPrimitive';
import { ArtifactPrimitive } from '@/features/workflows/primitives/ArtifactPrimitive';
import { DocumentPrimitive } from '@/features/workflows/primitives/DocumentPrimitive';
import { BuildResult } from '@/features/ai-agents/types/factoryAdapter';

const PRIMITIVE_CONSTRUCTORS: Record<
  PrimitiveType,
  (config: PrimitiveConfig, ai?: BuildResult) => Primitive
> = {
  [PrimitiveType.DOCUMENT]: (config) => new DocumentPrimitive(config),
  [PrimitiveType.WEBSCRAPER]: (config) => new WebScraperPrimitive(config),
  [PrimitiveType.PROMPT]: (config, ai) => {
    const primitive = new PromptPrimitive(config, ai);
    if (ai) {
      primitive.setAI(ai);
    }
    return primitive;
  },
  [PrimitiveType.ARTIFACT]: (config) => new ArtifactPrimitive(config),
};

export class PrimitiveFactory {
  /**
   * Create a primitive instance from configuration
   */
  static create(config: PrimitiveConfig, ai?: BuildResult): Primitive {
    const ctor = PRIMITIVE_CONSTRUCTORS[config.type];
    if (!ctor) {
      throw new Error(`Unknown primitive type: ${config.type}`);
    }
    return ctor(config, ai);
  }

  /**
   * Validate that all primitives in a workflow are supported
   */
  static validateWorkflowPrimitives(
    configs: PrimitiveConfig[]
  ): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    for (const config of configs) {
      if (!PRIMITIVE_CONSTRUCTORS[config.type]) {
        errors.push(
          `Unsupported primitive type: ${config.type} (ID: ${config.id})`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
