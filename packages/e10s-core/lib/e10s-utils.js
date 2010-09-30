function pickleArgs(types, args) {
  var pickled = [];
  for (var i = 0; i < args.length; i++) {
    switch (types[i]) {
    case "string":
      pickled.push(String(args[i]));
      break;
    default:
      throw new Error("Unsupported type: " + types[i]);
    }
  }
  return pickled;
}

function unpickleArgs(types, args) {
  var unpickled = [];
  for (var i = 0; i < args.length; i++) {
    switch (types[i]) {
    case "string":
      if (typeof(args[i]) != "string")
        throw new Error("Expected string, got " + typeof(args[i]));
      unpickled.push(args[i]);
      break;
    default:
      throw new Error("Unsupported type: " + types[i]);
    }
  }
  return unpickled;
}

function createProxyPrototype(options) {
  var chrome = options.chrome;
  var prototype = {};

  function defineProperty(name, info) {
    switch (info.type) {
    case "async-method":
      prototype[name] = function() {
        chrome.sendMessage(options.meta.channel, {
          name: name,
          handle: this._handle,
          args: pickleArgs(info.args, arguments)
        });
      };
      break;
    default:
      throw new Error("Unsupported type: " + info.type);
    }    
  }

  for (name in options.meta.properties)
    defineProperty(name, options.meta.properties[name]);
    
  return prototype;
};

exports.createProxy = function createProxy(options) {
  function proxyConstructor() {
    this._handle = options.chrome.callMessage(options.meta.channel, {
      msg: "construct",
      args: pickleArgs(options.meta.constructor.args, arguments)
    })[0];
  };

  proxyConstructor.prototype = createProxyPrototype(options);

  return proxyConstructor;
};

exports.registerProxyEndpoint = function registerProxyEndpoint(options) {
  var process = options.process;
  var constructor = options.meta.constructor;
  var properties = options.meta.properties;

  function propertyAccess(options) {
    if (!(options.name in properties))
      throw new Error("Unknown property: " + options.name);
    var info = properties[options.name];
    var delegate = options.handle.delegate;
    switch (info.type) {
    case "async-method":
      delegate[options.name].apply(delegate,
                                   unpickleArgs(info.args, options.args));
      break;
    default:
      throw new Error("Unsupported type: " + info.type);
    }
  }

  process.registerReceiver(options.meta.channel, function(name, options) {
    switch (options.msg) {
    case "property":
      return propertyAccess(options);
      break;
    case "construct":
      var handle = process.createHandle();
      handle.delegate = constructor.factory();
      return handle;
      break;
    default:
      throw new Error("Unsupported message: " + options.msg);
    }
  });
};
