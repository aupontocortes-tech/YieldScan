import { redirect } from 'next/navigation'

/** O antigo Painel foi integrado em Notícias — redireciona visitantes com URL antiga. */
export default function DashboardPage() {
  redirect('/news/mercado')
}
