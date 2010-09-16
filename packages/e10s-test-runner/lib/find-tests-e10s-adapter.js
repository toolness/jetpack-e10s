if (this.sendMessage) {
  var timer = require("timer");
  var ut = require("e10s-unit-test");

  registerReceiver(
    "runTest",
    function(name, test) {
      function onDone() {
        sendMessage("testDone", test);
      }
      
      var runner = {
        waitTimeout: null,
        extend: function extend(mixIn) {
          for (name in mixIn) {
            this[name] = mixIn[name];
          }
        },
        pass: function pass(msg) {
          sendMessage("testPass", test, msg);
        },
        fail: function fail(msg) {
          sendMessage("testFail", test, msg);
        },
        waitUntilDone: function waitUntilDone(ms) {
          if (ms === undefined)
            ms = ut.TestRunner.prototype.DEFAULT_PAUSE_TIMEOUT;
          var self = this;
          this.waitTimeout = timer.setTimeout(function() {
            self.fail("timed out");
            self.done();
          }, ms);
        },
        done: function done() {
          timer.clearTimeout(this.waitTimeout);
          this.waitTimeout = null;
          onDone();
        }
      };
      runner.extend(new ut.AssertionMixIn());
      test.testHandle.testFunction(runner);
      if (runner.waitTimeout == null)
        onDone();
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
