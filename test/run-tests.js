const suites = [
  ...require('./api.test.js'),
  ...require('./accept.test.js'),
];

let failed = 0;

for (const suite of suites) {
  try {
    suite.run();
    console.log(`PASS ${suite.name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${suite.name}`);
    console.error(error.stack);
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed.`);
  process.exit(1);
}

console.log(`\n${suites.length} test(s) passed.`);
