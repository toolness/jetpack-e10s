// This is an adapter that only provides what's needed for the
// request module to work. Note that responseXML doesn't work, though.

var RESPONSE_FIELDS = ['responseText', 'status', 'statusText'];

if (this.sendMessage) {
  exports.XMLHttpRequest = function XMLHttpRequest() {
    var handle = createHandle();
    var settings = {
      headers: {},
    };
    var orsc;
    var readyState = 0;

    var response;

    var req = {
      open: function(method, url) {
        settings.method = method;
        settings.url = url;
      },
      send: function(body) {
        settings.body = body;
        sendMessage("xhr:send", handle, settings);
      },
      get readyState() {
        return readyState;
      },
      setRequestHeader: function(key, value) {
        settings.headers[key] = value;
      },
      set onreadystatechange(cb) {
        orsc = cb;
      },
      getAllResponseHeaders: function() {
        return response.headers;
      },
      get responseXML() {
        // Tried E4X'ing here, but it didn't work; XML objects don't seem
        // to provide a DOM API.
        // https://developer.mozilla.org/en/E4X
        
        // Fix for bug 336551
        //var XMLDeclRE = /^<\?xml\s+version\s*=\s*(["'])[^\1]+\1[^?]*\?>/;
        //return new XML(response.responseText.replace(XMLDeclRE, ""));
        throw new Error("responseXML is not supported");
      }
    };

    RESPONSE_FIELDS.forEach(function(name) {
      req.__defineGetter__(name, function() {
        return response[name];
      });
    });

    handle.onFinished = function(aResponse) {
      readyState = 4;
      response = aResponse;
      handle.invalidate();
      orsc();
    };

    return req;
  };
  
  registerReceiver("xhr:finished", function(name, handle, response) {
    handle.onFinished(response);
  });
} else {
  var xhr = require("xhr");

  exports.register = function(process) {
    process.registerReceiver("xhr:send", function(name, handle, settings) {
      var req = new xhr.XMLHttpRequest();
      req.open(settings.method, settings.url);
      req.onreadystatechange = function() {
        if (req.readyState == 4) {
          var response = {
            headers: req.getAllResponseHeaders(),
          };
          RESPONSE_FIELDS.forEach(function(name) {
            response[name] = req[name];
          });
          process.sendMessage("xhr:finished", handle, response);
        }
      };
      for (name in settings.headers)
        req.setRequestHeader(name, settings.headers[name]);
      req.send(settings.body);
    });
  };
}
