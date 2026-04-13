'use strict';

/**
 * AutoTaskListenerPlugin
 *
 * Automatically adds zeebe:TaskListeners to every Camunda 8 User Task
 * when it is created on the canvas:
 *
 *   - creating  (type left empty — fill in via Properties Panel)
 *   - canceling (type left empty — fill in via Properties Panel)
 *
 * Listeners are only injected if no zeebe:TaskListeners block already exists,
 * so manually configured tasks are never overwritten.
 */

function AutoTaskListenerPlugin(eventBus, modeling, moddle) {

  // Hook into shape creation as part of the same compound command,
  // so Ctrl+Z undoes the shape AND the injected listeners together.
  eventBus.on('commandStack.shape.create.postExecute', function(event) {
    var shape = event.context.shape;

    if (shape.type !== 'bpmn:UserTask') {
      return;
    }

    addDefaultTaskListeners(shape);
  });

  function addDefaultTaskListeners(element) {
    var bo = element.businessObject;

    // Retrieve or create extensionElements
    var extensionElements = bo.extensionElements;
    if (!extensionElements) {
      extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] });
      extensionElements.$parent = bo;
    }

    var values = extensionElements.get('values') || [];

    // Bail out if task listeners are already configured
    var hasTaskListeners = values.some(function(v) {
      return v.$type === 'zeebe:TaskListeners';
    });

    if (hasTaskListeners) {
      return;
    }

    var newValues = values.slice();

    // Ensure zeebe:UserTask marker is present (required for C8 user task mode)
    var hasUserTaskMarker = values.some(function(v) {
      return v.$type === 'zeebe:UserTask';
    });

    if (!hasUserTaskMarker) {
      var userTaskMarker = moddle.create('zeebe:UserTask', {});
      userTaskMarker.$parent = extensionElements;
      newValues.push(userTaskMarker);
    }

    // Build listener elements (type intentionally left empty)
    var createListener = moddle.create('zeebe:TaskListener', {
      eventType: 'creating'
    });

    var cancelListener = moddle.create('zeebe:TaskListener', {
      eventType: 'canceling'
    });

    var taskListenersContainer = moddle.create('zeebe:TaskListeners', {
      listeners: [ createListener, cancelListener ]
    });

    // Wire up $parent references (required by moddle serialisation)
    createListener.$parent = taskListenersContainer;
    cancelListener.$parent = taskListenersContainer;
    taskListenersContainer.$parent = extensionElements;

    newValues.push(taskListenersContainer);

    // Apply the update — triggers the modeler to re-render the properties panel
    modeling.updateProperties(element, {
      extensionElements: Object.assign(extensionElements, { values: newValues })
    });
  }
}

AutoTaskListenerPlugin.$inject = [ 'eventBus', 'modeling', 'moddle' ];

module.exports = {
  __init__: [ 'autoTaskListenerPlugin' ],
  autoTaskListenerPlugin: [ 'type', AutoTaskListenerPlugin ]
};
