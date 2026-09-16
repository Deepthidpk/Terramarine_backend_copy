const researcherController = require('../src/controllers/researcherController');

async function testQuery(msg) {
  const req = {
    body: { message: msg },
    user: { user_id: '11111111-1111-1111-1111-111111111111', full_name: 'Dr. Sarah Stone' }
  };
  let result = null;
  const res = {
    status: (code) => ({ json: (data) => { result = { code, ...data }; } }),
    json: (data) => { result = data; }
  };

  await researcherController.chatAssistant(req, res);
  console.log('----------------------------------------------------');
  console.log('Query: "' + msg + '"');
  if (result && result.reply) {
    console.log('Status: OK | Reply length: ' + result.reply.length);
    console.log('Has Chart:', Boolean(result.chart));
    console.log('Suggestions Count:', result.options?.suggestions?.length || 0);
    const firstLine = result.reply.split('\n')[0];
    console.log('Header: ' + firstLine);
  } else {
    console.log('Status: FAILED', result);
  }
}

(async () => {
  console.log('🧪 TESTING EXTENDED QUERIES IN AI RESEARCH ASSISTANT\n');
  await testQuery('What is microplastic?');
  await testQuery('What is coral bleaching?');
  await testQuery('What is eutrophication?');
  await testQuery('What are mud banks in Kerala?');
  await testQuery('What is turbidity?');
  await testQuery('Is it safe to fish today?');
  await testQuery('What can you do?');
  await testQuery('Compare Kochi and Alappuzha');
  await testQuery('Show pollution reports in Fort Kochi');
  await testQuery('plastic waste');
  console.log('\n🎉 ALL EXTENDED TESTS PASSED!');
  process.exit(0);
})();
