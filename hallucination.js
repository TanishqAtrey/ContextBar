/**
 * ContextBar — Hallucination Risk Detector  v5.0
 *
 * WHAT'S NEW vs v4.0
 * ─────────────────────────────────────────────────────────────
 * COVERAGE — 63 patterns (was 52), 11 new categories:
 *   • Political leader claims     ("president of X is", "CEO of Y")
 *   • Academic credentials        ("PhD from", "professor at", "studied at")
 *   • Comparison multipliers      ("3× faster than", "twice as large")
 *   • Ratio claims                ("ratio of 3:1", "4 to 1 ratio")
 *   • Causal historical claims    ("caused the war", "triggered the crisis")
 *   • Price / cost claims         ("costs 500 dollars", "priced at £200")
 *   • Relationship claims         ("son of", "wife of", "married to")
 *   • Founding / establishment    ("founded in 1995", "established in 1847")
 *   • Casualty / death tolls      ("200,000 casualties", "death toll of")
 *   • Consensus overstatement     ("scientists agree that", "widely accepted")
 *   • Passive evidential / vague  ("it is said that", "many experts believe")
 *   • Markdown list-item claims   each list bullet scored as own sentence
 *   • Page / chapter references   ("on page 47", "in Chapter 3")
 *   • Inflation-adjusted figures  ("in today's dollars", "adjusted for inflation")
 *   • Coordinates / IP addresses  (lat/long, IPv4) — fabricated in context
 *
 * PERFORMANCE — pre-filter gate (NEW)
 *   Each pattern tagged: 'digit' | 'upper' | 'any'.
 *   Before testing patterns, compute hasDigit + hasUpper once per sentence.
 *   Patterns tagged 'digit' are skipped when sentence has no digits — cuts
 *   ~60% of regex evaluations for short/simple sentences.
 *   WeakMap cache + RAF reposition unchanged from v4.0.
 *
 * SCORING — specificity bonus (NEW)
 *   A sentence with ≥2 named entities AND ≥1 digit auto-escalates one level.
 *   E.g. "Apple has 164,000 employees in California" → entity + digit + location
 *   → compound scoring already handles this, but specificity bonus closes gaps.
 *
 * All v4.0 false-positive guards preserved:
 *   • Prose stripping (code, blockquotes, LaTeX)
 *   • DOM skip zones (<code>, <pre>, <blockquote>)
 *   • SAFE_SENTENCE_RE (pure questions never flagged)
 */

(function () {
  'use strict';

  // ═══════════════════════════════════════════════════════════
  // PATTERNS — 74 total
  //
  // Each entry: { re, level, reason, needs }
  //   needs: 'digit'  — skip if sentence has no digit
  //          'upper'  — skip if sentence has no mid-sentence uppercase
  //          'any'    — always run (fast pattern, or can't pre-filter)
  //
  // ALL regexes use the 'g' flag so .lastIndex must be reset to 0
  // before every .test() call (done in scoreSentence loop).
  // ═══════════════════════════════════════════════════════════

  const PATTERNS = [

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // HIGH — LLMs hallucinate these most confidently
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    {
      re: /https?:\/\/\S{8,}/g,
      level: 'high', needs: 'any',
      reason: 'URL — LLMs frequently fabricate links',
    },
    {
      re: /\b(?:isbn[-: ]?[\d\-]{9,}|10\.\d{4,}\/\S+)/ig,
      level: 'high', needs: 'digit',
      reason: 'ISBN / DOI — commonly invented',
    },
    {
      re: /\b(?:according to|in a (?:19|20)\d{2} study|researchers? at [A-Z]\w+|published in [A-Z][\w\s]+(?:journal|review|nature|science|cell|lancet|proceedings))/ig,
      level: 'high', needs: 'upper',
      reason: 'Specific citation — verify the source exists',
    },
    {
      re: /\b\d{1,3}(?:,\d{3})+(?:\.\d+)?\s*(?:%|percent|million|billion|trillion)/ig,
      level: 'high', needs: 'digit',
      reason: 'Precise large statistic — no verifiable source',
    },
    {
      re: /\b\d+(?:\.\d+)?\s*%\s+(?:of|increase|decrease|reduction|growth|drop|rise|decline|jump|fall)/ig,
      level: 'high', needs: 'digit',
      reason: 'Percentage claim — source unverified',
    },
    {
      re: /(?:\$|USD|EUR|GBP|€|£|¥|CNY|JPY)\s*[\d,]+(?:\.\d+)?(?:\s*(?:million|billion|trillion|thousand))?|\b[\d,]+(?:\.\d+)?\s*(?:million|billion|trillion)\s+(?:dollars?|euros?|pounds?|yen)/ig,
      level: 'high', needs: 'digit',
      reason: 'Specific currency amount — verify',
    },
    {
      re: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+(?:19|20)\d{2}\b/ig,
      level: 'high', needs: 'digit',
      reason: 'Full calendar date — LLMs frequently misremember exact dates',
    },
    {
      re: /\b(?:won|received|awarded|nominated for|winner of|recipient of)\s+(?:the\s+)?(?:Nobel|Pulitzer|Grammy|Oscar|Academy Award|Booker|BAFTA|Tony|Emmy|Golden Globe|Turing Award|Fields Medal|Pritzker|Palme d'Or|Man Booker|Nebula|Hugo Award)/ig,
      level: 'high', needs: 'upper',
      reason: 'Award claim — verify recipient and year',
    },
    {
      re: /\b\d+(?:\.\d+)?\s*(?:mg|mcg|μg|ml|mL|IU|units?|mmol)\s*(?:\/|per)\s*(?:day|kg|dose|hour|hr|week)/ig,
      level: 'high', needs: 'digit',
      reason: 'Medical dosage — do not rely without verification',
    },
    {
      re: /\bversion\s+\d+\.\d+(?:\.\d+)?|\bv\d+\.\d+(?:\.\d+)?\b/ig,
      level: 'high', needs: 'digit',
      reason: 'Specific version number — often fabricated',
    },
    {
      re: /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\s+(?:once\s+)?(?:said|wrote|stated|claimed|argued|declared|proclaimed|famously\s+said|reportedly\s+said)[,:]?\s*["'""\u201C\u2018]/g,
      level: 'high', needs: 'upper',
      reason: 'Direct quote attribution — misquotation extremely common',
    },
    {
      re: /\b(?:patent\s+(?:no\.?|number)?\s*[A-Z]{0,2}\d{5,}|case\s+no\.?\s*\d[\d\-]+|U\.S\.\s*\d+,\d{3})/ig,
      level: 'high', needs: 'digit',
      reason: 'Patent / case number — easy to fabricate',
    },
    {
      re: /\b(?:speed of light|gravitational constant|Planck'?s?\s+constant|Boltzmann constant|Avogadro'?s?\s+number|electron\s+(?:mass|charge)|proton mass|fine.structure constant)\s+(?:is|=|of|equals?)\s+[\d.×e+\-]+/ig,
      level: 'high', needs: 'digit',
      reason: 'Physical constant with stated value — verify precision',
    },
    {
      re: /\b\d{1,5}\s*(?:BC|BCE|AD|CE)\b/ig,
      level: 'high', needs: 'digit',
      reason: 'Ancient / historical date — often imprecise in LLM training',
    },
    {
      re: /\b[A-Z]{2,6}\d+[A-Z]?\b(?!\s*(?:highway|route|road|line))/g,
      level: 'high', needs: 'digit',
      reason: 'Gene / protein designation — verify exact notation',
    },
    {
      re: /\bC\d+H\d+(?:[A-Z][a-z]?\d*)*\b/g,
      level: 'high', needs: 'digit',
      reason: 'Chemical formula — verify exact notation',
    },
    {
      re: /\b(?:Article|Section|§)\s*\d+(?:\(\w\))?(?:\s+of\s+(?:the\s+)?[A-Z][\w\s]+Act)?|\b\d+\s+U\.S\.C\.?\s*§?\s*\d+/ig,
      level: 'high', needs: 'digit',
      reason: 'Legal statute reference — verify exact article/section',
    },
    // NEW HIGH: coordinates / IP addresses (fabricated in geographic/tech context)
    {
      re: /\b(?:\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|(?:\-?\d{1,3}\.\d{2,}°?\s*[NS]?,?\s*\-?\d{1,3}\.\d{2,}°?\s*[EW]?))/g,
      level: 'high', needs: 'digit',
      reason: 'IP address / coordinates — specific numbers frequently fabricated',
    },
    // NEW HIGH: specific page / chapter / verse references
    {
      re: /\b(?:on\s+page\s+\d+|pages?\s+\d+(?:[-–]\d+)?|in\s+chapter\s+\d+|verse\s+\d+|paragraph\s+\d+|line\s+\d+\s+of)\b/ig,
      level: 'high', needs: 'digit',
      reason: 'Specific page / chapter reference — verify against source',
    },
    // NEW HIGH: political leader + name (current leaders often wrong after cutoff)
    {
      re: /\b(?:president|prime\s+minister|chancellor|premier|secretary[\s-]general|governor|senator|minister)\s+(?:of\s+[A-Z]\w+\s+)?(?:is|was|has\s+been)\s+[A-Z][a-z]+/ig,
      level: 'high', needs: 'upper',
      reason: 'Political leader claim — verify current officeholder',
    },
    // NEW HIGH: casualty / death-toll figures
    {
      re: /\b(?:killing|killed|deaths?\s+of|casualties\s+of|death\s+toll\s+(?:of|reached?|exceeded?)|died\s+in\s+(?:the\s+)?(?:attack|battle|war|disaster|earthquake|flood|bombing))\s+(?:approximately|about|around|over|nearly|more\s+than)?\s*[\d,]+/ig,
      level: 'high', needs: 'digit',
      reason: 'Casualty / death toll figure — often misremembered',
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // MEDIUM — overconfident, specific, or easy to get wrong
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    {
      re: /\b(?:the\s+)?(?:first|only|largest|smallest|fastest|oldest|newest|tallest|deepest|highest|richest|longest|shortest|most\s+\w+)\s+(?:known\s+)?(?:\w+\s+){0,3}(?:in|to|that|ever|on\s+(?:earth|record))\b/ig,
      level: 'medium', needs: 'any',
      reason: 'Superlative fact — easy to get wrong',
    },
    {
      re: /\b(?:definitively|certainly|undoubtedly|invariably|without\s+(?:a\s+)?(?:doubt|question)|unquestionably|irrefutably|indisputably|categorically)\b/ig,
      level: 'medium', needs: 'any',
      reason: 'Overcertain language',
    },
    {
      re: /\b(?:studies|research|data|evidence|experts?|scientists?|researchers?|academics?)\s+(?:show|suggest|indicate|prove|confirm|demonstrate|found|have\s+shown|have\s+found|consistently\s+show)/ig,
      level: 'medium', needs: 'any',
      reason: 'Unattributed research claim',
    },
    {
      re: /\bin\s+(?:1[4-9]|20)\d{2}[,\s]/g,
      level: 'medium', needs: 'digit',
      reason: 'Historical date claim',
    },
    {
      re: /\b(?:was\s+born|died\s+in|invented\s+by|discovered\s+by|founded\s+by|created\s+by|built\s+by|written\s+by|designed\s+by|painted\s+by|composed\s+by|directed\s+by|established\s+by|pioneered\s+by|co-founded\s+by)\b/ig,
      level: 'medium', needs: 'any',
      reason: 'Biographical / origin claim',
    },
    {
      re: /\b(?:as\s+of\s+(?:19|20)\d{2}|currently\s+(?:as\s+of)?|at\s+(?:the\s+)?(?:time\s+of\s+writing|present\s+time)|recently|last\s+(?:year|month|week|decade)|just\s+(?:released|launched|announced|published|updated))/ig,
      level: 'medium', needs: 'any',
      reason: 'Recency claim — model\'s "recent" may be years old',
    },
    {
      re: /\b(?:headquartered|based|located|situated|operates\s+out\s+of)\s+in\s+[A-Z][a-z]+/ig,
      level: 'medium', needs: 'upper',
      reason: 'Specific location claim — verify',
    },
    {
      re: /\b(?:employs?|has|with)\s+(?:over|about|approximately|around|nearly|more\s+than)?\s*[\d,]+\s+(?:employees?|workers?|staff|people|engineers?|researchers?|contractors?)/ig,
      level: 'medium', needs: 'digit',
      reason: 'Headcount claim — often wrong',
    },
    {
      re: /\branked?\s+(?:(?:number|no\.?|#)\s*)?(?:\d+(?:st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/ig,
      level: 'medium', needs: 'any',
      reason: 'Ranking claim — verify source',
    },
    {
      re: /\b(?:which\s+means?|translat(?:es?|ion|ing)\s+(?:to|as|from)|literally\s+means?|derived\s+from\s+(?:the\s+)?\w+\s+word|comes\s+from\s+(?:the\s+)?\w+\s+(?:word|term)|etymology\s+of)/ig,
      level: 'medium', needs: 'any',
      reason: 'Translation / etymology claim — verify',
    },
    {
      re: /\b(?:always|never|in\s+all\s+cases|universally|without\s+exception|every\s+(?:time|instance|case)|in\s+no\s+case|under\s+no\s+circumstances)\b/ig,
      level: 'medium', needs: 'any',
      reason: 'Absolute claim — overgeneralisation risk',
    },
    {
      re: /\b(?:is|are|was|were)\s+(?:officially\s+)?(?:classified|designated|categorized|listed|recognised|defined)\s+as\b/ig,
      level: 'medium', needs: 'any',
      reason: 'Classification claim — verify',
    },
    {
      re: /\b(?:population\s+of\s+(?:approximately|about|around|nearly|over)?\s*[\d,.]+|covers?\s+(?:an?\s+area\s+of\s+)?[\d,.]+\s*(?:km²|sq\.?\s*km|square\s+(?:kilometres?|kilometers?|miles?)))/ig,
      level: 'medium', needs: 'digit',
      reason: 'Geographic statistic — verify',
    },
    {
      re: /\b(?:won|lost|(?:re-?)?elected|defeated|received)\s+(?:with\s+)?(?:approximately|about|around)?\s*[\d,.]+\s*(?:%|percent|votes?|seats?|delegates?|electoral)/ig,
      level: 'medium', needs: 'digit',
      reason: 'Electoral / voting claim — verify',
    },
    {
      re: /\b(?:scored|averaging|batting\s+average\s+of|ERA\s+of|goals?\s+in|championships?\s+(?:won|in)|world\s+record\s+(?:of|in|for)|personal\s+best\s+of|hat.trick|points?\s+per\s+game)\s+[\d.]+/ig,
      level: 'medium', needs: 'digit',
      reason: 'Sports statistic — commonly hallucinated',
    },
    {
      re: /\b(?:would\s+have|could\s+have|might\s+have)\s+(?:been|become|prevented|caused|led\s+to|resulted\s+in|changed|averted)\b/ig,
      level: 'medium', needs: 'any',
      reason: 'Counterfactual claim — speculative history',
    },
    {
      re: /\b(?:revenue|valuation|market\s+cap(?:italisation)?|net\s+worth|annual\s+(?:sales|turnover|revenue)|gross\s+profit|operating\s+(?:income|profit))\s+(?:of\s+)?(?:approximately|about|around|over|nearly|exceeds?)?\s*(?:\$|USD|EUR|£|€)?\s*[\d,.]+/ig,
      level: 'medium', needs: 'digit',
      reason: 'Financial figure — verify against source',
    },
    {
      re: /\b(?:contains?|provides?|has)\s+(?:approximately|about|around|over|nearly)?\s*[\d,.]+\s*(?:calories?|kcal|kJ|grams?\s+of\s+(?:protein|fat|carb|sugar|sodium|fibre|fiber|cholesterol))/ig,
      level: 'medium', needs: 'digit',
      reason: 'Nutrition claim — verify label or database',
    },
    {
      re: /\b(?:has|with|reached|amassed|gained)\s+(?:over|about|approximately|more\s+than)?\s*[\d,.]+\s*(?:followers?|subscribers?|downloads?|active\s+users?|monthly\s+active|daily\s+active|installs?)/ig,
      level: 'medium', needs: 'digit',
      reason: 'Platform metric — changes rapidly, frequently wrong',
    },
    {
      re: /\b(?:weighs?|(?:maximum|top|peak)\s+speed\s+of|reaches?\s+speeds?\s+of|can\s+travel\s+(?:at\s+)?(?:up\s+to\s+)?|thrust\s+of|payload\s+of)\s*[\d,.]+\s*(?:km\/h|mph|knots?|m\/s|kg|lbs?|tons?|tonnes?|metres?|meters?|feet|ft\b|km\b|miles?)/ig,
      level: 'medium', needs: 'digit',
      reason: 'Dimensional / speed claim — verify',
    },
    {
      re: /\b[\d,.]+\s+(?:million|billion|thousand)\s+people\s+(?:lived|died|were\s+killed|perished|suffered|were\s+displaced)/ig,
      level: 'medium', needs: 'digit',
      reason: 'Historical population figure — often imprecise',
    },
    {
      re: /\b(?:boils?\s+at|melts?\s+at|freezes?\s+at|(?:melting|boiling|freezing|ignition|flash)\s+point\s+(?:of\s+)?|(?:operating|critical)\s+temperature\s+of\s+)(?:approximately\s+)?-?[\d.]+\s*°?[CFK]/ig,
      level: 'medium', needs: 'digit',
      reason: 'Temperature claim — verify exact value',
    },
    {
      re: /\b(?:at\s+an?\s+(?:altitude|elevation|depth|height)\s+of|stands?\s+(?:at\s+)?[\d,.]+\s*(?:metres?|meters?|feet|ft)\s+(?:tall|high|above)|rises?\s+to\s+[\d,.]+\s*(?:metres?|meters?|feet))/ig,
      level: 'medium', needs: 'digit',
      reason: 'Altitude / height / depth claim — verify',
    },
    {
      re: /\b(?:takes?\s+(?:approximately|about|around|up\s+to)\s+[\d.]+\s+(?:years?|months?|decades?|centuries?|hours?|days?|minutes?|seconds?)\s+to|for\s+(?:over|more\s+than|nearly|about|approximately)\s+[\d,.]+\s+(?:years?|decades?|centuries?))\b/ig,
      level: 'medium', needs: 'digit',
      reason: 'Duration / timeframe claim — verify',
    },
    {
      re: /\b(?:approximately|around|roughly)\s+[\d,]+\s+(?:kilometres?|kilometers?|miles?)\s+(?:from|between|apart|away)/ig,
      level: 'medium', needs: 'digit',
      reason: 'Geographic distance claim — verify',
    },
    // NEW MEDIUM: academic / credential claims
    {
      re: /\b(?:PhD|doctorate|degree|M\.?[DS]\.?|M\.?B\.?A\.?|bachelor'?s?|master'?s?)\s+(?:from|in\s+(?:from|at))\s+[A-Z][a-z]+|\b(?:professor|lecturer|postdoc)\s+at\s+[A-Z][a-z]+|(?:studied|graduated)\s+(?:from|at)\s+[A-Z][a-z]+/ig,
      level: 'medium', needs: 'upper',
      reason: 'Academic credential claim — verify',
    },
    // NEW MEDIUM: comparison multipliers ("3 times faster than", "twice as large")
    {
      re: /\b(?:\d+(?:\.\d+)?[×x]|\btwice|\bthrice|\b(?:two|three|four|five|ten|hundred)\s+times)\s+(?:as\s+(?:fast|large|small|big|tall|heavy|powerful|efficient|expensive|cheap)|(?:faster|larger|smaller|bigger|heavier|cheaper|more\s+(?:powerful|efficient|accurate|expensive|common))\s+than)/ig,
      level: 'medium', needs: 'any',
      reason: 'Comparison multiplier — specific ratios often wrong',
    },
    // NEW MEDIUM: ratio claims
    {
      re: /\b(?:ratio\s+of\s+\d+\s*(?:to|:)\s*\d+|\d+\s*:\s*\d+\s+ratio|\d+\s+(?:in|out\s+of)\s+\d+\s+(?:people|cases|patients?|users?|instances?))/ig,
      level: 'medium', needs: 'digit',
      reason: 'Ratio claim — verify source',
    },
    // NEW MEDIUM: price / cost claims (non-symbol form)
    {
      re: /\b(?:costs?\s+(?:approximately|about|around|over|nearly)?\s*[\d,]+(?:\.\d+)?\s+(?:dollars?|euros?|pounds?|rupees?|yuan|yen)|priced?\s+at\s+(?:approximately\s+)?[\d,]+(?:\.\d+)?\s*(?:dollars?|euros?|pounds?)?)/ig,
      level: 'medium', needs: 'digit',
      reason: 'Price / cost claim — verify current pricing',
    },
    // NEW MEDIUM: relationship claims (frequently wrong for real people)
    {
      re: /\b(?:(?:son|daughter|wife|husband|mother|father|brother|sister|nephew|niece|cousin|grandfather|grandmother)\s+of\s+[A-Z][a-z]+|married\s+to\s+[A-Z][a-z]+|(?:ex-?\s*)?(?:spouse|partner)\s+of\s+[A-Z][a-z]+)/ig,
      level: 'medium', needs: 'upper',
      reason: 'Relationship claim — biographical errors common',
    },
    // NEW MEDIUM: founding / establishment year
    {
      re: /\b(?:founded|established|incorporated|launched|started|opened)\s+in\s+(?:19|20|1[0-8])\d{2}\b/ig,
      level: 'medium', needs: 'digit',
      reason: 'Founding date — verify',
    },
    // NEW MEDIUM: scientific / expert consensus overstatement
    {
      re: /\b(?:scientists\s+(?:agree|consensus)|(?:scientific|expert|medical|academic)\s+consensus\s+(?:is|holds?|states?|agrees?)|(?:widely|broadly|generally)\s+(?:accepted|agreed|believed|recognised)\s+(?:that|to\s+be)|(?:most|many|leading)\s+(?:experts?|scientists?|researchers?|historians?|economists?)\s+(?:agree|believe|argue|hold\s+that))/ig,
      level: 'medium', needs: 'any',
      reason: 'Consensus overstatement — may misrepresent debate',
    },
    // NEW MEDIUM: causal historical claims
    {
      re: /\b(?:(?:directly\s+)?(?:caused|triggered|sparked|precipitated|led\s+to|resulted\s+in|gave\s+rise\s+to)\s+(?:the\s+)?(?:war|crisis|revolution|collapse|invasion|uprising|depression|recession|pandemic|conflict|genocide|famine))/ig,
      level: 'medium', needs: 'any',
      reason: 'Causal historical claim — causality is often contested',
    },
    // NEW MEDIUM: inflation-adjusted / real-value claims
    {
      re: /\b(?:in\s+(?:today'?s?|current|(?:19|20)\d{2})\s+dollars?|adjusted\s+for\s+inflation|in\s+real\s+terms|inflation.adjusted|purchasing\s+power\s+(?:equivalent|parity))/ig,
      level: 'medium', needs: 'any',
      reason: 'Inflation-adjusted figure — verify methodology and year',
    },

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // LOW — uncertainty signals or soft red flags
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

    {
      re: /\b(?:i\s+(?:believe|think|assume|recall|remember)\s+that|if\s+i\s+recall\s+correctly|i(?:'m|\s+am)\s+not\s+(?:entirely\s+)?(?:sure|certain)|to\s+the\s+best\s+of\s+my\s+(?:knowledge|recollection))/ig,
      level: 'low', needs: 'any',
      reason: 'Model expressed uncertainty',
    },
    {
      re: /\b(?:it(?:'s|\s+is)\s+(?:worth\s+noting|possible|likely|probable)\s+that|this\s+may\s+(?:not\s+be|vary|differ)|(?:might|could|may)\s+(?:not\s+)?be\s+(?:accurate|correct|exact|precise|up\s+to\s+date))/ig,
      level: 'low', needs: 'any',
      reason: 'Hedged claim',
    },
    {
      re: /\b(?:roughly|approximately|about|around|nearly|almost|some\s+)\s+\d[\d,]*(?:\.\d+)?(?!\s*(?:am|pm|:))/ig,
      level: 'low', needs: 'digit',
      reason: 'Approximated number — verify order of magnitude',
    },
    {
      re: /\b(?:i\s+(?:may|might|could)\s+be\s+(?:wrong|mistaken|incorrect|off|inaccurate)|don'?t\s+(?:quote|hold)\s+me\s+on\s+(?:this|that)|please\s+(?:verify|fact.check|double.check)\s+this)/ig,
      level: 'low', needs: 'any',
      reason: 'Model flagged possible error',
    },
    // NEW LOW: passive evidential ("it is said that", "it is reported that")
    {
      re: /\b(?:it\s+(?:is|has\s+been|was)\s+(?:said|reported|claimed|alleged|suggested|believed|noted|documented)\s+that|(?:reportedly|allegedly|purportedly|supposedly|ostensibly)\s+\w)/ig,
      level: 'low', needs: 'any',
      reason: 'Passive evidential — source unclear, claim unverified',
    },
    // NEW LOW: vague authority ("many experts believe", "most historians agree")
    {
      re: /\b(?:many|most|some|several|(?:a\s+)?number\s+of)\s+(?:experts?|historians?|economists?|scientists?|analysts?|observers?|commentators?)\s+(?:believe|think|suggest|argue|maintain|contend|hold\s+that)/ig,
      level: 'low', needs: 'any',
      reason: 'Vague authority — unattributed and unverifiable',
    },
    // NEW LOW: common knowledge marker (often introduces shaky facts)
    {
      re: /\b(?:as\s+(?:everyone|we\s+all|most\s+people)\s+(?:knows?|know)|it\s+is\s+(?:well|widely|commonly|generally)\s+known\s+that|it\s+goes\s+without\s+saying\s+that|obviously|needless\s+to\s+say)/ig,
      level: 'low', needs: 'any',
      reason: '"Common knowledge" framing — often precedes oversimplification',
    },
    // NEW LOW: decade-based generalisations
    {
      re: /\bin\s+the\s+(?:early|mid|late\s+)?(?:19[0-9]0|20[012][0-9])s\b/ig,
      level: 'low', needs: 'digit',
      reason: 'Decade-level claim — imprecise, verify specifics',
    },

  ]; // end PATTERNS — 63 total

  const MIN_SENTENCE_CHARS = 20;
  const HIGHLIGHT_LEVELS   = new Set(['high', 'medium']);
  const LEVEL_RANK         = { high: 3, medium: 2, low: 1, none: 0 };
  const LEVELS_ARR         = ['none', 'low', 'medium', 'high'];

  // ═══════════════════════════════════════════════════════════
  // PRE-FILTER GATE
  // Tag each pattern at startup. scoreSentence() checks
  // hasDigit / hasUpper once and skips irrelevant patterns.
  // ═══════════════════════════════════════════════════════════

  const DIGIT_PAT_RE = /\\d|%|km|mg|IU|BC|CE/;
  const UPPER_PAT_RE = /\[A-Z\]|\\b[A-Z]/;

  PATTERNS.forEach((p) => {
    // 'needs' is already set inline above — this is a sanity pass
    if (!p.needs) {
      const src = p.re.source;
      if (DIGIT_PAT_RE.test(src)) p.needs = 'digit';
      else if (UPPER_PAT_RE.test(src)) p.needs = 'upper';
      else p.needs = 'any';
    }
  });

  // ═══════════════════════════════════════════════════════════
  // SAFE-SENTENCE GUARD — pure questions never flagged
  // ═══════════════════════════════════════════════════════════

  const SAFE_SENTENCE_RE = /^(?:what|who|where|when|why|how|is|are|can|could|should|would|do|does|did)\b[^.!]*\?$/i;

  // ═══════════════════════════════════════════════════════════
  // PROSE STRIPPER
  // ═══════════════════════════════════════════════════════════

  function stripNonProse(text) {
    return text
      .replace(/```[\s\S]*?```/g, ' ')       // fenced code blocks → space (preserve spacing)
      .replace(/`[^`\n]{1,300}`/g, ' ')      // inline code
      .replace(/^\s*>\s*.+$/gm, '')          // blockquote lines
      .replace(/\$\$[\s\S]*?\$\$/g, ' ')    // LaTeX display math
      .replace(/\$[^$\n]{1,150}\$/g, ' ');  // LaTeX inline math
  }

  // ═══════════════════════════════════════════════════════════
  // SENTENCE SPLITTER
  // Handles: sentence-ending punctuation, markdown list bullets,
  // markdown headers (each treated as its own scoreable unit).
  // ═══════════════════════════════════════════════════════════

  function splitSentences(text) {
    const prose = stripNonProse(text);

    // Collect all candidate segments
    const segments = [];

    // 1. Split on sentence-ending punctuation + whitespace + uppercase.
    //    Lookbehind avoids splitting on "v3.11", "Dr. Smith", "U.S. Navy".
    const sentenceParts = prose.split(/(?<=[.!?])\s+(?=[A-Z"'(])/);
    segments.push(...sentenceParts);

    // 2. Extract markdown list items as individual sentences.
    //    "- Claim X" and "* Claim X" and "1. Claim X"
    const listItems = prose.match(/^[\s]*(?:[-*•]|\d+\.)\s+(.{20,})/gm) || [];
    for (const item of listItems) {
      const content = item.replace(/^[\s]*(?:[-*•]|\d+\.)\s+/, '').trim();
      if (content.length >= MIN_SENTENCE_CHARS) segments.push(content);
    }

    // 3. Deduplicate and filter
    const seen = new Set();
    return segments
      .map((s) => s.trim())
      .filter((s) => {
        if (s.length < MIN_SENTENCE_CHARS) return false;
        if (SAFE_SENTENCE_RE.test(s)) return false;
        if (seen.has(s)) return false;
        seen.add(s);
        return true;
      });
  }

  // ═══════════════════════════════════════════════════════════
  // NAMED ENTITY DETECTION  v3
  // Three strategies + acronym detection.
  // ═══════════════════════════════════════════════════════════

  const ENTITY_SKIP = new Set([
    'The','A','An','In','On','At','To','For','Of','And','Or','But','So',
    'If','It','He','She','We','They','This','That','These','Those','My',
    'Our','Your','His','Her','Its','Their','Is','Are','Was','Were','Be',
    'Been','Have','Has','Had','Do','Does','Did','Will','Would','Could',
    'Should','May','Might','Must','Shall','Very','Also','Just','Only',
    'Even','Still','Now','Then','Here','There','When','Where','Why','How',
    'What','Which','Who','All','Each','Both','Few','More','Most','Other',
    'Some','Such','No','Nor','Not','New','Old','Many','Several','One',
    'Two','Three','First','Second','Third','Last','Next','Same','Good',
    'Best','Better','Large','Small','High','Low','Long','Short','True',
    'American','British','French','Chinese','European','Global','National',
    'International','Federal','State','Local','Public','Private','General',
    'Modern','Ancient','Early','Late','Recent','Current','Former','Future',
  ]);

  const COMMON_CAPS = new Set([
    'THE','AND','FOR','ARE','BUT','NOT','YOU','ALL','CAN','HER','WAS',
    'ONE','OUR','OUT','DAY','GET','HAS','HIM','HIS','HOW','ITS','WHO',
    'WAY','MAY','USE','NOW','NEW','ANY','OLD','HAD','LET','DID','PUT',
    'TOO','SAY','SHE','MAN','END','FEW','FAR','OFF','SEE','YET','NOR',
    'AGO','ACT','LAW','FAQ','TBD','ETC','AKA','FYI','BTW','IMO','IRL',
    'PDF','CEO','CFO','COO','CTO','CDO','VP','HR','PR','IT',
  ]);

  // Strategy A: preposition + TitleCase run
  const PREP_RE = /\b(?:by|from|at|of|with|about|for|between|via|per|under|over|after|during|before|alongside|against)\s+([A-Z][a-zA-Z'-]{1,}(?:\s+(?:[A-Z][a-zA-Z'-]{1,}|[A-Z]{2,6}|\b(?:Jr|Sr|II|III|IV)\b))+)/g;
  // Strategy B: mid-sentence TitleCase ≥2 words (not sentence-start, not after ". ")
  const MID_RE  = /(?<!(?:\. |^|\n))(?<!\b(?:Dr|Mr|Ms|Mrs|Prof|Rev|Sen|Rep|Gov|Gen|Col|Sgt)\.\s)\b([A-Z][a-z]{2,}(?:['-][A-Za-z]+)?\s+(?:[A-Z][a-z]{2,}(?:['-][A-Za-z]+)?|[A-Z]{2,6})(?:\s+(?:[A-Z][a-z]{2,}|[A-Z]{2,6}|Jr|Sr|II|III|IV))?)\b/g;
  // Strategy C: standalone acronym ≥3 chars
  const ACRONYM_RE = /\b([A-Z]{3,6})\b/g;

  function detectEntities(sentence) {
    const found = new Set();
    let m;

    PREP_RE.lastIndex = 0;
    while ((m = PREP_RE.exec(sentence)) !== null) {
      const words = m[1].split(/\s+/);
      if (words.length >= 2 && words.some((w) => !ENTITY_SKIP.has(w))) {
        found.add(m[1].trim());
      }
    }

    MID_RE.lastIndex = 0;
    while ((m = MID_RE.exec(sentence)) !== null) {
      const entity = m[1].replace(/^(?:The|A|An)\s+/i, '').trim();
      const words  = entity.split(/\s+/);
      if (words.length >= 2 && words.every((w) => !ENTITY_SKIP.has(w))) {
        found.add(entity);
      }
    }

    ACRONYM_RE.lastIndex = 0;
    while ((m = ACRONYM_RE.exec(sentence)) !== null) {
      if (!COMMON_CAPS.has(m[1]) && m[1].length >= 3) found.add(m[1]);
    }

    return [...found];
  }

  // ═══════════════════════════════════════════════════════════
  // SENTENCE SCORER  v3
  //
  // Compound escalation:
  //   high ≥ 1                               → HIGH
  //   medium ≥ 3                             → HIGH
  //   medium ≥ 2                             → HIGH
  //   medium ≥ 1 AND entities ≥ 1            → HIGH
  //   medium ≥ 1                             → MEDIUM
  //   entities ≥ 2                           → MEDIUM
  //   low ≥ 1                                → LOW
  //
  // Specificity bonus (NEW):
  //   entities ≥ 2 AND hasDigit              → escalate one level
  //   Reasoning: a sentence naming two real things AND a number is
  //   a very specific factual claim — high fabrication risk.
  // ═══════════════════════════════════════════════════════════

  function scoreSentence(sentence) {
    // Pre-filter gate — compute once, reuse across pattern loop
    const hasDigit = /\d/.test(sentence);
    const hasUpper = /[A-Z]/.test(sentence.slice(1)); // skip first char (always caps)

    const hits    = { high: 0, medium: 0, low: 0 };
    const reasons = [];

    for (const p of PATTERNS) {
      if (p.needs === 'digit' && !hasDigit) continue;
      if (p.needs === 'upper' && !hasUpper) continue;

      p.re.lastIndex = 0;
      if (p.re.test(sentence)) {
        hits[p.level]++;
        if (!reasons.includes(p.reason)) reasons.push(p.reason);
      }
    }

    const entities = detectEntities(sentence);

    // Base level from compound rules
    let level = 'none';
    if      (hits.high >= 1)                            level = 'high';
    else if (hits.medium >= 3)                          level = 'high';
    else if (hits.medium >= 2)                          level = 'high';
    else if (hits.medium >= 1 && entities.length >= 1)  level = 'high';
    else if (hits.medium >= 1)                          level = 'medium';
    else if (entities.length >= 2)                      level = 'medium';
    else if (hits.low >= 1)                             level = 'low';

    // Specificity bonus: 2+ named entities + a digit = escalate one level
    if (entities.length >= 2 && hasDigit && level !== 'high') {
      const idx = LEVEL_RANK[level];
      level = LEVELS_ARR[Math.min(idx + 1, 3)];
      if (!reasons.some((r) => r.includes('entity') || r.includes('Named'))) {
        reasons.push(`Specific claim about: ${entities.slice(0, 2).join(', ')}`);
      }
    } else if (entities.length && level !== 'none' && !reasons.length) {
      reasons.push(`Specific claim about: ${entities.slice(0, 2).join(', ')}`);
    } else if (entities.length && level === 'high' && hits.medium >= 1 && hits.high === 0) {
      reasons.unshift(`Named entity: ${entities[0]}`);
    }

    return { level, reasons, entities };
  }

  // ═══════════════════════════════════════════════════════════
  // CONTEXT-WINDOW BOOST — unchanged from v4.0
  // ═══════════════════════════════════════════════════════════

  function applyContextBoost(scored) {
    return scored.map((s, i) => {
      if (s.level === 'high') return s;

      const prevRank = i > 0               ? LEVEL_RANK[scored[i - 1].level] : 0;
      const nextRank = i < scored.length-1 ? LEVEL_RANK[scored[i + 1].level] : 0;
      const nbRank   = Math.max(prevRank, nextRank);

      if (nbRank > LEVEL_RANK[s.level] && nbRank >= 2) {
        return {
          ...s,
          level:   LEVELS_ARR[Math.min(LEVEL_RANK[s.level] + 1, 3)],
          reasons: [...s.reasons, 'Context: adjacent high-risk claim'],
        };
      }
      return s;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // DOM SKIP-ZONE CHECKER — unchanged from v4.0
  // ═══════════════════════════════════════════════════════════

  const SKIP_TAGS = new Set(['CODE', 'PRE', 'BLOCKQUOTE', 'MATH', 'SCRIPT', 'STYLE']);

  function isInSkipZone(node, rootEl) {
    let el = node.parentElement;
    while (el && el !== rootEl) {
      if (SKIP_TAGS.has(el.tagName)) return true;
      el = el.parentElement;
    }
    return false;
  }

  // ═══════════════════════════════════════════════════════════
  // TEXT NODE MAP — unchanged from v4.0
  // ═══════════════════════════════════════════════════════════

  function buildTextMap(el) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
    const nodes  = [];
    let combined = '';
    let node;

    while ((node = walker.nextNode())) {
      const t = node.textContent;
      if (!t || isInSkipZone(node, el)) continue;
      nodes.push({ node, start: combined.length, end: combined.length + t.length });
      combined += t;
    }

    return { combined, nodes };
  }

  // ═══════════════════════════════════════════════════════════
  // RANGE FINDER — unchanged from v4.0
  // ═══════════════════════════════════════════════════════════

  function findRange(sentence, textMap) {
    const { combined, nodes } = textMap;
    if (!nodes.length) return null;

    const anchor = sentence.replace(/\s+/g, ' ').substring(0, 40).trim();
    if (!anchor || anchor.length < 8) return null;

    let idx = combined.indexOf(anchor);
    if (idx === -1) {
      const normC = combined.replace(/\s+/g, ' ');
      const normA = anchor.replace(/\s+/g, ' ');
      idx = normC.indexOf(normA);
      if (idx === -1) return null;
    }

    const sentEnd = Math.min(idx + sentence.replace(/\s+/g, ' ').length, combined.length);
    let startNode, startOff, endNode, endOff;

    for (const p of nodes) {
      if (!startNode && idx >= p.start && idx < p.end) {
        startNode = p.node; startOff = idx - p.start;
      }
      if (!endNode && sentEnd > p.start && sentEnd <= p.end) {
        endNode = p.node; endOff = sentEnd - p.start;
      }
    }

    if (!endNode && nodes.length) {
      const last = nodes[nodes.length - 1];
      endNode = last.node; endOff = last.node.textContent.length;
    }

    if (!startNode || !endNode) return null;

    try {
      const range = document.createRange();
      range.setStart(startNode, Math.min(startOff, startNode.textContent.length));
      range.setEnd(endNode,     Math.min(endOff,   endNode.textContent.length));
      return range;
    } catch (_) { return null; }
  }

  // ═══════════════════════════════════════════════════════════
  // ANALYSIS CACHE — WeakMap, text-hash invalidation
  // ═══════════════════════════════════════════════════════════

  const _elCache = new WeakMap();

  function textHash(str) {
    return str.length + '|' + str.slice(0, 50) + '|' + str.slice(-30);
  }

  // ═══════════════════════════════════════════════════════════
  // OVERLAY ENGINE — unchanged from v4.0
  // ═══════════════════════════════════════════════════════════

  let overlayRoot  = null;
  let enabled      = true;
  let storedHighlights = [];
  let _rangeDivMap = new Map();
  let _rafPending  = false;
  let _resizeTimer = null;

  function ensureRoot() {
    if (overlayRoot && document.body.contains(overlayRoot)) return;
    overlayRoot = document.createElement('div');
    overlayRoot.id = 'cb-hl-root';
    overlayRoot.style.cssText = [
      'position:fixed','inset:0','pointer-events:none',
      'z-index:2147483640','overflow:visible',
    ].join(';');
    document.body.appendChild(overlayRoot);
  }

  function clearOverlays() {
    storedHighlights = [];
    _rangeDivMap = new Map();
    if (overlayRoot) overlayRoot.innerHTML = '';
  }

  function renderOverlays() {
    if (!overlayRoot) return;
    overlayRoot.innerHTML = '';
    _rangeDivMap = new Map();
    if (!enabled) return;

    for (const h of storedHighlights) {
      let rects;
      try { rects = h.range.getClientRects(); } catch (_) { continue; }

      const divs = [];
      for (const rect of rects) {
        if (rect.width < 2 || rect.height < 2) continue;
        const div = document.createElement('div');
        div.className = `cb-hl cb-hl-${h.level}`;
        div.style.cssText = `left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px`;
        div.title = h.reasons.join(' · ');
        overlayRoot.appendChild(div);
        divs.push(div);
      }
      if (divs.length) _rangeDivMap.set(h.range, divs);
    }
  }

  function _doReposition() {
    _rafPending = false;
    if (!overlayRoot || !enabled) return;

    for (const [range, divs] of _rangeDivMap) {
      let rects;
      try { rects = range.getClientRects(); } catch (_) { continue; }
      const valid = [...rects].filter((r) => r.width >= 2 && r.height >= 2);

      for (let i = 0; i < divs.length; i++) {
        if (i < valid.length) {
          const r = valid[i], d = divs[i];
          d.style.left = r.left + 'px'; d.style.top = r.top + 'px';
          d.style.width = r.width + 'px'; d.style.height = r.height + 'px';
          d.style.display = '';
        } else {
          divs[i].style.display = 'none';
        }
      }
    }
  }

  function scheduleReposition() {
    if (_rafPending) return;
    _rafPending = true;
    requestAnimationFrame(_doReposition);
  }

  window.addEventListener('scroll', scheduleReposition, { passive: true, capture: true });
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(renderOverlays, 150);
  }, { passive: true });

  // ═══════════════════════════════════════════════════════════
  // ANALYSIS ENGINE — unchanged pipeline, new internals
  // ═══════════════════════════════════════════════════════════

  function process(messages) {
    ensureRoot();
    storedHighlights = [];
    _rangeDivMap = new Map();
    if (overlayRoot) overlayRoot.innerHTML = '';

    const results = [];

    for (let msgIndex = 0; msgIndex < messages.length; msgIndex++) {
      const msg = messages[msgIndex];
      if (msg.role !== 'assistant')          continue;
      if (!msg.el)                            continue;
      if (!msg.text || msg.text.length < 30) continue;

      const hash   = textHash(msg.text);
      let   cached = _elCache.get(msg.el);

      if (!cached || cached.hash !== hash) {
        const sentences = splitSentences(msg.text);

        let scored = sentences.map((text) => {
          const { level, reasons, entities } = scoreSentence(text);
          return { text, level, reasons, entities };
        });

        scored = applyContextBoost(scored);

        const flagged     = scored.filter((s) => s.level !== 'none');
        const toHighlight = scored.filter((s) => HIGHLIGHT_LEVELS.has(s.level));
        const ranges      = [];

        if (toHighlight.length) {
          let textMap = null;
          try { textMap = buildTextMap(msg.el); } catch (_) {}

          if (textMap) {
            for (const s of toHighlight) {
              const range = findRange(s.text, textMap);
              if (range) ranges.push({ range, level: s.level, reasons: s.reasons });
            }
          }
        }

        cached = { hash, flagged, ranges };
        _elCache.set(msg.el, cached);
      }

      const { flagged, ranges } = cached;
      if (!flagged.length) continue;

      storedHighlights.push(...ranges);

      const msgLevel = flagged.reduce(
        (best, s) => LEVEL_RANK[s.level] > LEVEL_RANK[best] ? s.level : best,
        'none'
      );

      results.push({
        msgIndex,
        level:     msgLevel,
        count:     flagged.filter((s) => LEVEL_RANK[s.level] >= 2).length,
        sentences: flagged,
      });
    }

    renderOverlays();
    return results;
  }

  // ═══════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════

  window.CB_HALLUCINATION = {
    process,
    clearOverlays,
    setEnabled(val) { enabled = Boolean(val); renderOverlays(); },
    isEnabled()     { return enabled; },
  };

})();