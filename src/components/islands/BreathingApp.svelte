<script lang="ts">
  import { onDestroy } from 'svelte';
  import { clamp } from '@lib/helpers';

  type Phase = 'idle' | 'breathing' | 'retention' | 'recovery' | 'complete';

  interface SessionConfig {
    breaths: number;
    rounds: number;
    recoveryHold: number;
  }

  const PHASE_LABEL: Record<Phase, string> = {
    idle: 'Bereit',
    breathing: 'Atmen',
    retention: 'Halten',
    recovery: 'Erholung',
    complete: 'Geschafft',
  };

  const BREATH_VALUES = Array.from({ length: 11 }, (_, i) => 10 + i * 5);

  const PICKER_ITEM_WIDTH = 72;
  const DRAG_THRESHOLD_PX = 4;
  const INHALE_MS = 1800;
  const EXHALE_MS = 1800;
  const CYCLE_MS = INHALE_MS + EXHALE_MS;

  function formatTime(seconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(safeSeconds / 60);
    const s = safeSeconds % 60;

    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function circleMotion(phase: Phase): string | undefined {
    if (phase === 'breathing') return 'wave';
    if (phase === 'retention') return 'hold-high';
    if (phase === 'recovery') return 'hold-low';

    return undefined;
  }

  function closestBreathIndex(value: number): number {
    return clamp(Math.round((value - 10) / 5), 0, BREATH_VALUES.length - 1);
  }

  // ─── Reactive state ────────────────────────────────────────────────
  let phase = $state<Phase>('idle');
  let round = $state(0);
  let breath = $state(0);
  let timerSeconds = $state(0);

  let settingBreaths = $state(35);
  let settingRounds = $state(3);
  let settingRecovery = $state(15);

  let session = $state<SessionConfig | null>(null);

  // ─── Picker state ─────────────────────────────────────────────────
  let breathIndex = $state(closestBreathIndex(settingBreaths));
  let pickerOffset = $state(0);
  let isDraggingPicker = $state(false);

  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let hasDragged = false;

  // ─── Scheduling handles ───────────────────────────────────────────
  let timeoutHandle: number | null = null;
  let intervalHandle: number | null = null;
  let rafHandle: number | null = null;

  const isActive = $derived(
    phase === 'breathing' || phase === 'retention' || phase === 'recovery',
  );

  const currentSession = $derived(
    session ?? {
      breaths: settingBreaths,
      rounds: settingRounds,
      recoveryHold: settingRecovery,
    },
  );

  const sessionRounds = $derived(currentSession.rounds);
  const sessionBreaths = $derived(currentSession.breaths);
  const motion = $derived(circleMotion(phase));

  const pickerTransform = $derived(
    `translate3d(${-breathIndex * PICKER_ITEM_WIDTH + pickerOffset}px, 0, 0)`,
  );

  const pickerTransition = $derived(
    isDraggingPicker
      ? 'none'
      : 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)',
  );

  // Fractional position of the centre indicator over the track, in item units.
  // pickerOffset is 0 at rest, so this collapses to breathIndex when idle.
  const centerFloat = $derived(breathIndex - pickerOffset / PICKER_ITEM_WIDTH);

  // The value nearest the centre indicator — the one we "activate". Updates
  // live while dragging so the focused number lights up under the thumb.
  const focusedIndex = $derived(
    clamp(Math.round(centerFloat), 0, BREATH_VALUES.length - 1),
  );

  // Native picker-wheel depth: items scale and fade with their distance from
  // the centre. Driven inline (not via :class) so it tracks the drag frame by
  // frame; the CSS transition only kicks in on release to settle.
  function itemDepth(index: number): string {
    const distance = Math.abs(index - centerFloat);
    const scale = clamp(1.18 - distance * 0.32, 0.62, 1.18);
    const opacity = clamp(1 - distance * 0.32, 0.18, 1);

    return `transform: scale(${scale.toFixed(3)}); opacity: ${opacity.toFixed(3)};`;
  }

  const counterText = $derived.by(() => {
    switch (phase) {
      case 'idle':
        return `${settingRounds} Runden · ${settingBreaths} Atemzüge`;

      case 'breathing':
        return `Atemzug ${breath}`;

      case 'retention':
        return `Halten · ${formatTime(timerSeconds)}`;

      case 'recovery':
        return `Halten · ${timerSeconds}s`;

      case 'complete':
        return 'Nimm dir einen Moment, spüre nach.';
    }
  });

  const startLabel = $derived(
    phase === 'complete' ? 'Erneut starten' : 'Atemübung starten',
  );

  const holdLabel = $derived(
    phase === 'recovery' ? 'Weiteratmen' : 'Atem freigeben',
  );

  const showStart = $derived(phase === 'idle' || phase === 'complete');
  const showHold = $derived(phase === 'retention' || phase === 'recovery');

  // ─── Scheduling ────────────────────────────────────────────────────
  function clearScheduled(): void {
    if (timeoutHandle !== null) {
      window.clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (intervalHandle !== null) {
      window.clearInterval(intervalHandle);
      intervalHandle = null;
    }

    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  }

  // ─── Phase transitions ─────────────────────────────────────────────
  function enterIdle(): void {
    clearScheduled();

    phase = 'idle';
    round = 0;
    breath = 0;
    timerSeconds = 0;
    session = null;
  }

  function finishSession(): void {
    clearScheduled();

    phase = 'complete';
    breath = 0;
    timerSeconds = 0;
  }

  function beginSession(): void {
    session = {
      breaths: settingBreaths,
      rounds: settingRounds,
      recoveryHold: settingRecovery,
    };

    round = 0;
    breath = 0;
    timerSeconds = 0;

    startBreathing();
  }

  function startBreathing(): void {
    clearScheduled();

    phase = 'breathing';
    round += 1;
    breath = 1;
    timerSeconds = 0;

    const startedAt = performance.now();
    const breathLimit = currentSession.breaths;

    intervalHandle = window.setInterval(() => {
      if (phase !== 'breathing') return;

      if (breath >= breathLimit) {
        startRetention();
        return;
      }

      breath += 1;
    }, CYCLE_MS);

    const tick = (): void => {
      if (phase !== 'breathing') return;

      timerSeconds = Math.floor((performance.now() - startedAt) / 1000);
      timeoutHandle = window.setTimeout(tick, 1000);
    };

    timeoutHandle = window.setTimeout(tick, 1000);
  }

  function startRetention(): void {
    clearScheduled();

    phase = 'retention';
    timerSeconds = 0;

    const startedAt = performance.now();

    const loop = (): void => {
      if (phase !== 'retention') return;

      timerSeconds = Math.floor((performance.now() - startedAt) / 1000);
      rafHandle = window.requestAnimationFrame(loop);
    };

    rafHandle = window.requestAnimationFrame(loop);
  }

  function startRecovery(): void {
    clearScheduled();

    phase = 'recovery';
    timerSeconds = currentSession.recoveryHold;

    const tick = (): void => {
      if (phase !== 'recovery') return;

      timerSeconds -= 1;

      if (timerSeconds <= 0) {
        goToNextRound();
        return;
      }

      timeoutHandle = window.setTimeout(tick, 1000);
    };

    timeoutHandle = window.setTimeout(tick, 1000);
  }

  function goToNextRound(): void {
    if (round >= currentSession.rounds) {
      finishSession();
      return;
    }

    startBreathing();
  }

  // ─── Actions ───────────────────────────────────────────────────────
  function onCircleClick(): void {
    if (phase === 'idle' || phase === 'complete') {
      beginSession();
    }
  }

  function onHoldClick(): void {
    if (phase === 'retention') {
      startRecovery();
      return;
    }

    if (phase === 'recovery') {
      goToNextRound();
    }
  }

  function setBreathIndex(index: number): void {
    if (isActive) return;

    breathIndex = clamp(index, 0, BREATH_VALUES.length - 1);
    settingBreaths = BREATH_VALUES[breathIndex];
  }

  function adjustRounds(delta: number): void {
    if (isActive) return;

    settingRounds = clamp(settingRounds + delta, 1, 6);
  }

  function adjustRecovery(delta: number): void {
    if (isActive) return;

    settingRecovery = clamp(settingRecovery + delta, 5, 30);
  }

  // ─── Picker events ─────────────────────────────────────────────────
  function onPickerPointerDown(event: PointerEvent): void {
    if (isActive) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    dragPointerId = event.pointerId;
    dragStartX = event.clientX;
    hasDragged = false;
    isDraggingPicker = true;

    if (event.currentTarget instanceof HTMLElement) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }

  function onPickerPointerMove(event: PointerEvent): void {
    if (dragPointerId !== event.pointerId) return;

    const delta = event.clientX - dragStartX;

    if (!hasDragged && Math.abs(delta) > DRAG_THRESHOLD_PX) {
      hasDragged = true;
    }

    pickerOffset = delta;

    // Activate the value currently nearest the centre, live under the thumb.
    settingBreaths = BREATH_VALUES[focusedIndex];
  }

  function onPickerPointerEnd(event: PointerEvent): void {
    if (dragPointerId !== event.pointerId) return;

    // Snap to whatever is in focus right now (read before the offset resets).
    const target = focusedIndex;

    dragPointerId = null;
    pickerOffset = 0;
    isDraggingPicker = false;

    if (hasDragged) {
      setBreathIndex(target);
    }
  }

  function onPickerClick(value: number, event: MouseEvent): void {
    if (isActive) {
      event.preventDefault();
      return;
    }

    if (hasDragged) {
      event.preventDefault();
      event.stopPropagation();
      hasDragged = false;
      return;
    }

    setBreathIndex(closestBreathIndex(value));
  }

  function onPickerKeydown(event: KeyboardEvent): void {
    if (isActive) return;

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        setBreathIndex(breathIndex - 1);
        break;

      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        setBreathIndex(breathIndex + 1);
        break;

      case 'Home':
        event.preventDefault();
        setBreathIndex(0);
        break;

      case 'End':
        event.preventDefault();
        setBreathIndex(BREATH_VALUES.length - 1);
        break;
    }
  }

  function onPickerWheel(event: WheelEvent): void {
    if (isActive) return;
    if (Math.abs(event.deltaX) < Math.abs(event.deltaY)) return;

    event.preventDefault();

    if (event.deltaX > 10) {
      setBreathIndex(breathIndex + 1);
    } else if (event.deltaX < -10) {
      setBreathIndex(breathIndex - 1);
    }
  }

  onDestroy(clearScheduled);
</script>

<div
  class="breathing-app"
  data-motion-essential
  data-phase={phase}
  style="--breathing-cycle-ms: {CYCLE_MS}ms"
>
  <div class="breathing-app__stage" aria-live="polite">
    <button
      type="button"
      class="breathing-app__circle"
      data-motion={motion}
      aria-label={`${PHASE_LABEL[phase]}: ${counterText}`}
      onclick={onCircleClick}
    >
      <span
        class="breathing-app__ring breathing-app__ring--1"
        aria-hidden="true"
      ></span>
      <span
        class="breathing-app__ring breathing-app__ring--2"
        aria-hidden="true"
      ></span>
      <span
        class="breathing-app__ring breathing-app__ring--3"
        aria-hidden="true"
      ></span>
      <span class="breathing-app__core" aria-hidden="true"></span>

      <span class="breathing-app__label">
        <span class="breathing-app__phase">{PHASE_LABEL[phase]}</span>
        <span class="breathing-app__counter">{counterText}</span>
      </span>
    </button>
  </div>

  <div class="breathing-app__meta">
    <div class="breathing-app__meta-item">
      <span class="breathing-app__meta-label">Runde</span>
      <span class="breathing-app__meta-value">{round} / {sessionRounds}</span>
    </div>

    <div class="breathing-app__meta-item">
      <span class="breathing-app__meta-label">Atemzug</span>
      <span class="breathing-app__meta-value">{breath} / {sessionBreaths}</span>
    </div>

    <div class="breathing-app__meta-item">
      <span class="breathing-app__meta-label">Zeit</span>
      <span class="breathing-app__meta-value">{formatTime(timerSeconds)}</span>
    </div>
  </div>

  <div class="breathing-app__controls">
    {#if showStart}
      <button
        type="button"
        class="btn btn--primary btn--icon breathing-app__start"
        aria-label={startLabel}
        title={startLabel}
        onclick={beginSession}
      >
        <svg class="icon" aria-hidden="true" focusable="false">
          <use href="#icon-play"></use>
        </svg>
      </button>
    {/if}

    {#if showHold}
      <button type="button" class="btn btn--outline" onclick={onHoldClick}>
        {holdLabel}
      </button>
    {/if}

    <button type="button" class="btn btn--ghost" onclick={enterIdle}>
      Zurücksetzen
    </button>
  </div>

  <div class="breathing-app__settings" aria-disabled={isActive}>
    <div class="breathing-app__setting breathing-app__setting--picker">
      <span class="breathing-app__setting-label">Atemzüge je Runde</span>

      <div
        class={`breathing-picker ${isDraggingPicker ? 'is-dragging' : ''}`}
        role="slider"
        tabindex="0"
        aria-label="Atemzüge je Runde"
        aria-valuemin={BREATH_VALUES[0]}
        aria-valuemax={BREATH_VALUES[BREATH_VALUES.length - 1]}
        aria-valuenow={settingBreaths}
        aria-valuetext={`${settingBreaths} Atemzüge`}
        aria-disabled={isActive ? 'true' : undefined}
        onkeydown={onPickerKeydown}
        onwheel={onPickerWheel}
      >
        <div class="breathing-picker__indicator" aria-hidden="true"></div>

        <div
          class="breathing-picker__track"
          style={`transform: ${pickerTransform}; transition: ${pickerTransition};`}
          onpointerdown={onPickerPointerDown}
          onpointermove={onPickerPointerMove}
          onpointerup={onPickerPointerEnd}
          onpointercancel={onPickerPointerEnd}
        >
          {#each BREATH_VALUES as value, index}
            <button
              type="button"
              class={`breathing-picker__item ${
                index === focusedIndex ? 'is-active' : ''
              }`}
              style={itemDepth(index)}
              tabindex={index === focusedIndex ? 0 : -1}
              aria-label={`${value} Atemzüge`}
              onclick={(event) => onPickerClick(value, event)}
            >
              {value}
            </button>
          {/each}
        </div>

        <div
          class="breathing-picker__fade breathing-picker__fade--start"
          aria-hidden="true"
        ></div>
        <div
          class="breathing-picker__fade breathing-picker__fade--end"
          aria-hidden="true"
        ></div>
      </div>
    </div>

    <div class="breathing-app__setting breathing-app__setting--stepper">
      <span class="breathing-app__setting-label">Runden</span>

      <div class="breathing-stepper">
        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Eine Runde weniger"
          disabled={isActive || settingRounds <= 1}
          onclick={() => adjustRounds(-1)}
        >
          −
        </button>

        <span
          class="breathing-stepper__value"
          role="spinbutton"
          aria-valuemin="1"
          aria-valuemax="6"
          aria-valuenow={settingRounds}
        >
          {settingRounds}
        </span>

        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Eine Runde mehr"
          disabled={isActive || settingRounds >= 6}
          onclick={() => adjustRounds(1)}
        >
          +
        </button>
      </div>
    </div>

    <div class="breathing-app__setting breathing-app__setting--stepper">
      <span class="breathing-app__setting-label">Erholungs-Halt (Sek.)</span>

      <div class="breathing-stepper">
        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Erholungs-Halt verringern"
          disabled={isActive || settingRecovery <= 5}
          onclick={() => adjustRecovery(-1)}
        >
          −
        </button>

        <span
          class="breathing-stepper__value"
          role="spinbutton"
          aria-valuemin="5"
          aria-valuemax="30"
          aria-valuenow={settingRecovery}
        >
          {settingRecovery}
        </span>

        <button
          type="button"
          class="breathing-stepper__btn"
          aria-label="Erholungs-Halt erhöhen"
          disabled={isActive || settingRecovery >= 30}
          onclick={() => adjustRecovery(1)}
        >
          +
        </button>
      </div>
    </div>
  </div>
</div>
