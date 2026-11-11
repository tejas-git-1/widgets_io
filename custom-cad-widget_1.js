(function () {
  'use strict';

  const SDK_CDN_URL = 'https://esm.sh';

  class CustomCadWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this.cadValue = 'Initializing...';
      this.colorClass = 'neutral';
      this.Desktop = null;
      this.boundHandleUpdate = this.handleInteractionUpdate.bind(this);
    }

    async connectedCallback() {
      this.setupDOM();

      try {
        // Dynamically load @wxcc-desktop/sdk from CDN inside the IIFE
        const sdkModule = await import(SDK_CDN_URL);
        this.Desktop = sdkModule.Desktop || sdkModule.default?.Desktop;

        if (!this.Desktop) {
          throw new Error('Desktop export not found in @wxcc-desktop/sdk');
        }

        await this.Desktop.config.init();

        // Check for an already-active call when the widget loads
        if (typeof this.Desktop.agentContact.getTaskMap === 'function') {
          const taskMap = await this.Desktop.agentContact.getTaskMap();
          if (taskMap && Object.keys(taskMap).length > 0) {
            const activeTaskId = Object.keys(taskMap);
            this.updateFromTaskMap(activeTaskId, taskMap);
          } else {
            this.cadValue = 'No Active Call';
            this.render();
          }
        } else {
          this.cadValue = 'No Active Call';
          this.render();
        }

        this.Desktop.agentContact.addEventListener('change', this.boundHandleUpdate);
      } catch (err) {
        console.error('[custom-cad-widget] Failed to initialize SDK:', err);
        this.cadValue = 'SDK Load Error';
        this.colorClass = 'red-status';
        this.render();
      }
    }

    disconnectedCallback() {
      if (this.Desktop && this.Desktop.agentContact) {
        this.Desktop.agentContact.removeEventListener('change', this.boundHandleUpdate);
      }
    }

    setupDOM() {
      this.shadowRoot.innerHTML = `
        <style>
          .widget-container {
            font-family: var(--momentum-font-family, sans-serif);
            padding: 15px;
            border-radius: 8px;
            border: 1px solid #dcdcdc;
            margin: 10px;
            transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
          }
          .neutral {
            background-color: #f4f5f7;
            color: #333333;
          }
          .red-status {
            background-color: #ffebe6;
            color: #de350b;
            border-color: #ffbdad;
            font-weight: bold;
          }
          .amber-status {
            background-color: #fff0b3;
            color: #172b4d;
            border-color: #ffe380;
            font-weight: bold;
          }
          .green-status {
            background-color: #e3fcef;
            color: #006644;
            border-color: #abf5d1;
            font-weight: bold;
          }
          h3 {
            margin-top: 0;
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .value-display {
            font-size: 20px;
            margin: 10px 0 0 0;
          }
        </style>
        <div id="container" class="widget-container neutral">
          <h3>Account Status Indicator</h3>
          <p id="status-text" class="value-display">${this.cadValue}</p>
        </div>
      `;

      this.containerEl = this.shadowRoot.getElementById('container');
      this.statusTextEl = this.shadowRoot.getElementById('status-text');
    }

    handleInteractionUpdate(event) {
      this.updateFromTaskMap(event?.detail?.activeTaskId, event?.detail?.taskMap);
    }

    updateFromTaskMap(activeTaskId, taskMap) {
      const task = activeTaskId && taskMap ? taskMap[activeTaskId] : null;
      const cadVariables = task?.interaction?.callAssociatedData;

      if (cadVariables && Object.prototype.hasOwnProperty.call(cadVariables, 'VerifyMeStatus')) {
        const rawValue = cadVariables['VerifyMeStatus']?.value;
        this.cadValue = rawValue !== undefined && rawValue !== null ? String(rawValue) : 'Empty Value';
        this.determineColorCoding(this.cadValue);
      } else if (task) {
        this.cadValue = 'Variable Not Found';
        this.colorClass = 'neutral';
      } else {
        this.cadValue = 'No Active Call';
        this.colorClass = 'neutral';
      }

      this.render();
    }

    determineColorCoding(value) {
      const normalizedValue = String(value ?? '').trim().toLowerCase();
      if (normalizedValue === 'failed' || normalizedValue === 'denied') {
        this.colorClass = 'red-status';
      } else if (normalizedValue === 'expired' || normalizedValue === 'unhandled') {
        this.colorClass = 'amber-status';
      } else if (normalizedValue === 'confirmed') {
        this.colorClass = 'green-status';
      } else {
        this.colorClass = 'neutral';
      }
    }

    render() {
      if (!this.containerEl || !this.statusTextEl) return;
      this.containerEl.className = `widget-container ${this.colorClass}`;
      this.statusTextEl.textContent = this.cadValue;
    }
  }

  if (!customElements.get('custom-cad-widget')) {
    customElements.define('custom-cad-widget', CustomCadWidget);
  }
})();