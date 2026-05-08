const ROUND_SECONDS = 120;
const LETTERS = ["A", "B", "C", "D"];

const demoQuestions = {
  rondas: [
    {
      tipo: "normal",
      tema: "Matemáticas",
      pregunta: "¿Cuánto es 7 x 8?",
      opciones: ["54", "56", "64", "48"],
      correcta: 1,
      pista: "Es el resultado de sumar 7 ocho veces."
    },
    {
      tipo: "normal",
      tema: "Animales",
      pregunta: "¿Qué animal es conocido como el rey de la selva?",
      opciones: ["Tigre", "León", "Elefante", "Gorila"],
      correcta: 1,
      pista: "Tiene melena y ruge muy fuerte."
    }
  ]
};

const dom = {
  loadingScreen: document.querySelector("#loadingScreen"),
  loadingMessage: document.querySelector("#loadingMessage"),
  jsonInput: document.querySelector("#jsonInput"),
  useDemoButton: document.querySelector("#useDemoButton"),
  gameScreen: document.querySelector("#gameScreen"),
  roundLevel: document.querySelector("#roundLevel"),
  roundTitle: document.querySelector("#roundTitle"),
  timerCard: document.querySelector("#timerCard"),
  timerLabel: document.querySelector("#timerLabel"),
  timer: document.querySelector("#timer"),
  themeChoice: document.querySelector("#themeChoice"),
  phaseLabel: document.querySelector("#phaseLabel"),
  questionText: document.querySelector("#questionText"),
  hintBox: document.querySelector("#hintBox"),
  optionsGrid: document.querySelector("#optionsGrid"),
  statusLine: document.querySelector("#statusLine"),
  advanceButton: document.querySelector("#advanceButton"),
  timerButton: document.querySelector("#timerButton"),
  finishButton: document.querySelector("#finishButton"),
  nextRoundButton: document.querySelector("#nextRoundButton"),
  lifelines: {
    fifty: document.querySelector("#lifelineFifty"),
    call: document.querySelector("#lifelineCall"),
    hint: document.querySelector("#lifelineHint")
  }
};

const state = {
  rounds: [],
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
  audioReady: false,
  audioContext: null,
  tensionNodes: null
};

async function init() {
  bindEvents();

  try {
    const response = await fetch("preguntas.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("No se pudo cargar preguntas.json");
    }
    const data = await response.json();
    startGame(data);
  } catch (error) {
    dom.loadingMessage.textContent =
      "Tu navegador ha bloqueado la carga automática. Selecciona preguntas.json o usa el ejemplo.";
  }
}

function bindEvents() {
  dom.jsonInput.addEventListener("change", loadJsonFromFile);
  dom.useDemoButton.addEventListener("click", () => startGame(demoQuestions));
  dom.advanceButton.addEventListener("click", advance);
  dom.timerButton.addEventListener("click", toggleTimer);
  dom.finishButton.addEventListener("click", finishDeliberation);
  dom.nextRoundButton.addEventListener("click", nextRound);

  Object.values(dom.lifelines).forEach((button) => {
    button.addEventListener("click", () => useLifeline(button.dataset.lifeline));
  });

  document.addEventListener("keydown", handleKeyboard);
  document.addEventListener("pointerdown", ensureAudio, { once: true });
  document.addEventListener("keydown", ensureAudio, { once: true });
}

function loadJsonFromFile(event) {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.addEventListener("load", () => {
    try {
      startGame(JSON.parse(String(reader.result)));
    } catch (error) {
      dom.loadingMessage.textContent = "El archivo no es un JSON válido.";
    }
  });
  reader.readAsText(file);
}

function startGame(data) {
  validateQuestions(data);
  state.rounds = data.rondas;
  state.roundIndex = 0;
  state.lifelinesUsed = { fifty: false, call: false, hint: false };
  dom.loadingScreen.classList.add("is-hidden");
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

      if (!question.tema || !question.pregunta || !hasFourOptions || !hasValidAnswer) {
        throw new Error(`La ronda ${roundIndex + 1} no tiene el formato esperado.`);
      }
    });
  });
}

function setupRound() {
  stopTimer();
  stopTension();

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
  dom.hintBox.classList.add("is-hidden");
  dom.hintBox.textContent = "";
  dom.optionsGrid.innerHTML = "";

  dom.roundLevel.textContent = `Ronda ${state.roundIndex + 1} de ${state.rounds.length}`;
  dom.roundTitle.textContent = round.tipo === "eleccion" ? "Elegid temática" : round.tema;
  dom.phaseLabel.textContent = "Preparando ronda";
  dom.questionText.textContent =
    round.tipo === "eleccion" ? "Selecciona una temática para esta ronda." : "Pulsa avanzar para mostrar las respuestas.";

  if (round.tipo === "eleccion") {
    renderThemeChoice(round);
    setStatus("Ronda de elección: elige uno de los temas para continuar.");
  } else {
    state.currentQuestion = round;
    renderOptions(round);
    setStatus("Pulsa avanzar para revelar las opciones una a una.");
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
  dom.roundTitle.textContent = question.tema;
  dom.questionText.textContent = "Pulsa avanzar para mostrar las respuestas.";
  renderOptions(question);
  playEffect("advance");
  setStatus(`Tema seleccionado: ${question.tema}.`);
  updateControls();
}

function renderOptions(question) {
  dom.optionsGrid.innerHTML = "";
  question.opciones.forEach((option, index) => {
    const card = document.createElement("button");
    card.className = "option-card";
    card.type = "button";
    card.dataset.index = String(index);
    card.innerHTML = `
      <span class="option-letter">${LETTERS[index]}</span>
      <span class="option-text">${escapeHtml(option)}</span>
    `;
    card.addEventListener("click", () => revealOption(index));
    dom.optionsGrid.append(card);
  });
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
      dom.phaseLabel.textContent = "Respuestas";
      dom.questionText.textContent = "Memorizad las opciones. La pregunta aparecerá después.";
      setStatus(`Opción ${LETTERS[state.visibleOptions - 1]} revelada.`);
      playEffect("advance");
      updateControls();
      return;
    }

    state.phase = "question";
    dom.phaseLabel.textContent = "Pregunta";
    dom.questionText.textContent = state.currentQuestion.pregunta;
    setStatus("Pregunta revelada. Inicia el tiempo cuando quieras.");
    playEffect("question");
    updateControls();
    return;
  }

  if (state.phase === "question") {
    toggleTimer();
    return;
  }

  if (state.phase === "finished") {
    nextRound();
  }
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
  dom.phaseLabel.textContent = "Deliberación";
  dom.timerLabel.textContent = "Tiempo corriendo";
  dom.timerCard.classList.add("is-running");
  state.timerId = window.setInterval(tick, 1000);
  startTension();
  playEffect("start");
  setStatus("Tiempo iniciado: 2 minutos.");
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
  dom.phaseLabel.textContent = "Revelación";
  dom.timerLabel.textContent = "Revelando";
  setStatus(message);
  playEffect("finish");
  updateControls();
  updateLifelines();
}

function revealOption(index) {
  if (state.phase !== "reveal" || state.revealed.has(index)) {
    return;
  }

  state.revealed.add(index);
  const card = getOptionCards()[index];
  const isCorrect = index === state.currentQuestion.correcta;
  card.classList.add("is-visible", "is-revealed", isCorrect ? "is-correct" : "is-wrong");
  playEffect(isCorrect ? "correct" : "wrong");

  if (isCorrect) {
    state.phase = "finished";
    dom.phaseLabel.textContent = "Ronda resuelta";
    setStatus("Respuesta correcta revelada. Puedes pasar a la siguiente ronda.");
  } else {
    setStatus(`La opción ${LETTERS[index]} no era correcta.`);
  }

  updateControls();
}

function nextRound() {
  if (state.roundIndex >= state.rounds.length - 1) {
    stopTimer();
    stopTension();
    state.phase = "complete";
    dom.roundLevel.textContent = "Final";
    dom.roundTitle.textContent = "Partida terminada";
    dom.phaseLabel.textContent = "Enhorabuena";
    dom.questionText.textContent = "Habéis llegado al final de Caza un Millón.";
    dom.optionsGrid.innerHTML = "";
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
  dom.hintBox.textContent = `Pista: ${state.currentQuestion.pista || "Esta pregunta no tiene pista configurada."}`;
  dom.hintBox.classList.remove("is-hidden");
  setStatus("Comodín pista usado.");
}

function updateControls() {
  const hasQuestion = Boolean(state.currentQuestion);
  dom.advanceButton.disabled = !hasQuestion || !["setup", "options", "question", "finished"].includes(state.phase);
  dom.timerButton.disabled = !hasQuestion || !["question", "timing"].includes(state.phase);
  dom.finishButton.disabled = !["question", "timing"].includes(state.phase);
  dom.nextRoundButton.disabled = !["finished", "complete"].includes(state.phase);

  dom.timerButton.textContent = state.timerRunning ? "Pausar tiempo" : state.phase === "timing" ? "Reanudar tiempo" : "Iniciar tiempo";

  getOptionCards().forEach((card, index) => {
    card.disabled = state.phase !== "reveal" || state.revealed.has(index) || state.hiddenByFifty.has(index);
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

  if (!state.timerRunning && state.phase !== "reveal") {
    dom.timerLabel.textContent = state.timeLeft === ROUND_SECONDS ? "Preparado" : "Pausado";
  }
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
  if (!state.audioContext || state.tensionNodes) {
    return;
  }

  const context = state.audioContext;
  const gain = context.createGain();
  const bass = context.createOscillator();
  const pulse = context.createOscillator();
  const filter = context.createBiquadFilter();

  bass.type = "sawtooth";
  bass.frequency.value = 55;
  pulse.type = "square";
  pulse.frequency.value = 2.2;
  filter.type = "lowpass";
  filter.frequency.value = 420;
  gain.gain.value = 0.045;

  bass.connect(filter);
  pulse.connect(gain.gain);
  filter.connect(gain);
  gain.connect(context.destination);
  bass.start();
  pulse.start();

  state.tensionNodes = { bass, pulse, gain, filter };
}

function stopTension() {
  if (!state.tensionNodes) {
    return;
  }

  const { bass, pulse, gain } = state.tensionNodes;
  const context = state.audioContext;
  const now = context.currentTime;

  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
  bass.stop(now + 0.28);
  pulse.stop(now + 0.28);
  state.tensionNodes = null;
}

function setStatus(message) {
  dom.statusLine.textContent = message;
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
