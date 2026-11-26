/**
 * محرك تشكيل الحروف العربية (Arabic Contextual Shaping) وإعادة الترتيب ثنائي الاتجاه (BiDi)
 * لتمكين رسم نص عربي متجه متصل وصحيح الاتجاه داخل pdf-lib باستخدام خطوط TTF مضمّنة.
 */

interface ArabicFormEntry {
  isolated: number;
  final: number;
  initial: number;
  medial: number;
  connectsLeft: boolean;
  connectsRight: boolean;
}

const ARABIC_FORMS: Record<number, ArabicFormEntry> = {
  // همزة منفصلة (لا تتصل)
  0x0621: { isolated: 0xfe80, final: 0xfe80, initial: 0xfe80, medial: 0xfe80, connectsLeft: false, connectsRight: false },
  // حروف تتصل بما قبلها فقط (Right-joining)
  0x0622: { isolated: 0xfe81, final: 0xfe82, initial: 0xfe81, medial: 0xfe82, connectsLeft: false, connectsRight: true }, // آ
  0x0623: { isolated: 0xfe83, final: 0xfe84, initial: 0xfe83, medial: 0xfe84, connectsLeft: false, connectsRight: true }, // أ
  0x0624: { isolated: 0xfe85, final: 0xfe86, initial: 0xfe85, medial: 0xfe86, connectsLeft: false, connectsRight: true }, // ؤ
  0x0625: { isolated: 0xfe87, final: 0xfe88, initial: 0xfe87, medial: 0xfe88, connectsLeft: false, connectsRight: true }, // إ
  0x0627: { isolated: 0xfe8d, final: 0xfe8e, initial: 0xfe8d, medial: 0xfe8e, connectsLeft: false, connectsRight: true }, // ا
  0x0629: { isolated: 0xfe93, final: 0xfe94, initial: 0xfe93, medial: 0xfe94, connectsLeft: false, connectsRight: true }, // ة
  0x062f: { isolated: 0xfea9, final: 0xfeaa, initial: 0xfea9, medial: 0xfeaa, connectsLeft: false, connectsRight: true }, // د
  0x0630: { isolated: 0xfeab, final: 0xfeac, initial: 0xfeab, medial: 0xfeac, connectsLeft: false, connectsRight: true }, // ذ
  0x0631: { isolated: 0xfead, final: 0xfeae, initial: 0xfead, medial: 0xfeae, connectsLeft: false, connectsRight: true }, // ر
  0x0632: { isolated: 0xfeaf, final: 0xfeb0, initial: 0xfeaf, medial: 0xfeb0, connectsLeft: false, connectsRight: true }, // ز
  0x0648: { isolated: 0xfeed, final: 0xfeee, initial: 0xfeed, medial: 0xfeee, connectsLeft: false, connectsRight: true }, // و
  0x0649: { isolated: 0xfeef, final: 0xfef0, initial: 0xfeef, medial: 0xfef0, connectsLeft: false, connectsRight: true }, // ى
  // حروف تتصل من الجهتين (Dual-joining)
  0x0626: { isolated: 0xfe89, final: 0xfe8a, initial: 0xfe8b, medial: 0xfe8c, connectsLeft: true, connectsRight: true }, // ئ
  0x0628: { isolated: 0xfe8f, final: 0xfe90, initial: 0xfe91, medial: 0xfe92, connectsLeft: true, connectsRight: true }, // ب
  0x062a: { isolated: 0xfe95, final: 0xfe96, initial: 0xfe97, medial: 0xfe98, connectsLeft: true, connectsRight: true }, // ت
  0x062b: { isolated: 0xfe99, final: 0xfe9a, initial: 0xfe9b, medial: 0xfe9c, connectsLeft: true, connectsRight: true }, // ث
  0x062c: { isolated: 0xfe9d, final: 0xfe9e, initial: 0xfe9f, medial: 0xfea0, connectsLeft: true, connectsRight: true }, // ج
  0x062d: { isolated: 0xfea1, final: 0xfea2, initial: 0xfea3, medial: 0xfea4, connectsLeft: true, connectsRight: true }, // ح
  0x062e: { isolated: 0xfea5, final: 0xfea6, initial: 0xfea7, medial: 0xfea8, connectsLeft: true, connectsRight: true }, // خ
  0x0633: { isolated: 0xfeb1, final: 0xfeb2, initial: 0xfeb3, medial: 0xfeb4, connectsLeft: true, connectsRight: true }, // س
  0x0634: { isolated: 0xfeb5, final: 0xfeb6, initial: 0xfeb7, medial: 0xfeb8, connectsLeft: true, connectsRight: true }, // ش
  0x0635: { isolated: 0xfeb9, final: 0xfeba, initial: 0xfebb, medial: 0xfebc, connectsLeft: true, connectsRight: true }, // ص
  0x0636: { isolated: 0xfebd, final: 0xfebe, initial: 0xfebf, medial: 0xfec0, connectsLeft: true, connectsRight: true }, // ض
  0x0637: { isolated: 0xfec1, final: 0xfec2, initial: 0xfec3, medial: 0xfec4, connectsLeft: true, connectsRight: true }, // ط
  0x0638: { isolated: 0xfec5, final: 0xfec6, initial: 0xfec7, medial: 0xfec8, connectsLeft: true, connectsRight: true }, // ظ
  0x0639: { isolated: 0xfec9, final: 0xfeca, initial: 0xfecb, medial: 0xfecc, connectsLeft: true, connectsRight: true }, // ع
  0x063a: { isolated: 0xfecd, final: 0xfece, initial: 0xfecf, medial: 0xfed0, connectsLeft: true, connectsRight: true }, // غ
  0x0640: { isolated: 0x0640, final: 0x0640, initial: 0x0640, medial: 0x0640, connectsLeft: true, connectsRight: true }, // ـ تطويل
  0x0641: { isolated: 0xfed1, final: 0xfed2, initial: 0xfed3, medial: 0xfed4, connectsLeft: true, connectsRight: true }, // ف
  0x0642: { isolated: 0xfed5, final: 0xfed6, initial: 0xfed7, medial: 0xfed8, connectsLeft: true, connectsRight: true }, // ق
  0x0643: { isolated: 0xfed9, final: 0xfeda, initial: 0xfedb, medial: 0xfedc, connectsLeft: true, connectsRight: true }, // ك
  0x0644: { isolated: 0xfedd, final: 0xfede, initial: 0xfedf, medial: 0xfee0, connectsLeft: true, connectsRight: true }, // ل
  0x0645: { isolated: 0xfee1, final: 0xfee2, initial: 0xfee3, medial: 0xfee4, connectsLeft: true, connectsRight: true }, // م
  0x0646: { isolated: 0xfee5, final: 0xfee6, initial: 0xfee7, medial: 0xfee8, connectsLeft: true, connectsRight: true }, // ن
  0x0647: { isolated: 0xfee9, final: 0xfeea, initial: 0xfeeb, medial: 0xfeec, connectsLeft: true, connectsRight: true }, // ه
  0x064a: { isolated: 0xfef1, final: 0xfef2, initial: 0xfef3, medial: 0xfef4, connectsLeft: true, connectsRight: true }, // ي
};

const LAM_ALEF_LIGATURES: Record<number, { isolated: number; final: number }> = {
  0x0622: { isolated: 0xfef5, final: 0xfef6 }, // لآ
  0x0623: { isolated: 0xfef7, final: 0xfef8 }, // لأ
  0x0625: { isolated: 0xfef9, final: 0xfefa }, // لإ
  0x0627: { isolated: 0xfefb, final: 0xfefc }, // لا
};

const MIRROR_BRACKETS: Record<string, string> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
};

const ARABIC_CHAR_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasArabicCharacters(text: string): boolean {
  return ARABIC_CHAR_REGEX.test(text);
}

/** فحص ما إذا كان الحرف علامة تشكيل (تُعد شفافة ولا تقطع اتصال الحروف) */
export function isArabicDiacritic(code: number): boolean {
  return (
    (code >= 0x064b && code <= 0x065f) ||
    code === 0x0670 ||
    (code >= 0x06d6 && code <= 0x06ed)
  );
}

/**
 * تحويل الحروف العربية إلى أشكالها المتصلة (Presentation Forms-B) مع دمج لام-ألف
 * والحفاظ على علامات التشكيل.
 */
export function reshapeArabicText(input: string): string {
  const chars = Array.from(input);
  const output: string[] = [];

  const findPrevBaseIndex = (idx: number): number => {
    for (let i = idx - 1; i >= 0; i--) {
      const code = chars[i].charCodeAt(0);
      if (!isArabicDiacritic(code)) return i;
    }
    return -1;
  };

  const findNextBaseIndex = (idx: number): number => {
    for (let i = idx + 1; i < chars.length; i++) {
      const code = chars[i].charCodeAt(0);
      if (!isArabicDiacritic(code)) return i;
    }
    return -1;
  };

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.charCodeAt(0);

    if (isArabicDiacritic(code)) {
      output.push(ch);
      continue;
    }

    const entry = ARABIC_FORMS[code];
    if (!entry) {
      output.push(ch);
      continue;
    }

    const prevIdx = findPrevBaseIndex(i);
    const prevEntry = prevIdx !== -1 ? ARABIC_FORMS[chars[prevIdx].charCodeAt(0)] : undefined;
    const joinPrev = Boolean(prevEntry?.connectsLeft && entry.connectsRight);

    // معالجة ربط لام-ألف (لا، لأ، لإ، لآ) حتى لو وجدت حركة على اللام
    if (code === 0x0644) {
      const nextIdx = findNextBaseIndex(i);
      if (nextIdx !== -1) {
        const nextCode = chars[nextIdx].charCodeAt(0);
        const ligature = LAM_ALEF_LIGATURES[nextCode];
        if (ligature) {
          const ligCode = joinPrev ? ligature.final : ligature.isolated;
          output.push(String.fromCharCode(ligCode));
          // الحفاظ على أي تشكيل كان بين اللام والألف
          for (let d = i + 1; d < nextIdx; d++) {
            output.push(chars[d]);
          }
          i = nextIdx;
          continue;
        }
      }
    }

    const nextIdx = findNextBaseIndex(i);
    const nextEntry = nextIdx !== -1 ? ARABIC_FORMS[chars[nextIdx].charCodeAt(0)] : undefined;
    const joinNext = Boolean(entry.connectsLeft && nextEntry?.connectsRight);

    let shapedCode = entry.isolated;
    if (joinPrev && joinNext) {
      shapedCode = entry.medial;
    } else if (joinPrev) {
      shapedCode = entry.final;
    } else if (joinNext) {
      shapedCode = entry.initial;
    }

    output.push(String.fromCharCode(shapedCode));
  }

  return output.join('');
}

type RunKind = 'rtl' | 'ltr' | 'neutral';

interface GraphemeToken {
  text: string;
  kind: RunKind;
  isDigitOrLatinSep?: boolean;
}

function classifyChar(ch: string): RunKind {
  const code = ch.charCodeAt(0);
  // الأرقام العربية-الهندية (٠-٩) والإنجليزية (0-9) تُقرأ من اليسار لليمين
  if ((code >= 0x0030 && code <= 0x0039) || (code >= 0x0660 && code <= 0x0669)) {
    return 'ltr';
  }
  // الحروف اللاتينية
  if (
    (code >= 0x0041 && code <= 0x005a) ||
    (code >= 0x0061 && code <= 0x007a) ||
    (code >= 0x00c0 && code <= 0x024f)
  ) {
    return 'ltr';
  }
  // الحروف العربية وأشكالها التقديمية وعلامات الترقيم العربية
  if (
    (code >= 0x0600 && code <= 0x06ff) ||
    (code >= 0x0750 && code <= 0x077f) ||
    (code >= 0x08a0 && code <= 0x08ff) ||
    (code >= 0xfb50 && code <= 0xfdff) ||
    (code >= 0xfe70 && code <= 0xfeff)
  ) {
    return 'rtl';
  }
  return 'neutral';
}

function tokenizeGraphemes(text: string): GraphemeToken[] {
  const chars = Array.from(text);
  const tokens: GraphemeToken[] = [];

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const code = ch.charCodeAt(0);

    if (isArabicDiacritic(code) && tokens.length > 0) {
      // نُبقي علامة التشكيل ملتصقة بحرفها الأساسي حتى لا ينفصلا عند عكس الاتجاه
      tokens[tokens.length - 1].text += ch;
      continue;
    }

    const kind = classifyChar(ch);
    const isDigitOrLatinSep =
      ch === '.' || ch === ':' || ch === '/' || ch === '-' || ch === '+' || ch === '%';
    tokens.push({ text: ch, kind, isDigitOrLatinSep });
  }

  return tokens;
}

/**
 * إعادة ترتيب سطر واحد بصرياً (من اليسار إلى اليمين كما يرسمه pdf-lib)
 * مع الحفاظ على الكلمات الإنجليزية والأرقام بترتيبها الصحيح وعكس الأقواس في السياق العربي.
 */
export function toVisualBidiLine(
  shapedLine: string,
  baseDirection: 'rtl' | 'ltr'
): string {
  if (!shapedLine) return '';
  const tokens = tokenizeGraphemes(shapedLine);
  if (tokens.length === 0) return '';

  // 1. تجميع الرموز المتجاورة من نفس النوع مع ربط فواصل الأرقام (مثل 2026/11/26 أو INV-104)
  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].isDigitOrLatinSep) {
      const prev = tokens[i - 1]?.kind;
      const next = tokens[i + 1]?.kind;
      if (prev === 'ltr' && next === 'ltr') {
        tokens[i].kind = 'ltr';
      }
    }
  }

  // 2. حل اتجاه المقاطع المحايدة بناءً على الجيران أو اتجاه السطر الأساسي
  interface Run {
    kind: RunKind;
    tokens: GraphemeToken[];
  }

  const rawRuns: Run[] = [];
  for (const tok of tokens) {
    const last = rawRuns[rawRuns.length - 1];
    if (last && last.kind === tok.kind) {
      last.tokens.push(tok);
    } else {
      rawRuns.push({ kind: tok.kind, tokens: [tok] });
    }
  }

  const resolvedRuns: { dir: 'rtl' | 'ltr'; tokens: GraphemeToken[] }[] = rawRuns.map(
    (run, idx) => {
      if (run.kind !== 'neutral') {
        return { dir: run.kind, tokens: run.tokens };
      }
      const prevStrong = rawRuns
        .slice(0, idx)
        .reverse()
        .find((r) => r.kind !== 'neutral')?.kind as 'rtl' | 'ltr' | undefined;
      const nextStrong = rawRuns
        .slice(idx + 1)
        .find((r) => r.kind !== 'neutral')?.kind as 'rtl' | 'ltr' | undefined;

      const resolvedDir: 'rtl' | 'ltr' =
        prevStrong && prevStrong === nextStrong ? prevStrong : baseDirection;

      return { dir: resolvedDir, tokens: run.tokens };
    }
  );

  // دمج المقاطع المتجاورة ذات الاتجاه نفسه بعد الحل
  const mergedRuns: { dir: 'rtl' | 'ltr'; tokens: GraphemeToken[] }[] = [];
  for (const r of resolvedRuns) {
    const last = mergedRuns[mergedRuns.length - 1];
    if (last && last.dir === r.dir) {
      last.tokens.push(...r.tokens);
    } else {
      mergedRuns.push({ dir: r.dir, tokens: [...r.tokens] });
    }
  }

  const renderRun = (run: { dir: 'rtl' | 'ltr'; tokens: GraphemeToken[] }): string => {
    if (run.dir === 'ltr') {
      return run.tokens.map((t) => t.text).join('');
    }
    return [...run.tokens]
      .reverse()
      .map((t) => MIRROR_BRACKETS[t.text] ?? t.text)
      .join('');
  };

  if (baseDirection === 'rtl') {
    return [...mergedRuns].reverse().map(renderRun).join('');
  }

  return mergedRuns.map(renderRun).join('');
}

/**
 * دالة شاملة تجهّز سطراً واحداً للرسم المتجه المباشر في pdf-lib
 */
export function prepareVectorLineForPdf(
  logicalLine: string,
  baseDirection?: 'rtl' | 'ltr'
): string {
  const dir = baseDirection ?? (hasArabicCharacters(logicalLine) ? 'rtl' : 'ltr');
  const shaped = hasArabicCharacters(logicalLine)
    ? reshapeArabicText(logicalLine)
    : logicalLine;
  return toVisualBidiLine(shaped, dir);
}
