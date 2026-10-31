import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import type { LoadedPage } from './fetcher.service';

/** Per-page on-page signals, extracted with a deterministic parser (never the model). */
export interface PageSignals {
  pageUrl: string;
  file?: string;
  title?: string;
  metaDescription?: string;
  h1Count: number;
  canonical?: string;
  /** true when og:title, og:description and og:image are all present */
  openGraphComplete: boolean;
  ogTagCount: number;
  twitterCardPresent: boolean;
  hreflangLangs: string[];
  htmlLang?: string;
  isSpaShell: boolean;
  images: { src: string; alt: string | null }[];
}

/** Site-level signals: robots.txt and sitemap.xml presence. */
export interface SiteSignals {
  robotsTxtPresent: boolean;
  sitemapPresent: boolean;
}

@Injectable()
export class ExtractorService {
  extract(page: LoadedPage): PageSignals {
    const $ = cheerio.load(page.html);
    const og = ['og:title', 'og:description', 'og:image'];
    const appRoot = $('#root, #app, #__next').first();

    return {
      pageUrl: page.url,
      file: page.file,
      title: $('head title').text().trim() || undefined,
      metaDescription: $('meta[name="description"]').attr('content')?.trim() || undefined,
      h1Count: $('h1').length,
      canonical: $('link[rel="canonical"]').attr('href')?.trim() || undefined,
      openGraphComplete: og.every((p) => $(`meta[property="${p}"]`).length > 0),
      ogTagCount: $('meta[property^="og:"]').length,
      twitterCardPresent: $('meta[name="twitter:card"]').length > 0,
      hreflangLangs: $('link[rel="alternate"][hreflang]').map((_, el) => $(el).attr('hreflang') ?? '').get(),
      htmlLang: $('html').attr('lang')?.trim() || undefined,
      isSpaShell: appRoot.length > 0 && appRoot.children().length === 0,
      images: $('img').map((_, el) => ({
        src: $(el).attr('src')?.trim() ?? '',
        alt: $(el).attr('alt') ?? null,
      })).get(),
    };
  }
}
