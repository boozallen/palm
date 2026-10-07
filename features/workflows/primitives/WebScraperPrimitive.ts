/**
 * Web Scraper Primitive
 * Crawls websites and extracts text content
 */

import { BasePrimitive } from '@/features/workflows/primitives/BasePrimitive';
import {
  PrimitiveContext,
  PrimitiveResult,
  PrimitiveType,
  WebScraperConfig,
} from '@/features/workflows/types/primitive';
import { PuppeteerCrawlerFactory } from '@/features/ai-agents/utils/crawler';

export class WebScraperPrimitive extends BasePrimitive {
  private readonly scraperConfig: WebScraperConfig;

  constructor(config: any) {
    super({
      ...config,
      type: PrimitiveType.WEBSCRAPER,
    });
    this.scraperConfig = config.config as WebScraperConfig;
  }

  async validate(): Promise<{ valid: boolean; errors?: string[] }> {
    const baseValidation = await super.validate();
    const errors = baseValidation.errors || [];

    if (!this.scraperConfig.url) {
      errors.push('URL is required for web scraper');
    }

    try {
      new URL(this.scraperConfig.url);
    } catch {
      errors.push('Invalid URL format');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  async execute(context: PrimitiveContext): Promise<PrimitiveResult> {
    if (!this.shouldExecute(context)) {
      return this.success({ skipped: true }, { reason: 'Condition not met' });
    }

    try {
      const url = new URL(this.scraperConfig.url);
      const filterClasses = this.scraperConfig.filterClasses || [];

      // Create crawler
      const factory = new PuppeteerCrawlerFactory(url, filterClasses);

      // Run crawler
      await factory.crawler.run([url.toString()]);

      // Extract documents
      const documents = factory.documents.map((doc) => ({
        text: doc.text,
        url: doc.metadata?.url ?? '',
        title: doc.metadata?.title ?? '',
      }));

      return this.success(
        {
          documents,
          documentCount: documents.length,
          baseUrl: url.toString(),
        },
        {
          pagesScraped: documents.length,
          domain: url.hostname,
        }
      );
    } catch (error) {
      return this.error(
        `Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}
