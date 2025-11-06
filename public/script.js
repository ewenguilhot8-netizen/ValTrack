document.addEventListener('DOMContentLoaded', () => {

    // --- Sélecteurs Globaux ---
    let currentPlayerData = null; 
    let searchHistory = JSON.parse(localStorage.getItem('valHistory')) || [];
    const svgNS = "http://www.w3.org/2000/svg";
    const profileTemplate = document.getElementById('player-profile-template').innerHTML;
    let currentPage = 'finder'; 
    let pageIndex = { 'finder': 0, 'results': 0, 'leaderboard': 1, 'compare': 2, 'armory': 3 };

    // URL de l'image pour la page d'accueil (Finder)
    const splashScreenImage = 'https://esportsinsider.com/wp-content/uploads/2025/10/Veto-Agent-Portrait-large.jpg';

    // --- Sélecteurs de Pages & Navigation ---
    const agentBackgroundArt = document.getElementById('agentBackgroundArt');
    const mapBackgroundArt = document.getElementById('mapBackgroundArt');
    const mainNavbar = document.getElementById('mainNavbar');
    const navFinder = document.getElementById('navFinder');
    const navLeaderboard = document.getElementById('navLeaderboard');
    const navCompare = document.getElementById('navCompare');
    const navArmory = document.getElementById('navArmory');
    
    const finderPage = document.getElementById('finderPage');
    const resultsPage = document.getElementById('resultsPage'); 
    const leaderboardPage = document.getElementById('leaderboardPage');
    const comparePage = document.getElementById('comparePage');
    const armoryPage = document.getElementById('armoryPage');

    // --- Sélecteurs Stats Finder ---
    const finderLoader = document.getElementById('loader');
    const finderError = document.getElementById('error');
    const searchButton = document.getElementById('searchButton');
    const updateButton = document.getElementById('updateButton');
    const riotIdInput = document.getElementById('riotIdInput');
    const finderResults = document.getElementById('finderResults');
    const splashNavLeaderboard = document.getElementById('splashNavLeaderboard');
    const splashNavCompare = document.getElementById('splashNavCompare');
    const splashNavArmory = document.getElementById('splashNavArmory');

    // --- Sélecteurs Comparer ---
    const compareLoader = document.getElementById('compareLoader');
    const compareError = document.getElementById('compareError');
    const compareInput1 = document.getElementById('compareInput1');
    const compareInput2 = document.getElementById('compareInput2');
    const compareSearchButton = document.getElementById('compareSearchButton');
    const compareResults1 = document.getElementById('compareResults1');
    const compareResults2 = document.getElementById('compareResults2');

    // --- Sélecteurs Leaderboard ---
    const leaderboardLoader = document.getElementById('leaderboardLoader');
    const leaderboardError = document.getElementById('leaderboardError');
    const leaderboardList = document.getElementById('leaderboardList');
    
    // --- Sélecteurs Armurerie ---
    const armoryListContainer = document.getElementById('armoryListContainer');
    const armoryDetailContainer = document.getElementById('armoryDetailContainer');
    const armoryLoader = document.getElementById('armoryLoader');
    const armoryError = document.getElementById('armoryError');
    const armoryGrid = document.getElementById('armoryGrid');
    let armoryData = null; // Cache pour les données des armes

    // Définir le fond d'écran d'accueil par défaut au chargement
    if (agentBackgroundArt) { // Vérification de sécurité
        agentBackgroundArt.style.backgroundImage = `url(${splashScreenImage})`;
        agentBackgroundArt.style.opacity = '0.15'; // Augmenté pour la visibilité
    }

    // --- Sélecteurs Historique de recherche ---
    const searchHistoryDropdown = document.getElementById('searchHistoryDropdown');
    const searchHistoryList = document.getElementById('searchHistoryList');
    const searchInputs = document.querySelectorAll('.search-input-with-history');
    let currentFocusedInput = null;

    // =================================================================
    // --- NAVIGATION & ANIMATIONS
    // =================================================================
    
    const pages = {
        'finder': finderPage,
        'results': resultsPage,
        'leaderboard': leaderboardPage,
        'compare': comparePage,
        'armory': armoryPage
    };
    
    const navLinks = {
        'finder': navFinder,
        'results': navFinder, 
        'leaderboard': navLeaderboard,
        'compare': navCompare,
        'armory': navArmory
    };

    function showPage(pageName) {
        if (pageName === currentPage) return;

        // Gérer les sous-vues de l'armurerie
        if (pageName === 'armory') {
            armoryListContainer.style.display = 'block';
            armoryDetailContainer.style.display = 'none';
        }

        const oldPage = pages[currentPage];
        const newPage = pages[pageName];
        
        const oldIndex = pageIndex[currentPage];
        const newIndex = pageIndex[pageName];

        let exitAnimation = 'page-exit-left';
        let enterAnimation = 'page-enter-right';

        if (newIndex < oldIndex) {
            exitAnimation = 'page-exit-right';
            enterAnimation = 'page-enter-left';
        }

        // Gérer la navbar
        if (pageName === 'finder') {
            mainNavbar.classList.remove('visible');
            updateButton.style.display = 'none';
        } else {
            mainNavbar.classList.add('visible');
            // Afficher le bouton MAJ seulement si on est sur la page de résultats
            updateButton.style.display = (pageName === 'results') ? 'inline-block' : 'none';
        }
        
        // Gérer les liens actifs
        Object.values(navLinks).forEach(nav => nav.classList.remove('active'));
        if(navLinks[pageName]) navLinks[pageName].classList.add('active');

        // Gérer le fond
        if (pageName === 'finder') {
            // Afficher le fond d'accueil par défaut
            agentBackgroundArt.style.backgroundImage = `url(${splashScreenImage})`;
            agentBackgroundArt.style.opacity = '0.15'; // Augmenté
            mapBackgroundArt.style.opacity = '0';
        
        } else if (pageName === 'results' && currentPlayerData) {
            // Afficher les fonds du joueur (ceux-ci sont définis dans fetchPlayerData)
            agentBackgroundArt.style.opacity = '0.08';
            mapBackgroundArt.style.opacity = '0.08';
        
        } else {
            // Cacher les fonds sur 'leaderboard', 'compare' et 'armory'
            agentBackgroundArt.style.opacity = '0';
            mapBackgroundArt.style.opacity = '0';
        }

        // Animer
        if (oldPage) {
            oldPage.classList.add(exitAnimation);
            setTimeout(() => {
                oldPage.style.display = 'none';
                oldPage.classList.remove(exitAnimation);
            }, 400); 
        }
        
        newPage.style.display = 'block';
        newPage.classList.add(enterAnimation);
        setTimeout(() => newPage.classList.remove(enterAnimation), 400);

        currentPage = pageName;
    }

    // Clics de navigation
    navFinder.addEventListener('click', (e) => showPage('finder'));
    navLeaderboard.addEventListener('click', (e) => {
        showPage('leaderboard');
        fetchLeaderboard();
    });
    navCompare.addEventListener('click', (e) => showPage('compare'));
    navArmory.addEventListener('click', (e) => {
        showPage('armory');
        fetchArmory(); 
    });
    
    // Clics de la page d'accueil
    splashNavLeaderboard.addEventListener('click', (e) => {
        showPage('leaderboard');
        fetchLeaderboard();
    });
    splashNavCompare.addEventListener('click', (e) => showPage('compare'));
    splashNavArmory.addEventListener('click', (e) => {
        showPage('armory');
        fetchArmory();
    });

    // =================================================================
    // --- GESTION DE L'HISTORIQUE DE RECHERCHE
    // =================================================================
    
    searchInputs.forEach(input => {
        input.addEventListener('focus', (e) => {
            currentFocusedInput = e.target;
            updateHistoryUI();
            positionHistoryDropdown(e.target);
            searchHistoryDropdown.classList.add('visible');
        });
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box') && !e.target.closest('.history-dropdown') && !e.target.closest('.compare-search-box')) {
            searchHistoryDropdown.classList.remove('visible');
            currentFocusedInput = null;
        }
    });

    function positionHistoryDropdown(inputElement) {
        const rect = inputElement.getBoundingClientRect();
        searchHistoryDropdown.style.top = `${rect.bottom + window.scrollY + 5}px`;
        searchHistoryDropdown.style.left = `${rect.left + window.scrollX}px`;
        searchHistoryDropdown.style.width = `${rect.width}px`;
    }
    
    function addToHistory(riotId) {
        if (!searchHistory.includes(riotId)) {
            searchHistory.unshift(riotId);
            if (searchHistory.length > 5) searchHistory.pop();
            localStorage.setItem('valHistory', JSON.stringify(searchHistory));
        }
    }

    function updateHistoryUI() {
        searchHistoryList.innerHTML = "";
        if (searchHistory.length === 0) {
            searchHistoryList.innerHTML = "<li>Aucune recherche récente.</li>";
        } else {
            searchHistory.forEach(id => {
                const li = document.createElement('li');
                li.textContent = id;
                li.addEventListener('click', () => {
                    if(currentFocusedInput) {
                        currentFocusedInput.value = id;
                    }
                    searchHistoryDropdown.classList.remove('visible');
                    currentFocusedInput = null;
                });
                searchHistoryList.appendChild(li);
            });
        }
    }

    // =================================================================
    // --- STATS FINDER (Page Principale)
    // =================================================================
    searchButton.addEventListener('click', () => handleSearch(false));
    updateButton.addEventListener('click', () => handleSearch(true)); 
    riotIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(false);
    });

    async function handleSearch(forceUpdate = false) {
        const fullRiotId = riotIdInput.value;
        if (!fullRiotId.includes('#')) {
            showError(finderError, "Veuillez entrer un Riot ID complet (ex: Utilisateur#TAG)");
            finderError.style.display = 'block';
            setTimeout(() => finderError.style.display = 'none', 3000);
            return;
        }
        await fetchPlayerData(fullRiotId, finderResults, finderLoader, finderError, forceUpdate);
        
        if (finderError.style.display !== 'block') {
            showPage('results');
        }
    }
    
    // =================================================================
    // --- PAGE COMPARER
    // =================================================================
    compareSearchButton.addEventListener('click', () => {
        const id1 = compareInput1.value;
        const id2 = compareInput2.value;

        if (!id1.includes('#') || !id2.includes('#')) {
            showError(compareError, "Veuillez entrer deux Riot ID complets (ex: Utilisateur#TAG)");
            return;
        }
        
        compareResults1.innerHTML = '';
        compareResults2.innerHTML = '';
        
        fetchPlayerData(id1, compareResults1, compareLoader, compareError, false);
        fetchPlayerData(id2, compareResults2, compareLoader, compareError, false);
    });

    // =================================================================
    // --- LOGIQUE DE FETCH & POPULATION (RÉUTILISABLE)
    // =================================================================

    async function fetchPlayerData(fullRiotId, containerElement, loaderElement, errorElement, forceUpdate = false) {
        containerElement.innerHTML = ''; 
        errorElement.style.display = 'none';
        loaderElement.style.display = 'block';

        if(containerElement === finderResults) {
            agentBackgroundArt.style.opacity = '0';
            mapBackgroundArt.style.opacity = '0';
            updateButton.style.display = 'none';
        }
        
        try {
            const [name, tag] = fullRiotId.split('#');
            const url = `/api/stats/${name}/${tag}${forceUpdate ? '?force=true' : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Joueur non trouvé");
            }
            const data = await response.json();
            
            if(containerElement === finderResults) {
                currentPlayerData = data; 
                // Définit les nouveaux fonds (ils sont encore cachés)
                if(data.playerInfo.bestAgentSplash) {
                    agentBackgroundArt.style.backgroundImage = `url(${data.playerInfo.bestAgentSplash})`;
                }
                if(data.playerInfo.bestMapSplash) {
                    mapBackgroundArt.style.backgroundImage = `url(${data.playerInfo.bestMapSplash})`;
                }
                // Note: L'opacité est gérée par showPage('results')
            }
            
            containerElement.innerHTML = profileTemplate;
            populateUI(data, containerElement);
            addToHistory(fullRiotId);
            
        } catch (error) {
            console.error(error);
            showError(errorElement, `${fullRiotId}: ${error.message}`);
        } finally {
            loaderElement.style.display = 'none';
        }
    }

    function populateUI(data, root) {
        // Profil
        root.querySelector('.playerName').textContent = data.playerInfo.name;
        root.querySelector('.playerLevel').textContent = `Niveau ${data.playerInfo.level}`;
        root.querySelector('.playerAvatar').src = data.playerInfo.avatarUrl || 'https://via.placeholder.com/80';
        const hours = Math.floor(data.playerInfo.playtimeMinutes / 60);
        const minutes = data.playerInfo.playtimeMinutes % 60;
        root.querySelector('.playerPlaytime').textContent = `${hours}h ${minutes}m (sur ${data.playerInfo.gameCount} matchs)`;
        root.querySelector('.gameCountLabel').textContent = `${data.playerInfo.gameCount} matchs`;
        root.querySelector('.gameCountLabel2').textContent = `${data.playerInfo.gameCount} matchs`;

        // Rang
        root.querySelector('.rankName').textContent = data.rankInfo.rankName || 'Unranked';
        root.querySelector('.rrPoints').textContent = data.rankInfo.rankName ? `${data.rankInfo.rr} RR` : '';
        root.querySelector('.rankImage').src = data.rankInfo.rankImageUrl || 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/0/largeicon.png';
        const rrPercent = (data.rankInfo.rr / 100) * 360;
        root.querySelector('.rrCircle').style.setProperty('--rr-percent', `${rrPercent}deg`);

        // Stats
        root.querySelector('.kdRatio').textContent = data.overviewStats.kd;
        root.querySelector('.winPercent').textContent = `${data.overviewStats.winRate}%`;
        root.querySelector('.hsPercent').textContent = `${data.overviewStats.hsPercent}%`;
        root.querySelector('.acs').textContent = data.overviewStats.acs;
        root.querySelector('.adr').textContent = data.overviewStats.adr;

        // Stats Score v3.0
        const score = data.overviewStats.statsScore;
        const scorePercent = (score / 1000) * 360;
        const lightness = 30 + (score / 1000) * 40;
        const scoreColor = `hsl(200, 100%, ${lightness}%)`;
        
        root.querySelector('.statsScore').textContent = score;
        root.querySelector('.statsScore').style.color = scoreColor;
        root.querySelector('.statsScoreCircle').style.setProperty('--stats-score-percent', `${scorePercent}deg`);
        root.querySelector('.statsScoreCircle').style.setProperty('--stats-score-color', scoreColor);

        // Graphiques (10 derniers matchs)
        createSparkline(root.querySelector('.kdGraph'), data.historyData.kd);
        createSparkline(root.querySelector('.winRateGraph'), data.historyData.winRate, true); 
        createSparkline(root.querySelector('.hsGraph'), data.historyData.hs);
        createSparkline(root.querySelector('.acsGraph'), data.historyData.acs);
        createSparkline(root.querySelector('.adrGraph'), data.historyData.adr);

        // Analyse (basée sur 50 matchs)
        populateAnalysisCard(root.querySelector('.bestAgentName'), root.querySelector('.bestAgentStats'), root.querySelector('.bestAgentImage'), data.analysis.agents.best);
        populateAnalysisCard(root.querySelector('.worstAgentName'), root.querySelector('.worstAgentStats'), root.querySelector('.worstAgentImage'), data.analysis.agents.worst);
        populateAnalysisCard(root.querySelector('.bestMapName'), root.querySelector('.bestMapStats'), root.querySelector('.bestMapImage'), data.analysis.maps.best);
        populateAnalysisCard(root.querySelector('.worstMapName'), root.querySelector('.worstMapStats'), root.querySelector('.worstMapImage'), data.analysis.maps.worst);

        // Historique des matchs (Menu Déroulant)
        const matchHistoryContainer = root.querySelector('.matchHistory');
        matchHistoryContainer.innerHTML = "";
        if (data.matchHistory.length > 0) {
            data.matchHistory.forEach(match => {
                const wrapper = document.createElement('div');
                wrapper.className = 'match-dropdown-wrapper';
                wrapper.dataset.matchId = match.matchId;
                wrapper.dataset.loaded = 'false';

                const header = document.createElement('div');
                header.className = 'match-item-header';
                header.style.backgroundImage = `url(${match.mapImage || 'https://via.placeholder.com/100x50'})`;
                
                header.innerHTML = `
                    <div class="match-item-content">
                        <img src="${match.agentImage || 'https://via.placeholder.com/48'}" class="match-agent-icon" alt="">
                        <div class="match-info">
                            <strong>${match.map}</strong>
                            <span class="${match.result === 'Victoire' ? 'win' : 'loss'}">${match.result}</span>
                        </div>
                    </div>
                    <div class="match-stats">
                        <div class="match-stat-item">
                            <span>K/D</span>
                            <strong>${match.kd}</strong>
                        </div>
                        <div class="match-stat-item">
                            <span>ACS</span>
                            <strong>${match.acs}</strong>
                        </div>
                        <div class="match-stat-item">
                            <span>HS%</span>
                            <strong>${match.hsPercent}%</strong>
                        </div>
                        <div class="match-stat-item">
                            <span>KDA</span>
                            <strong>${match.kda}</strong>
                        </div>
                    </div>
                    <span class="match-expand-icon">+</span>
                `;

                const content = document.createElement('div');
                content.className = 'match-dropdown-content';
                
                header.addEventListener('click', () => openMatchDropdown(wrapper, match.matchId));

                wrapper.appendChild(header);
                wrapper.appendChild(content);
                matchHistoryContainer.appendChild(wrapper);
            });
        } else {
            matchHistoryContainer.innerHTML = "<p>Aucun match compétitif récent trouvé.</p>";
        }

        // --- Attacher les écouteurs d'événements spécifiques à ce profil ---
        root.querySelector('.rankCard').addEventListener('click', () => {
            const rrContent = root.querySelector('.rrGraphDropdownContent');
            const isExpanded = rrContent.style.display === 'block';
            
            if (isExpanded) {
                rrContent.style.display = 'none';
            } else {
                drawRRGraph(data.rrHistory, root.querySelector('.rrGraphContainer'));
                rrContent.style.display = 'block';
            }
        });
    }

    function populateAnalysisCard(nameEl, statsEl, imgEl, data) {
        if (data && data.name) {
            nameEl.textContent = data.name;
            statsEl.textContent = `${data.winRate.toFixed(0)}% WR (${data.count} m.) | ${data.kd} K/D`;
            imgEl.src = data.image || 'https://via.placeholder.com/64';
        } else {
            nameEl.textContent = '-';
            statsEl.textContent = 'N/A';
            imgEl.src = 'https://via.placeholder.com/64';
        }
    }

    function showError(element, message) {
        element.textContent = message;
        element.style.display = 'block';
    }


    // =================================================================
    // --- LEADERBOARD
    // =================================================================
    let leaderboardLoaded = false;
    async function fetchLeaderboard() {
        if (leaderboardLoaded) return; 
        leaderboardLoader.style.display = 'block';
        leaderboardError.style.display = 'none';

        try {
            const response = await fetch('/api/leaderboard/eu');
            if (!response.ok) throw new Error('Impossible de charger le leaderboard.');
            const data = await response.json();
            
            leaderboardList.innerHTML = ""; // Vider
            data.forEach(player => {
                if (!player) return; 
                const li = document.createElement('li');
                li.className = 'leaderboard-player-card card';
                
                let rankClass = "rank-Immortal-1";
                if (player.isRadiant) rankClass = "rank-Radiant";
                else if (player.leaderboardRank <= 100) rankClass = "rank-Immortal-3";
                else if (player.leaderboardRank <= 500) rankClass = "rank-Immortal-2";
                
                li.innerHTML = `
                    <span class="lb-rank ${rankClass}">#${player.leaderboardRank}</span>
                    <div class="lb-player-info">
                        <img src="${player.PlayerCardID ? `https://media.valorant-api.com/playercards/${player.PlayerCardID}/smallart.png` : 'https://via.placeholder.com/40'}" class="match-agent-icon" alt="">
                        <div>
                            <span class="lb-player-name" data-name="${player.gameName}" data-tag="${player.tagLine}">
                                ${player.gameName}#${player.tagLine}
                            </span>
                        </div>
                    </div>
                    <div class="lb-stat">
                        <p>${player.rankedRating} <span style="color:var(--primary-color)">RR</span></p>
                    </div>
                    <div class="lb-stat">
                        <p>${player.numberOfWins}</p>
                        <span>Victoires</span>
                    </div>
                `;
                li.querySelector('.lb-player-name').addEventListener('click', (e) => {
                    const target = e.target.closest('.lb-player-name');
                    if (target) {
                        const name = target.dataset.name;
                        const tag = target.dataset.tag;
                        
                        showPage('results');
                        riotIdInput.value = `${name}#${tag}`;
                        handleSearch(false);
                    }
                });
                leaderboardList.appendChild(li);
            });
            leaderboardLoaded = true;
        } catch (error) {
            showError(leaderboardError, error.message);
        } finally {
            leaderboardLoader.style.display = 'none';
        }
    }
    
    // =================================================================
    // --- Logique du menu déroulant de match ---
    // =================================================================

    async function openMatchDropdown(wrapper, matchId) {
        const contentDiv = wrapper.querySelector('.match-dropdown-content');
        const isLoaded = wrapper.dataset.loaded === 'true';
        const isExpanded = wrapper.classList.contains('expanded');

        if (isExpanded) {
            wrapper.classList.remove('expanded');
        } else {
            document.querySelectorAll('.match-dropdown-wrapper.expanded').forEach(el => el.classList.remove('expanded'));
            
            if (isLoaded) {
                wrapper.classList.add('expanded');
            } else {
                contentDiv.innerHTML = '<div class="loader" style="margin: 20px auto;"></div>';
                wrapper.classList.add('expanded'); 
                
                try {
                    const response = await fetch(`/api/match/${matchId}`);
                    if (!response.ok) throw new Error("Impossible de charger les détails du match.");
                    const data = await response.json();
                    
                    let html = `<h3>Scoreboard (${data.teams.red.rounds_won} - ${data.teams.blue.rounds_won})</h3>`;
                    
                    const redWon = data.teams.red.has_won;
                    html += `<h4 style="color: ${redWon ? 'var(--win-color)' : 'var(--lose-color)'};">Équipe Rouge</h4>`;
                    html += buildScoreboardTable(data.players.red, redWon);
                    
                    const blueWon = data.teams.blue.has_won;
                    html += `<h4 style="color: ${blueWon ? 'var(--win-color)' : 'var(--lose-color)'};">Équipe Bleue</h4>`;
                    html += buildScoreboardTable(data.players.blue, blueWon);
                    
                    contentDiv.innerHTML = html;
                    wrapper.dataset.loaded = 'true';
                    
                    contentDiv.querySelectorAll('.leaderboard-player-name').forEach(nameEl => {
                        nameEl.addEventListener('click', (e) => {
                            e.stopPropagation(); 
                            const target = e.target.closest('.leaderboard-player-name');
                            if (target) {
                                const name = target.dataset.name;
                                const tag = target.dataset.tag;
                                
                                showPage('results');
                                riotIdInput.value = `${name}#${tag}`;
                                handleSearch(false);
                            }
                        });
                    });

                } catch (error) {
                    contentDiv.innerHTML = `<p style="color: var(--lose-color);">${error.message}</p>`;
                }
            }
        }
    }
    
    function buildScoreboardTable(players, hasWon) {
        const tableClass = hasWon ? 'team-win' : 'team-loss';
        let table = `<table class="leaderboard-table scoreboard-table ${tableClass}">`;
        table += '<thead><tr><th>Joueur</th><th>Agent</th><th>K/D/A</th><th>ACS</th></tr></thead><tbody>';
        players.forEach(p => {
            const acs = (p.stats.score / (p.stats.rounds_played || 1)).toFixed(0);
            table += `
                <tr>
                    <td>
                        <span class="leaderboard-player-name" data-name="${p.name}" data-tag="${p.tag}">
                            ${p.name}#${p.tag}
                        </span>
                    </td>
                    <td><img src="${p.assets.agent.small}" alt="${p.character}" title="${p.character}"></td>
                    <td>${p.stats.kills}/${p.stats.deaths}/${p.stats.assists}</td>
                    <td>${acs}</td>
                </tr>
            `;
        });
        table += '</tbody></table>';
        return table;
    }
    
    // =================================================================
    // --- FONCTIONS GRAPHIQUES
    // =================================================================
    function createSparkline(container, data, isBinary = false) {
        if (!container) return;
        container.innerHTML = ''; 
        if (!data || data.length < 2) return; 

        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute('class', 'sparkline-svg');
        svg.setAttribute('viewBox', '0 0 100 40');
        svg.setAttribute('preserveAspectRatio', 'none');

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute('class', 'sparkline-path');

        const max = isBinary ? 1 : Math.max(...data);
        const min = isBinary ? 0 : Math.min(0, ...data); 
        const spread = max - min || 1; 
        const points = data.map((d, i) => {
            const x = (i / (data.length - 1)) * 100;
            const y = 35 - ((d - min) / spread) * 30; 
            return `${x},${y}`;
        });
        
        path.setAttribute('d', 'M ' + points.join(' L '));
        svg.appendChild(path);
        container.appendChild(svg);
    }

    function drawRRGraph(data, container) {
        if (!container) return;
        container.innerHTML = '';
        if (!data || data.length < 2) {
            container.innerHTML = '<p>Pas assez de données pour afficher un graphique.</p>';
            return;
        }

        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute('class', 'rr-graph-svg');
        svg.setAttribute('viewBox', '0 0 500 200');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

        const padding = 40;
        const width = 500 - padding * 2;
        const height = 200 - padding * 2;

        const maxRR = 100;
        const minRR = 0;
        const spread = maxRR - minRR || 1;

        const grid = document.createElementNS(svgNS, 'g');
        for (let i = 0; i <= 4; i++) { 
            const y = padding + (height - (i * 25 / spread) * height);
            const line = document.createElementNS(svgNS, 'line');
            line.setAttribute('class', 'rr-graph-grid');
            line.setAttribute('x1', padding);
            line.setAttribute('y1', y);
            line.setAttribute('x2', padding + width);
            line.setAttribute('y2', y);
            grid.appendChild(line);

            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('class', 'rr-graph-text');
            text.setAttribute('x', padding - 10);
            text.setAttribute('y', y + 3);
            text.setAttribute('text-anchor', 'end');
            text.textContent = i * 25;
            grid.appendChild(text);
        }
        svg.appendChild(grid);

        const path = document.createElementNS(svgNS, "path");
        path.setAttribute('class', 'rr-graph-path');
        const points = data.map((d, i) => {
            const x = padding + (i / (data.length - 1)) * width;
            const y = padding + (height - ((d.rr - minRR) / spread) * height);
            return `${x},${y}`;
        });
        path.setAttribute('d', 'M ' + points.join(' L '));
        svg.appendChild(path);

        data.forEach((d, i) => {
            const x = padding + (i / (data.length - 1)) * width;
            const y = padding + (height - ((d.rr - minRR) / spread) * height);
            
            const prevRank = data[i-1] ? data[i-1].rank : null;
            const isRankUp = prevRank && d.rank !== prevRank && d.change > 0;
            const isDerank = prevRank && d.rank !== prevRank && d.change < 0;
            
            const pointGroup = document.createElementNS(svgNS, 'g');
            
            let element;
            if ((isRankUp || isDerank) && d.rank_icon) {
                element = document.createElementNS(svgNS, 'image');
                element.setAttribute('href', d.rank_icon);
                element.setAttribute('x', x - 12);
                element.setAttribute('y', y - 12);
                element.setAttribute('width', 24);
                element.setAttribute('height', 24);
                element.setAttribute('class', `rr-rank-image ${isRankUp ? 'rr-rank-up-icon' : 'rr-rank-down-icon'}`);
            } else {
                element = document.createElementNS(svgNS, 'circle');
                element.setAttribute('class', 'rr-graph-point');
                element.setAttribute('cx', x);
                element.setAttribute('cy', y);
                element.setAttribute('r', 3);
            }
            
            const title = document.createElementNS(svgNS, 'title');
            const date = new Date(d.date).toLocaleDateString('fr-FR');
            title.textContent = `${date} - ${d.rr} RR (${d.rank})`;
            
            pointGroup.appendChild(title);
            pointGroup.appendChild(element);
            svg.appendChild(pointGroup);
        });
        
        container.appendChild(svg);
    }
    
    // =================================================================
    // --- SECTION ARMURERIE (Modifiée pour la grille de skins)
    // =================================================================

    // 1. Fetcher les données de l'armurerie (avec cache)
    async function fetchArmory() {
        if (armoryData) {
            populateArmoryGrid(armoryData);
            return;
        }
        
        armoryLoader.style.display = 'block';
        armoryError.style.display = 'none';
        armoryGrid.innerHTML = '';

        try {
            const response = await fetch('/api/weapons');
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || "Impossible de charger l'armurerie.");
            }
            const data = await response.json();
            armoryData = data; // Stocker en cache
            populateArmoryGrid(data);
        } catch (error) {
            showError(armoryError, error.message);
        } finally {
            armoryLoader.style.display = 'none';
        }
    }

    // 2. Remplir la grille des SKINS (Modifié)
    function populateArmoryGrid(data) {
        armoryGrid.innerHTML = '';
        // Regrouper par catégorie
        const categories = {};
        data.forEach(weapon => {
            const categoryKey = weapon.category || 'EEquippableCategory::Unknown';
            if (!categories[categoryKey]) categories[categoryKey] = [];
            categories[categoryKey].push(weapon);
        });

        // Ordre d'affichage des catégories
        const categoryOrder = [
            'EEquippableCategory::Melee',
            'EEquippableCategory::Sidearm',
            'EEquippableCategory::SMG',
            'EEquippableCategory::Shotgun',
            'EEquippableCategory::Rifle',
            'EEquippableCategory::Sniper',
            'EEquippableCategory::Heavy'
        ];

        categoryOrder.forEach(categoryKey => {
            const weapons = categories[categoryKey];
            if (!weapons) return;
            
            // Titre de Catégorie (ex: Fusils)
            const categoryName = categoryKey.split('::')[1] || 'Arme';
            const categoryTitle = document.createElement('h2'); // H2 pour la catégorie
            categoryTitle.textContent = categoryName;
            categoryTitle.className = 'armory-category-title'; // Ajout de classe
            armoryGrid.appendChild(categoryTitle);

            // Boucle d'armes pour afficher les SKINS
            weapons.forEach(weapon => {
                // Titre de l'arme (ex: Vandal)
                const weaponTitle = document.createElement('h3'); // H3 pour l'arme
                weaponTitle.textContent = weapon.displayName;
                weaponTitle.className = 'armory-weapon-title'; // Ajout de classe
                armoryGrid.appendChild(weaponTitle);

                // Conteneur de grille pour les skins de CETTE arme
                const skinGrid = document.createElement('div');
                skinGrid.className = 'armory-skin-grid';
                
                const validSkins = weapon.skins.filter(s => s.displayIcon && !s.displayName.includes('Standard') && !s.displayName.includes('Aléatoire'));
                
                if (validSkins.length === 0) {
                    skinGrid.innerHTML = '<p class="armory-no-skins">Aucun skin disponible pour cette arme.</p>';
                }

                // Ajouter les cartes de SKINS
                validSkins.forEach(skin => {
                    const card = document.createElement('div');
                    card.className = 'armory-skin-card card clickable';
                    card.innerHTML = `
                        <img src="${skin.displayIcon}" alt="${skin.displayName}">
                        <h4>${skin.displayName}</h4>
                    `;
                    // Le clic appelle showSkinDetails avec l'UUID de l'arme et du skin
                    card.addEventListener('click', () => showSkinDetails(weapon.uuid, skin.uuid));
                    skinGrid.appendChild(card);
                });
                armoryGrid.appendChild(skinGrid);
            });
        });
    }

    // 3. Afficher le détail d'un SKIN (Modifié, n'est plus un carrousel)
    function showSkinDetails(weaponUuid, skinUuid) {
        const weapon = armoryData.find(w => w.uuid === weaponUuid);
        if (!weapon) return;
        const skin = weapon.skins.find(s => s.uuid === skinUuid);
        if (!skin) return;
        
        const hasLevels = skin.levels && skin.levels.length > 1;
        const hasChromas = skin.chromas && skin.chromas.length > 1;

        // HTML pour la vue de détail (un seul skin)
        armoryDetailContainer.innerHTML = `
            <div class="armory-detail-header">
                <button class="armory-back-button">&larr; Retour</button>
                <h2>${weapon.displayName}</h2>
            </div>
            <div class="skin-detail-container card">
                <div class="skin-carousel-image-wrapper">
                    </div>
                <div class="skin-info">
                    <h4 class="skin-name">${skin.displayName}</h4>
                    <div class="skin-selectors" style="grid-template-columns: ${hasLevels && hasChromas ? '1fr 1fr' : '1fr'};">
                        ${hasLevels ? `
                        <div class="skin-levels">
                            <h5>Niveaux</h5>
                            <div class="skin-level-list">
                                ${skin.levels.map((level, i) => `
                                    <div class="level-item ${i === 0 ? 'active' : ''}" data-level-uuid="${level.uuid}">
                                        ${level.displayName || `Niveau ${i + 1}`}
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : (hasChromas ? '<div></div>' : '')} ${hasChromas ? `
                        <div class="skin-chromas">
                            <h5>Chromas</h5>
                            <div class="skin-chroma-list">
                                ${skin.chromas.map((chroma, i) => `
                                    <div class="chroma-swatch ${i === 0 ? 'active' : ''}" data-chroma-uuid="${chroma.uuid}" title="${chroma.displayName}">
                                        <img src="${chroma.swatch || chroma.displayIcon || 'https://via.placeholder.com/30'}" alt="${chroma.displayName}">
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        // Gérer les clics sur les niveaux et chromas
        armoryDetailContainer.addEventListener('click', (e) => {
            const container = e.target.closest('.skin-detail-container');
            if (!container) return; // Ne pas réagir aux clics en dehors (ex: bouton retour)

            let levelUuid = container.querySelector('.level-item.active')?.dataset.levelUuid;
            let chromaUuid = container.querySelector('.chroma-swatch.active')?.dataset.chromaUuid;
            
            const levelTarget = e.target.closest('.level-item');
            if (levelTarget) {
                container.querySelectorAll('.level-item').forEach(l => l.classList.remove('active'));
                levelTarget.classList.add('active');
                levelUuid = levelTarget.dataset.levelUuid;
            }
            
            const chromaTarget = e.target.closest('.chroma-swatch');
            if (chromaTarget) {
                container.querySelectorAll('.chroma-swatch').forEach(c => c.classList.remove('active'));
                chromaTarget.classList.add('active');
                chromaUuid = chromaTarget.dataset.chromaUuid;
            }
            
            updateSkinDisplay(skin, container, levelUuid, chromaUuid);
        });

        // Bouton Retour
        armoryDetailContainer.querySelector('.armory-back-button').addEventListener('click', () => {
            armoryListContainer.style.display = 'block';
            armoryDetailContainer.style.display = 'none';
        });

        // Afficher la page de détail
        armoryListContainer.style.display = 'none';
        armoryDetailContainer.style.display = 'block';
        
        // Initialiser l'affichage du skin
        const defaultLevelUuid = (skin.levels && skin.levels.length > 0) ? skin.levels[0].uuid : null;
        const defaultChromaUuid = (skin.chromas && skin.chromas.length > 0) ? skin.chromas[0].uuid : null;
        updateSkinDisplay(skin, armoryDetailContainer.querySelector('.skin-detail-container'), defaultLevelUuid, defaultChromaUuid);
    }
    
    // 4. Mettre à jour l'image/vidéo du skin
    function updateSkinDisplay(skin, containerElement, levelUuid, chromaUuid) {
        if (!containerElement) return; // Sécurité
        
        const imageWrapper = containerElement.querySelector('.skin-carousel-image-wrapper');
        const skinNameEl = containerElement.querySelector('.skin-name');

        const level = levelUuid ? skin.levels.find(l => l.uuid === levelUuid) : null;
        const chroma = chromaUuid ? skin.chromas.find(c => c.uuid === chromaUuid) : null;

        let displayName = skin.displayName;
        let displayMedia = chroma ? chroma.fullRender : skin.displayIcon;

        // Si le chroma a un nom (ex: "Rouge"), l'ajouter
        if (chroma && chroma.displayName && !skin.displayName.includes(chroma.displayName) && !chroma.displayName.includes('Standard')) {
             displayName = `${skin.displayName} (${chroma.displayName.split('(').pop().replace(')','')})`;
        }
        
        // Si un niveau a une vidéo, la préférer
        if (level && level.streamedVideo) {
            imageWrapper.innerHTML = `<video src="${level.streamedVideo}" autoplay muted loop playsinline></video>`;
        } else {
             // Utiliser le "fullRender" du chroma, sinon l'icône du skin
            imageWrapper.innerHTML = `<img src="${displayMedia || 'https://via.placeholder.com/400x200'}" alt="${displayName}">`;
        }
        
        skinNameEl.textContent = displayName;
    }
    // --- FIN SECTION ARMURERIE ---

});