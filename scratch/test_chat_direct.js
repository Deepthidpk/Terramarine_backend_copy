const db = require('../src/config/db');
const researcherController = require('../src/controllers/researcherController');

async function test() {
  try {
    const userRes = await db.query("SELECT * FROM users WHERE role = 'Researcher' LIMIT 1");
    const u = userRes.rows[0];
    console.log('Testing with researcher:', u.full_name, `(${u.email})`);

    const mockReq = (msg) => ({
      body: { message: msg },
      user: {
        user_id: u.user_id,
        role: u.role,
        full_name: u.full_name,
        name: u.full_name
      }
    });

    const runQuery = async (query) => {
      console.log(`\n======================================================`);
      console.log(`QUERY: "${query}"`);
      console.log(`======================================================`);
      await new Promise((resolve) => {
        const req = mockReq(query);
        const res = {
          status: (code) => ({
            json: (data) => {
              console.log(`Response status ${code}:`, data);
              resolve();
            }
          }),
          json: (data) => {
            console.log(`\nAI Assistant Response:\n${data.reply}`);
            if (data.chart) console.log('\nChart type:', data.chart.type);
            if (data.options?.suggestions) console.log('Suggestions:', data.options.suggestions);
            resolve();
          }
        };
        researcherController.chatAssistant(req, res);
      });
    };

    await runQuery('hi');
    await runQuery('how are you today?');
    await runQuery('what is ocean acidification?');
    await runQuery('can you help me design a research project on microplastics in backwaters?');
    await runQuery('compare pH between Kochi and Alappuzha');

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}
test();
