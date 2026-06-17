import { redirect } from 'next/navigation'

/** Abertura da app → Gestão Financeira (central patrimonial). */
export default function HomePage() {
  redirect('/news/gestao-financeira')
}
