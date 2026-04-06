/**
 * Critério estrito: só conta como «notícia de IA» quem fala de IA/ML/modelos/LLM/etc.
 * Evita misturar macro, espaço ou gadgets só porque o feed tem categoria «AI».
 */

/** Normaliza para testar título + resumo (sem HTML). */
export function normalizarTextoParaClassificacaoIa(bruto: string): string {
  return bruto
    .replace(/<[^>]+>/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Texto já normalizado (ex. `textoParaAnalise` / `normalizarTextoMatch`) ou usar a função acima.
 */
export function textoIndicaFocoInteligenciaArtificial(t: string): boolean {
  if (t.length < 6) return false

  const forte =
    /artificial intelligence|inteligencia artificial|machine learning|deep learning|neural network|rede neural|large language model|modelo de linguagem|\bllm\b|generative ai|ia generativa|multimodal|foundation model|modelo fundacional|language model|modelo de ia|\bai model\b|\bgenai\b|agentic|ai agent|\bchatbot\b|openai|chatgpt|gpt-4|gpt-5|gpt-3\.5|anthropic|\bclaude\b|\bgemini\b|\bcopilot\b|microsoft ai|google ai|meta ai|perplexity|mistral ai|\bcohere\b|hugging face|huggingface|fine-?tuning|fine tuning|prompt engineering|retrieval augmented|inferen[cs]e.*\b(llm|model)\b|train(?:ed|ing)?.*\b(model|llm|dataset)\b|tokenization|embeddings?|transformer model|diffusion model|stable diffusion|\bai chips?\b|\bgpu\b.*\b(training|llm|model|ai)\b|\b(training|llm|model)\b.*\bgpu\b|nvidia.*\b(ai|llm|training)\b|data center.*\b(ai|llm|training|model)\b|\bai-native\b|\bllmops\b/i.test(
      t
    )
  if (forte) return true

  // «AI» / «ML» só se o contexto for claramente técnico (evita ruído)
  if (
    /\b(ai|ml)\b/.test(t) &&
    /\b(model|models|startup|chip|chips|gpu|inference|training|dataset|datasets|benchmark|llm|neural|llm|tokenizer|alignment|hallucination|safety|eval|evaluation|scaling law|parameters? billion|weights?)\b/i.test(
      t
    )
  ) {
    return true
  }

  return false
}
