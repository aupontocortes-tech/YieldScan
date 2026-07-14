/** Heurísticas de idioma para o feed de notícias. */

/**
 * Sinais tipicamente portugueses (sem depender só de acentos).
 * Inclui verbos/manchetes frequentes em cripto e bolsa.
 */
const PT_DISTINTO =
  /\b(não|nao|também|tambem|será|sera|serão|serao|está|esta|estão|estao|foram|seria|seriam|havia|tinha|tinham|sobre|entre|governo|Brasil|Portugal|país|pais|hoje|disse|segundo|após|apos|durante|crise|economia|banco|investimento|regulacao|regulação|aprovado|queda|alta|subiu|desceu|sobe|desce|dispara|disparam|atinge|fecha|fecham|noticias|notícias|empresa|tecnologia|português|portugues|cryptomoeda|criptomoeda|cripto|mercado|milhões|milhoes|milhão|milhao|biliões|bilhoes|anunciou|confirmou|relatório|relatorio|dólar|dolar|dólares|dolares|porcento|por\s*cento|máximo|maximo|mínimo|minimo|histórico|historico|aprovação|aprovacao|reserva|estratégica|estrategica|bolsa|ações|acoes|ação|acao|ainda|pelo|pela|pelo\s+menos|mais\s+de|em\s+alta|em\s+queda)\b/i

/**
 * Sinais tipicamente ingleses — evita cognatos crypto (bitcoin, ethereum, crypto, market…)
 * que aparecem em manchetes PT e geravam falso positivo (feed vazio).
 */
const EN_DISTINTO =
  /\b(the|and|with|after|before|says|said|will|could|should|would|trading|surge|drop|approval|regulation|investors|according|report|breaking|hits|hit|why|how|what|when|where|who|which|their|this|that|these|those|from|into|over|under|between|through|analysts|futures|amid|despite|while|than|then|been|being|have|has|had|were|was|are|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|won't|can't|couldn't|shouldn't|wouldn't|hasn't|haven't|hadn't|all-time|selloff|sell-off|outlook|headline|weekends?)\b/i

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
