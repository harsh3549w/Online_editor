
const axios = require('axios');

const JUDGE0_BASE_URL = process.env.JUDGE0_BASE_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST;

function getJudge0Headers() {
  const headers = { 'Content-Type': 'application/json' };

  if (JUDGE0_API_KEY && JUDGE0_API_HOST) {
    headers['x-rapidapi-key'] = JUDGE0_API_KEY;
    headers['x-rapidapi-host'] = JUDGE0_API_HOST;
  }

  return headers;
}

function createPythonVisualizerScript(sourceCode, stdinText) {
  const userCodeLiteral = JSON.stringify(sourceCode || '');
  const stdinLiteral = JSON.stringify(stdinText || '');

  return `
import builtins
import io
import json
import linecache
import sys
import traceback

USER_CODE = ${userCodeLiteral}
INPUT_DATA = ${stdinLiteral}
MAX_STEPS = 2000

steps = []
step_limit_hit = False
runtime_error = None

def safe_repr(value):
    try:
        text = repr(value)
    except Exception:
        text = "<unrepresentable>"
    if len(text) > 180:
        return text[:177] + "..."
    return text

def tracer(frame, event, arg):
    global step_limit_hit
    if frame.f_code.co_filename != "<user_code>":
        return tracer

    if event == "line":
        if len(steps) >= MAX_STEPS:
            step_limit_hit = True
            return None

        line_no = frame.f_lineno
        line_text = linecache.getline("<user_code>", line_no).rstrip("\\n")
        locals_snapshot = {}

        for key, value in frame.f_locals.items():
            if key.startswith("__"):
                continue
            locals_snapshot[key] = safe_repr(value)

        steps.append({
            "line": line_no,
            "code": line_text,
            "locals": locals_snapshot
        })

    return tracer

linecache.cache["<user_code>"] = (
    len(USER_CODE),
    None,
    [ln + "\\n" for ln in USER_CODE.splitlines()],
    "<user_code>"
)

input_iter = iter(INPUT_DATA.splitlines())
original_input = builtins.input

def patched_input(prompt=""):
    try:
        return next(input_iter)
    except StopIteration:
        return ""

builtins.input = patched_input

original_stdout = sys.stdout
captured_stdout = io.StringIO()
sys.stdout = captured_stdout

exec_scope = {"__name__": "__main__"}

try:
    sys.settrace(tracer)
    exec(compile(USER_CODE, "<user_code>", "exec"), exec_scope, exec_scope)
except Exception:
    runtime_error = traceback.format_exc()
finally:
    sys.settrace(None)
    builtins.input = original_input
    sys.stdout = original_stdout

result_payload = {
    "steps": steps,
    "error": runtime_error,
    "user_output": captured_stdout.getvalue(),
    "step_limit_hit": step_limit_hit
}

print("___VISUALIZER_JSON_START___")
print(json.dumps(result_payload))
print("___VISUALIZER_JSON_END___")
`;
}

function extractVisualizerPayload(stdoutText) {
  const startMarker = '___VISUALIZER_JSON_START___';
  const endMarker = '___VISUALIZER_JSON_END___';

  if (!stdoutText || typeof stdoutText !== 'string') {
    return null;
  }

  const startIdx = stdoutText.indexOf(startMarker);
  const endIdx = stdoutText.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }

  const jsonText = stdoutText
    .slice(startIdx + startMarker.length, endIdx)
    .trim();

  try {
    return JSON.parse(jsonText);
  } catch {
    return null;
  }
}

async function pollSubmission(token, maxAttempts = 15, delayMs = 1000) {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const response = await axios.get(
      `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=false`,
      { headers: getJudge0Headers() }
    );

    const result = response.data;
    const statusId = result?.status?.id;

    if (statusId !== 1 && statusId !== 2) {
      return result;
    }

    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempts += 1;
  }

  throw new Error('Execution timed out while waiting for Judge0 response.');
}

// Visualizer API route mapping functionality
/*
app.post('/api/code/visualize', verifyToken, async (req, res) => {
  try {
    const { source_code, stdin } = req.body;

    if (!source_code) {
      return res.status(400).json({ message: 'source_code is required.' });
    }

    const visualizerScript = createPythonVisualizerScript(source_code, stdin || '');

    const submitResponse = await axios.post(
      `${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`,
      {
        source_code: visualizerScript,
        language_id: 71,
        stdin: '',
        memory_limit: 1024000,
        cpu_time_limit: 10,
        wall_time_limit: 20,
        enable_per_process_and_thread_time_limit: true,
        enable_per_process_and_thread_memory_limit: true
      },
      { headers: getJudge0Headers() }
    );

    const token = submitResponse.data?.token;
    if (!token) {
      return res.status(502).json({ message: 'No token received from Judge0.' });
    }

    const executionResult = await pollSubmission(token);

    const parsed = extractVisualizerPayload(executionResult.stdout || '');
    if (!parsed) {
      return res.status(500).json({
        message: 'Failed to parse visualizer output.',
        details: {
          status: executionResult.status,
          stderr: executionResult.stderr,
          compile_output: executionResult.compile_output
        }
      });
    }

    return res.json({
      token,
      status: executionResult.status,
      steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      error: parsed.error || null,
      user_output: parsed.user_output || '',
      step_limit_hit: Boolean(parsed.step_limit_hit)
    });
  } catch (error) {
    const upstreamData = error.response?.data;
    return res.status(500).json({
      message: 'Code visualization failed.',
      error: upstreamData || error.message
    });
  }
});
*/
