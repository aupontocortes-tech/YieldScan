import { redirect } from 'next/navigation'

/** Abertura da app → hub de notícias / mercado (preços das criptos). Dashboard fica em /dashboard. */
export default function HomePage() {
  redirect('/news/mercado')
}
