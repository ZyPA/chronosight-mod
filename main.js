const mod_id = 'chronosight';

const m = (window[mod_id] ??= {
  version: 1.1,
  cycles: [3, 12, 24]
});

Game.registerMod(mod_id, {
  init() {
    let lastBestUpdate;

    /* ------------------------------------------------------------------ */
    /* Lifecycle                                                           */
    /* ------------------------------------------------------------------ */

    m.setup = function () {
      if (!m.loaded && Game.Objects['Temple'].minigameLoaded) {
        m.start();
        Game.registerHook('logic', m.updateBest);
        Game.removeHook('logic', m.setup);
      }
    };

    m.start = function () {
      if (m.loaded) return;

      m.minigame = Game.Objects['Temple'].minigame;
      m.ages = m.minigame.gods['ages'];

      m.state = {
        best: undefined
      };

      m.mountSprite();
      m.patchTooltips();

      m.loaded = true;
    };

    m.updateBest = function () {
      if (!lastBestUpdate || Game.t - lastBestUpdate > 1000) {
        m.setBest(m.calculateBest());
        lastBestUpdate = Game.t;
      }
    };

    /* ------------------------------------------------------------------ */
    /* Utilities                                                           */
    /* ------------------------------------------------------------------ */

    m.getCycle = (id) => (id !== -1 ? m.cycles[id] : -1);

    m.getSlotName = (id) => (id !== -1 ? m.minigame.slotNames[id] : 'None');

    /* ------------------------------------------------------------------ */
    /* Tooltip UI                                                          */
    /* ------------------------------------------------------------------ */

    m.patchTooltips = function () {
      ['desc1', 'desc2', 'desc3'].forEach((key, index) => {
        const original = Object.getOwnPropertyDescriptor(m.ages, key);

        Object.defineProperty(m.ages, key, {
          get() {
            const base =
              original.get ? original.get.call(this) : original.value;

            return base + m.tooltip(index);
          }
        });
      });
    };

    m.tooltip = function (id) {
      const cycle = m.getCycle(id);
      const { effect, slope } = m.cycleData(cycle);

      const trend =
        Math.abs(slope) < 0.1 ? 'flat'
        : slope < 0 ? 'down'
        : 'up';

      const isNegative = effect < 0;

      const effectString = `${isNegative ? '-' : '+'}${Beautify(Math.abs(effect), 2)}%`;

      return `
        <span
          style="
            float:right;
            display:inline-flex;
            align-items:baseline;
            gap:.33rem;
            padding-right:.33rem;
            ${m.state.best === id ? 'color:#fc0;' : ''}
          "
          ${
            m.state.best === id ? '' : `class="${isNegative ? 'red' : 'green'}"`
          }
        >
          ${effectString}
          
          <svg
            width="1em"
            height="1em"
            style="
              align-self:center;
              display:block;
            "
          >
            <use href="#${mod_id}-trending-${trend}"></use>
          </svg>
        </span>
      `;
    };

    m.mountSprite = function () {
      const spriteSymbols = {
        'trending-up': `
          <symbol id="${mod_id}-trending-up" viewBox="0 -960 960 960">
            <path class="green" fill="currentColor"
              d="m136-240-56-56 296-298 160 160 208-206H640v-80h240v240h-80v-104L536-320 376-480 136-240Z"/>
          </symbol>
        `,
        'trending-flat': `
          <symbol id="${mod_id}-trending-flat" viewBox="0 -960 960 960">
            <path class="gray" fill="currentColor"
              d="m700-300-57-56 84-84H120v-80h607l-83-84 57-56 179 180-180 180Z"/>
          </symbol>
        `,
        'trending-down': `
          <symbol id="${mod_id}-trending-down" viewBox="0 -960 960 960">
            <path class="red" fill="currentColor"
              d="M640-240v-80h104L536-526 376-366 80-664l56-56 240 240 160-160 264 264v-104h80v240H640Z"/>
          </symbol>
        `
      };

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');

      svg.id = `${mod_id}-sprite-root`;
      svg.style.display = 'none';
      svg.innerHTML = Object.values(spriteSymbols).join('');

      document.getElementById(svg.id)?.remove();
      document.body.prepend(svg);
    };

    /* ------------------------------------------------------------------ */
    /* Math                                                                */
    /* ------------------------------------------------------------------ */

    m.cycleData = (cycle) => {
      if (cycle === -1) {
        return {
          effect: 0,
          slope: 0,
          hourlyAverage: 0,
          getAverage: () => 0
        };
      }

      const timeHours = (Game.time / (60 * 60 * 1000)) % 24;

      const amplitude = 15;
      const omega = (2 * Math.PI) / cycle;
      const phase = omega * timeHours;

      return {
        effect: amplitude * Math.sin(phase),
        slope: amplitude * omega * Math.cos(phase),

        hourlyAverage:
          (amplitude / omega) * (Math.cos(phase) - Math.cos(phase + omega))
      };
    };

    m.calculateBest = () => {
      const currentData = m.cycleData(m.ages.slot);

      const current = [
        currentData.effect,
        currentData.hourlyAverage,
        m.ages.slot
      ];

      const candidates = m.cycles.map((cycle, id) => {
        const data = m.cycleData(cycle);

        return [data.effect, data.hourlyAverage, id];
      });

      candidates.push([0, 0, -1]);

      const bestCandidate = [...candidates].sort((a, b) => b[1] - a[1])[0];

      const best = current[0] > bestCandidate[0] ? current : bestCandidate;

      return best[2];
    };

    /* ------------------------------------------------------------------ */
    /* State                                                               */
    /* ------------------------------------------------------------------ */

    m.setBest = function (value) {
      if (m.state.best === value) return;

      if (value != m.ages.slot) {
        Game.Notify(
          'BiS cyclius slot changed',
          `${m.getSlotName(m.ages.slot)} → ${m.getSlotName(value)}.`,
          [24, 18]
        );
      }

      m.state.best = value;
    };

    /* ------------------------------------------------------------------ */
    /* Init                                                                */
    /* ------------------------------------------------------------------ */

    Game.registerHook('logic', m.setup);

    Game.Notify('Chronosight loaded!', 'Version ' + m.version, [24, 18]);
  }
});
