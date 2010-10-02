exports.testTestMethods = function testTestMethods(test) {
  test.assert(true, "test.assert() works");
  test.assertEqual("one", "one", "test.assertEqual() works");
  test.assertRaises(function() { o(); },
                    /o is not defined/,
                    "test.assertRaises() works");
  test.assertNotEqual("one", "two", "test.assertNotEqual works");
  test.assertMatches("one", /o/, "test.assertMatches works");
  test.pass("test.pass() works");
};

exports.testAsync = function testAsync(test) {
  require("timer").setTimeout(function() {
    test.pass("asynchronous tests work");
    test.done();
  }, 10);
  test.waitUntilDone();
};
