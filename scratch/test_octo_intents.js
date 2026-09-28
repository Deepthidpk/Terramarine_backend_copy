const { chatAssistant } = require('../src/controllers/researcherController');

// Test queries
const queries = [
  "i'm in a trouble",
  "i am in trouble",
  "who are you?",
  "how do i upload a dataset?",
  "write a python script to load sensor readings",
  "what causes coral bleaching?",
  "tell me about kerala mud banks",
  "compare pH between Kochi and Alappuzha"
];

// Mock req and res
async function run() {
  for (const q of queries) {
    console.log(`\n======================================================`);
    console.log(`QUERY: "${q}"`);
    console.log(`======================================================`);

    const req = {
      body: { message: q },
      user: { user_id: '7bfe70a9-aa2e-4828-ad6d-581e4273ab49', full_name: 'Aradhya' }
    };

    let responseData = null;
    const res = {
      json: (data) => { responseData = data; return res; },
      status: (code) => { console.log('HTTP Status:', code); return res; }
    };

    await chatAssistant(req, res);
    console.log(responseData?.reply?.slice(0, 300) + '...\n');
  }
}

run().catch(console.error);
