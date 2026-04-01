import { redirect } from 'next/navigation'

/** Entrada /news → abre por defeito a área de preços e mercado. */
export default function NewsPage() {
  redirect('/news/mercado')
}
