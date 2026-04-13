# Auto Task Listener Plugin for Camunda Desktop Modeler

A Camunda Desktop Modeler plugin that automatically adds `creating` and `canceling`
[zeebe:TaskListeners](https://docs.camunda.io/docs/components/modeler/bpmn/user-tasks/task-listeners/)
to every new Camunda 8 User Task dropped onto the canvas.

## What it does

Whenever a **User Task** is placed on a Camunda 8 BPMN diagram, the plugin
injects two Task Listeners into the element's extension elements:

| Event      | Type            |
|------------|-----------------|
| `creating` | *(empty)*       |
| `canceling`| *(empty)*       |

The `type` (job type of the worker) is intentionally left blank so you can fill
it in via the Properties Panel without being forced to overwrite a default value.

The resulting BPMN XML looks like this:

```xml
<bpmn:userTask id="UserTask_1" name="My Task">
  <bpmn:extensionElements>
    <zeebe:userTask />
    <zeebe:taskListeners>
      <zeebe:taskListener eventType="creating" type="" />
      <zeebe:taskListener eventType="canceling" type="" />
    </zeebe:taskListeners>
  </bpmn:extensionElements>
</bpmn:userTask>
```

**Idempotent:** if a `zeebe:TaskListeners` block already exists on the element
(e.g. set manually via the Properties Panel), the plugin leaves it untouched.

**Undo-safe:** the injection is part of the same compound command as the shape
creation, so a single Ctrl+Z removes both the shape and its listeners.

## Installation

### Option A — no build step (recommended)

The `client/client.js` file is already bundled and ready to use. Just copy the
plugin folder as-is.

### Option B — build from source

```bash
npm install
npm run build
```

### Copy to the Camunda Modeler plugins directory

Copy the **entire plugin folder** into the Camunda Modeler plugins directory:

| OS      | Path                                                                 |
|---------|----------------------------------------------------------------------|
| Windows | `%APPDATA%\camunda-modeler\resources\plugins\`                       |
| macOS   | `~/Library/Application Support/camunda-modeler/resources/plugins/`  |
| Linux   | `~/.config/camunda-modeler/resources/plugins/`                       |

Expected structure after copying:

```
resources/plugins/
  camunda-modeler-task-listener-plugin/
    index.js
    client/
      client.js
    ...
```

### Restart the Camunda Modeler

The plugin is loaded on startup and is active immediately for every Camunda 8
(`.bpmn`) diagram.

## Development

```bash
# Watch mode — rebuilds automatically on file changes
npm run dev

# Production build
npm run build
```

## File structure

```
.
├── index.js                    # Plugin descriptor (loaded by Camunda Modeler)
├── client.js                   # Webpack entry point (source)
├── TaskListenerSyncPlugin.js   # bpmn-js module with the auto-inject logic
├── webpack.config.js
├── package.json
└── client/
    └── client.js               # Webpack output (loaded by Camunda Modeler)
```

## Limitations

- Desktop Modeler only. The Web Modeler does not support client-side bpmn-js plugins.
- Applies to Camunda 8 diagrams only.
- Only fires on **new** shapes. Existing user tasks in an opened file are not
  modified retroactively.
