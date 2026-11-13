/** Rótulos e textos de cripto para a UI (sempre português). */

export function nomeRedeVisivel(name: string): string {
  return name.replace(/\s+L1$/i, '').trim()
}

const SOBRE_CATEGORIA: Record<string, string> = {
  Dexes: 'bolsa descentralizada — troca de tokens na própria rede, sem intermediário',
  Dexs: 'bolsa descentralizada — troca de tokens na própria rede, sem intermediário',
  Lending: 'empréstimos DeFi — depositas cripto e recebes juros, ou pedes emprestado contra colateral',
  'Liquid Staking': 'staking líquido — trancas o token da rede e recebes um comprovativo negociável',
  'Liquid Restaking': 'restaking líquido — reutiliza stake para segurança extra e rendimento',
  Yield: 'rendimento — tenta gerar juros sobre liquidez ou tesouraria',
  'Yield Aggregator': 'agregador de rendimento — escolhe as melhores taxas por ti',
  CDP: 'dívida colateralizada — emites crédito ou stablecoin contra um activo bloqueado',
  Bridge: 'ponte entre redes — move tokens de uma blockchain para outra',
  Derivatives: 'derivativos — perpétuos, opções ou exposição alavancada na cadeia',
  Synthetics: 'sintéticos — exposição a outros activos sem os ter directamente',
  RWA: 'activos do mundo real — títulos, crédito ou imobiliário tokenizado',
  'Real World Assets': 'activos do mundo real — títulos, crédito ou imobiliário tokenizado',
  Gaming: 'jogos na cadeia — itens, moedas ou mercados ligados a um jogo',
  'NFT Marketplace': 'mercado de NFTs — compra e venda de coleccionáveis digitais',
  NFT: 'NFTs — coleccionáveis digitais nesta rede',
  Launchpad: 'lançamento de tokens — plataforma que lista projectos novos',
  'AI Agents': 'IA na cadeia — computação, agentes ou tokens de inteligência artificial',
  AI: 'IA na cadeia — computação ou tokens de inteligência artificial',
  Infrastructure: 'infra-estrutura — oráculos, dados, RPC ou ferramentas de base',
  Chain: 'a própria blockchain — o token nativo da rede',
  Restaking: 'restaking — reutiliza stake para segurança extra e rendimento',
  'Basis Trading': 'estratégia de base — captura diferenças de preço entre mercados',
  Payments: 'pagamentos — envio de valor na cadeia',
  Privacy: 'privacidade — transacções ou misturas com mais anonimato',
  CEX: 'corretora centralizada — liquidez fora da cadeia, medida no DefiLlama',
  Farm: 'farming — recompensas por fornecer liquidez',
  Insurance: 'seguros DeFi — cobertura contra falhas de protocolos',
  Indexes: 'índices — cabaz de tokens num só produto',
  'Liquidity Manager': 'gestor de liquidez — reequilibra posições em bolsas automáticas',
  Options: 'opções — contratos de compra ou venda a um preço futuro',
  Perpetuals: 'perpétuos — contratos alavancados sem data de vencimento',
  Staking: 'staking — bloqueias tokens para segurança da rede e recebes recompensa',
}

export function sobreProtocoloPt(nome: string, categoria: string): string {
  const body = SOBRE_CATEGORIA[categoria]
  if (body) return `${nome} é um protocolo de ${body}.`
  return `${nome} é um protocolo nesta rede.`
}

export function sobreTokenNativoPt(rede: string, simbolo: string | null): string {
  const s = simbolo ?? nomeRedeVisivel(rede)
  return `${s} é o token nativo de ${nomeRedeVisivel(rede)}. Serve para taxas da rede, segurança (stake, quando existe) e como unidade de conta no ecossistema.`
}

const NARRATIVA_CAT: Record<string, string> = {
  Dexes: 'Bolsa DEX',
  Dexs: 'Bolsa DEX',
  Lending: 'Empréstimos',
  'Liquid Staking': 'Staking líquido',
  Yield: 'Rendimento',
  'Yield Aggregator': 'Rendimento',
  CDP: 'DeFi',
  Bridge: 'Pontes',
  Derivatives: 'Derivativos',
  Synthetics: 'Derivativos',
  RWA: 'RWA',
  'Real World Assets': 'RWA',
  Gaming: 'Jogos',
  'NFT Marketplace': 'NFT',
  NFT: 'NFT',
  Launchpad: 'Lançamentos',
  'AI Agents': 'IA',
  AI: 'IA',
  Infrastructure: 'Infra-estrutura',
  Chain: 'Camada 1',
  'Liquid Restaking': 'Restaking',
  Restaking: 'Restaking',
  'Basis Trading': 'DeFi',
  Payments: 'Pagamentos',
  Privacy: 'Privacidade',
  CEX: 'Corretora',
  Farm: 'Rendimento',
  Perpetuals: 'Derivativos',
}

export function narrativaCategoriaPt(category: string): string {
  return NARRATIVA_CAT[category] ?? 'DeFi'
}

const CATEGORIA_CG: Record<string, string> = {
  'Decentralized Finance (DeFi)': 'Finanças descentralizadas (DeFi)',
  'Smart Contract Platform': 'Plataforma de contratos inteligentes',
  'Layer 1 (L1)': 'Camada 1 (L1)',
  'Layer 2 (L2)': 'Camada 2 (L2)',
  'Exchange-based Tokens': 'Tokens de corretora',
  'Centralized Exchange (CEX)': 'Corretora centralizada',
  'Decentralized Exchange (DEX)': 'Bolsa descentralizada (DEX)',
  'Liquid Staking Tokens': 'Tokens de staking líquido',
  'Meme': 'Meme',
  'Artificial Intelligence (AI)': 'Inteligência artificial (IA)',
  'Real World Assets (RWA)': 'Activos do mundo real (RWA)',
  'Gaming': 'Jogos',
  'NFT': 'NFT',
  'DePIN': 'DePIN',
  'Restaking': 'Restaking',
}

export function categoriaCoinGeckoPt(cat: string): string {
  return CATEGORIA_CG[cat] ?? cat
}
