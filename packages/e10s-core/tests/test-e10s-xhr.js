// This is mostly just test-xhr.js from jetpack-core.

var xhr = require("xhr");

exports.testLocalXhr = function(test) {
  var req = new xhr.XMLHttpRequest();
  req.overrideMimeType("text/plain");
  req.open("GET", __url__);
  req.onreadystatechange = function() {
    if (req.readyState == 4 && req.status == 0) {
      test.assertMatches(req.responseText,
                         /onreadystatechange/,
                         "XMLHttpRequest should get local files");
      test.done();
    }
  };
  req.send(null);
  test.waitUntilDone(4000);
};

exports.testDelegatedReturns = function(test) {
  var req = new xhr.XMLHttpRequest();
  req.overrideMimeType("text/plain");
  req.open("GET", __url__);
  req.onreadystatechange = function() {
    if (req.readyState == 4 && req.status == 0) {
      // This response isn't going to have any headers, so the return value
      // should be null. Previously it wasn't returning anything, and thus was
      // undefined.
      test.assert(req.getAllResponseHeaders() === null,
                  "XHR's delegated methods should return");
      test.done();
    }
  };
  req.send(null);
  test.waitUntilDone(4000);
};
