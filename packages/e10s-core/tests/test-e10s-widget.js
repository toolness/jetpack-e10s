var widget = require("widget");

exports.testWidget = function(test) {
  widget.add(new widget.Widget({
    label: "testing",
    content: "Click me",
    onClick: function() {}
  }));
  test.pass("Widget can be created.");
};
