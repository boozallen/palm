export interface CrawlerConfig {
  maxRequests: number;
  headless: boolean;
  launchOptions: Record<string, any>;
}
