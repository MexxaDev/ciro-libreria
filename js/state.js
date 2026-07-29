'use strict';

const PERSIST_KEYS = ['currentUser', 'sidebarMode', 'sidebarCollapsed'];

class State {
  constructor() {
    this.state = {
      currentUser: null,
      currentRoute: 'dashboard',
      settings: {},
      sidebarCollapsed: false
    };
    this.listeners = {};
    this._restore();
  }

  _restore() {
    try {
      for (const key of PERSIST_KEYS) {
        const saved = localStorage.getItem(`state:${key}`);
        if (saved) {
          this.state[key] = JSON.parse(saved);
        }
      }
    } catch {
      /* localStorage not available or corrupt */
    }
  }

  _persist(key, value) {
    try {
      if (PERSIST_KEYS.includes(key)) {
        localStorage.setItem(`state:${key}`, JSON.stringify(value));
      }
    } catch {
      /* localStorage full or unavailable */
    }
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this._persist(key, value);
    this.emit(`state:${key}`, value);
    this.emit('state:change', { key, value });
  }

  clearSession() {
    this.set('currentUser', null);
    try {
      for (const key of PERSIST_KEYS) {
        localStorage.removeItem(`state:${key}`);
      }
    } catch {
      /* ignore */
    }
  }

  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this.listeners[event]) {
      return;
    }
    this.listeners[event].forEach(callback => callback(data));
  }
}

export default new State();
