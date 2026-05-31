/** Heurísticas de idioma para o feed de notícias. */

const PT_DISTINTO =
  /\b(não|nao|também|tambem|será|sera|serão|serao|está|esta|estão|estao|foram|seria|seriam|havia|tinha|tinham|sobre|entre|governo|Brasil|Portugal|país|pais|hoje|disse|segundo|após|apos|durante|crise|economia|banco|investimento|regulacao|regulação|aprovado|queda|alta|subiu|desceu|noticias|notícias|empresa|tecnologia|também|português|portugues|cryptomoeda|criptomoeda|mercado|milhões|milhoes|milhão|milhao|biliões|bilhoes|anunciou|confirmou|relatório|relatorio)\b/i

const EN_DISTINTO =
  /\b(the|and|with|after|before|market|crypto|bitcoin|ethereum|says|said|will|could|should|would|trading|price|surge|drop|approval|regulation|investors|according|report|breaking|news|hits|hit|why|how|what|when|where|who|which|their|this|that|these|those|from|into|over|under|between|through|analysts|exchange|exchanges|futures|bulls|defy|order|president|weekend|watch|center|stage|inventor|sticks|signals|interest|open|across|here|feed|economy|immigration|amid|despite|while|than|then|been|being|have|has|had|were|was|are|is|was|not|but|for|you|your|our|its|it's|don't|doesn't|didn't|won't|can't|couldn't|shouldn't|wouldn't|hasn't|haven't|hadn't|aren't|isn't|wasn't|weren't)\b/i

export function parecePortugues(texto: string): boolean {
  const t = texto.trim()
  if (t.length < 8) return false
  if (/[ãõáéíóúâêôçÃÕÁÉÍÓÚÂÊÔÇ]/.test(t)) return true
  if (EN_DISTINTO.test(t) && !PT_DISTINTO.test(t)) return false
  return PT_DISTINTO.test(t)
}

export function pareceIngles(texto: string): boolean {
  const t = texto.trim()
  if (t.length < 8) return false
  if (/[ãõáéíóúâêôçÃÕÁÉÍÓÚÂÊÔÇ]/.test(t)) return false
  if (PT_DISTINTO.test(t)) return false
  return EN_DISTINTO.test(t)
}
