/**
 * English → Arabic auto-translate for paired name/description fields.
 * Tries Google's public translate endpoint first, then MyMemory as a
 * fallback (neither needs a key). Best-effort convenience fill, not a
 * certified translation, and it needs a live internet connection — except
 * for names made only of numbers, short codes and known restaurant words
 * ("T1", "VIP 3", "Table 12"), which are converted locally.
 *
 * Returns '' when there is simply nothing to translate; throws when every
 * provider was unreachable, so callers can tell "no result" from "offline".
 */

const cache = new Map<string, string>()

async function viaGoogle(text: string): Promise<string> {
  const res = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ar&dt=t&q=${encodeURIComponent(text)}`,
  )
  if (!res.ok) throw new Error(`google ${res.status}`)
  const data = (await res.json()) as unknown
  const segments = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : []
  return segments
    .map((s) => (Array.isArray(s) ? String(s[0] ?? '') : ''))
    .join('')
    .trim()
}

async function viaMyMemory(text: string): Promise<string> {
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`)
  if (!res.ok) throw new Error(`mymemory ${res.status}`)
  const data = (await res.json()) as { responseData?: { translatedText?: string } }
  const translated = String(data?.responseData?.translatedText ?? '').trim()
  // MyMemory hands back a "MYMEMORY WARNING" placeholder once the free
  // daily quota is spent — that's a failure, not a translation.
  if (/mymemory warning/i.test(translated)) throw new Error('mymemory quota')
  return translated
}

/** Restaurant words the providers get wrong or don't know (e.g. "Table"
 * comes back as الجدول — a data table — rather than طاولة). */
const GLOSSARY: Record<string, string> = {
  table: 'طاولة',
  tables: 'طاولات',
  tbl: 'طاولة',
  room: 'غرفة',
  hall: 'قاعة',
  cabin: 'كابينة',
  counter: 'كاونتر',
  family: 'عائلي',
  outdoor: 'خارجي',
  indoor: 'داخلي',
  terrace: 'تراس',
  floor: 'طابق',
  seat: 'مقعد',
  chair: 'كرسي',
}

/** How Arabic writes English abbreviations — letter by letter, by name. */
const LETTER_NAMES: Record<string, string> = {
  a: 'أيه', b: 'بي', c: 'سي', d: 'دي', e: 'إي', f: 'إف', g: 'جي', h: 'إتش', i: 'آي',
  j: 'جيه', k: 'كيه', l: 'إل', m: 'إم', n: 'إن', o: 'أو', p: 'بي', q: 'كيو', r: 'آر',
  s: 'إس', t: 'تي', u: 'يو', v: 'في', w: 'دبليو', x: 'إكس', y: 'واي', z: 'زد',
}

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩'

function toArabicDigits(text: string) {
  return text.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)])
}

/** Rough English → Arabic-letter spelling for words no provider translates
 * (brand names, made-up table names) or when offline — so the Arabic field
 * is never left empty. Digraphs first, then single letters. */
const DIGRAPHS: [string, string][] = [
  ['sh', 'ش'], ['ch', 'تش'], ['th', 'ث'], ['kh', 'خ'], ['gh', 'غ'], ['ph', 'ف'],
  ['oo', 'و'], ['ee', 'ي'], ['ou', 'و'], ['ck', 'ك'], ['qu', 'كو'],
]
const LETTERS: Record<string, string> = {
  a: 'ا', b: 'ب', c: 'ك', d: 'د', e: 'ي', f: 'ف', g: 'ج', h: 'ه', i: 'ي', j: 'ج', k: 'ك', l: 'ل', m: 'م',
  n: 'ن', o: 'و', p: 'ب', q: 'ق', r: 'ر', s: 'س', t: 'ت', u: 'و', v: 'ف', w: 'و', x: 'كس', y: 'ي', z: 'ز',
}

function transliterate(word: string) {
  let out = ''
  for (let i = 0; i < word.length; ) {
    const pair = DIGRAPHS.find(([en]) => word.startsWith(en, i))
    if (pair) {
      out += pair[1]
      i += 2
    } else {
      out += LETTERS[word[i]] ?? ''
      i += 1
    }
  }
  // A trailing silent "e" (table, cake) reads better dropped.
  return word.length > 3 && word.endsWith('e') && out.endsWith('ي') ? out.slice(0, -1) : out
}

/** Letters written by name, the way Arabic writes abbreviations (VIP → في آي بي). */
function spellOut(letters: string) {
  return [...letters.toLowerCase()].map((ch) => LETTER_NAMES[ch]).join(' ')
}

/** Local conversion, run by run ("Table-12A" → Table / - / 12 / A).
 * strict: return '' as soon as an ordinary word needs a real translation.
 * not strict: spell such words in Arabic letters instead. */
function localArabic(text: string, strict: boolean): string {
  const runs = text.match(/[a-z]+|\d+|[^a-z\d]+/gi) ?? []
  const out: string[] = []
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i]
    if (/^\d+$/.test(run)) {
      out.push(toArabicDigits(run))
      continue
    }
    if (!/^[a-z]+$/i.test(run)) {
      out.push(/\s/.test(run) ? ' ' : run)
      continue
    }
    const lower = run.toLowerCase()
    const touchesDigit = /\d/.test(runs[i - 1] ?? '') || /\d/.test(runs[i + 1] ?? '')
    if (GLOSSARY[lower]) {
      out.push(GLOSSARY[lower])
    } else if (run.length <= 4 && (run === run.toUpperCase() || touchesDigit || run.length <= 2)) {
      out.push(spellOut(run))
    } else if (strict) {
      return ''
    } else {
      out.push(transliterate(lower))
    }
  }
  // Space letter/number runs apart the way they read: "تي ١" not "تي١".
  return out
    .join('\u0001')
    .replace(/\u0001(?=[-./,])|(?<=[-./,])\u0001/g, '')
    .replace(/\u0001/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Fix known provider mistakes in an otherwise good translation. */
function applyGlossary(source: string, translated: string) {
  let result = translated
  if (/tables?(?![a-z])/i.test(source)) result = result.replace(/(ال)?جداول/g, 'طاولات').replace(/(ال)?جدول/g, 'طاولة')
  return toArabicDigits(result)
}

/**
 * Always returns Arabic for non-empty input: names made only of numbers,
 * codes and known words convert locally; everything else goes to the
 * translation providers, and if they're unreachable or hand the text back
 * untranslated it's spelled out in Arabic letters instead.
 */
export async function translateToArabic(text: string): Promise<string> {
  const trimmed = text.trim()
  if (!trimmed) return ''
  const key = trimmed.toLowerCase()
  const cached = cache.get(key)
  if (cached != null) return cached

  const local = localArabic(trimmed, true)
  if (local) {
    cache.set(key, local)
    return local
  }

  let translated = ''
  let reachable = false
  for (const provider of [viaGoogle, viaMyMemory]) {
    try {
      translated = await provider(trimmed)
      reachable = true
      if (translated) break
    } catch {
      // try the next provider
    }
  }

  const untranslated = !translated || translated.toLowerCase() === key || !/[\u0600-\u06FF]/.test(translated)
  if (untranslated) {
    const spelled = localArabic(trimmed, false)
    // Only cache a real answer; retry the providers next time if they were down.
    if (reachable) cache.set(key, spelled)
    return spelled
  }
  const fixed = applyGlossary(trimmed, translated)
  cache.set(key, fixed)
  return fixed
}
