// Set up our "proxy" objects that just send messages to our parent
// process to do the real work.

var global = this;

var console = {
  log: function console_log(msg) {
    sendMessage('console:log', "" + msg);
  }
};
console.info = console.log;

function require(name) {
  var response = callMessage("require", name)[0];
  switch (response.code) {
  case "not-found":
    throw new Error("Unknown module '" + name + "'.");
  case "access-denied":
    throw new Error("Module '" + name + "' requires chrome privileges " +
                    "and has no e10s adapter.");
  case "error":
    throw new Error("An unexpected error occurred in the chrome " +
                    "process.");
  case "ok":
    break;
  default:
    throw new Error("Internal error: unknown response code '" +
                    response.code + "'");
  };

  var module = createSandbox();

  // Set up the globals of the sandbox.
  module.exports = {};
  module.console = console;
  module.require = require;

  if (response.needsMessaging)
    ["registerReceiver",
     "createHandle",
     "sendMessage",
     "callMessage"].forEach(
       function(name) {
         module[name] = global[name];
       });

  evalInSandbox(module, '//@line 1 "' + response.script.filename + 
                '"\n' + response.script.contents);

  return module.exports;
};

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

registerReceiver(
  "findTests",
  function(name, suites) {
    function makeTest(suite, name, test) {
      return function runTest(runner) {
        console.info("executing '" + suite + "." + name + "'");
        test(runner);
      };
    }

    var tests = [];

    suites.forEach(function(suite) {
      var module = require(suite);
      for (testName in module) {
        var handle = createHandle();
        handle.testFunction = makeTest(suite, testName, module[testName]);
        tests.push({testHandle: handle, name: suite + "." + name});
      }
    });
    sendMessage("testsFound", tests);
  });

registerReceiver(
  "startMain",
  function(name, mainName) {
    var main = require(mainName);

    if ('main' in main)
      main.main();
  });
