'use strict';

var registerClientPlugin = require('camunda-modeler-plugin-helpers').registerClientPlugin;
var plugin = require('./TaskListenerSyncPlugin');

// Register for both Camunda 7 and Camunda 8 BPMN editor types so the plugin
// works regardless of which editor the Modeler version uses.
// The plugin itself skips non-UserTask elements and guards against missing
// zeebe moddle types, so it is safe on C7 diagrams.
registerClientPlugin(plugin, 'bpmn.modeler.additionalModules');
registerClientPlugin(plugin, 'cloud-bpmn.modeler.additionalModules');
