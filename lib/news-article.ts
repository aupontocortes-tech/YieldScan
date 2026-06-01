/**
 * Tipos partilhados de artigos brutos (evita dependência circular newsdata ↔ gnews).
 */

export interface NewsDataArticle {
  article_id?: string
  title?: string | null
  link?: string | null
  description?: string | null
  content?: string | null
  pubDate?: string | null
  source_id?: string | null
  source_name?: string | null
  source_priority?: number | null
  category?: string[] | null
  country?: string[] | null
  language?: string | null
  keywords?: string[] | null
  image_url?: string | null
  image?: string | null
  imageUrl?: string | null
  thumbnail?: string | null
  enclosure?: { link?: string | null; url?: string | null } | null
  media?: { thumbnail?: string | null; content?: string | null } | null
  urlToImage?: string | null
  _yieldscanCryptoQuery?: boolean
  _yieldscanAiQuery?: boolean
  _yieldscanStocksQuery?: boolean
}

export type NewsDataApiResponse =
  | {
      status: 'success'
      totalResults?: number
      results: NewsDataArticle[]
      nextPage?: string
    }
  | {
      status: 'error'
      results: { message?: string; code?: string }
    }
