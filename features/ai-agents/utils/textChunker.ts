import { load } from 'cheerio';
import { nanoid } from 'nanoid';

import { Document } from '@/features/ai-agents/types/certa/webPolicyCompliance';

export interface TextNode {
  id: string;
  text: string;
  embedding?: number[];
  metadata?: {
    url?: string;
    navContent?: string;
    footerContent?: string;
    headerContent?: string;
    links?: { text: string; href: string }[];
    chunk_index?: number;
    total_chunks?: number;
    doc_id?: string;
    semanticSource?: string;
  };
}

interface Link {
  href: string;
  text: string;
}

export class TextChunker {
  private readonly chunkSize: number;
  private readonly chunkOverlap: number;

  constructor(chunkSize = 512, chunkOverlap = 150) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  processDocument(doc: Document): TextNode[] {
    const $ = load(doc.text);
    const metadata: Record<string, unknown> = { ...doc.metadata };

    const seen = new Set<string>();

    // Navigation content detection
    const knownNavSelectors = [
      'nav',
      '[class*="nav"]',
      '[id*="nav"]',
      '[class*="menu"]',
      '[id*="menu"]',
      '[role="navigation"]',
    ];
    let aggregatedNavText = '';
    for (const selector of knownNavSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 30 && !seen.has(text)) {
          aggregatedNavText += `\n\n${text}`;
          seen.add(text);
        }
      });
    }
    if (aggregatedNavText.trim().length > 0) {
      metadata.navContent = aggregatedNavText.trim();
    }

    // Footer content detection
    const knownFooterSelectors = [
      'footer',
      '[class*="footer"]',
      '[id*="footer"]',
      '[class*="disclaimer"]',
      '[id*="disclaimer"]',
      '[class*="terms"]',
      '[id*="terms"]',
      '[class*="policy"]',
      '[id*="policy"]',
      '[class*="privacy"]',
      '[id*="privacy"]',
      '[class*="legal"]',
      '[id*="legal"]',
      '[class*="notice"]',
      '[id*="notice"]',
    ];
    let aggregatedFooterText = '';
    for (const selector of knownFooterSelectors) {
      $(selector).each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 50 && !seen.has(text)) {
          aggregatedFooterText += `\n\n${text}`;
          seen.add(text);
        }
      });
    }
    if (aggregatedFooterText.trim().length > 0) {
      metadata.footerContent = aggregatedFooterText.trim();
    }

    // Header content detection
    const header = $('header').text().trim();
    if (header.length > 0) {
      metadata.headerContent = header;
    }

    // Link replacement and collection
    const links: Link[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const text = $(el).text().trim();
      if (href && text) {
        links.push({ href, text });
        $(el).replaceWith(`${text} (${href})`);
      }
    });
    if (links.length > 0) {
      metadata.links = links;
    }

    // Cleanup and remove unwanted elements
    $('script, style, noscript').remove();

    const fullText: string = $('body').text().replace(/\s+/g, ' ').trim();
    const textChunks: string[] = this.splitText(fullText);
    const docId = doc.id ?? `doc-${nanoid()}`;

    return textChunks.map((chunk, index): TextNode => {
      const lowered = chunk.toLowerCase();

      let semanticSource: string;

      if (index === textChunks.length - 1) {
        semanticSource = 'likely-footer';
      } else if (
        /privacy|terms|gdpr|ccpa|disclaimer|cookie|legal|notice/.test(lowered)
      ) {
        semanticSource = 'legal-block';
      } else if (
        /menu|home|navigation|resources|contact|apply|about|studies/.test(
          lowered
        )
      ) {
        semanticSource = 'nav-block';
      } else if (index === 0) {
        semanticSource = 'likely-header';
      } else {
        semanticSource = 'body';
      }

      return {
        id: `${docId}-chunk-${index}`,
        text: chunk,
        metadata: {
          ...metadata,
          chunk_index: index,
          total_chunks: textChunks.length,
          doc_id: docId,
          semanticSource,
        },
      };
    });
  }

  private splitText(text: string): string[] {
    const chunks: string[] = [];
    let currentChunk = '';
    const sentences: string[] = text.split(/(?<=[.!?])\s+/);

    for (const sentence of sentences) {
      if ((currentChunk + ' ' + sentence).length > this.chunkSize) {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk.trim());
        }
        currentChunk = sentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? ' ' : '') + sentence;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }
}
