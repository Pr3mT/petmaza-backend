// ─── Product search relevance engine ──────────────────────────────────────────
// Builds a MongoDB aggregation pipeline that ranks products by a weighted,
// multi-field relevance score (Amazon/Flipkart style) instead of a flat regex.
//
// What it gives us over the old buildFuzzyFilter regex:
//   • Brand names are searchable (brand_id is joined in, so "Pedigree" works)
//   • Weighted fields: name > brand > subCategory > mainCategory > description
//   • Graceful degradation: a product matching ANY word is a candidate, but
//     matching ALL words (coverage) and exact/prefix phrase hits score far higher
//   • Popularity (units sold), rating, and in-stock all boost the score so
//     best-sellers rise and out-of-stock items sink
//   • Light plural/synonym handling: foods→food, puppy→dog, kitten→cat
//
// It is intentionally infra-free — pure aggregation, no external search service.

import Brand from '../models/Brand';

// Words that carry no search signal — dropped so they don't dilute coverage.
const STOPWORDS = new Set([
  'for', 'the', 'a', 'an', 'with', 'and', 'of', 'to', 'in', 'on', 'my', 'best',
]);

// Pet-domain synonyms. Each key expands into extra match terms (it does NOT add
// a required token — it just lets e.g. "puppy" also match "dog" products).
const SYNONYMS: Record<string, string[]> = {
  puppy: ['dog', 'pup'],
  pup: ['dog'],
  puppies: ['dog', 'pup'],
  doggy: ['dog'],
  doggie: ['dog'],
  kitten: ['cat', 'kitty'],
  kitty: ['cat'],
  kittens: ['cat'],
  feline: ['cat'],
  canine: ['dog'],
};

// Per-field weight applied each time a query token matches that field.
const FIELD_WEIGHTS: Record<string, number> = {
  name: 40,
  brand: 30,
  sub: 15,
  main: 12,
  desc: 4,
};

// Lowercased, array-flattened search surfaces computed via $addFields.
const FIELD_REFS: Record<keyof typeof FIELD_WEIGHTS | string, string> = {
  name: '$_sName',
  brand: '$_sBrand',
  sub: '$_sSub',
  main: '$_sMain',
  desc: '$_sDesc',
};

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Very small stemmer: collapse common English plurals so "foods"/"leashes"
// match "food"/"leash". We match on the stem (a substring of the plural form),
// so singular→plural also works.
const stem = (w: string): string => {
  if (w.length <= 3) return w;
  if (/ies$/.test(w)) return w.slice(0, -3) + 'y';
  if (/(ches|shes|xes|ses)$/.test(w)) return w.slice(0, -2);
  if (/s$/.test(w) && !/ss$/.test(w)) return w.slice(0, -1);
  return w;
};

export interface ParsedQuery {
  /** Original lowercased phrase, regex-escaped (for whole-phrase bonuses). */
  phrase: string;
  /** Whether the query had any usable tokens. */
  hasTokens: boolean;
  /** Each token's escaped match terms (stem + synonyms). */
  tokenTerms: string[][];
  /** Flat, de-duplicated list of every match term across all tokens. */
  allTerms: string[];
}

/** Tokenize + normalize a raw query into match terms. */
export function parseQuery(raw: string): ParsedQuery {
  const lower = (raw || '').toLowerCase().trim();
  const rawTokens = lower.split(/\s+/).filter(Boolean);

  let tokens = rawTokens.filter((t) => !STOPWORDS.has(t));
  if (tokens.length === 0) tokens = rawTokens; // query was all stopwords — keep them

  const tokenTerms = tokens.map((t) => {
    const terms = new Set<string>([t, stem(t)]);
    (SYNONYMS[t] || []).forEach((syn) => {
      terms.add(syn);
      terms.add(stem(syn));
    });
    return Array.from(terms).filter(Boolean).map(escapeRegex);
  });

  const allTerms = Array.from(new Set(tokenTerms.flat()));

  return {
    phrase: escapeRegex(lower),
    hasTokens: tokenTerms.length > 0,
    tokenTerms,
    allTerms,
  };
}

// "Does this field contain any of the token's terms?" as an aggregation expr.
const tokenMatchesField = (fieldRef: string, terms: string[]) => ({
  $or: terms.map((t) => ({ $regexMatch: { input: fieldRef, regex: t } })),
});

const anyFieldMatchesToken = (terms: string[]) => ({
  $or: Object.values(FIELD_REFS).map((ref) => tokenMatchesField(ref, terms)),
});

export interface PipelineOptions {
  baseMatch?: Record<string, any>; // facet filters (isActive, category, price, …)
  sortBy?: string;                 // 'relevance' (default) | price_asc | price_desc | newest | discount
  /** Fields to keep in the output (besides the injected brand_id). Omit for all. */
  projectFields?: Record<string, 0 | 1>;
}

/**
 * Resolve which brands match the query text, so brand-only hits (product name
 * doesn't contain the term but its brand does) become candidates too.
 */
export async function resolveMatchingBrandIds(parsed: ParsedQuery): Promise<any[]> {
  if (parsed.allTerms.length === 0) return [];
  const brands = await Brand.find({
    $or: parsed.allTerms.map((t) => ({ name: { $regex: t, $options: 'i' } })),
  }).select('_id');
  return brands.map((b) => b._id);
}

/**
 * Build the relevance aggregation pipeline (everything up to and including the
 * data/total $facet). Caller runs it with Product.aggregate(...).
 */
export function buildRelevancePipeline(
  parsed: ParsedQuery,
  brandIds: any[],
  opts: PipelineOptions & { skip: number; limit: number }
): any[] {
  const { baseMatch = {}, sortBy = 'relevance', projectFields, skip, limit } = opts;

  // ── 1. Candidate reduction: only products that hit at least one term ─────────
  const textOr: any[] = [];
  for (const terms of parsed.tokenTerms) {
    for (const t of terms) {
      textOr.push({ name: { $regex: t, $options: 'i' } });
      textOr.push({ description: { $regex: t, $options: 'i' } });
      textOr.push({ mainCategory: { $regex: t, $options: 'i' } });
      textOr.push({ subCategory: { $regex: t, $options: 'i' } });
    }
  }
  if (brandIds.length) textOr.push({ brand_id: { $in: brandIds } });

  const match: Record<string, any> = { ...baseMatch };
  if (textOr.length) match.$or = textOr;

  // ── 2. Join brand + flatten searchable fields to lowercase strings ──────────
  // mainCategory/subCategory are declared as arrays, but legacy docs store them
  // as plain strings — handle both shapes so $reduce never sees a non-array.
  const arrayToLower = (field: string) => ({
    $toLower: {
      $cond: [
        { $isArray: [field] },
        {
          $reduce: {
            input: field,
            initialValue: '',
            in: { $concat: ['$$value', ' ', { $ifNull: ['$$this', ''] }] },
          },
        },
        { $ifNull: [field, ''] }, // string or null
      ],
    },
  });

  // ── 3. Relevance scoring expression ─────────────────────────────────────────
  const perTokenScores = parsed.tokenTerms.map((terms) => ({
    $add: Object.entries(FIELD_REFS).map(([field, ref]) => ({
      $cond: [tokenMatchesField(ref, terms), FIELD_WEIGHTS[field], 0],
    })),
  }));

  const matchedCount = {
    $add: parsed.tokenTerms.map((terms) => ({
      $cond: [anyFieldMatchesToken(terms), 1, 0],
    })),
  };

  // Whole-phrase bonuses — exact/prefix name hits should dominate.
  const phraseBonus = {
    $add: [
      { $cond: [{ $regexMatch: { input: '$_sName', regex: '^' + parsed.phrase } }, 200, 0] },
      { $cond: [{ $regexMatch: { input: '$_sName', regex: parsed.phrase } }, 80, 0] },
      { $cond: [{ $regexMatch: { input: '$_sBrand', regex: parsed.phrase } }, 60, 0] },
    ],
  };

  // All query words present anywhere → strong boost (graceful coverage).
  const coverageBonus = {
    $cond: [{ $eq: [matchedCount, parsed.tokenTerms.length] }, 60, 0],
  };

  const soldTotal = {
    $add: [
      { $ifNull: ['$soldQuantity', 0] },
      { $ifNull: ['$totalSoldWebsite', 0] },
      { $ifNull: ['$totalSoldStore', 0] },
    ],
  };
  const popularity = { $multiply: [2, { $ln: [{ $add: [1, soldTotal] }] }] };
  const ratingBoost = { $multiply: [3, { $ifNull: ['$averageRating', 0] }] };
  const inStockEff = {
    $and: [{ $ne: ['$isActive', false] }, { $ne: ['$inStock', false] }],
  };
  const stockBoost = { $cond: [inStockEff, 8, -25] };

  // ── 4. Sort ─────────────────────────────────────────────────────────────────
  let sortStage: Record<string, 1 | -1>;
  switch (sortBy) {
    case 'price_asc':
      sortStage = { sellingPrice: 1, _relScore: -1 };
      break;
    case 'price_desc':
      sortStage = { sellingPrice: -1, _relScore: -1 };
      break;
    case 'newest':
      sortStage = { createdAt: -1, _relScore: -1 };
      break;
    case 'discount':
      sortStage = { discount: -1, _relScore: -1 };
      break;
    default: // relevance
      sortStage = { _relScore: -1, _matched: -1, createdAt: -1 };
  }

  const dataPipeline: any[] = [
    { $sort: sortStage },
    { $skip: skip },
    { $limit: limit },
    {
      $addFields: {
        brand_id: { _id: '$_brand._id', name: '$_brand.name', image: '$_brand.image' },
        inStock: inStockEff, // expose effective stock to the frontend
      },
    },
    {
      $project: {
        _sName: 0, _sBrand: 0, _sSub: 0, _sMain: 0, _sDesc: 0,
        _brand: 0, _matched: 0, _relScore: 0,
        ...(projectFields ? {} : {}),
      },
    },
  ];
  if (projectFields) {
    // Replace the exclusion projection with an explicit inclusion one.
    dataPipeline[dataPipeline.length - 1] = { $project: projectFields };
  }

  return [
    { $match: match },
    {
      $lookup: {
        from: 'brands',
        localField: 'brand_id',
        foreignField: '_id',
        as: '_brand',
      },
    },
    { $unwind: { path: '$_brand', preserveNullAndEmptyArrays: true } },
    {
      $addFields: {
        _sName: { $toLower: { $ifNull: ['$name', ''] } },
        _sDesc: { $toLower: { $ifNull: ['$description', ''] } },
        _sBrand: { $toLower: { $ifNull: ['$_brand.name', ''] } },
        _sMain: arrayToLower('$mainCategory'),
        _sSub: arrayToLower('$subCategory'),
      },
    },
    {
      $addFields: {
        _matched: matchedCount,
        _relScore: {
          $add: [...perTokenScores, phraseBonus, coverageBonus, popularity, ratingBoost, stockBoost],
        },
      },
    },
    { $match: { _matched: { $gt: 0 } } }, // text-relevance gate
    {
      $facet: {
        data: dataPipeline,
        total: [{ $count: 'count' }],
      },
    },
  ];
}
