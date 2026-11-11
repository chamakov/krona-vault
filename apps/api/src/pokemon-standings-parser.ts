import type {
  ParsedPokeStandings,
  ParsedPokeCategory,
  ParsedPokeEntry,
  TournamentPrizeStanding,
} from '@krona-vault/shared-types';

/**
 * Normaliza nombres de categoría de TOM / Play! Pokémon a formato canónico
 */
export function normalizeCategoryName(raw: string): 'Master' | 'Senior' | 'Junior' | 'General' | string {
  const clean = raw.trim();
  const lower = clean.toLowerCase();
  if (lower.includes('master') || lower.includes('máster')) return 'Master';
  if (lower.includes('senior') || lower.includes('sénior')) return 'Senior';
  if (lower.includes('junior') || lower.includes('júnior')) return 'Junior';
  if (lower.includes('general')) return 'General';
  return clean || 'General';
}

/**
 * Limpia etiquetas HTML y entidades comunes
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Parsea el HTML de clasificaciones de TOM (Tournament Operations Manager) / RK9
 * sin dependencias externas pesadas.
 */
export function parsePokemonStandingsHTML(
  htmlContent: string,
  options?: {
    entryFeeCents?: number;
    prizeContributionCents?: number;
    guaranteedPoolCents?: number;
    topCutSizeDefault?: number;
  }
): ParsedPokeStandings {
  const defaultEntryFee = Math.max(0, Number(options?.entryFeeCents ?? 15_000)); // $150 MXN
  const defaultContribution = Math.max(0, Number(options?.prizeContributionCents ?? 10_000)); // $100 MXN

  // 1. Extraer Título del Torneo
  let tournamentName = 'Torneo Oficial Pokémon';
  const titleMatch = htmlContent.match(/<title[^>]*>(.*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    const rawTitle = stripHtml(titleMatch[1]);
    const cleanMatch = rawTitle.match(/(?:Clasificación Final|Standings)\s*-\s*(.+?)\s*-\s*/i);
    if (cleanMatch) {
      tournamentName = cleanMatch[1].trim();
    } else {
      tournamentName = rawTitle.replace(/Standings\s*-\s*/i, '').trim();
    }
  } else {
    const h1Match = htmlContent.match(/<h1[^>]*>(.*?)<\/h1>/i);
    if (h1Match) {
      tournamentName = stripHtml(h1Match[1]);
    }
  }

  // 2. Extraer Total de Rondas
  let totalRounds: number | null = null;
  const roundMatch = htmlContent.match(/Ronda\s+(\d+)\/(\d+)/i) || htmlContent.match(/Round\s+(\d+)\/(\d+)/i);
  if (roundMatch && roundMatch[2]) {
    totalRounds = parseInt(roundMatch[2], 10);
  }

  // 3. Detectar Secciones de Categorías y sus Tablas
  // TOM exporta h2/h3 con "Categoría Master", "Categoría Senior", "Categoría Junior"
  // seguido inmediatamente de un <table>...</table>
  const categorySections: Array<{ category: string; tableHtml: string }> = [];

  // Buscar todos los encabezados con Categoría/Category/Division
  const catRegex = /<(h[1-4]|div|p)[^>]*>(?:[^<]*?)(?:Categoría|Category|Division)\s+(Master|Senior|Junior|Máster|Sénior|Júnior|General)[\s\S]*?<\/\1>([\s\S]*?)(?=(?:<(?:h[1-4]|div|p)[^>]*>(?:[^<]*?)(?:Categoría|Category|Division)|\s*$))/gi;

  let match: RegExpExecArray | null;
  while ((match = catRegex.exec(htmlContent)) !== null) {
    const rawCat = match[2];
    const rest = match[3];
    const tableMatch = rest.match(/<table[\s\S]*?<\/table>/i);
    if (tableMatch) {
      categorySections.push({
        category: normalizeCategoryName(rawCat),
        tableHtml: tableMatch[0],
      });
    }
  }

  // Si no se encontraron encabezados de categoría explícitos, buscar cualquier tabla
  if (categorySections.length === 0) {
    const anyTables = htmlContent.match(/<table[\s\S]*?<\/table>/gi);
    if (anyTables && anyTables.length > 0) {
      for (const tableHtml of anyTables) {
        categorySections.push({
          category: 'Master',
          tableHtml,
        });
      }
    }
  }

  // 4. Parsear las filas de cada tabla
  const parsedCategories: ParsedPokeCategory[] = [];

  for (const section of categorySections) {
    const entries = parseTableRows(section.tableHtml);
    if (entries.length > 0) {
      const occupancy = entries.length;
      const calculatedPoolCents = occupancy * defaultContribution;
      parsedCategories.push({
        category: section.category,
        entries,
        occupancy,
        calculatedPoolCents,
      });
    }
  }

  const totalOccupancy = parsedCategories.reduce((sum, c) => sum + c.occupancy, 0);
  const unifiedPoolCents = parsedCategories.reduce((sum, c) => sum + c.calculatedPoolCents, 0);

  return {
    tournamentName,
    totalRounds,
    categories: parsedCategories,
    totalOccupancy,
    unifiedPoolCents,
  };
}

/**
 * Parsea las filas <tr> y celdas <td> de una tabla HTML
 */
function parseTableRows(tableHtml: string): ParsedPokeEntry[] {
  const entries: ParsedPokeEntry[] = [];
  const rows = tableHtml.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const rowHtml = rows[rowIndex];

    // Ignorar filas de encabezado (<th>)
    if (rowHtml.includes('<th') && !rowHtml.includes('<td')) {
      continue;
    }

    const cells = rowHtml.match(/<td[^>]*>[\s\S]*?<\/td>/gi) || [];
    if (cells.length < 2) continue;

    const cellTexts = cells.map((c) => stripHtml(c));

    // Celda 0: Rank
    const rankNum = parseInt(cellTexts[0].replace(/[^0-9]/g, ''), 10);
    if (isNaN(rankNum)) continue; // Probablemente encabezado o fila de separación

    // Celda 1: Nombre del Jugador
    let rawName = cellTexts[1];
    let playerIdentifier: string | undefined = undefined;

    // Detectar si el nombre trae ID entre paréntesis o si hay columna ID
    const idInName = rawName.match(/\((?:ID:?\s*)?(\d{4,9})\)/i);
    if (idInName) {
      playerIdentifier = idInName[1];
      rawName = rawName.replace(idInName[0], '').trim();
    } else if (cellTexts.length > 2 && /^\d{5,9}$/.test(cellTexts[2])) {
      playerIdentifier = cellTexts[2];
    }

    // Extraer Récord, Puntos y OMW%
    let wins = 0;
    let losses = 0;
    let ties = 0;
    let matchPoints = 0;
    let opponentWinPercentage = 0;
    let recordStr = '';
    let recordFound = false;

    // Buscar patrón TOM: "W/L/T (P)" ej. "4/1/0 (12)" o "3-1-0"
    for (let i = 2; i < cellTexts.length; i++) {
      const txt = cellTexts[i].trim();
      const wltMatch = txt.match(/^(\d+)\/(\d+)\/(\d+)\s*(?:\((\d+)\))?$/);
      if (wltMatch) {
        wins = parseInt(wltMatch[1], 10);
        losses = parseInt(wltMatch[2], 10);
        ties = parseInt(wltMatch[3], 10);
        matchPoints = wltMatch[4] ? parseInt(wltMatch[4], 10) : wins * 3 + ties;
        recordStr = `${wins}-${losses}-${ties}`;
        recordFound = true;

        // Buscar OMW% en columnas subsecuentes
        for (let j = i + 1; j < cellTexts.length; j++) {
          const nextTxt = cellTexts[j].trim();
          if (nextTxt.includes('%')) {
            const omw = parseFloat(nextTxt.replace(',', '.').replace('%', ''));
            if (!isNaN(omw)) {
              opponentWinPercentage = omw;
              break;
            }
          }
        }
        break;
      }
    }

    if (!recordFound) {
      // Buscar formato "W-L-D" simple (ej. "4-1-0")
      for (let i = 2; i < cellTexts.length; i++) {
        const txt = cellTexts[i].trim();
        const dashMatch = txt.match(/^(\d+)-(\d+)-(\d+)$/);
        if (dashMatch) {
          wins = parseInt(dashMatch[1], 10);
          losses = parseInt(dashMatch[2], 10);
          ties = parseInt(dashMatch[3], 10);
          matchPoints = wins * 3 + ties;
          recordStr = txt;
          recordFound = true;
          break;
        }
      }
    }

    // Buscar Puntos y OMW% numéricos si no se obtuvieron antes
    if (!matchPoints) {
      for (let i = 2; i < cellTexts.length; i++) {
        const txt = cellTexts[i].trim();
        if (/^\d+$/.test(txt)) {
          const val = parseInt(txt, 10);
          if (val < 100) {
            matchPoints = val;
            break;
          }
        }
      }
    }

    if (!opponentWinPercentage) {
      for (let i = 2; i < cellTexts.length; i++) {
        const txt = cellTexts[i].trim();
        if (txt.includes('%')) {
          const parsedPct = parseFloat(txt.replace(',', '.').replace('%', ''));
          if (!isNaN(parsedPct)) {
            opponentWinPercentage = parsedPct;
            break;
          }
        }
      }
    }

    if (!recordStr) {
      recordStr = `${wins}-${losses}-${ties}`;
    }

    entries.push({
      rank: rankNum,
      playerName: rawName,
      playerIdentifier,
      matchPoints,
      opponentWinPercentage,
      record: recordStr,
      wins,
      losses,
      ties,
    });
  }

  // Ordenar por ranking
  entries.sort((a, b) => a.rank - b.rank);
  return entries;
}

/**
 * Calcula la distribución del pozo para un Top Cut dado
 * garantizando el principio de Partida Doble y Suma Cero exacta (100.00% / 10,000 bps)
 */
/**
 * Genera una curva proporcional decreciente estándar para cualquier N posiciones
 */
export function generateProportionalDecayBps(count: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [10_000];
  const weights = Array.from({ length: count }, (_, i) => 1 / Math.pow(i + 1, 0.75));
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const bps = weights.map((w) => Math.floor((w / sumWeights) * 10_000));
  const currentSum = bps.reduce((a, b) => a + b, 0);
  bps[0] += 10_000 - currentSum;
  return bps;
}

/**
 * Calcula la distribución del pozo para un Top Cut dado
 * garantizando el principio de Partida Doble y Suma Cero exacta (100.00% / 10,000 bps)
 */
export function calculateTopCutPrizeDistribution(params: {
  totalPoolCents: number;
  topCutSize: number; // 1 | 2 | 3 | 4 | 6 | 8 | 16 o cualquier número positivo
  applyEqualSplit?: boolean;
  customPercentagesBps?: number[];
  entries: ParsedPokeEntry[];
  resolvePlayerFn?: (entry: ParsedPokeEntry) => {
    userId: string;
    memberCode: string;
    fullName: string;
  };
}): TournamentPrizeStanding[] {
  const { totalPoolCents, topCutSize, applyEqualSplit, customPercentagesBps, entries, resolvePlayerFn } = params;
  if (totalPoolCents <= 0 || entries.length === 0) return [];

  const eligibleCount = Math.min(Math.max(1, topCutSize), entries.length);
  const eligibleEntries = entries.slice(0, eligibleCount);

  // Porcentajes estándar por Top Cut (en Basis Points, 10,000 = 100%)
  const standardPercentagesByCut: Record<number, number[]> = {
    1: [10_000],
    2: [6500, 3500],
    3: [5000, 3000, 2000],
    4: [4500, 2500, 1500, 1500],
    5: [4000, 2500, 1500, 1000, 1000],
    6: [3500, 2200, 1500, 1200, 800, 800],
    8: [3000, 2000, 1250, 1250, 625, 625, 625, 625],
    12: [2500, 1800, 1200, 1000, 600, 600, 500, 500, 450, 450, 200, 200],
    16: [
      2500, 1500, 1000, 1000, 500, 500, 500, 500,
      250, 250, 250, 250, 250, 250, 250, 250,
    ],
  };

  let percentagesBps: number[] = [];

  if (customPercentagesBps && customPercentagesBps.length > 0) {
    percentagesBps = customPercentagesBps.slice(0, eligibleCount);
    while (percentagesBps.length < eligibleCount) {
      percentagesBps.push(0);
    }
    const currentSum = percentagesBps.reduce((a, b) => a + b, 0);
    if (currentSum > 0 && currentSum !== 10_000 && eligibleCount > 0) {
      percentagesBps = percentagesBps.map((bps) => Math.floor((bps * 10_000) / currentSum));
      const normalizedSum = percentagesBps.reduce((a, b) => a + b, 0);
      percentagesBps[0] += 10_000 - normalizedSum;
    } else if (currentSum === 0 && eligibleCount > 0) {
      const share = Math.floor(10_000 / eligibleCount);
      percentagesBps = new Array(eligibleCount).fill(share);
      percentagesBps[0] += 10_000 - share * eligibleCount;
    }
  } else if (applyEqualSplit) {
    const shareBps = Math.floor(10_000 / eligibleCount);
    percentagesBps = new Array(eligibleCount).fill(shareBps);
    // Ajustar el residuo de bps al 1° lugar
    const sumBps = percentagesBps.reduce((a, b) => a + b, 0);
    percentagesBps[0] += 10_000 - sumBps;
  } else {
    const preset = standardPercentagesByCut[eligibleCount] || standardPercentagesByCut[topCutSize] || generateProportionalDecayBps(eligibleCount);
    percentagesBps = preset.slice(0, eligibleCount);
    // Normalizar si hay menos inscritos que el tamaño del Top Cut
    const currentSum = percentagesBps.reduce((a, b) => a + b, 0);
    if (currentSum !== 10_000 && eligibleCount > 0) {
      percentagesBps = percentagesBps.map((bps) => Math.floor((bps * 10_000) / currentSum));
      const normalizedSum = percentagesBps.reduce((a, b) => a + b, 0);
      percentagesBps[0] += 10_000 - normalizedSum;
    }
  }

  let allocatedCents = 0;
  const result: TournamentPrizeStanding[] = eligibleEntries.map((entry, idx) => {
    const bps = percentagesBps[idx];
    const cents = Math.floor((totalPoolCents * bps) / 10_000);
    allocatedCents += cents;

    const resolved = resolvePlayerFn ? resolvePlayerFn(entry) : null;

    return {
      position: entry.rank,
      playerUserId: resolved?.userId || `u_player_${entry.rank}`,
      playerMemberCode: resolved?.memberCode || `CC-POKE-${entry.rank.toString().padStart(3, '0')}`,
      playerName: resolved?.fullName || entry.playerName,
      record: entry.record || `${entry.matchPoints} pts`,
      inTopSplit: Boolean(applyEqualSplit),
      percentageBps: bps,
      awardedCents: cents,
    };
  });

  // Principio de Suma Cero: Asignar centavos impares residuales al 1° lugar
  const remainderCents = totalPoolCents - allocatedCents;
  if (remainderCents !== 0 && result.length > 0) {
    result[0].awardedCents += remainderCents;
  }

  return result;
}

/**
 * Calculador de Pozo Multi-Juego Rápido (MTG, Yu-Gi-Oh!, One Piece, Lorcana, etc.)
 */
export function calculateQuickMultiGamePool(params: {
  totalPlayers: number;
  entryFeeCents: number;
  prizeContributionCents: number;
  guaranteedPoolCents?: number;
  topCutSize?: number; // 1 | 2 | 3 | 4 | 6 | 8 | 12 | 16
  applyTopCutSplit?: boolean;
  customPercentagesBps?: number[];
}): {
  totalCollectionCents: number;
  calculatedPoolCents: number;
  effectivePoolCents: number;
  storeMarginCents: number;
  topCutSize: number;
  payoutBreakdown: Array<{
    position: number;
    percentageBps: number;
    percentageLabel: string;
    awardedCents: number;
  }>;
} {
  const totalPlayers = Math.max(0, Number(params.totalPlayers || 0));
  const entryFeeCents = Math.max(0, Number(params.entryFeeCents || 0));
  const prizeContribCents = Math.max(0, Number(params.prizeContributionCents || 0));
  const guaranteedPoolCents = Math.max(0, Number(params.guaranteedPoolCents || 0));
  const topCutSize = Math.max(1, Number(params.topCutSize || 4));
  const isSplit = Boolean(params.applyTopCutSplit);
  const customPercentages = params.customPercentagesBps;

  const totalCollectionCents = totalPlayers * entryFeeCents;
  const calculatedPoolCents = totalPlayers * prizeContribCents;
  const effectivePoolCents = Math.max(guaranteedPoolCents, calculatedPoolCents);
  const storeMarginCents = Math.max(0, totalCollectionCents - effectivePoolCents);

  if (effectivePoolCents <= 0 || totalPlayers === 0) {
    return {
      totalCollectionCents,
      calculatedPoolCents,
      effectivePoolCents: 0,
      storeMarginCents,
      topCutSize,
      payoutBreakdown: [],
    };
  }

  const eligibleCount = Math.min(topCutSize, totalPlayers);
  const standardPercentagesByCut: Record<number, number[]> = {
    1: [10_000],
    2: [6500, 3500],
    3: [5000, 3000, 2000],
    4: [4500, 2500, 1500, 1500],
    5: [4000, 2500, 1500, 1000, 1000],
    6: [3500, 2200, 1500, 1200, 800, 800],
    8: [3000, 2000, 1250, 1250, 625, 625, 625, 625],
    12: [2500, 1800, 1200, 1000, 600, 600, 500, 500, 450, 450, 200, 200],
    16: [
      2500, 1500, 1000, 1000, 500, 500, 500, 500,
      250, 250, 250, 250, 250, 250, 250, 250,
    ],
  };

  let bpsList: number[] = [];
  if (customPercentages && customPercentages.length > 0) {
    bpsList = customPercentages.slice(0, eligibleCount);
    while (bpsList.length < eligibleCount) {
      bpsList.push(0);
    }
    const sum = bpsList.reduce((a, b) => a + b, 0);
    if (sum > 0 && sum !== 10_000 && eligibleCount > 0) {
      bpsList = bpsList.map((b) => Math.floor((b * 10_000) / sum));
      const newSum = bpsList.reduce((a, b) => a + b, 0);
      bpsList[0] += 10_000 - newSum;
    }
  } else if (isSplit) {
    const shareBps = Math.floor(10_000 / eligibleCount);
    bpsList = new Array(eligibleCount).fill(shareBps);
    const sum = bpsList.reduce((a, b) => a + b, 0);
    bpsList[0] += 10_000 - sum;
  } else {
    const preset = standardPercentagesByCut[eligibleCount] || standardPercentagesByCut[topCutSize] || generateProportionalDecayBps(eligibleCount);
    bpsList = preset.slice(0, eligibleCount);
    const sum = bpsList.reduce((a, b) => a + b, 0);
    if (sum !== 10_000 && eligibleCount > 0) {
      bpsList = bpsList.map((b) => Math.floor((b * 10_000) / sum));
      const newSum = bpsList.reduce((a, b) => a + b, 0);
      bpsList[0] += 10_000 - newSum;
    }
  }

  let allocated = 0;
  const payoutBreakdown = bpsList.map((bps, idx) => {
    const cents = Math.floor((effectivePoolCents * bps) / 10_000);
    allocated += cents;
    return {
      position: idx + 1,
      percentageBps: bps,
      percentageLabel: customPercentages && customPercentages.length > 0
        ? `Personalizado (${(bps / 100).toFixed(1)}%)`
        : isSplit
          ? 'Split Equitativo'
          : `${(bps / 100).toFixed(1)}%`,
      awardedCents: cents,
    };
  });

  const remainder = effectivePoolCents - allocated;
  if (remainder !== 0 && payoutBreakdown.length > 0) {
    payoutBreakdown[0].awardedCents += remainder;
  }

  return {
    totalCollectionCents,
    calculatedPoolCents,
    effectivePoolCents,
    storeMarginCents,
    topCutSize,
    payoutBreakdown,
  };
}
