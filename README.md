## Jetpack-Electrolysis Integration Package ##

This is a Jetpack package that allows Firefox addons to be created that execute in a separate process from Firefox itself.

This package contains the following sub-packages:

  * <code>[e10s-core][]</code> makes the Jetpack platform multi-process-aware. Specifically, it replaces parts of Jetpack's module loader to allow non-chrome-privileged modules to be loaded in a separate process. Citing this package as a dependency in an addon's `package.json` will cause it to be loaded and executed with the semantics described in the rest of this document.

  * <code>[e10s-test-runner][]</code> provides a multi-process-aware test runner that executes all non-chrome-privileged test modules in a separate process.

  [e10s-core]: http://github.com/toolness/jetpack-e10s/tree/master/packages/e10s-core/
  [e10s-test-runner]: http://github.com/toolness/jetpack-e10s/tree/master/packages/e10s-test-runner/

### Prerequisites ###

  * The latest [Firefox 4 Beta][].
  * The latest [Jetpack SDK][].

  [Firefox 4 Beta]: http://www.mozilla.com/en-US/firefox/beta/
  [Jetpack SDK]: http://github.com/mozillalabs/jetpack-sdk

### Running An Example ###

1. Activate your SDK and clone this git repository in the `packages` subdirectory of your SDK and enter the `twitter-widget` example:

        git clone git://github.com/toolness/jetpack-e10s.git
        cd jetpack-e10s/examples/twitter-widget

2. Run the test suite for the example:

        cfx test --test-runner-pkg=e10s-test-runner

   The extra arguments tell `cfx` to use the multi-process-aware test runner.

3. Run the example itself:

        cfx run

4. Once Firefox starts up, you should see a widget at the bottom of the
   browser labeled "Click me!" (it may be truncated due to size constraints).
   Do what it says.

5. The widget label should change to "..." for a moment and then change
   to the Twitter status of [toolness](http://twitter.com/toolness).

### The Big Picture ###

![Multi-Process Architecture](http://github.com/toolness/jetpack-e10s/raw/master/diagrams/twitter-widget.png)

The above diagram is a simplified depiction of what happens when the example [twitter-widget][] addon is loaded.

First, the Jetpack Platform Loader initializes the Jetpack Platform and loads <code>[main.js][]</code> in a separate process.

When `main.js` calls `require("widget")`, the Addon Process sends a message to the Firefox Process and awaits a reply.

The Firefox Process then notices that the `widget` module requires chrome privileges and therefore won't work properly if sent to the Addon Process for evaluation. So it looks for an *e10s adapter* for the module by appending `-e10s-adapter` to the module's name and searching for it.

This causes <code>[widget-e10s-adapter.js][]</code> to be found and imported as the `widget-e10s-adapter` module in the Firefox Process. The *exact same code* is also returned to the Addon Process for evaluation as the `widget` module in its world, and its exports are returned by `require()`. In other words, different sides of the message-passing boundary between the two processes are contained in the same adapter file, which is typically of the following form:

    if (this.sendMessage) {
	  /* We're being evaluated in the Addon Process. Set up message-passing
	   * infrastructure to communicate with the Firefox Process
	   * and export an API. */
    } else {
	  /* We're being evaluated in the Firefox Process. */
	  exports.register = function register(process) {
		/* Set-up Firefox Process message-passing infrastructure
		 * to communicate with the given Addon Process. */
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

### Internals ###

Code for the creation and bootstrapping of the remote process is contained in <code>[e10s.js][]</code>, which uses the <code>[nsIJetpackService][]</code> and <code>[nsIJetpack][]</code> XPCOM interfaces to create a [Jetpack process][] and send <code>[bootstrap-remote-process.js][]</code> to it for evaluation. The `e10s` module also contains most of the `require()` logic for the Addon Process.

[e10s.js]: http://github.com/toolness/jetpack-e10s/blob/master/packages/e10s-core/lib/e10s.js
[bootstrap-remote-process.js]: http://github.com/toolness/jetpack-e10s/blob/master/packages/e10s-core/data/bootstrap-remote-process.js
[nsIJetpackService]: https://developer.mozilla.org/en/nsIJetpackService
[nsIJetpack]: https://developer.mozilla.org/en/nsIJetpack
[Jetpack process]: https://developer.mozilla.org/en/Jetpack_Processes
