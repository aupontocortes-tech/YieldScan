import { redirect } from 'next/navigation'

/** Abertura da app → Preços e mercado (cripto e ações). */
export default function HomePage() {
  redirect('/news/mercado')
}
