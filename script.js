const PROJECT_ID = 'l3lnax4d';
const DATASET = 'production';
const TOKEN = 'skDq4KnAQVOZzdOl7ryJyY27YngtjCeduD3hZ7L0kqShzkXLGJlXcf8tBjf9G3ZKtzBQco9os7JaEw3wl6GlMxXZpQLnbBLrOuWnPOQsMAOQOj5X1RLvsPjTY3NLZYRRwU4OEgXwacGjN2aKD78Ks0MzuYPEiTWhfphv2d3fOUSBGYpFy7j8';

// Funções de API Direta (Sem bibliotecas externas)
async function fetchSanity(query) {
    const url = `https://${PROJECT_ID}.api.sanity.io/v2024-02-06/data/query/${DATASET}?query=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${TOKEN.trim()}`,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Detalhes do erro Sanity:", errorData);
        throw new Error(`Erro Sanity ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();
    return json.result;
}

async function mutateSanity(mutations) {
    const url = `https://${PROJECT_ID}.api.sanity.io/v2024-02-06/data/mutate/${DATASET}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${TOKEN.trim()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ mutations })
    });

    if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Detalhes do erro de mutação:", errorData);
        throw new Error(`Erro Sanity ${response.status}: ${response.statusText}`);
    }

    return await response.json();
}

// Elementos DOM
const currentDateElement = document.getElementById('currentDate');
const streakCountElement = document.getElementById('streakCount');
const cardioCard = document.getElementById('cardioCard');
const dietCard = document.getElementById('dietCard');
const progressCircle = document.getElementById('progressCircle');
const progressPercent = document.getElementById('progressPercent');
const quoteElement = document.getElementById('quote');
const weightInput = document.getElementById('weightInput');
const fullHistoryList = document.getElementById('fullHistoryList');

// Estado
let habitsData = JSON.parse(localStorage.getItem('habitsData')) || {};
const today = new Date().toISOString().split('T')[0];

const quotes = [
    "A disciplina é a ponte entre metas e realizações.",
    "Não pare quando estiver cansado, pare quando tiver terminado.",
    "O sucesso é a soma de pequenos esforços repetidos.",
    "Sua saúde é um investimento, não uma despesa.",
    "Corpo sã, mente sã.",
    "O melhor momento para começar é agora.",
    "Seja mais forte que sua melhor desculpa."
];

// Helper para obter o ID da semana (YYYY-WW)
function getWeekID(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

// Inicialização
function calculateAdvancedStats() {
    const adherenceEl = document.getElementById('adherenceValue');
    const changeEl = document.getElementById('weightChangeValue');
    const toGoalEl = document.getElementById('toGoalValue');

    const weekId = getWeekID(new Date());
    const currentGoal = habitsData.weeklyGoals?.[weekId];

    // 1. Adesão Semanal (Últimos 7 dias)
    const last7Days = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        last7Days.push(d.toISOString().split('T')[0]);
    }
    const perfectDays = last7Days.filter(d => habitsData[d] && habitsData[d].cardio && habitsData[d].diet).length;
    adherenceEl.textContent = `${Math.round((perfectDays / 7) * 100)}%`;

    // 2. Variação na Semana (Desde segunda-feira)
    const todayObj = new Date();
    const dayOfWeek = todayObj.getDay() || 7; // 1 (Seg) a 7 (Dom)
    const mondayObj = new Date(todayObj);
    mondayObj.setDate(todayObj.getDate() - (dayOfWeek - 1));
    const mondayStr = mondayObj.toISOString().split('T')[0];

    const currentWeight = parseFloat(habitsData[today]?.weight);
    const mondayWeight = parseFloat(habitsData[mondayStr]?.weight);

    if (!isNaN(currentWeight) && !isNaN(mondayWeight)) {
        const diff = (currentWeight - mondayWeight).toFixed(1);
        changeEl.textContent = `${diff > 0 ? '+' : ''}${diff} kg`;
    } else {
        changeEl.textContent = "-- kg";
    }

    // 3. Para a Meta da Semana
    if (currentGoal && !isNaN(currentWeight)) {
        const goalDiff = (currentWeight - parseFloat(currentGoal)).toFixed(1);
        toGoalEl.textContent = `${goalDiff > 0 ? goalDiff : '0'} kg`;
        document.querySelector('.highlight-goal .stat-label').textContent = "Meta Semanal";
    } else {
        toGoalEl.textContent = "-- kg";
    }
}

async function init() {
    console.log("🚀 Iniciando App (Modo Fetch Nativo)...");
    updateDateDisplay();
    setDailyQuote();
    loadTodayData();
    calculateStreak();
    updateProgressRing();
    renderFullHistory();
    calculateAdvancedStats();
    checkNotificationState();

    // Inicia ciclo de lembretes (checa a cada hora)
    setInterval(checkReminders, 1000 * 60 * 60);
    // Checa imediatamente
    checkReminders();

    // Sincronização em segundo plano
    syncWithSanity();
}

async function toggleNotifications() {
    if (!("Notification" in window)) {
        alert("Este navegador não suporta notificações.");
        return;
    }

    if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            new Notification("Habit Flow", { body: "Lembretes ativados com sucesso! ✨" });
        }
    } else if (Notification.permission === "denied") {
        alert("As notificações foram bloqueadas. Por favor, ative-as nas configurações do seu navegador.");
    }
    checkNotificationState();
}

function checkNotificationState() {
    const btn = document.getElementById('notificationToggle');
    if (!btn) return;

    if (Notification.permission === "granted") {
        btn.classList.add('active');
        btn.title = "Lembretes Ativos";
    } else if (Notification.permission === "denied") {
        btn.classList.add('denied');
        btn.title = "Notificações Bloqueadas";
    }
}

function checkReminders() {
    if (Notification.permission !== "granted") return;

    const hour = new Date().getHours();
    const dayData = habitsData[today];

    // Se não completou os hábitos e é hora de avisar (12h ou 21h)
    if (dayData && (!dayData.cardio || !dayData.diet)) {
        if (hour === 12 || hour === 21) {
            new Notification("Habit Flow: Lembrete! 🔔", {
                body: "Ainda faltam alguns hábitos hoje. Não quebre o seu streak!",
                icon: "favicon.ico" // Opcional
            });
        }
    }
}

async function syncWithSanity() {
    const statusText = document.getElementById('cloudStatusText');
    const statusDiv = document.getElementById('cloudStatus');
    try {
        console.log("🔄 Buscando dados da nuvem...");
        const entries = await fetchSanity('*[_type in ["habitEntry", "appSettings", "weeklyGoal"]] | order(date desc)');
        console.log(`📥 Recebido: ${entries.length} objetos.`);

        if (statusText) statusText.textContent = "Nuvem: Sincronizada";
        if (statusDiv) statusDiv.classList.add('online');

        if (entries && entries.length > 0) {
            entries.forEach(entry => {
                if (entry._type === 'habitEntry') {
                    habitsData[entry.date] = {
                        cardio: entry.cardio || false,
                        diet: entry.diet || false,
                        weight: entry.weight || ""
                    };
                } else if (entry._type === 'appSettings' && entry._id === 'settings-goal') {
                    habitsData.targetWeight = entry.targetWeight;
                } else if (entry._type === 'weeklyGoal') {
                    if (!habitsData.weeklyGoals) habitsData.weeklyGoals = {};
                    habitsData.weeklyGoals[entry.weekId] = entry.targetWeight;
                }
            });
            saveDataLocally();
            loadTodayData();
            calculateStreak();
            renderFullHistory();
            console.log("✅ Sincronização concluída com sucesso!");
        }
    } catch (err) {
        console.warn("⚠️ Falha na conexão com Sanity:", err.message);
        if (err.message.includes("401")) {
            console.error("⛔ ERRO DE PERMiSSÃO. Verifique se o Token tem permissão de 'Editor' e se o CORS permite credentials.");
        }
        if (statusText) statusText.textContent = "Nuvem: Offline";
        if (statusDiv) statusDiv.classList.add('error');
    }
}

async function pushToSanity(dateStr) {
    const statusText = document.getElementById('cloudStatusText');
    const data = habitsData[dateStr];
    const doc = {
        _id: `habit-${dateStr}`,
        _type: 'habitEntry',
        date: dateStr,
        cardio: !!data.cardio,
        diet: !!data.diet,
        weight: data.weight || ""
    };

    try {
        if (statusText) statusText.textContent = "Nuvem: Salvando...";
        // Operação createOrReplace via API HTTP
        await mutateSanity([
            { createOrReplace: doc }
        ]);
        if (statusText) statusText.textContent = "Nuvem: Sincronizada";
        console.log("☁️ Salvo na nuvem:", dateStr);
    } catch (err) {
        console.error("❌ Erro ao salvar na nuvem:", err.message);
        if (statusText) statusText.textContent = "Nuvem: Erro ao salvar";
    }
}

function setDailyQuote() {
    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    quoteElement.textContent = `"${quotes[dayOfYear % quotes.length]}"`;
}

function updateDateDisplay() {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    const dateString = new Date().toLocaleDateString('pt-BR', options);
    currentDateElement.textContent = dateString.charAt(0).toUpperCase() + dateString.slice(1);
}

function loadTodayData() {
    if (!habitsData[today]) habitsData[today] = { cardio: false, diet: false, weight: "" };
    updateCardVisuals('cardio', habitsData[today].cardio);
    updateCardVisuals('diet', habitsData[today].diet);
    weightInput.value = habitsData[today].weight || "";
}

function saveWeight() {
    habitsData[today].weight = weightInput.value;
    saveDataLocally();
    pushToSanity(today);
    renderFullHistory();
}

function toggleHabit(type) {
    if (!habitsData[today]) habitsData[today] = { cardio: false, diet: false, weight: "" };
    habitsData[today][type] = !habitsData[today][type];

    saveDataLocally();
    updateCardVisuals(type, habitsData[today][type]);
    calculateStreak();
    updateProgressRing();
    renderFullHistory();

    pushToSanity(today);

    if (habitsData[today].cardio && habitsData[today].diet) triggerSuccessFeedback();
}

function togglePastHabit(dateStr, type) {
    if (!habitsData[dateStr]) habitsData[dateStr] = { cardio: false, diet: false, weight: "" };
    habitsData[dateStr][type] = !habitsData[dateStr][type];

    saveDataLocally();
    renderFullHistory();
    calculateStreak();

    if (dateStr === today) {
        updateCardVisuals(type, habitsData[today][type]);
        updateProgressRing();
    }

    pushToSanity(dateStr);
}

function updateProgressRing() {
    const dayData = habitsData[today];
    let completed = (dayData?.cardio ? 1 : 0) + (dayData?.diet ? 1 : 0);
    const percentage = (completed / 2) * 100;
    const circumference = 2 * Math.PI * 52;
    progressCircle.style.strokeDashoffset = circumference - (percentage / 100) * circumference;
    progressPercent.textContent = `${percentage}%`;
}

function triggerSuccessFeedback() {
    if (window.confetti) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#ff4d4d', '#00f2fe', '#ffffff'] });
    }
}

function updateCardVisuals(type, isActive) {
    const card = type === 'cardio' ? cardioCard : dietCard;
    if (card) {
        if (isActive) card.classList.add(`active-${type}`);
        else card.classList.remove(`active-${type}`);
    }
}

function saveDataLocally() { localStorage.setItem('habitsData', JSON.stringify(habitsData)); }

function calculateStreak() {
    let streak = 0, checkDate = new Date();
    while (true) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const dayData = habitsData[dateStr];
        if (dayData && dayData.cardio && dayData.diet) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else break;
    }
    animateValue(streakCountElement, parseInt(streakCountElement.textContent) || 0, streak, 800);
}

function animateValue(obj, start, end, duration) {
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

let weightChart = null;

function updateChart() {
    const ctx = document.getElementById('weightChart');
    if (!ctx) return;

    const sortedDates = Object.keys(habitsData).filter(d => d.includes('-') && !d.includes('W')).sort();
    const chartData = sortedDates
        .filter(d => habitsData[d].weight)
        .map(d => ({ x: d, y: parseFloat(habitsData[d].weight) }));

    if (chartData.length === 0) return;

    if (weightChart) weightChart.destroy();

    // Gera a linha de meta baseada na semana de cada ponto
    const targetData = sortedDates.map(dateStr => {
        const weekId = getWeekID(new Date(dateStr + 'T00:00:00'));
        const weeklyGoal = habitsData.weeklyGoals?.[weekId];
        return weeklyGoal ? parseFloat(weeklyGoal) : null;
    });

    weightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: chartData.map(d => {
                const date = new Date(d.x + 'T00:00:00');
                return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            }),
            datasets: [
                {
                    label: 'Peso (kg)',
                    data: chartData.map(d => d.y),
                    borderColor: '#00f2fe',
                    backgroundColor: 'rgba(0, 242, 254, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: '#00f2fe',
                    pointRadius: 4
                },
                {
                    label: 'Meta da Semana',
                    data: targetData,
                    borderColor: 'rgba(74, 222, 128, 0.6)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    stepped: 'before', // Faz a linha em degraus
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { grid: { color: 'rgba(255, 255, 255, 0.05)' }, ticks: { color: '#94a3b8' } },
                x: { grid: { display: false }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

function saveTargetWeight() {
    const input = document.getElementById('targetWeightInput');
    const weekId = getWeekID(new Date());

    if (!habitsData.weeklyGoals) habitsData.weeklyGoals = {};
    habitsData.weeklyGoals[weekId] = input.value;

    saveDataLocally();
    pushTargetWeightToSanity(weekId, input.value);
    updateChart();
    calculateAdvancedStats();
}

async function pushTargetWeightToSanity(weekId, weight) {
    try {
        await mutateSanity([{
            createOrReplace: {
                _id: `goal-${weekId}`,
                _type: 'weeklyGoal',
                weekId: weekId,
                targetWeight: weight
            }
        }]);
    } catch (err) { console.error("Erro ao salvar meta semanal:", err); }
}

function editPastWeight(dateStr) {
    const currentWeight = habitsData[dateStr]?.weight || "";
    const newWeight = prompt(`Qual era o peso no dia ${dateStr}?`, currentWeight);

    if (newWeight !== null) {
        if (!habitsData[dateStr]) habitsData[dateStr] = { cardio: false, diet: false, weight: "" };
        habitsData[dateStr].weight = newWeight;
        saveDataLocally();
        pushToSanity(dateStr);
        renderFullHistory();
        updateChart();
    }
}

function addPastDate() {
    const dateStr = prompt("Para qual data deseja adicionar registro? (Formato: AAAA-MM-DD)", new Date().toISOString().split('T')[0]);
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        if (!habitsData[dateStr]) {
            habitsData[dateStr] = { cardio: false, diet: false, weight: "" };
            saveDataLocally();
            renderFullHistory();
        } else {
            alert("Esta data já existe no seu histórico!");
        }
    } else if (dateStr) {
        alert("Formato inválido! Use AAAA-MM-DD");
    }
}

function switchTab(tab) {
    todayTab.classList.toggle('hidden', tab !== 'today');
    historyTab.classList.toggle('hidden', tab !== 'history');
    navToday.classList.toggle('active', tab === 'today');
    navHistory.classList.toggle('active', tab === 'history');
    if (tab === 'history') {
        calculateAdvancedStats();
        setTimeout(updateChart, 100);
    }
}

// Elementos Tab globais
const todayTab = document.getElementById('todayTab');
const historyTab = document.getElementById('historyTab');
const navToday = document.getElementById('navToday');
const navHistory = document.getElementById('navHistory');


function renderFullHistory() {
    if (!fullHistoryList) return;
    fullHistoryList.innerHTML = '';
    Object.keys(habitsData).sort().reverse().forEach(dateStr => {
        const entry = habitsData[dateStr];
        const dateObj = new Date(dateStr + 'T00:00:00');
        const dayLabel = dateObj.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
        const item = document.createElement('div');
        item.className = 'history-item-full';
        item.innerHTML = `
            <div class="date-info">
                <span class="day-text">${dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1)}</span>
                <span class="weight-edit-btn" onclick="editPastWeight('${dateStr}')">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                    ${entry.weight ? entry.weight + ' kg' : 'Add peso'}
                </span>
            </div>
            <div class="history-status">
                <div class="status-dot ${entry.cardio ? 'completed-cardio' : ''}" onclick="togglePastHabit('${dateStr}', 'cardio')"></div>
                <div class="status-dot ${entry.diet ? 'completed-diet' : ''}" onclick="togglePastHabit('${dateStr}', 'diet')"></div>
            </div>`;
        fullHistoryList.appendChild(item);
    });
}

// Atribuindo funções globais
window.toggleHabit = toggleHabit;
window.togglePastHabit = togglePastHabit;
window.switchTab = switchTab;
window.saveWeight = saveWeight;
window.editPastWeight = editPastWeight;
window.addPastDate = addPastDate;
window.saveTargetWeight = saveTargetWeight;
window.toggleNotifications = toggleNotifications;

document.addEventListener('DOMContentLoaded', init);
