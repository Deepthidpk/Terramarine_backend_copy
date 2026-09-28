const https = require('https');

async function callGenerativeAI(prompt, researcherName, liveData) {
  const systemPrompt = `You are Octo (🐙), an intelligent, conversational AI marine environmental and scientific research assistant for the TerraMarine platform (working just like ChatGPT / Gemini).
You are currently interacting with ${researcherName} (a marine scientist / researcher).

Key Guidelines:
1. Always address ${researcherName} directly and naturally.
2. Directly answer the user's specific prompt or message. Do NOT give irrelevant data dumps.
3. If ${researcherName} says they are in trouble, in danger, or need help:
   - Show empathy and ask for details.
   - If it sounds like a maritime emergency, provide key emergency contacts (Indian Coast Guard: 1554 / 0484-2210100, Coastal Police: 1093, Emergency: 112).
   - If it's a platform/technical issue, offer step-by-step assistance.
4. Use clean Markdown formatting with bullet points, bold highlights, tables, and chemical/mathematical formulas ($CO_2 + H_2O \\rightleftharpoons H_2CO_3$) where appropriate.
5. If the inquiry relates to coastal telemetry, you have access to live Kerala platform data:
   - Mean Seawater pH: ${liveData.avgPh}
   - Mean Turbidity: ${liveData.avgTurb} NTU
   - Seawater Temp: ${liveData.avgTemp} °C
   - Pollution Records: ${liveData.pollutionCount} incidents
   - Biodiversity: ${liveData.bioCount} field observations.`;

  const payload = JSON.stringify({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    model: 'openai',
    seed: 42
  });

  return new Promise((resolve, reject) => {
    const req = https.request('https://text.pollinations.ai/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 && data.trim()) {
          resolve(data.trim());
        } else {
          reject(new Error(`AI HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('AI request timed out'));
    });

    req.write(payload);
    req.end();
  });
}

async function runTests() {
  const liveData = { avgPh: '7.68', avgTurb: '18.4', avgTemp: '28.5', pollutionCount: 18, bioCount: 1 };
  
  console.log('--- Test 1: "i\'m in a trouble" ---');
  const res1 = await callGenerativeAI("i'm in a trouble", "Aradhya", liveData);
  console.log(res1);

  console.log('\n--- Test 2: "what is aragonite saturation?" ---');
  const res2 = await callGenerativeAI("what is aragonite saturation?", "Aradhya", liveData);
  console.log(res2.slice(0, 300));
}

runTests().catch(console.error);
