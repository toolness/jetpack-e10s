if (this.sendMessage) {
  var timer = require("timer");
  var ut = require("e10s-unit-test");

  registerReceiver(
    "runTest",
    function(name, test) {
      var runner = new ut.TestRunner();
      runner.start({
        test: test.testHandle,
        onDone: function() {
          test.passed = runner.test.passed;
          test.failed = runner.test.failed;
          test.errors = runner.test.errors;
          sendMessage("testDone", test);
        }
      });
    });
    
  exports.main = function(options, callbacks) {
    function makeTest(suite, name, test) {
      return function runTest(runner) {
        console.info("executing '" + suite + "." + name + "' remotely");
        test(runner);
      };
    }

    var tests = [];

    options.suites.forEach(function(suite) {
      var module = require(suite);
      for (testName in module) {
        var handle = createHandle();
        handle.testFunction = makeTest(suite, testName, module[testName]);
        handle.name = suite + "." + testName;
        tests.push({testHandle: handle, name: handle.name});
      }
    });
    sendMessage("testsFound", tests, options.finderHandle);
  }
} else {
  exports.register = function(process) {
    process.registerReceiver("testDone", function(name, remoteTest) {
      var runner = remoteTest.testHandle.runner;
      runner.passed += remoteTest.passed;
      runner.failed += remoteTest.failed;
      runner.test.passed = remoteTest.passed;
      runner.test.failed = remoteTest.failed;
      runner.test.errors = remoteTest.errors;
      runner.done();
    });
    process.registerReceiver("testPass", function(name, remoteTest, msg) {
      remoteTest.testHandle.runner.pass(msg);
    });
    process.registerReceiver("testFail", function(name, remoteTest, msg) {
      remoteTest.testHandle.runner.fail(msg);
    });
    process.registerReceiver("testsFound", function(name, remoteTests,
                                                    finderHandle) {
      var tests = [];
      remoteTests.forEach(function(remoteTest) {
        tests.push({
          testFunction: function(runner) {
            remoteTest.testHandle.runner = runner;
            runner.waitUntilDone();
            process.sendMessage("runTest", remoteTest);
          },
          name: remoteTest.name
        });
      });
      finderHandle.onTestsFound(tests);
    });
  };
}
