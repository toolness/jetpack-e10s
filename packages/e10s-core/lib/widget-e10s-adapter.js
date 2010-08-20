if (this.sendMessage) {
  exports.Widget = function Widget(options) {
    this.options_ = options;
    this.handle_ = createHandle();
    this.handle_.widget = this;
    this.__defineSetter__(
      "content",
      function(value) {
        sendMessage("widget:setContent", this.handle_, value);
      });
  };

  exports.add = function add(widget) {
    sendMessage("widget:add", widget.handle_, {
                  label: widget.options_.label,
                  content: widget.options_.content
                });
  };
  
  registerReceiver("widget:onClick", function(name, handle) {
                     handle.widget.options_.onClick.call(handle.widget);
                   });
} else {
  exports.register = function(process) {
    process.registerReceiver(
      "widget:setContent",
      function(name, handle, value) {
        console.log("setting widget status to", uneval(value));
        handle.widget.content = value;
      });

    process.registerReceiver(
      "widget:add",
      function(name, handle, options) {
        var widget = require("widget");
        var w = new widget.Widget({label: options.label,
                                   content: options.content,
                                   onClick: function remote_widget_onclick() {
	                             process.sendMessage("widget:onClick",
                                                         handle);
                                   }});
        handle.widget = w;
        widget.add(w);
      });
  };
}
