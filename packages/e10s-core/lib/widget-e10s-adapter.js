// This is a very incomplete adapter and doesn't port all of the original
// module's functionality.

/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Jetpack.
 *
 * The Initial Developer of the Original Code is Mozilla.
 * Portions created by the Initial Developer are Copyright (C) 2007
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *   Atul Varma <atul@mozilla.com>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

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
