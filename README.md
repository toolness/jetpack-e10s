## Jetpack-Electrolysis Integration Package ##

This is a Jetpack package that allows Firefox addons to be created that execute in a separate process from Firefox itself.

### Prerequisites ###

  * The latest [Firefox 4 Beta][].
  * The latest [Jetpack SDK][].

  [Firefox 4 Beta]: http://www.mozilla.com/en-US/firefox/beta/
  [Jetpack SDK]: http://github.com/mozillalabs/jetpack-sdk

### Overview ###

![Multi-Process Architecture](http://github.com/toolness/jetpack-e10s/raw/master/diagrams/xhr.png)

The above diagram is a simplified depiction of what happens when the example [twitter-widget][] addon is loaded.

First, the Jetpack Platform Loader initializes the Jetpack Platform and loads <code>[main.js][]</code> in a separate process.

When `main.js` calls `require("widget")`, the Addon Process sends a message to the Firefox Process and awaits a reply.

The Firefox Process then notices that the `widget` module requires chrome privileges and therefore won't work properly if sent to the Addon Process for evaluation. So it looks for an *e10s adapter* for the module by appending `-e10s-adapter` to the module's name and searching for it.

This causes <code>[widget-e10s-adapter.js][]</code> to be found and imported as the `widget-e10s-adapter` module in the Firefox Process. The *exact same code* is also sent to the Addon Process for evaluation as the `widget` module in its world, and its `exports` are returned by `require()`. In other words, different sides of the message-passing boundary between the two processes are contained in the same adapter file, which is typically of the following form:

    if (this.sendMessage) {
	  /* Set-up Addon Process message-passing infrastructure
	   * and export an API. */
    } else {
	  exports.register = function register(process) {
		/* Set-up Firefox Process message-passing infrastructure
		 * on the given Addon Process. */
	  };
	}

Note that this only describes what happens when a module requiring chrome privileges *and* having an e10s adapter is requested by code in the Addon Process.

[twitter-widget]: http://github.com/toolness/jetpack-e10s/tree/master/examples/twitter-widget/
[main.js]: http://github.com/toolness/jetpack-e10s/blob/master/examples/twitter-widget/lib/main.js
[widget-e10s-adapter.js]: http://github.com/toolness/jetpack-e10s/blob/master/packages/e10s-core/lib/widget-e10s-adapter.js

#### Other Cases ####

If the Addon Process code attempts to import a chrome-privileged module that does *not* have an e10s adapter, an access denied exception is thrown.

If the Addon Process code attempts to import a module that does *not* explicitly require chrome privileges, the code for the module is sent to the Addon Process and evaluated there, just like the `main` module.

#### Double Loading ####

If both a module in the Firefox Process *and* a module in the Addon Process request the same module that doesn't require chrome privileges, it is actually loaded *twice*: once in each process. This means that modules which intend to provide singleton-like functionality may need an e10s adapter to proxy calls into a single process.

### Under The Hood ###

Code for the creation and bootstrapping of the remote process is contained in <code>[e10s.js][]</code>, which uses the <code>[nsIJetpackService][]</code> and <code>[nsIJetpack][]</code> XPCOM interfaces to create a remote process and send <code>[bootstrap-remote-process.js][]</code> to it for evaluation. The `e10s` module also contains most of the `require()` logic for the Addon Process.

[e10s.js]: http://github.com/toolness/jetpack-e10s/blob/master/packages/e10s-core/lib/e10s.js
[bootstrap-remote-process.js]: http://github.com/toolness/jetpack-e10s/blob/master/packages/e10s-core/data/bootstrap-remote-process.js
[nsIJetpackService]: http://mxr.mozilla.org/mozilla-central/source/js/jetpack/nsIJetpackService.idl
[nsIJetpack]: http://mxr.mozilla.org/mozilla-central/source/js/jetpack/nsIJetpack.idl
