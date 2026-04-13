---
name: camunda-modeler-plugin
description: This skill should be used when the user asks to "create a camunda modeler plugin", "build a bpmn-js plugin", "implement a task listener plugin", "scaffold a modeler plugin", or wants to add automatic element behavior to Camunda Desktop Modeler using bpmn-js extension modules.
version: 1.0.0
---

# Camunda Modeler bpmn-js Plugin Skill

Guidance for implementing Camunda Desktop Modeler client-side plugins that hook into bpmn-js to automatically inject extension elements (e.g. `zeebe:TaskListeners`) onto BPMN elements.

## Repository layout

Every plugin must follow this structure so the Camunda Modeler picks it up:

```
<plugin-folder>/
├── index.js                  # Plugin descriptor — name + script path
├── client.js                 # Webpack entry point (source)
├── <PluginName>.js           # bpmn-js module (the logic)
├── webpack.config.js
├── package.json
├── .gitignore
└── client/
    └── client.js             # Webpack output (referenced by index.js)
```

### index.js

```js
module.exports = {
  name: '<Human-readable plugin name>',
  script: './client/client.js'
};
```

### client.js (entry point)

```js
'use strict';

var registerClientPlugin = require('camunda-modeler-plugin-helpers').registerClientPlugin;
var plugin = require('./<PluginName>');

// Register for both C7 and C8 editor types
registerClientPlugin(plugin, 'bpmn.modeler.additionalModules');
registerClientPlugin(plugin, 'cloud-bpmn.modeler.additionalModules');
```

### package.json

```json
{
  "name": "<repo-name>",
  "version": "1.0.0",
  "description": "...",
  "scripts": {
    "build": "webpack --mode production",
    "dev":   "webpack --mode development --watch"
  },
  "devDependencies": {
    "camunda-modeler-plugin-helpers": "^3.0.0",
    "webpack": "^5.90.0",
    "webpack-cli": "^5.1.0"
  }
}
```

### webpack.config.js

```js
const path = require('path');

module.exports = {
  mode: 'development',
  entry: './client.js',
  output: {
    path: path.resolve(__dirname, 'client'),
    filename: 'client.js'
  },
  resolve: { modules: ['node_modules', '.'] },
  devtool: false
};
```

### .gitignore

```
node_modules/
dist/
```

## Writing the bpmn-js module

A bpmn-js module is a plain object with `__init__` and service entries. Inject `eventBus`, `modeling`, and `moddle` as needed.

```js
'use strict';

function MyPlugin(eventBus, modeling, moddle) {

  // Hook AFTER shape creation so the injection is part of the same
  // compound command — Ctrl+Z undoes the shape AND the injection together.
  eventBus.on('commandStack.shape.create.postExecute', function(event) {
    var shape = event.context.shape;

    // Guard: only act on the element type you care about
    if (shape.type !== 'bpmn:UserTask') {
      return;
    }

    injectExtensions(shape);
  });

  function injectExtensions(element) {
    var bo = element.businessObject;

    // 1. Retrieve or create extensionElements
    var extensionElements = bo.extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
      extensionElements.$parent = bo;
    }

    var values = extensionElements.get('values') || [];

    // 2. Guard: bail out if already configured (idempotent)
    var alreadyConfigured = values.some(function(v) {
      return v.$type === 'zeebe:TaskListeners'; // adjust type as needed
    });
    if (alreadyConfigured) { return; }

    var newValues = values.slice();

    // 3. Build and wire the new extension element(s)
    var listener = moddle.create('zeebe:TaskListener', { eventType: 'creating' });
    var container = moddle.create('zeebe:TaskListeners', { listeners: [listener] });

    listener.$parent  = container;
    container.$parent = extensionElements;
    newValues.push(container);

    // 4. Apply via modeling so the command stack records it
    modeling.updateProperties(element, {
      extensionElements: Object.assign(extensionElements, { values: newValues })
    });
  }
}

MyPlugin.$inject = ['eventBus', 'modeling', 'moddle'];

module.exports = {
  __init__: ['myPlugin'],
  myPlugin:  ['type', MyPlugin]
};
```

## Adding a toggle (enable / disable)

The Camunda Modeler plugin descriptor (`index.js`) only supports `name`, `script`, and `style`. **Do not add a `menu` property** — the plugin loader will silently reject the entire plugin if it encounters it.

Instead, implement a toggle entirely client-side using `localStorage` and a global `keydown` listener:

```js
var STORAGE_KEY = 'myPlugin.enabled';

// Default to disabled; change to === 'true' check for opt-in behaviour
var enabled = localStorage.getItem(STORAGE_KEY) === 'true';

// Attach to document so the shortcut works regardless of canvas focus
document.addEventListener('keydown', function(event) {
  if (
    (event.key === 'l' || event.key === 'L') &&
    (event.ctrlKey || event.metaKey) &&
    event.shiftKey
  ) {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEY, String(enabled));
    showToast('My Plugin: ' + (enabled ? 'enabled' : 'disabled'));
    event.preventDefault();
  }
});
```

Add a small toast helper so the user gets visual feedback:

```js
function showToast(message) {
  var el = document.createElement('div');
  el.textContent = message;
  el.style.cssText =
    'position:fixed;bottom:24px;right:24px;' +
    'background:#333;color:#fff;' +
    'padding:10px 16px;border-radius:4px;' +
    'font-size:13px;z-index:9999;' +
    'pointer-events:none;transition:opacity 0.3s;';
  document.body.appendChild(el);
  setTimeout(function() {
    el.style.opacity = '0';
    setTimeout(function() { el.parentNode && el.parentNode.removeChild(el); }, 300);
  }, 2000);
}
```

Then guard the injection logic with the flag:

```js
eventBus.on('commandStack.shape.create.postExecute', function(event) {
  if (!enabled) { return; }
  // ...
});
```

**Why not `bpmn-js keyboard` service?** The bpmn-js `keyboard` service only fires events when the canvas has focus. `document.addEventListener('keydown', …)` is more reliable and requires no extra injection.

## Key rules

| Rule | Detail |
|---|---|
| **Idempotent** | Always check whether the extension already exists before injecting. |
| **Undo-safe** | Use `commandStack.shape.create.postExecute` (not `postExecuted`) so the injection joins the same compound command. |
| **$parent wiring** | Every `moddle.create(...)` result needs `$parent` set — moddle uses it during XML serialisation. |
| **C8 guard** | If using Zeebe-specific moddle types, verify `moddle.getPackage('zeebe')` is available before creating instances. |
| **No side-effects on open** | The hook only fires for new shapes; existing elements in opened files are never touched. |

## Moddle types reference (Zeebe)

| Type | Purpose |
|---|---|
| `zeebe:UserTask` | Marks the user task as Camunda 8 mode (required for task listeners) |
| `zeebe:TaskListeners` | Container for one or more task listeners |
| `zeebe:TaskListener` | Individual listener — `eventType`: `creating` / `completing` / `canceling` / `updating` / `assigning` |
| `zeebe:TaskHeaders` | Key-value headers passed to the job worker |
| `zeebe:IoMapping` | Input/output variable mappings |

## Common event hooks

```js
// After a shape is placed on the canvas
eventBus.on('commandStack.shape.create.postExecute', fn);

// After an existing element's properties are updated
eventBus.on('commandStack.element.updateProperties.postExecute', fn);

// After a connection is drawn
eventBus.on('commandStack.connection.create.postExecute', fn);

// When the diagram is fully imported
eventBus.on('import.done', fn);
```

## Installation path (for end users)

| OS      | Plugins directory |
|---|---|
| macOS   | `~/Library/Application Support/camunda-modeler/resources/plugins/` |
| Windows | `%APPDATA%\camunda-modeler\resources\plugins\` |
| Linux   | `~/.config/camunda-modeler/resources/plugins/` |

Copy the **entire plugin folder** (not just `client/client.js`) and restart the Modeler.

## Checklist for a new plugin

- [ ] `index.js` only contains `name` and `script` — no `menu` property
- [ ] `client.js` registers for both `bpmn.modeler.additionalModules` and `cloud-bpmn.modeler.additionalModules`
- [ ] Module uses `postExecute` (not `postExecuted`) for undo-safety
- [ ] All `moddle.create(...)` results have `$parent` set
- [ ] Idempotency guard prevents double-injection
- [ ] Toggle (if needed) uses `document.addEventListener('keydown', …)` + `localStorage`, not the bpmn-js `keyboard` service or `index.js` menu
- [ ] `package.json` name matches the repository/folder name
- [ ] `.gitignore` excludes `node_modules/` and `dist/`
- [ ] Bundle is built (`npm run build`) before shipping
