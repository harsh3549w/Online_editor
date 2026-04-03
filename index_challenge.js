

const axios = require('axios');

const JUDGE0_BASE_URL = process.env.JUDGE0_BASE_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;
const JUDGE0_API_HOST = process.env.JUDGE0_API_HOST;

// Headers required for accessing the Challenge Compiler (Judge0)
function getJudge0Headers() {
  const headers = { 'Content-Type': 'application/json' };
  if (JUDGE0_API_KEY && JUDGE0_API_HOST) {
    headers['x-rapidapi-key'] = JUDGE0_API_KEY;
    headers['x-rapidapi-host'] = JUDGE0_API_HOST;
  }
  return headers;
}

// Polling mechanic used for Challenge test case evaluation wait times.
async function pollSubmission(token, maxAttempts = 15, delayMs = 1000) {
  let attempts = 0;
  while (attempts < maxAttempts) {
    const response = await axios.get(
      `${JUDGE0_BASE_URL}/submissions/${token}?base64_encoded=false`,
      { headers: getJudge0Headers() }
    );
    const result = response.data;
    const statusId = result?.status?.id;

    // Status 1 = In Queue, 2 = Processing
    if (statusId !== 1 && statusId !== 2) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    attempts += 1;
  }
  throw new Error('Execution timed out while waiting for Judge0 response.');
}

/*
// Express JS Routes Implementation - Challenge evaluation endpoints

app.get('/api/code/languages', verifyToken, async (req, res) => {
  try {
    let languageList = [];
    try {
      const responseAll = await axios.get(`${JUDGE0_BASE_URL}/languages/all`, { headers: getJudge0Headers() });
      languageList = Array.isArray(responseAll.data) ? responseAll.data : [];
    } catch (allError) {
      const response = await axios.get(`${JUDGE0_BASE_URL}/languages`, { headers: getJudge0Headers() });
      languageList = Array.isArray(response.data) ? response.data : [];
    }
    languageList.sort((a, b) => Number(a.id) - Number(b.id));
    return res.json(languageList);
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch languages.', error: error.message });
  }
});

app.post('/api/code/execute', verifyToken, async (req, res) => {
  try {
    const { source_code, language_id, stdin } = req.body;
    if (!source_code || !language_id) return res.status(400).json({ message: 'source_code and language_id are required.' });

    const submissionPayload = {
      source_code,
      language_id,
      stdin: stdin || '',
      memory_limit: 1024000,
      cpu_time_limit: 10,
      wall_time_limit: 20,
      enable_per_process_and_thread_time_limit: true,
      enable_per_process_and_thread_memory_limit: true
    };

    // Kotlin adjustments mimicking coding challenge architecture
    if (Number(language_id) === 78) {
      submissionPayload.memory_limit = 4096000;
      submissionPayload.compiler_options = '-J-Xms128m -J-Xmx768m -J-Xss256k -J-XX:MaxMetaspaceSize=512m -J-XX:CompressedClassSpaceSize=128m -J-XX:ActiveProcessorCount=2 -J-XX:CICompilerCount=2';
    }

    const submitResponse = await axios.post(`${JUDGE0_BASE_URL}/submissions?base64_encoded=false&wait=false`, submissionPayload, { headers: getJudge0Headers() });
    const token = submitResponse.data?.token;

    if (!token) return res.status(502).json({ message: 'No token received from Judge0.' });

    const executionResult = await pollSubmission(token);
    return res.json({ token, ...executionResult });
  } catch (error) {
    return res.status(500).json({ message: 'Code execution failed.', error: error.message });
  }
});
*/
