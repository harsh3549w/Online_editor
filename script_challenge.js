// Extract from client/script.js for Challenge Analysis and Execution Sandbox

const CODE_API = 'http://localhost:5000/api/code';
const runBtn = document.getElementById('runBtn');
const languageSelect = document.getElementById('language');
const metricStatus = document.getElementById('metricStatus');
const metricTime = document.getElementById('metricTime');
const metricMemory = document.getElementById('metricMemory');
const metricComplexity = document.getElementById('metricComplexity');

// --- 1. COMPLEXITY ESTIMATOR (Challenge Analysis) ---

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripInlineComment(line, languageId) {
  const id = Number(languageId);
  const text = String(line || '');

  if (id === 70 || id === 71 || id === 72 || id === 46) {
    const hash = text.indexOf('#');
    return hash === -1 ? text : text.slice(0, hash);
  }

  const slash = text.indexOf('//');
  const hash = text.indexOf('#');
  let cut = -1;

  if (slash !== -1) cut = slash;
  if (hash !== -1 && (cut === -1 || hash < cut)) cut = hash;
  return cut === -1 ? text : text.slice(0, cut);
}

function getLoopRegex(languageId) {
  const id = Number(languageId);
  if (id === 70 || id === 71) return /^\s*(for|while)\b/;
  if (id === 46) return /^\s*(for|while|until)\b/;
  if (id === 72) return /(^\s*(for|while|until|loop)\b)|(\.each\s+do\b)|(\.times\s+do\b)/;
  if (id === 60) return /\bfor\b/;
  if (id === 73) return /(\bfor\s+.+\sin\b)|(\bwhile\b)|(\bloop\b)/;
  return /(\bfor\s*\()|(\bwhile\s*\()|(\bdo\b)|(\bforeach\s*\()|(\bfor\s+\w+\s+in\b)/;
}

function estimateIndentLoopDepth(sourceCode, languageId, loopRegex) {
  const lines = String(sourceCode || '').split('\n');
  const loopStack = [];
  let maxDepth = 0;

  lines.forEach((raw) => {
    const cleanedLine = stripInlineComment(raw, languageId);
    const trimmed = cleanedLine.trim();
    if (!trimmed) return;

    const spaces = cleanedLine.replace(/\t/g, '    ').match(/^\s*/)?.[0]?.length || 0;
    while (loopStack.length && spaces <= loopStack[loopStack.length - 1]) loopStack.pop();

    if (loopRegex.test(trimmed)) {
      loopStack.push(spaces);
      if (loopStack.length > maxDepth) maxDepth = loopStack.length;
    }
  });

  return maxDepth;
}

function estimateBraceLoopDepth(sourceCode, languageId, loopRegex) {
  const lines = String(sourceCode || '').split('\n');
  const loopDepthMarkers = [];
  let braceDepth = 0;
  let maxDepth = 0;

  lines.forEach((raw) => {
    const cleanedLine = stripInlineComment(raw, languageId);
    const trimmed = cleanedLine.trim();
    if (!trimmed) return;

    const closeCount = (cleanedLine.match(/}/g) || []).length;
    braceDepth = Math.max(0, braceDepth - closeCount);

    while (loopDepthMarkers.length && loopDepthMarkers[loopDepthMarkers.length - 1] > braceDepth) loopDepthMarkers.pop();

    if (loopRegex.test(trimmed)) {
      loopDepthMarkers.push(braceDepth + 1);
      if (loopDepthMarkers.length > maxDepth) maxDepth = loopDepthMarkers.length;
      if (!trimmed.includes('{')) loopDepthMarkers.pop();
    }

    const openCount = (cleanedLine.match(/{/g) || []).length;
    braceDepth += openCount;
  });

  return maxDepth;
}

function detectRecursionFeatures(sourceCode) {
  const code = String(sourceCode || '');
  const names = new Set();
  const reservedNames = new Set(['if', 'for', 'while', 'switch', 'catch', 'else', 'do', 'try', 'class', 'def', 'function', 'return']);

  const definitionPatterns = [
    /\bdef\s+([A-Za-z_]\w*)\s*\(/g,
    /\bfunction\s+([A-Za-z_$]\w*)\s*\(/g,
    /\b([A-Za-z_$]\w*)\s*=\s*\([^)]*\)\s*=>/g,
    /\b([A-Za-z_$]\w*)\s*=\s*function\s*\(/g,
    /\b([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g
  ];

  definitionPatterns.forEach((pattern) => {
    let match = pattern.exec(code);
    while (match) {
      const name = match[1];
      if (name && !reservedNames.has(name)) names.add(name);
      match = pattern.exec(code);
    }
  });

  let hasRecursion = false;
  let hasBranchingRecursion = false;

  names.forEach((name) => {
    const callRegex = new RegExp(`\\b${escapeRegex(name)}\\s*\\(`, 'g');
    const callCount = (code.match(callRegex) || []).length;

    if (callCount >= 2) hasRecursion = true;
    if (callCount >= 3) hasBranchingRecursion = true;
  });

  return { hasRecursion, hasBranchingRecursion };
}

function estimateTimeComplexity(sourceCode, languageId) {
  const code = String(sourceCode || '');
  if (!code.trim()) return { bigO: 'O(?)', hint: 'Add code to estimate complexity.' };

  const loopRegex = getLoopRegex(languageId);
  const id = Number(languageId);
  const usesIndentation = id === 70 || id === 71 || id === 72 || id === 46;
  const loopDepth = usesIndentation ? estimateIndentLoopDepth(code, languageId, loopRegex) : estimateBraceLoopDepth(code, languageId, loopRegex);

  const recursion = detectRecursionFeatures(code);
  const hasSortLike = /(\.sort\s*\()|(\bsorted\s*\()/i.test(code);
  const hasHalvingPattern = /(>>\s*1)|(\/\s*2\b)|(\/\/\s*2\b)|(\/=\s*2\b)|(>>=)/.test(code);

  let bigO = 'O(1)';
  if (recursion.hasBranchingRecursion) bigO = 'O(2^n)';
  else if (hasSortLike && loopDepth <= 1) bigO = 'O(n log n)';
  else if (loopDepth === 0) {
    if (recursion.hasRecursion) bigO = 'O(n)';
    else if (hasHalvingPattern) bigO = 'O(log n)';
    else bigO = 'O(1)';
  } else if (loopDepth === 1) bigO = hasHalvingPattern ? 'O(n log n)' : 'O(n)';
  else if (loopDepth === 2) bigO = 'O(n^2)';
  else if (loopDepth === 3) bigO = 'O(n^3)';
  else bigO = `O(n^${loopDepth})`;

  return { bigO };
}

function updateComplexityMetricFromSource(source, languageId) {
  if (metricComplexity) {
    const estimate = estimateTimeComplexity(source, languageId);
    metricComplexity.textContent = estimate.bigO;
  }
}

// --- 2. SANDBOXED EXECUTION (Sending Code to Engine) ---

function getSourceCode() {
  if (window.sourceEditor) return window.sourceEditor.getValue();
  return document.getElementById('sourceCode')?.value || '';
}

function getStdinValue() {
  // Uses Stdin Sandbox views (Line Builder or Terminal mode mappings)
  return document.getElementById('stdin')?.value || '';
}

function formatResult(result) {
  const status = result?.status?.description || 'Unknown';
  return `Status: ${status}\nTime: ${result.time}s\nMemory: ${result.memory} KB\n\nSTDOUT:\n${result.stdout || ''}\nSTDERR:\n${result.stderr || ''}\nCOMPILE OUTPUT:\n${result.compile_output || ''}\nMESSAGE:\n${result.message || ''}`;
}

if (runBtn) {
  runBtn.addEventListener('click', async () => {
    const payload = {
      source_code: getSourceCode(),
      language_id: Number(languageSelect.value),
      stdin: getStdinValue()
    };

    if (!payload.source_code.trim()) return;

    updateComplexityMetricFromSource(payload.source_code, payload.language_id);
    runBtn.disabled = true;

    try {
      const response = await fetch(`${CODE_API}/execute`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json' 
            // In prod: Authorization: Bearer <token>
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result?.message || 'Execution request failed.');

      document.getElementById('output').textContent = formatResult(result);
    } catch (error) {
      document.getElementById('output').textContent = `Execution failed.\n${error.message}`;
    } finally {
      runBtn.disabled = false;
    }
  });
}
