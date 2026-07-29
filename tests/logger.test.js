'use strict';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { logger } from '../utils/logger.js';

describe('logger', () => {
  beforeEach(() => {
    logger.clear();
  });

  describe('debug', () => {
    it('should add a debug entry', () => {
      logger.debug('mod', 'debug message');
      const entries = logger.getEntries();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].level, 'debug');
      assert.equal(entries[0].module, 'mod');
      assert.equal(entries[0].message, 'debug message');
    });

    it('should include optional data', () => {
      logger.debug('mod', 'msg', { key: 'value' });
      const entries = logger.getEntries();
      assert.deepEqual(entries[0].data, { key: 'value' });
    });
  });

  describe('info', () => {
    it('should add an info entry', () => {
      logger.info('mod', 'info message');
      const entries = logger.getEntries();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].level, 'info');
    });
  });

  describe('warn', () => {
    it('should add a warn entry', () => {
      logger.warn('mod', 'warn message');
      const entries = logger.getEntries();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].level, 'warn');
    });

    it('should appear in getWarningsAndErrors', () => {
      logger.warn('mod', 'warn');
      const filtered = logger.getWarningsAndErrors();
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].level, 'warn');
    });
  });

  describe('error', () => {
    it('should add an error entry', () => {
      logger.error('mod', 'error message');
      const entries = logger.getEntries();
      assert.equal(entries.length, 1);
      assert.equal(entries[0].level, 'error');
    });

    it('should appear in getWarningsAndErrors', () => {
      logger.error('mod', 'error');
      const filtered = logger.getWarningsAndErrors();
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].level, 'error');
    });
  });

  describe('buffer management', () => {
    it('should keep entries in order', () => {
      logger.info('mod', 'first');
      logger.warn('mod', 'second');
      logger.error('mod', 'third');
      const entries = logger.getEntries();
      assert.equal(entries[0].message, 'first');
      assert.equal(entries[1].message, 'second');
      assert.equal(entries[2].message, 'third');
    });

    it('should return a copy from getEntries', () => {
      logger.info('mod', 'test');
      const entries = logger.getEntries();
      entries.pop();
      assert.equal(logger.getEntries().length, 1);
    });

    it('should clear all entries', () => {
      logger.info('mod', 'a');
      logger.error('mod', 'b');
      logger.clear();
      assert.equal(logger.getEntries().length, 0);
    });
  });

  describe('getWarningsAndErrors', () => {
    it('should exclude debug and info entries', () => {
      logger.debug('mod', 'd');
      logger.info('mod', 'i');
      logger.warn('mod', 'w');
      logger.error('mod', 'e');
      const filtered = logger.getWarningsAndErrors();
      assert.equal(filtered.length, 2);
    });

    it('should return empty array when no warnings/errors', () => {
      logger.debug('mod', 'd');
      logger.info('mod', 'i');
      assert.equal(logger.getWarningsAndErrors().length, 0);
    });
  });

  describe('entry timestamp', () => {
    it('should have a Date timestamp', () => {
      logger.info('mod', 'test');
      const entry = logger.getEntries()[0];
      assert.ok(entry.timestamp instanceof Date);
    });
  });
});
