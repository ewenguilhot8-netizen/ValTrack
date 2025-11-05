// Éléments du DOM
const searchButton = document.getElementById('searchButton');
const riotIdInput = document.getElementById('riotIdInput');
const resultsContainer = document.getElementById('resultsContainer');
const loader = document.getElementById('loader');
const errorEl = document.getElementById('error');
const historyList = document.getElementById('historyList');

// Éléments de données
const playerName = document.getElementById('playerName');
const playerLevel = document.getElementById('playerLevel');
const playerAvatar = document.getElementById('playerAvatar');
const kdRatio = document.getElementById('kdRatio');
const hsPercent = document.getElementById('hsPercent');
const winPercent = document.getElementById('winPercent');
const matchHistory = document.getElementById('matchHistory');

// Historique local (stocké dans le navigateur)
let searchHistory = JSON.parse(localStorage.getItem('valHistory')) || [];
updateHistoryUI();

searchButton.addEventListener('click', () => {
    handleSearch();
});

riotIdInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        handleSearch();
    }
});

function handleSearch() {
    const fullRiotId = riotIdInput.value;
    if (!fullRiotId.includes('#')) {
        showError("Veuillez entrer un Riot ID complet (ex: Utilisateur#TAG)");
        return;
    }
    const [name, tag] = fullRiotId.split('#');
    fetchPlayerData(name, tag);
}

async function fetchPlayerData(name, tag) {
    resultsContainer.style.display = 'none';
    errorEl.style.display = 'none';
    loader.style.display = 'block';

    try {
        // Appelle NOTRE PROPRE backend (qui est sur le même serveur)
        const response = await fetch(`/api/stats/${name}/${tag}`);

        if (!response.ok) {
            throw new Error("Joueur non trouvé ou erreur de l'API");
        }

        const data = await response.json();

        // Traite les données reçues de Tracker.gg
        const overview = data.data.segments.find(s => s.type === 'overview');
        if (!overview) {
            throw new Error("Données de profil incomplètes.");
        }

        const stats = overview.stats;
        const processedData = {
            playerName: data.data.platformInfo.platformUserHandle,
            level: stats.level?.value || 'N/A',
            avatarUrl: data.data.platformInfo.avatarUrl,
            kd: stats.kd?.value || '-',
            hs: stats.headshotsPercentage?.value || '-',
            winRate: stats.matchesWinPct?.value || '-',
            // Vous pouvez aussi traiter data.data.matches ici
            matches: data.data.matches || [] 
        };

        showResults(processedData);
        addToHistory(`${name}#${tag}`);

    } catch (error) {
        console.error(error);
        showError(error.message);
    } finally {
        loader.style.display = 'none';
    }
}

function showResults(data) {
    playerName.textContent = data.playerName;
    playerLevel.textContent = `Niveau ${data.level}`;
    playerAvatar.src = data.avatarUrl;
    kdRatio.textContent = data.kd;
    hsPercent.textContent = `${data.hs}%`;
    winPercent.textContent = `${data.winRate}%`;

    // Affiche l'historique des matchs (simplifié)
    matchHistory.innerHTML = "";
    const recentMatches = data.matches.slice(0, 5); // 5 derniers matchs

    recentMatches.forEach(match => {
        const mapName = match.metadata.mapName;
        const result = match.segments[0].stats.matchesWon.value > 0 ? "Victoire" : "Défaite";
        const kills = match.segments[0].stats.kills.value;
        const deaths = match.segments[0].stats.deaths.value;
        const assists = match.segments[0].stats.assists.value;

        const matchEl = document.createElement('div');
        matchEl.style.color = result === 'Victoire' ? '#a0e8a0' : '#e8a0a0';
        matchEl.style.borderBottom = '1px solid var(--border-color)';
        matchEl.style.padding = '10px 0';
        matchEl.innerHTML = `<strong>${mapName} (${result})</strong> - KDA: ${kills}/${deaths}/${assists}`;
        matchHistory.appendChild(matchEl);
    });

    resultsContainer.style.display = 'block';
}

function showError(message) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

function addToHistory(riotId) {
    if (!searchHistory.includes(riotId)) {
        searchHistory.unshift(riotId); 
        if (searchHistory.length > 5) {
            searchHistory.pop();
        }
        localStorage.setItem('valHistory', JSON.stringify(searchHistory));
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    historyList.innerHTML = "";
    searchHistory.forEach(id => {
        const li = document.createElement('li');
        li.textContent = id;
        li.addEventListener('click', () => {
            riotIdInput.value = id;
            handleSearch();
        });
        historyList.appendChild(li);
    });
}