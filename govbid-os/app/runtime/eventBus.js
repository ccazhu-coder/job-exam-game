(function (window) {
  'use strict';

  const listeners = {};

  window.EventBus = {
    on(event, handler) {
      listeners[event] = listeners[event] || [];
      listeners[event].push(handler);
      return () => this.off(event, handler);
    },
    off(event, handler) {
      listeners[event] = (listeners[event] || []).filter((fn) => fn !== handler);
    },
    emit(event, payload) {
      (listeners[event] || []).forEach((handler) => {
        try {
          handler(payload);
        } catch (error) {
          console.error('[EventBus]', event, error);
        }
      });
    }
  };
})(window);
