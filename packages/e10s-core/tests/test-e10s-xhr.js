var xhr = require("xhr");

exports.testXhr = function(test) {
  var req = new xhr.XMLHttpRequest();
  req.open('GET', 'http://gwegpaoewngonpge.mozilla.org/');
  req.onreadystatechange = function() {
    if (req.readyState != 4)
      return;
    test.pass("xhr can be sent");
    test.done();
  };
  req.send(null);
  test.waitUntilDone();
};
