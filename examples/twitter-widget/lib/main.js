// This is the main script of a Jetpack-based add-on.

const widget = require("widget");

exports.main = function() {
  console.log("Addon main function");
  var options = {
    label: "Click me!",
    content: "Click me!",
    onClick: function() {
      var self = this;
      self.content = "...";
      var xhr = require("xhr");
      console.log("Widget clicked");
      var req = new xhr.XMLHttpRequest();
      var url = ("http://api.twitter.com/1/users/show.json?" +
                 "screen_name=toolness");
      req.open("GET", url, false);
      req.send(null);
      if (req.status == 200) {
        console.log("Data received: " + req.responseText.length +
                    " bytes");
        self.content = JSON.parse(req.responseText).status.text;
      } else {
        console.log("Fetch error: " + req.status);
        self.content = "ERROR";        
      }
    }
  };
  widget.add(new widget.Widget(options));
};
