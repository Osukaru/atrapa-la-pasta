const ROUND_SECONDS = 120;
const LETTERS = ["A", "B", "C", "D"];

const dom = {
  startScreen: document.querySelector("#startScreen"),
  startMessage: document.querySelector("#startMessage"),
  startButton: document.querySelector("#startButton"),
  gameScreen: document.querySelector("#gameScreen"),
  roundLevel: document.querySelector("#roundLevel"),
  difficultyBadge: document.querySelector("#difficultyBadge"),
  roundTitle: document.querySelector("#roundTitle"),
  timerCard: document.querySelector("#timerCard"),
  timer: document.querySelector("#timer"),
  stage: document.querySelector("#stage"),
  themeChoice: document.querySelector("#themeChoice"),
  questionCard: document.querySelector("#questionCard"),
  phaseLabel: document.querySelector("#phaseLabel"),
  questionText: document.querySelector("#questionText"),
  optionsGrid: document.querySelector("#optionsGrid"),
  advanceZone: document.querySelector("#advanceZone"),
  hintModal: document.querySelector("#hintModal"),
  hintModalText: document.querySelector("#hintModalText"),
  hintCloseButton: document.querySelector("#hintCloseButton"),
  lifelines: {
    fifty: document.querySelector("#lifelineFifty"),
    call: document.querySelector("#lifelineCall"),
    hint: document.querySelector("#lifelineHint")
  }
};

const state = {
  rounds: [],
  pendingQuestions: null,
  roundIndex: 0,
  currentQuestion: null,
  phase: "loading",
  visibleOptions: 0,
  revealed: new Set(),
  hiddenByFifty: new Set(),
  timeLeft: ROUND_SECONDS,
  timerId: null,
  timerRunning: false,
  lifelinesUnlocked: false,
  lifelinesUsed: {
    fifty: false,
    call: false,
    hint: false
  },
  lifelineUsedThisRound: false,
  hintModalOpen: false,
  resumeTimerAfterHint: false,
  audioReady: false,
  audioContext: null,
  tensionNodes: null,
  tensionAudio: null,
  tensionFadeId: null
};

function getDifficulty(round, roundIndex, question = null) {
  if (question?.dificultad) {
    return question.dificultad;
  }

  if (round?.dificultad) {
    return round.dificultad;
  }

  if (roundIndex < 5) {
    return "Fácil";
  }

  if (roundIndex < 10) {
    return "Medio";
  }

  return "Difícil";
}

async function init() {
  bindEvents();

  try {
    const response = await fetch("preguntas.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("No se pudo cargar preguntas.json");
    }
    const data = await response.json();
    validateQuestions(data);
    state.pendingQuestions = data;
    dom.startMessage.textContent = "Todo listo para empezar.";
    dom.startButton.disabled = false;
  } catch (error) {
    dom.startMessage.textContent = "No se ha podido cargar preguntas.json.";
  }
}

function bindEvents() {
  dom.startButton.addEventListener("click", startPreparedGame);
  dom.advanceZone.addEventListener("click", handleAdvanceZoneClick);
  dom.hintCloseButton.addEventListener("click", closeHintModal);

  Object.values(dom.lifelines).forEach((button) => {
    button.addEventListener("click", () => useLifeline(button.dataset.lifeline));
  });

  document.addEventListener("keydown", handleKeyboard);
  document.addEventListener("pointerdown", ensureAudio, { once: true });
  document.addEventListener("keydown", ensureAudio, { once: true });
}

function startPreparedGame() {
  if (!state.pendingQuestions) {
    return;
  }

  startGame(state.pendingQuestions);
}

function startGame(data) {
  state.rounds = data.rondas;
  state.roundIndex = 0;
  state.lifelinesUsed = { fifty: false, call: false, hint: false };
  dom.startScreen.classList.add("is-hidden");
  dom.gameScreen.classList.remove("is-hidden");
  setupRound();
}

function validateQuestions(data) {
  if (!data || !Array.isArray(data.rondas) || data.rondas.length === 0) {
    throw new Error("El JSON debe tener un array 'rondas'.");
  }

  data.rondas.forEach((round, roundIndex) => {
    const questions = round.tipo === "eleccion" ? round.temas : [round];

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error(`La ronda ${roundIndex + 1} no tiene preguntas configuradas.`);
    }

    questions.forEach((question) => {
      const hasFourOptions = Array.isArray(question.opciones) && question.opciones.length === 4;
      const hasValidAnswer = Number.isInteger(question.correcta) && question.correcta >= 0 && question.correcta < 4;
      const hasExplanation = typeof question.explicacion === "string" && question.explicacion.trim() !== "";
      const hasExplanationPhoto = typeof question.foto_explicacion === "string" && question.foto_explicacion.trim() !== "";

      if (!question.tema || !question.pregunta || !hasFourOptions || !hasValidAnswer || !hasExplanation || !hasExplanationPhoto) {
        throw new Error(`La ronda ${roundIndex + 1} no tiene el formato esperado.`);
      }
    });
  });
}

function setupRound() {
  stopTimer();
  stopTension();
  resetTensionAudio();

  state.currentQuestion = null;
  state.phase = "setup";
  state.visibleOptions = 0;
  state.revealed = new Set();
  state.hiddenByFifty = new Set();
  state.timeLeft = ROUND_SECONDS;
  state.timerRunning = false;
  state.lifelinesUnlocked = state.roundIndex >= 3;
  state.lifelineUsedThisRound = false;

  const round = state.rounds[state.roundIndex];
  dom.themeChoice.innerHTML = "";
  dom.themeChoice.classList.add("is-hidden");
  dom.stage.classList.toggle("is-choosing-theme", round.tipo === "eleccion");
  dom.questionCard.classList.remove("is-visible");
  closeHintModal({ resumeTimer: false });
  dom.optionsGrid.innerHTML = "";
  dom.optionsGrid.classList.remove("is-showing-explanation");

  dom.roundLevel.textContent = `Ronda ${state.roundIndex + 1} de ${state.rounds.length}`;
  dom.difficultyBadge.textContent = `Nivel ${getDifficulty(round, state.roundIndex)}`;
  dom.roundTitle.textContent = round.tipo === "eleccion" ? "Elegid temática" : round.tema;
  dom.phaseLabel.textContent = "Pregunta";
  dom.questionText.textContent = round.tipo === "eleccion" ? "" : round.pregunta;

  if (round.tipo === "eleccion") {
    renderThemeChoice(round);
    setStatus("Ronda de elección: elige uno de los temas para continuar.");
  } else {
    state.currentQuestion = round;
    renderOptions(round);
    setStatus("");
  }

  updateTimerDisplay();
  updateControls();
  updateLifelines();
}

function renderThemeChoice(round) {
  dom.themeChoice.classList.remove("is-hidden");
  round.temas.forEach((question, index) => {
    const button = document.createElement("button");
    button.className = "theme-button";
    button.type = "button";
    button.textContent = question.tema;
    button.addEventListener("click", () => selectTheme(question, index));
    dom.themeChoice.append(button);
  });
}

function selectTheme(question) {
  state.currentQuestion = question;
  state.phase = "setup";
  dom.themeChoice.classList.add("is-hidden");
  dom.stage.classList.remove("is-choosing-theme");
  dom.questionCard.classList.remove("is-visible");
  dom.difficultyBadge.textContent = `Nivel ${getDifficulty(state.rounds[state.roundIndex], state.roundIndex, question)}`;
  dom.roundTitle.textContent = question.tema;
  dom.phaseLabel.textContent = "Pregunta";
  dom.questionText.textContent = question.pregunta;
  renderOptions(question);
  playEffect("advance");
  setStatus("");
  updateControls();
}

function renderOptions(question) {
  dom.optionsGrid.innerHTML = "";
  dom.optionsGrid.classList.remove("is-showing-explanation");
  question.opciones.forEach((option, index) => {
    const card = document.createElement("button");
    card.className = "option-card";
    card.type = "button";
    card.dataset.index = String(index);
    card.innerHTML = `
      <span class="option-face option-front">
        <span class="option-letter">${LETTERS[index]}</span>
        <span class="option-text">${escapeHtml(option)}</span>
      </span>
      <span class="option-face option-back" aria-hidden="true">
        <span>${LETTERS[index]}</span>
      </span>
    `;
    card.addEventListener("click", () => revealOption(index));
    dom.optionsGrid.append(card);
  });
}

function renderExplanation(question) {
  dom.optionsGrid.classList.add("is-showing-explanation");
  dom.optionsGrid.innerHTML = `
    <article class="explanation-card">
      <div class="explanation-media">
        <img src="${escapeHtml(question.foto_explicacion)}" alt="Imagen de explicación para ${escapeHtml(question.tema)}">
      </div>
      <div class="explanation-copy">
        <p class="eyebrow">Explicación</p>
        <p>${escapeHtml(question.explicacion)}</p>
      </div>
    </article>
  `;
}

function advance() {
  if (!state.currentQuestion) {
    setStatus("Primero selecciona una temática.");
    return;
  }

  ensureAudio();

  if (state.phase === "setup" || state.phase === "options") {
    state.phase = "options";
    if (state.visibleOptions < state.currentQuestion.opciones.length) {
      state.visibleOptions += 1;
      showVisibleOptions();
      dom.phaseLabel.textContent = "Pregunta";
      setStatus("");
      playEffect("advance");
      updateControls();
      return;
    }

    state.phase = "question";
    dom.phaseLabel.textContent = "Pregunta";
    dom.questionCard.classList.add("is-visible");
    playEffect("question");
    toggleTimer();
    return;
  }

  if (state.phase === "question") {
    toggleTimer();
    return;
  }

  if (state.phase === "finished") {
    state.phase = "explanation";
    dom.phaseLabel.textContent = "Explicación";
    renderExplanation(state.currentQuestion);
    setStatus("Explicación mostrada. Pulsa avanzar para pasar a la siguiente ronda.");
    playEffect("advance");
    updateControls();
    return;
  }

  if (state.phase === "explanation") {
    nextRound();
  }
}

function handleAdvanceZoneClick() {
  if (state.phase === "timing") {
    toggleTimer();
    return;
  }

  advance();
}

function showVisibleOptions() {
  getOptionCards().forEach((card, index) => {
    card.classList.toggle("is-visible", index < state.visibleOptions);
  });
}

function toggleTimer() {
  if (!state.currentQuestion || !["question", "timing"].includes(state.phase)) {
    setStatus("El tiempo solo puede iniciarse cuando la pregunta ya está visible.");
    return;
  }

  ensureAudio();

  if (state.timerRunning) {
    pauseTimer("Tiempo pausado.");
    return;
  }

  state.phase = "timing";
  state.timerRunning = true;
  dom.phaseLabel.textContent = "Pregunta";
  dom.timerCard.classList.add("is-running");
  state.timerId = window.setInterval(tick, 1000);
  startTension();
  playEffect("start");
  setStatus("Tiempo iniciado: 2 minutos.");
  updateTimerDisplay();
  updateControls();
  updateLifelines();
}

function tick() {
  state.timeLeft = Math.max(0, state.timeLeft - 1);
  updateTimerDisplay();

  if (state.timeLeft === 10) {
    playEffect("warning");
  }

  if (state.timeLeft <= 0) {
    finishDeliberation("Tiempo agotado.");
  }
}

function pauseTimer(message = "Tiempo pausado.") {
  stopTimer();
  stopTension();
  playEffect("pause");
  setStatus(message);
  updateControls();
  updateLifelines();
}

function finishDeliberation(message = "Deliberación finalizada. Revela las respuestas en el orden que quieras.") {
  if (!["question", "timing"].includes(state.phase)) {
    return;
  }

  stopTimer();
  stopTension();
  state.phase = "reveal";
  dom.phaseLabel.textContent = "Pregunta";
  setStatus(message);
  playEffect("finish");
  updateTimerDisplay();
  updateControls();
  updateLifelines();
}

function revealOption(index) {
  if (!canRevealOptions() || state.revealed.has(index)) {
    return;
  }

  state.revealed.add(index);
  const card = getOptionCards()[index];
  const isCorrect = index === state.currentQuestion.correcta;
  card.classList.add("is-visible", "is-revealed", isCorrect ? "is-correct" : "is-wrong");
  playEffect(isCorrect ? "correct" : "wrong");

  if (isCorrect) {
    state.phase = "finished";
    dom.phaseLabel.textContent = "Pregunta";
    setStatus("Respuesta correcta revelada. Pulsa avanzar para ver la explicación.");
    updateTimerDisplay();
  } else {
    setStatus(`La opción ${LETTERS[index]} no era correcta.`);
  }

  updateControls();
}

function canRevealOptions() {
  return state.phase === "reveal" || (state.phase === "timing" && !state.timerRunning);
}

function nextRound() {
  if (state.roundIndex >= state.rounds.length - 1) {
    stopTimer();
    stopTension();
    state.phase = "complete";
    dom.roundLevel.textContent = "Final";
    dom.roundTitle.textContent = "Partida terminada";
    dom.phaseLabel.textContent = "Enhorabuena";
    dom.questionText.textContent = "Habéis llegado al final de Atrapa la pasta.";
    dom.optionsGrid.innerHTML = "";
    dom.optionsGrid.classList.remove("is-showing-explanation");
    dom.themeChoice.classList.add("is-hidden");
    setStatus("Fin de la partida.");
    updateControls();
    updateLifelines();
    playEffect("correct");
    return;
  }

  state.roundIndex += 1;
  setupRound();
  playEffect("advance");
}

function useLifeline(type) {
  if (!canUseLifeline(type)) {
    return;
  }

  ensureAudio();
  state.lifelinesUsed[type] = true;
  state.lifelineUsedThisRound = true;

  if (type === "fifty") {
    useFifty();
  }

  if (type === "call") {
    useCall();
  }

  if (type === "hint") {
    useHint();
  }

  playEffect("lifeline");
  updateLifelines();
  updateControls();
}

function canUseLifeline(type) {
  if (!state.lifelinesUnlocked) {
    setStatus("Los comodines se desbloquean después de la ronda 3.");
    return false;
  }

  if (state.phase !== "timing" || !state.timerRunning) {
    setStatus("Los comodines solo se pueden usar con el tiempo corriendo.");
    return false;
  }

  if (state.lifelinesUsed[type]) {
    setStatus("Ese comodín ya se ha usado en esta partida.");
    return false;
  }

  if (state.lifelineUsedThisRound) {
    setStatus("Solo se puede usar un comodín por ronda.");
    return false;
  }

  return true;
}

function useFifty() {
  const wrongOptions = state.currentQuestion.opciones
    .map((_, index) => index)
    .filter((index) => index !== state.currentQuestion.correcta && !state.hiddenByFifty.has(index));
  shuffle(wrongOptions)
    .slice(0, 2)
    .forEach((index) => {
      state.hiddenByFifty.add(index);
      getOptionCards()[index].classList.add("is-hidden-by-lifeline");
    });
  setStatus("Comodín 50% usado: dos respuestas falsas han desaparecido.");
}

function useCall() {
  pauseTimer("Comodín llamada usado. Tiempo pausado para gestionar la llamada.");
  setStatus("Comodín llamada usado. Pulsa T para reanudar el tiempo al terminar.");
}

function useHint() {
  openHintModal(state.currentQuestion.pista || "Esta pregunta no tiene pista configurada.");
  setStatus("Comodín pista usado.");
}

function openHintModal(hint) {
  state.resumeTimerAfterHint = state.phase === "timing" && state.timerRunning;

  if (state.resumeTimerAfterHint) {
    pauseTimer("Comodín pista usado. Tiempo pausado.");
  }

  state.hintModalOpen = true;
  dom.hintModalText.textContent = hint;
  dom.hintModal.classList.remove("is-hidden");
  dom.hintCloseButton.focus();
}

function closeHintModal(options = {}) {
  const shouldResume = options.resumeTimer ?? true;

  if (!state.hintModalOpen && dom.hintModal.classList.contains("is-hidden")) {
    return;
  }

  dom.hintModal.classList.add("is-hidden");
  state.hintModalOpen = false;

  if (shouldResume && state.resumeTimerAfterHint && state.phase === "timing" && !state.timerRunning) {
    state.resumeTimerAfterHint = false;
    toggleTimer();
    return;
  }

  state.resumeTimerAfterHint = false;
}

function updateControls() {
  const canAdvance = ["setup", "options", "question", "finished", "explanation"].includes(state.phase) && Boolean(state.currentQuestion);
  const canToggleTimer = state.phase === "timing";
  dom.advanceZone.classList.toggle("is-hidden", !canAdvance && !canToggleTimer);
  dom.advanceZone.classList.toggle("is-timer-control", canToggleTimer);
  dom.advanceZone.classList.toggle("is-paused", canToggleTimer && !state.timerRunning);
  dom.advanceZone.disabled = !canAdvance && !canToggleTimer;

  getOptionCards().forEach((card, index) => {
    card.disabled = !canRevealOptions() || state.revealed.has(index) || state.hiddenByFifty.has(index);
  });
}

function updateLifelines() {
  Object.entries(dom.lifelines).forEach(([type, button]) => {
    const isUsed = state.lifelinesUsed[type];
    const isAvailable = state.lifelinesUnlocked && !isUsed && !state.lifelineUsedThisRound && state.phase === "timing" && state.timerRunning;
    button.disabled = !isAvailable;
    button.classList.toggle("is-used", isUsed);
    button.classList.toggle("is-available", isAvailable);
  });
}

function updateTimerDisplay() {
  const minutes = String(Math.floor(state.timeLeft / 60)).padStart(2, "0");
  const seconds = String(state.timeLeft % 60).padStart(2, "0");
  dom.timer.textContent = `${minutes}:${seconds}`;
  dom.timerCard.classList.toggle("is-danger", state.timeLeft <= 15);
  dom.timerCard.classList.toggle("is-paused", state.phase === "timing" && !state.timerRunning);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
  state.timerRunning = false;
  dom.timerCard.classList.remove("is-running");
  updateTimerDisplay();
}

function handleKeyboard(event) {
  if (event.target.matches("input, textarea, select")) {
    return;
  }

  if (state.hintModalOpen) {
    if (event.key === "Escape") {
      closeHintModal();
    }
    return;
  }

  if (event.code === "Space") {
    event.preventDefault();
    advance();
  }

  if (event.key.toLowerCase() === "t") {
    toggleTimer();
  }

  if (event.key.toLowerCase() === "f") {
    finishDeliberation();
  }

  if (event.key.toLowerCase() === "n") {
    if (state.phase === "finished" || state.phase === "explanation") {
      advance();
      return;
    }

    nextRound();
  }

  if (/^[1-4]$/.test(event.key)) {
    revealOption(Number(event.key) - 1);
  }
}

function ensureAudio() {
  if (state.audioReady) {
    if (state.audioContext?.state === "suspended") {
      state.audioContext.resume();
    }
    return;
  }

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    return;
  }

  state.audioContext = new AudioContext();
  state.tensionAudio = new Audio("tension-music.mp3");
  state.tensionAudio.loop = false;
  state.tensionAudio.preload = "auto";
  state.tensionAudio.volume = 0;
  state.audioReady = true;
}

function playEffect(type) {
  if (!state.audioContext) {
    return;
  }

  const context = state.audioContext;
  const now = context.currentTime;
  const gain = context.createGain();
  const osc = context.createOscillator();

  const settings = {
    advance: [420, 0.08, "sine", 0.08],
    question: [620, 0.18, "triangle", 0.12],
    start: [260, 0.22, "sawtooth", 0.08],
    pause: [180, 0.12, "sine", 0.07],
    finish: [120, 0.35, "sawtooth", 0.1],
    warning: [880, 0.3, "square", 0.08],
    wrong: [90, 0.42, "sawtooth", 0.12],
    correct: [720, 0.55, "triangle", 0.14],
    lifeline: [520, 0.32, "triangle", 0.12]
  }[type] || [440, 0.1, "sine", 0.08];

  osc.frequency.setValueAtTime(settings[0], now);
  osc.type = settings[2];
  gain.gain.setValueAtTime(settings[3], now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + settings[1]);
  osc.connect(gain);
  gain.connect(context.destination);
  osc.start(now);
  osc.stop(now + settings[1]);
}

function startTension() {
  if (!state.tensionAudio || state.tensionNodes) {
    return;
  }

  clearTensionFade();
  state.tensionAudio.play().catch(() => {});
  fadeTensionVolume(0.55, 450);
  state.tensionNodes = { audio: state.tensionAudio };
}

function stopTension() {
  if (!state.tensionNodes) {
    return;
  }

  fadeTensionVolume(0, 250, () => {
    state.tensionAudio.pause();
  });
  state.tensionNodes = null;
}

function resetTensionAudio() {
  if (!state.tensionAudio) {
    return;
  }

  clearTensionFade();
  state.tensionAudio.pause();
  state.tensionAudio.volume = 0;
  state.tensionAudio.currentTime = 0;
}

function fadeTensionVolume(targetVolume, duration, onComplete = null) {
  clearTensionFade();

  const audio = state.tensionAudio;
  const startVolume = audio.volume;
  const startTime = performance.now();

  state.tensionFadeId = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startTime) / duration);
    audio.volume = startVolume + (targetVolume - startVolume) * progress;

    if (progress >= 1) {
      clearTensionFade();
      onComplete?.();
    }
  }, 16);
}

function clearTensionFade() {
  if (state.tensionFadeId) {
    window.clearInterval(state.tensionFadeId);
    state.tensionFadeId = null;
  }
}

function setStatus() {
}

function getOptionCards() {
  return [...dom.optionsGrid.querySelectorAll(".option-card")];
}

function shuffle(items) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

init();
