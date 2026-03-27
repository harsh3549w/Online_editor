// Extract from client/script.js for visualizer processing

const CODE_API = 'http://localhost:5000/api/code';
const visualizeBtn = document.getElementById('visualizeBtn');
const visualizerModal = document.getElementById('visualizerModal');
const closeVisualizerBtn = document.getElementById('closeVisualizerBtn');
const vizPrevBtn = document.getElementById('vizPrevBtn');
const vizNextBtn = document.getElementById('vizNextBtn');
const vizStepIndicator = document.getElementById('vizStepIndicator');
const vizCurrentLine = document.getElementById('vizCurrentLine');
const vizLocals = document.getElementById('vizLocals');
const vizCodeView = document.getElementById('vizCodeView');
const vizFooter = document.getElementById('vizFooter');
const vizError = document.getElementById('vizError');
const vizOutput = document.getElementById('vizOutput');

let visualizerCodeEditor = null;
let visualizerActiveLine = null;

const visualizerState = {
  steps: [],
  index: 0,
  sourceLines: [],
  error: '',
  userOutput: '',
  stepLimitHit: false
};

function formatLocals(localsObj) {
  const entries = Object.entries(localsObj || {});
  if (!entries.length) {
    return 'No local variables in this step.';
  }

  return entries
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key} = ${value}`)
    .join('\n');
}

function initVisualizerCodeEditor() {
  if (!window.CodeMirror || !vizCodeView || visualizerCodeEditor) {
    return;
  }

  visualizerCodeEditor = window.CodeMirror.fromTextArea(vizCodeView, {
    mode: 'python',
    theme: 'neo',
    lineNumbers: true,
    readOnly: true,
    lineWrapping: false,
    viewportMargin: Infinity
  });

  visualizerCodeEditor.getWrapperElement().classList.add('viz-codemirror');
}

function renderCodeView() {
  const codeText = visualizerState.sourceLines.join('\n') || 'No code loaded.';
  const activeLine = visualizerState.steps[visualizerState.index]?.line;

  if (!visualizerCodeEditor) {
    vizCodeView.value = codeText;
    return;
  }

  if (visualizerCodeEditor.getValue() !== codeText) {
    visualizerCodeEditor.setValue(codeText);
  }

  visualizerCodeEditor.setOption('mode', 'python');

  if (visualizerActiveLine !== null) {
    visualizerCodeEditor.removeLineClass(visualizerActiveLine, 'background', 'viz-active-line');
    visualizerActiveLine = null;
  }

  if (Number.isInteger(activeLine) && activeLine > 0 && activeLine <= visualizerCodeEditor.lineCount()) {
    visualizerActiveLine = activeLine - 1;
    visualizerCodeEditor.addLineClass(visualizerActiveLine, 'background', 'viz-active-line');
    visualizerCodeEditor.scrollIntoView({ line: visualizerActiveLine, ch: 0 }, 90);
  }
}

function renderVisualizer() {
  const total = visualizerState.steps.length;

  vizStepIndicator.textContent = `Step ${total ? visualizerState.index + 1 : 0} / ${total}`;
  vizPrevBtn.disabled = visualizerState.index <= 0;
  vizNextBtn.disabled = total === 0 || visualizerState.index >= total - 1;

  if (!total) {
    vizCurrentLine.textContent = 'No execution steps captured.';
    vizLocals.textContent = 'No local variables in this step.';
  } else {
    const step = visualizerState.steps[visualizerState.index];
    vizCurrentLine.textContent = `Line ${step.line}: ${step.code || ''}`;
    vizLocals.textContent = formatLocals(step.locals);
  }

  renderCodeView();

  const errorTextParts = [];
  if (visualizerState.error) {
    errorTextParts.push(`Runtime Error:\n${visualizerState.error}`);
  }
  if (visualizerState.stepLimitHit) {
    errorTextParts.push('Step limit reached. Showing first 2000 steps only.');
  }

  if (errorTextParts.length) {
    vizError.classList.remove('hidden');
    vizError.textContent = errorTextParts.join('\n\n');
  } else {
    vizError.classList.add('hidden');
    vizError.textContent = '';
  }

  if (visualizerState.userOutput) {
    vizOutput.classList.remove('hidden');
    vizOutput.textContent = `Program Output:\n${visualizerState.userOutput}`;
  } else {
    vizOutput.classList.add('hidden');
    vizOutput.textContent = '';
  }

  const showFooter = errorTextParts.length > 0 || Boolean(visualizerState.userOutput);
  vizFooter.classList.toggle('hidden', !showFooter);
}

function resetVisualizerState() {
  visualizerState.steps = [];
  visualizerState.index = 0;
  visualizerState.sourceLines = getSourceCode().split('\n');
  visualizerState.error = '';
  visualizerState.userOutput = '';
  visualizerState.stepLimitHit = false;
  renderVisualizer();
}

async function openVisualizer() {
  const code = getSourceCode(); // Normally returns editor value
  
  visualizeBtn.disabled = true;

  try {
    const response = await fetch(`${CODE_API}/visualize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Add authHeaders(true) here in full project
      },
      body: JSON.stringify({
        source_code: code,
        stdin: getStdinValue() // Normally gets stdin terminal/raw input
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result?.message || 'Failed to generate step visualization.');
    }

    visualizerState.steps = Array.isArray(result.steps) ? result.steps : [];
    visualizerState.index = 0;
    visualizerState.sourceLines = code.split('\n');
    visualizerState.error = result.error || '';
    visualizerState.userOutput = result.user_output || '';
    visualizerState.stepLimitHit = Boolean(result.step_limit_hit);

    visualizerModal.classList.remove('hidden');
    visualizerModal.setAttribute('aria-hidden', 'false');
    if (visualizerCodeEditor) {
      setTimeout(() => visualizerCodeEditor.refresh(), 0);
    }
    renderVisualizer();
  } catch (error) {
    console.error(error.message);
  } finally {
    visualizeBtn.disabled = false;
  }
}

function closeVisualizer() {
  visualizerModal.classList.add('hidden');
  visualizerModal.setAttribute('aria-hidden', 'true');
}

// Event Listeners
if (visualizeBtn) {
  visualizeBtn.addEventListener('click', openVisualizer);
}

if (closeVisualizerBtn) {
  closeVisualizerBtn.addEventListener('click', closeVisualizer);
}

if (vizPrevBtn) {
  vizPrevBtn.addEventListener('click', () => {
    if (visualizerState.index > 0) {
      visualizerState.index -= 1;
      renderVisualizer();
    }
  });
}

if (vizNextBtn) {
  vizNextBtn.addEventListener('click', () => {
    if (visualizerState.index < visualizerState.steps.length - 1) {
      visualizerState.index += 1;
      renderVisualizer();
    }
  });
}

if (visualizerModal) {
  visualizerModal.addEventListener('click', (event) => {
    if (event.target === visualizerModal) {
      closeVisualizer();
    }
  });
}

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && visualizerModal && !visualizerModal.classList.contains('hidden')) {
    closeVisualizer();
  }
});
