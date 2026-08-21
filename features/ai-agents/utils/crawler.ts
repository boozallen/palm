import {
  Configuration,
  Dictionary,
  LoadedRequest,
  Log,
  PuppeteerCrawler,
  Request,
} from 'crawlee';
import { Page } from 'puppeteer';
import { load } from 'cheerio';

import { CrawlerConfig } from '@/features/ai-agents/types/crawler';
import { Document } from '@/features/ai-agents/types/certa/webPolicyCompliance';

/**
 * Simple HTML reader that parses HTML content into clean text.
 * It uses Cheerio to manipulate the HTML and extract relevant information.
 * It removes script, style, and XML tags, and replaces anchor tags with their text and href.
 * It also cleans up whitespace and returns the parsed text.
 */
export class HTMLReader {
  /**
   * Parse HTML content into clean text
   */
  async parseContent(
    html: string,
    options?: {
      options?: {
        ignoreTagsWithTheirContents?: string[];
        stripTogetherWithTheirContents?: string[];
      };
    }
  ): Promise<string> {
    const stripTags = options?.options?.stripTogetherWithTheirContents || [
      'script',
      'style',
      'xml',
      'head',
    ];
    const $ = load(html);

    // Remove specified tags along with their content
    stripTags.forEach((tag) => {
      $(tag).remove();
    });

    // Replace anchor tags with their text and href
    $('a').each((_, el) => {
      const $el = $(el);
      const text = $el.text().trim();
      const href = $el.attr('href');
      if (href) {
        $el.replaceWith(`${text} (${href})`);
      } else {
        $el.replaceWith(text);
      }
    });

    // Get the text content
    let parsedText = $.text();

    // Clean up whitespace
    parsedText = parsedText.replace(/\s+/g, ' ').trim();

    return parsedText;
  }
}

/**
 * A class that extracts navigation links from a web page.
 */
export class NavigationLinkExtractor {
  /**
   * A helper function that extracts links from the document based on specified selectors.
   *
   * @returns An array of unique navigation link URLs.
   */
  extractLinks(classes: string[] = []): string[] {
    const links: string[] = [];

    // If no classes specified, get all links
    const selectors =
      classes.length > 0 ? classes.map((cls) => `${cls} a`) : ['a'];

    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((link) => {
        const href = link.getAttribute('href');
        const dangerousSchemes = ['javascript:', 'data:', 'vbscript:'];
        if (
          href &&
          !href.startsWith('#') &&
          !dangerousSchemes.some((scheme) =>
            href.toLowerCase().startsWith(scheme)
          )
        ) {
          links.push(href);
        }
      });
    });

    return [...new Set(links)];
  }

  /**
   * Extracts navigation links from the given page.
   *
   * @param page - The page object from which to extract navigation links.
   * @returns A promise that resolves to an array of navigation link URLs.
   */
  async extractNavigationLinks(
    page: Page,
    classes: string[]
  ): Promise<string[]> {
    return page.evaluate(this.extractLinks, classes);
  }
}

export class PuppeteerRequestHandler {
  constructor(
    private readonly reader: HTMLReader,
    private readonly linkExtractor: NavigationLinkExtractor,
    private readonly documents: Document[],
    private readonly baseUrl: URL,
    private readonly filterClasses: string[] = []
  ) {}

  async handle({
    request,
    page,
    enqueueLinks,
    log,
  }: {
    request: LoadedRequest<LoadedRequest<Request<Dictionary>>>;
    page: Page;
    enqueueLinks: () => Promise<any>;
    log: Log;
  }) {
    log.debug(`Loading ${request.url}`);
    const title = await page.title();

    log.debug(`Scraping ${title} at ${request.loadedUrl}`);
    const html = await page.content();

    const parsedHtml = await this.reader.parseContent(html, {
      options: {
        ignoreTagsWithTheirContents: ['a'],
        stripTogetherWithTheirContents: ['script', 'style', 'xml', 'head'],
      },
    });

    log.debug('Creating document...');
    const document: Document = {
      text: parsedHtml,
      id: request.loadedUrl,
      metadata: {
        title: title,
        url: request.loadedUrl,
      },
    };

    this.documents.push(document);

    log.debug(`Created document for ${title}`);
    if (this.sameDomain(new URL(request.loadedUrl))) {
      const navigationLinks = await this.linkExtractor.extractNavigationLinks(
        page,
        this.filterClasses
      );

      await this.enqueueNavigationLinks(enqueueLinks, navigationLinks);
    }
  }

  private sameDomain(url: URL): boolean {
    const baseUrl = this.baseUrl.hostname.replace('www.', '');
    const newUrl = url.hostname.replace('www.', '');
    return baseUrl === newUrl;
  }

  private async enqueueNavigationLinks(enqueueLinks: any, links: string[]) {
    await enqueueLinks({
      strategy: 'all',
      urls: links,
      label: 'nav-footer-links',
      transformRequestFunction: (req: any) => req,
    });
  }
}

export class PuppeteerCrawlerFactory {
  readonly documents: Document[] = [];
  private readonly linkExtractor = new NavigationLinkExtractor();
  private readonly reader = new HTMLReader();
  private readonly baseUrl: URL;
  readonly crawler: PuppeteerCrawler;

  private readonly config: CrawlerConfig = {
    maxRequests: 250,
    headless: true,
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--ignore-certificate-errors',
      ],
      ignoreHTTPSErrors: true,
    },
  };

  constructor(baseUrl: URL, private readonly filterClasses: string[] = []) {
    this.baseUrl = baseUrl;
    const requestHandler = new PuppeteerRequestHandler(
      this.reader,
      this.linkExtractor,
      this.documents,
      this.baseUrl,
      this.filterClasses
    );
    this.crawler = this.buildCrawler(requestHandler);
  }

  buildCrawler(requestHandler: PuppeteerRequestHandler): PuppeteerCrawler {
    const crawlerConfig = new Configuration({
      persistStorage: false,
      purgeOnStart: true,
      storageClientOptions: {
        requestQueue: {
          lockExpirationMillis: 60000,
          checkForLocksIntervalMillis: 5000,
        },
      },
    });

    return new PuppeteerCrawler(
      {
        useSessionPool: false,
        persistCookiesPerSession: false,
        maxRequestsPerCrawl: this.config.maxRequests,
        headless: this.config.headless,
        maxConcurrency: 5,
        minConcurrency: 1,
        requestHandlerTimeoutSecs: 30,
        maxRequestRetries: 1,
        navigationTimeoutSecs: 20,
        failedRequestHandler: async () => {},
        launchContext: {
          launchOptions: {
            ...this.config.launchOptions,
    
            waitForInitialPage: true,
          },
        },
        requestHandler: (context) => requestHandler.handle(context),
      },
      crawlerConfig
    );
  }
}
