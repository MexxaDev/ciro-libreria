'use strict';

const MAX_LOG_ENTRIES = 200;

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const LEVEL_NAMES = { 0: 'DEBUG', 1: 'INFO', 2: 'WARN', 3: 'ERROR' };

const buffer = [];

function addEntry(level, module, message, data) {
  const entry = {
    timestamp: new Date(),
    level,
    module,
    message,
    data
  };
  buffer.push(entry);
  if (buffer.length > MAX_LOG_ENTRIES) {
    buffer.shift();
  }
  if (LEVELS[level] >= LEVELS.warn) {
    const prefix = `[${LEVEL_NAMES[LEVELS[level]]}] [${module}]`;
    if (level === 'error') {
      console.error(prefix, message, data || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, data || '');
    }
  }
  return entry;
}

export const logger = {
  debug(module, message, data) {
    addEntry('debug', module, message, data);
  },

  info(module, message, data) {
    addEntry('info', module, message, data);
  },

  warn(module, message, data) {
    addEntry('warn', module, message, data);
  },

  error(module, message, data) {
    addEntry('error', module, message, data);
  },

  getEntries() {
    return buffer.slice();
  },

  getWarningsAndErrors() {
    return buffer.filter(e => e.level === 'warn' || e.level === 'error');
  },

  clear() {
    buffer.length = 0;
  }
};
