if (this.sendMessage) {
  registerReceiver(
    "runTest",
    function(name, test) {
      var runner = {
        pass: function pass(msg) {
          sendMessage("testPass", test, msg);
        },
        fail: function fail(msg) {
          sendMessage("testFail", test, msg);
        }
      };
      test.testHandle.testFunction(runner);
      sendMessage("testDone", test);
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
        tests.push({testHandle: handle, name: suite + "." + testName});
      }
    });
    sendMessage("testsFound", tests, options.finderHandle);
  }
} else {
  exports.register = function(process) {
    process.registerReceiver("testDone", function(name, remoteTest) {
      remoteTest.testHandle.runner.done();
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
