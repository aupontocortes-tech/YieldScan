/** Heurísticas de idioma para o feed de notícias. */

export function parecePortugues(texto: string): boolean {
  const t = texto.trim()
  if (t.length < 8) return false
  if (/[ãõáéíóúâêôçÃÕÁÉÍÓÚÂÊÔÇ]/.test(t)) return true
  return /\b(não|nao|também|tambem|será|sera|está|esta|estao|estão|foram|sobre|entre|governo|Brasil|Portugal|país|pais|hoje|mercado|disse|segundo|após|apos|durante|crise|economia|criptomoeda|bitcoin|ethereum|banco|investimento|regulacao|regulação|aprovado|queda|alta|subiu|desceu|noticias|notícias|o|a|os|as|de|do|da|que|com|para|empresa|tecnologia)\b/i.test(
    t,
  )
}

export function pareceIngles(texto: string): boolean {
  const t = texto.trim()
  if (t.length < 8) return false
  if (parecePortugues(t)) return false
  return /\b(the|and|with|after|before|market|crypto|bitcoin|ethereum|says|said|will|could|should|trading|price|surge|drop|approval|regulation|investors|according|report|breaking|news)\b/i.test(
    t,
  )
}
