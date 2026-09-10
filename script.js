// BANCO DE PREGUNTAS (RESPALDO INTERNO EN CASO DE FALLO DE CARGA JSON LOCAL)
const defaultVocabularyDb = {
    1: [
        { q: "What is the opposite of 'COLD'?", options: ["Hot", "Ice", "Dark", "Tall"], correct: "Hot" },
        { q: "Which animal can fly?", options: ["Eagle", "Lion", "Shark", "Snake"], correct: "Eagle" },
        { q: "What do you use to write?", options: ["Pencil", "Pillow", "Plate", "Phone"], correct: "Pencil" }
    ],
    2: [
        { q: "A person who cooks in a restaurant is a...", options: ["Chef", "Doctor", "Driver", "Teacher"], correct: "Chef" },
        { q: "Where do you buy medicine?", options: ["Pharmacy", "Bakery", "Library", "Gym"], correct: "Pharmacy" }
    ],
    3: [
        { q: "Complete: She needs to ___ her shoes inside.", options: ["take off", "put on", "look for", "run away"], correct: "take off" },
        { q: "What is a synonym of 'BEAUTIFUL'?", options: ["Gorgeous", "Ugly", "Angry", "Boring"], correct: "Gorgeous" }
    ]
};

let vocabularyDb = defaultVocabularyDb;

// Cargar preguntas desde preguntas.json si está disponible
fetch('questions.json')
    .then(response => response.json())
    .then(data => {
        vocabularyDb = data;
        console.log("Preguntas cargadas desde preguntas.json con éxito.");
    })
    .catch(err => {
        console.warn("Usando banco de preguntas local por defecto.", err);
    });

// SINTETIZADOR DE SONIDOS (Web Audio API - Sin archivos externos)
class SoundEffects {
    constructor() {
        this.ctx = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
        }
    }

    playCorrect() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.15); // E5

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playWrong() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.25);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
    }

    playVictory() {
        this.init();
        if (!this.ctx) return;
        const now = this.ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        
        notes.forEach((freq, idx) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const startTime = now + idx * 0.12;

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, startTime);

            gain.gain.setValueAtTime(0.25, startTime);
            gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);

            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start(startTime);
            osc.stop(startTime + 0.3);
        });
    }
}

const sounds = new SoundEffects();

// ESTADO INDEPENDIENTE POR EQUIPO
const gameState = {
    left: { currentFloor: 0, activeQuiz: null, teamName: 'AZUL' },
    right: { currentFloor: 0, activeQuiz: null, teamName: 'ROJO' }
};

// ABRIR QUIZ LOCAL
function openQuiz(side, floor) {
    sounds.init();
    const state = gameState[side];

    // Regla: Deben subir piso por piso en orden estricto
    if (floor !== state.currentFloor + 1) {
        return;
    }

    const questions = vocabularyDb[floor] || defaultVocabularyDb[floor];
    if (!questions || questions.length === 0) return;

    // Pregunta aleatoria
    const randomQuiz = questions[Math.floor(Math.random() * questions.length)];
    state.activeQuiz = randomQuiz;

    // Renderizar modal del equipo
    document.getElementById(`level-tag-${side}`).innerText = `PISO ${floor}`;
    document.getElementById(`q-text-${side}`).innerText = randomQuiz.q;
    
    const optionsContainer = document.getElementById(`options-${side}`);
    optionsContainer.innerHTML = "";

    // Mezclar opciones para dinamismo
    const shuffledOptions = [...randomQuiz.options].sort(() => Math.random() - 0.5);

    shuffledOptions.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.onclick = () => checkAnswer(side, opt, floor);
        optionsContainer.appendChild(btn);
    });

    const modal = document.getElementById(`modal-${side}`);
    modal.classList.add('active');
}

// VALIDAR RESPUESTA
function checkAnswer(side, selectedOption, floor) {
    const state = gameState[side];
    const modal = document.getElementById(`modal-${side}`);

    if (selectedOption === state.activeQuiz.correct) {
        // RESPUESTA CORRECTA
        sounds.playCorrect();
        state.currentFloor = floor;

        // Actualizar marcador
        document.getElementById(`floor-num-${side}`).innerText = state.currentFloor;

        // Mover escalador
        const climber = document.getElementById(`climber-${side}`);
        climber.style.bottom = `calc(${state.currentFloor * 25}% + 25px)`;
        climber.style.left = `${Math.floor(Math.random() * 35) + 20}%`;

        modal.classList.remove('active');

        // VERIFICAR VICTORIA (PISO 3 ALCANZADO)
        if (state.currentFloor === 3) {
            setTimeout(() => {
                showVictory(side);
            }, 300);
        }
    } else {
        // RESPUESTA INCORRECTA
        sounds.playWrong();
        const card = modal.querySelector('.modal-card');
        card.classList.add('shake');
        setTimeout(() => {
            card.classList.remove('shake');
            modal.classList.remove('active');
        }, 400);
    }
}

// MOSTRAR PANTALLA DE VICTORIA LOCAL EN EL MODAL (SIN BLOQUEAR LA PANTALLA RIVAL)
function showVictory(side) {
    sounds.playVictory();
    const modal = document.getElementById(`modal-${side}`);
    const card = modal.querySelector('.modal-card');
    card.classList.add('victory-card');

    document.getElementById(`level-tag-${side}`).innerText = "🏆 CAMPEÓN";
    document.getElementById(`q-text-${side}`).innerHTML = `
        <div class="victory-title">¡VICTORIA!</div>
        <div class="victory-subtitle">El Equipo ${side === 'left' ? 'Azul ❄️' : 'Rojo 🔥'} ha conquistado la cima.</div>
    `;

    const optionsContainer = document.getElementById(`options-${side}`);
    optionsContainer.innerHTML = `
        <button class="option-btn restart-btn" onclick="resetGame()">🎮 Reiniciar Juego Completo</button>
    `;

    modal.classList.add('active');
}

// REINICIAR JUEGO
function resetGame() {
    location.reload();
}
