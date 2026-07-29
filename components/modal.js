'use strict';

class Modal {
  static backdrop = null;
  static _closable = true;
  static _previousFocus = null;
  static _keydownHandler = null;

  static init() {
    if (this.backdrop) {
      return;
    }

    this.backdrop = document.createElement('div');
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-header"><h3 class="modal-title" id="modal-title"></h3><button class="modal-close" aria-label="Cerrar">✕</button></div><div class="modal-body"></div><div class="modal-footer"></div></div>';
    document.body.appendChild(this.backdrop);

    this.backdrop.querySelector('.modal-close').addEventListener('click', () => {
      if (this._closable) {
        this.close();
      }
    });
    this.backdrop.addEventListener('click', e => {
      if (e.target === this.backdrop && this._closable) {
        this.close();
      }
    });
  }

  static show({ title = '', body = '', footer = '', onClose = null, closable = true }) {
    this.init();
    this._closable = closable;
    this._previousFocus = document.activeElement;

    const closeBtn = this.backdrop.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.style.display = closable ? '' : 'none';
    }
    this.backdrop.querySelector('.modal-title').textContent = title;
    this.backdrop.querySelector('.modal-body').innerHTML = body;
    this.backdrop.querySelector('.modal-footer').innerHTML = footer;
    this._onClose = onClose;
    requestAnimationFrame(() => {
      this.backdrop.classList.add('active');
      this._setupFocusTrap();
      const firstFocusable = this._getFirstFocusable();
      if (firstFocusable) {
        firstFocusable.focus();
      }
    });
  }

  static close() {
    this.backdrop.classList.remove('active');
    this._closable = true;
    this._removeFocusTrap();
    const closeBtn = this.backdrop.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.style.display = '';
    }
    if (this._onClose) {
      this._onClose();
    }
    if (this._previousFocus && this._previousFocus.focus) {
      this._previousFocus.focus();
      this._previousFocus = null;
    }
  }

  static _getFocusableElements() {
    const modal = this.backdrop.querySelector('.modal');
    if (!modal) {
      return [];
    }
    return modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
  }

  static _getFirstFocusable() {
    const elements = this._getFocusableElements();
    return elements.length > 0 ? elements[0] : null;
  }

  static _setupFocusTrap() {
    this._removeFocusTrap();
    this._keydownHandler = e => {
      if (e.key === 'Escape' && this._closable) {
        e.preventDefault();
        this.close();
        return;
      }
      if (e.key !== 'Tab') {
        return;
      }
      const elements = this._getFocusableElements();
      if (elements.length === 0) {
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', this._keydownHandler);
  }

  static _removeFocusTrap() {
    if (this._keydownHandler) {
      document.removeEventListener('keydown', this._keydownHandler);
      this._keydownHandler = null;
    }
  }
}

export default Modal;
