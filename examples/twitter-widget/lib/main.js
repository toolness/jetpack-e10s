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
      console.log("Widget clicked");
      var req = require("request").Request({
        url: "http://api.twitter.com/1/users/show.json?screen_name=toolness",
        onComplete: function() {
          var response = this.response;
          if (response.status == 200) {
            console.log("Data received: " +
                        response.text.length +
                        " bytes");
            self.content = response.json.status.text;
          } else {
            console.log("Fetch error: " + response.status);
            self.content = "ERROR";
          }
        }
      }).get();
    }
  };
  widget.add(new widget.Widget(options));
};
