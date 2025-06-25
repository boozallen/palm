import { Page } from 'puppeteer';
import {
  Dictionary,
  LoadedRequest,
  Log,
  PuppeteerCrawler,
  Request,
} from 'crawlee';

import { Document } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import {
  NavigationLinkExtractor,
  PuppeteerCrawlerFactory,
  PuppeteerRequestHandler,
  HTMLReader,
} from '@/features/ai-agents/utils/crawler';

jest.mock('cheerio', () => ({
  load: jest.fn().mockImplementation(() => {

    const $ = function () {
      return {
        remove: jest.fn(),
        each: jest.fn(),
        text: jest.fn().mockReturnValue('Parsed content'),
        replaceWith: jest.fn(),
      };
    };

    ($ as any).text = jest.fn().mockReturnValue('Parsed content');
    return $;
  }),
}));

jest.mock('crawlee', () => ({
  Configuration: jest.fn().mockImplementation(() => ({})),
  PuppeteerCrawler: jest.fn().mockImplementation(jest.fn()),
}));

describe('NavigationLinkExtractor', () => {
  const page = {
    evaluate: jest.fn(),
    title: jest.fn(),
    content: jest.fn(),
  } as unknown as Page;

  let extractor: NavigationLinkExtractor;

  beforeEach(() => {
    jest.clearAllMocks();
    extractor = new NavigationLinkExtractor();
  });

  describe('extractNavigationLinks', () => {
    it('calls evaluate method with extractLinks function and classes', async () => {
      const classes = ['nav', 'footer'];
      await extractor.extractNavigationLinks(page, classes);

      expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), classes);
    });

    it('calls evaluate method with extractLinks function and default empty classes', async () => {
      const classes: string[] = [];
      await extractor.extractNavigationLinks(page, classes);

      expect(page.evaluate).toHaveBeenCalledWith(expect.any(Function), classes);
    });
  });

  describe('extractLinks', () => {
    interface MockElement {
      getAttribute: jest.Mock;
    }

    const mockLinks: MockElement[] = [
      { getAttribute: jest.fn().mockReturnValue('https://www.example1.com') },
      { getAttribute: jest.fn().mockReturnValue('https://www.example2.com') },
      { getAttribute: jest.fn().mockReturnValue(null) },
      { getAttribute: jest.fn().mockReturnValue('#example') },
      { getAttribute: jest.fn().mockReturnValue('javascript:example') },
      {
        getAttribute: jest
          .fn()
          .mockReturnValue('data:text/html,<script>alert("test")</script>'),
      },
      { getAttribute: jest.fn().mockReturnValue('vbscript:msgbox("test")') },
    ];

    beforeEach(() => {
      (global as any).document = {
        querySelectorAll: jest.fn().mockReturnValue([]),
      };
    });

    afterEach(() => {
      delete (global as any).document;
    });

    it('calls querySelectorAll correct number of times based on classes', () => {
      const classes = ['nav', 'footer', 'header'];

      document.querySelectorAll = jest.fn().mockReturnValue([]);

      extractor.extractLinks(classes);

      expect(document.querySelectorAll).toHaveBeenCalledTimes(3);
    });

    it('returns correct links', () => {
      (document.querySelectorAll as jest.Mock).mockReturnValue(mockLinks);

      const links = extractor.extractLinks();

      expect(links).toEqual([
        'https://www.example1.com',
        'https://www.example2.com',
      ]);
    });
  });
});

describe('HTMLReader', () => {
  let reader: HTMLReader;

  beforeEach(() => {
    reader = new HTMLReader();

    jest
      .spyOn(reader, 'parseContent')
      .mockImplementation(async (_html: string, _options?: any) => 'Parsed HTML');
  });

  it('parses HTML content correctly', async () => {
    const mockHtml = '<html><body><p>Test content</p></body></html>';
    const result = await reader.parseContent(mockHtml);

    expect(result).toBe('Parsed HTML');
  });

  it('applies strip options correctly', async () => {
    const mockHtml =
      '<html><body><script>alert("test")</script><p>Test content</p></body></html>';
    const options = {
      options: {
        stripTogetherWithTheirContents: ['script', 'style'],
      },
    };

    await reader.parseContent(mockHtml, options);

    expect(reader.parseContent).toHaveBeenCalledWith(mockHtml, options);
  });
});

describe('PuppeteerRequestHandler', () => {
  const reader = new HTMLReader();
  const classes = ['nav', 'footer'];
  const documents: Document[] = [];

  let handler: PuppeteerRequestHandler;

  beforeEach(() => {
    jest.clearAllMocks();

    documents.length = 0;

    handler = new PuppeteerRequestHandler(
      reader,
      new NavigationLinkExtractor(),
      documents,
      new URL('https://www.example.com'),
      classes
    );

    jest.spyOn(reader, 'parseContent').mockResolvedValue('Parsed HTML');

    jest
      .spyOn(NavigationLinkExtractor.prototype, 'extractNavigationLinks')
      .mockResolvedValue(['https://www.example.com/page1']);
  });

  describe('handle', () => {
    const page = {
      evaluate: jest.fn(),
      title: jest.fn().mockResolvedValue('Mock Title'),
      content: jest.fn().mockResolvedValue('Mock Content'),
    } as unknown as Page;

    const request = {
      url: 'https://example.com',
      loadedUrl: 'https://www.example.com',
    } as unknown as LoadedRequest<LoadedRequest<Request<Dictionary>>>;

    const log = {
      info: jest.fn(),
      debug: jest.fn(),
    } as unknown as Log;

    const enqueueLinks = jest.fn().mockResolvedValue(undefined);

    it('passes filterClasses to extractNavigationLinks', async () => {
      const extractSpy = jest.spyOn(
        NavigationLinkExtractor.prototype,
        'extractNavigationLinks'
      );

      await handler.handle({
        page,
        request,
        enqueueLinks,
        log,
      });

      expect(extractSpy).toHaveBeenCalledWith(page, classes);
    });

    it('gets the page content', async () => {
      await handler.handle({ page, request, enqueueLinks, log });

      expect(page.content).toHaveBeenCalled();
    });

    it('creates a document with the correct structure', async () => {
      await handler.handle({ page, request, enqueueLinks, log });

      expect(documents[0]).toEqual({
        text: 'Parsed HTML',
        id: 'https://www.example.com',
        metadata: {
          title: 'Mock Title',
          url: 'https://www.example.com',
        },
      });
    });

    it('only crawls links from the same domain', async () => {
      jest.spyOn(handler as any, 'sameDomain').mockReturnValueOnce(false);

      await handler.handle({ page, request, enqueueLinks, log });

      expect(enqueueLinks).not.toHaveBeenCalled();
    });
  });
});

describe('PuppeteerCrawlerFactory', () => {
  const url = new URL('https://www.example.com');

  it('calls build method upon initialization', () => {
    jest.spyOn(PuppeteerCrawlerFactory.prototype, 'buildCrawler');

    const factory = new PuppeteerCrawlerFactory(url);

    expect(factory.buildCrawler).toHaveBeenCalled();
  });

  it('has crawler property that is an instance of PuppeteerCrawler', () => {
    const factory = new PuppeteerCrawlerFactory(url);

    expect(factory.crawler).toBeInstanceOf(PuppeteerCrawler);
  });

  it('passes filter classes to the request handler', () => {
    const filterClasses = ['nav', 'footer', 'sidebar'];
    const factory = new PuppeteerCrawlerFactory(url, filterClasses);

    expect(factory['filterClasses']).toEqual(filterClasses);
  });

  it('creates a crawler with the right configuration', () => {
    const factory = new PuppeteerCrawlerFactory(url);
    
    expect(factory.crawler).toBeInstanceOf(PuppeteerCrawler);
  });
});
