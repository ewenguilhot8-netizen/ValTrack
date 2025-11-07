document.addEventListener('DOMContentLoaded', () => {

    // --- Sélecteurs Globaux ---
    let currentPlayerData = null; 
    let searchHistory = JSON.parse(localStorage.getItem('valHistory')) || [];
    
    // MODIFIÉ: Gestion de l'état de connexion
    let currentUser = null; // null = on ne sait pas, false = déconnecté, objet = connecté
    let followedPlayers = []; // Sera chargé après la connexion

    const svgNS = "http://www.w3.org/2000/svg";
    const profileTemplate = document.getElementById('player-profile-template').innerHTML;
    let currentPage = 'finder'; 
    let pageIndex = { 'finder': 0, 'results': 0, 'leaderboard': 1, 'compare': 2, 'armory': 3, 'followed': 4 }; 

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
    const navFollowed = document.getElementById('navFollowed'); 
    
    const finderPage = document.getElementById('finderPage');
    const resultsPage = document.getElementById('resultsPage'); 
    const leaderboardPage = document.getElementById('leaderboardPage');
    const comparePage = document.getElementById('comparePage');
    const armoryPage = document.getElementById('armoryPage');
    const followedPage = document.getElementById('followedPage'); 

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
    const splashNavFollowed = document.getElementById('splashNavFollowed'); 

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
    const leaderboardSearchInput = document.getElementById('leaderboardSearchInput'); 
    
    // --- Sélecteurs Armurerie ---
    const armoryListContainer = document.getElementById('armoryListContainer');
    const armoryDetailContainer = document.getElementById('armoryDetailContainer');
    const armoryLoader = document.getElementById('armoryLoader');
    const armoryError = document.getElementById('armoryError');
    const armoryGrid = document.getElementById('armoryGrid');
    const armorySearchInput = document.getElementById('armorySearchInput'); 
    const armoryCategories = document.querySelector('.armory-categories'); 
    let armoryData = null; // Cache pour les données des armes
    
    // Sélecteurs Page Suivis
    const followedLoader = document.getElementById('followedLoader');
    const followedError = document.getElementById('followedError');
    const followedList = document.getElementById('followedList');
    
    // NOUVEAU: Sélecteur d'Authentification
    const authStatus = document.getElementById('auth-status');

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
    // --- AUTHENTIFICATION (MODIFIÉ) ---
    // =================================================================
    
    // MODIFIÉ: Vérifier l'état de connexion et définir currentUser
    async function checkAuthState() {
        try {
            const res = await fetch('/api/me');
            if (!res.ok) {
                currentUser = false; // "false" = on a vérifié, déconnecté
                // --- MODIFICATION ICI: Ajout du SVG et de la classe ---
                authStatus.innerHTML = `
                    <a href="/auth/discord" class="discord-login-button">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20.317 4.36981C18.696 3.16361 16.904 2.22151 15 1.62431C14.903 1.82101 14.801 2.02321 14.706 2.22811C13.064 1.91621 11.373 1.91621 9.738 2.22811C9.642 2.02321 9.54 1.82101 9.444 1.62431C7.096 2.22151 5.304 3.16361 3.683 4.36981C1.026 8.32831 0 12.6313 0 17.2023C2.312 19.1228 4.703 20.301 7.234 20.803C7.541 20.3995 7.821 19.9705 8.077 19.516C7.474 19.3171 6.896 19.0911 6.35 18.8396C6.495 18.7841 6.638 18.7268 6.778 18.6676C9.183 20.1062 11.912 20.592 14.757 20.441C15.118 20.068 15.463 19.6795 15.79 19.276C16.513 19.5125 17.21 19.7215 17.882 19.9023C18.15 20.33 18.423 20.738 18.72 21.127C21.24 20.596 23.606 19.4295 25.898 17.545C25.961 12.875 24.938 8.70781 22.317 4.36981H20.317Z" fill="white"/>
                            <path d="M17.65 15.2284C16.6 15.2284 15.74 14.3804 15.74 13.3444C15.74 12.3074 16.59 11.4604 17.65 11.4604C18.71 11.4604 19.56 12.3074 19.56 13.3444C19.56 14.3804 18.71 15.2284 17.65 15.2284ZM8.24 15.2284C7.18 15.2284 6.33 14.3804 6.33 13.3444C6.33 12.3074 7.18 11.4604 8.24 11.4604C9.3 11.4604 10.15 12.3074 10.15 14.3804C10.15 14.3804 9.3 15.2284 8.24 15.2284Z" fill="white"/>
                        </svg>
                        <span>Se connecter avec Discord</span>
                    </a>
                `;
                return;
            }
            currentUser = await res.json(); // "objet" = connecté
            // --- MODIFICATION ICI: Ajout de la classe pour le bouton déconnexion ---
            authStatus.innerHTML = `
                <div class="auth-user-info">
                    <img src="${currentUser.avatar || 'https://via.placeholder.com/30'}" alt="Avatar">
                    <span>${currentUser.username}</span>
                </div>
                <a href="/auth/logout" class="auth-logout-button">Déconnexion</a>
            `;
            await loadFollowedPlayersFromDB();
        } catch (err) {
            console.error("Erreur d'authentification", err);
            currentUser = false;
            // Assurez-vous que le SVG est là même en cas d'erreur
            authStatus.innerHTML = `
                <a href="/auth/discord" class="discord-login-button">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.317 4.36981C18.696 3.16361 16.904 2.22151 15 1.62431C14.903 1.82101 14.801 2.02321 14.706 2.22811C13.064 1.91621 11.373 1.91621 9.738 2.22811C9.642 2.02321 9.54 1.82101 9.444 1.62431C7.096 2.22151 5.304 3.16361 3.683 4.36981C1.026 8.32831 0 12.6313 0 17.2023C2.312 19.1228 4.703 20.301 7.234 20.803C7.541 20.3995 7.821 19.9705 8.077 19.516C7.474 19.3171 6.896 19.0911 6.35 18.8396C6.495 18.7841 6.638 18.7268 6.778 18.6676C9.183 20.1062 11.912 20.592 14.757 20.441C15.118 20.068 15.463 19.6795 15.79 19.276C16.513 19.5125 17.21 19.7215 17.882 19.9023C18.15 20.33 18.423 20.738 18.72 21.127C21.24 20.596 23.606 19.4295 25.898 17.545C25.961 12.875 24.938 8.70781 22.317 4.36981H20.317Z" fill="white"/>
                        <path d="M17.65 15.2284C16.6 15.2284 15.74 14.3804 15.74 13.3444C15.74 12.3074 16.59 11.4604 17.65 11.4604C18.71 11.4604 19.56 12.3074 19.56 13.3444C19.56 14.3804 18.71 15.2284 17.65 15.2284ZM8.24 15.2284C7.18 15.2284 6.33 14.3804 6.33 13.3444C6.33 12.3074 7.18 11.4604 8.24 11.4604C9.3 11.4604 10.15 12.3074 10.15 13.3444C10.15 14.3804 9.3 15.2284 8.24 15.2284Z" fill="white"/>
                    </svg>
                    <span>Se connecter avec Discord</span>
                </a>
            `;
        }
    }
    
    // MODIFIÉ: Vérifie currentUser
    async function loadFollowedPlayersFromDB() {
        if (!currentUser) { // Si false ou null
            followedPlayers = [];
            return;
        }
        try {
            const res = await fetch('/api/followed');
            const data = await res.json();
            followedPlayers = data;
        } catch (err) {
            console.warn("Impossible de charger les joueurs suivis (déconnecté?)");
            followedPlayers = [];
        }
    }

    checkAuthState(); // Lancer la vérification au démarrage


    // =================================================================
    // --- NAVIGATION & ANIMATIONS
    // =================================================================
    
    const pages = {
        'finder': finderPage,
        'results': resultsPage,
        'leaderboard': leaderboardPage,
        'compare': comparePage,
        'armory': armoryPage,
        'followed': followedPage 
    };
    
    const navLinks = {
        'finder': navFinder,
        'results': navFinder, 
        'leaderboard': navLeaderboard,
        'compare': navCompare,
        'armory': navArmory,
        'followed': navFollowed 
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

        updateButton.style.display = (pageName === 'results') ? 'inline-block' : 'none';
        
        // Gérer les liens actifs
        Object.values(navLinks).forEach(nav => nav.classList.remove('active'));
        if(navLinks[pageName]) navLinks[pageName].classList.add('active');

        // Gérer le fond
        if (pageName === 'finder') {
            agentBackgroundArt.style.backgroundImage = `url(${splashScreenImage})`;
            agentBackgroundArt.style.opacity = '0.15'; 
            mapBackgroundArt.style.opacity = '0';
        
        } else if (pageName === 'results' && currentPlayerData) {
            agentBackgroundArt.style.opacity = '0.08';
            mapBackgroundArt.style.opacity = '0.08';
        
        } else {
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
    navFollowed.addEventListener('click', (e) => { 
        showPage('followed');
        loadFollowedPlayersPage();
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
    splashNavFollowed.addEventListener('click', (e) => { 
        showPage('followed');
        loadFollowedPlayersPage();
    });
    
    // Écouteurs pour les filtres (Armurerie & Leaderboard)
    armorySearchInput.addEventListener('input', () => filterArmory());
    armoryCategories.addEventListener('click', (e) => {
        if (e.target.classList.contains('armory-cat-button')) {
            armoryCategories.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            filterArmory();
        }
    });

    leaderboardSearchInput.addEventListener('input', () => {
        const searchTerm = leaderboardSearchInput.value.toLowerCase();
        const players = leaderboardList.querySelectorAll('.leaderboard-player-card');
        
        players.forEach(player => {
            const playerName = player.querySelector('.lb-player-name').textContent.toLowerCase();
            if (playerName.includes(searchTerm)) {
                player.style.display = 'grid'; 
            } else {
                player.style.display = 'none';
            }
        });
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

    // MODIFIÉ: Ajout d'une boucle d'attente pour l'authentification
    async function handleSearch(forceUpdate = false) {
        // --- NOUVEAU: Attendre que l'authentification soit vérifiée ---
        while (currentUser === null) {
            console.log("En attente de l'authentification...");
            await new Promise(resolve => setTimeout(resolve, 100)); // Attend 100ms
        }
        // --- FIN NOUVEAU ---

        const fullRiotId = riotIdInput.value;
        if (!fullRiotId.includes('#')) {
            showError(finderError, "Veuillez entrer un Riot ID complet (ex: Utilisateur#TAG)");
            finderError.style.display = 'block';
            setTimeout(() => finderError.style.display = 'none', 3000);
            return;
        }

        searchButton.classList.add('loading'); 
        
        await fetchPlayerData(fullRiotId, finderResults, finderLoader, finderError, forceUpdate, searchButton);
        
        if (finderError.style.display !== 'block') {
            showPage('results');
        }
    }
    
    // =================================================================
    // --- PAGE COMPARER
    // =================================================================
    compareSearchButton.addEventListener('click', async () => {
        // --- NOUVEAU: Attendre que l'authentification soit vérifiée ---
        while (currentUser === null) {
            console.log("En attente de l'authentification...");
            await new Promise(resolve => setTimeout(resolve, 100)); // Attend 100ms
        }
        // --- FIN NOUVEAU ---

        const id1 = compareInput1.value;
        const id2 = compareInput2.value;

        if (!id1.includes('#') || !id2.includes('#')) {
            showError(compareError, "Veuillez entrer deux Riot ID complets (ex: Utilisateur#TAG)");
            return;
        }
        
        compareResults1.innerHTML = '';
        compareResults2.innerHTML = '';
        
        compareSearchButton.disabled = true;
        compareSearchButton.textContent = 'Chargement...';
        
        const p1 = fetchPlayerData(id1, compareResults1, compareLoader, compareError, false);
        const p2 = fetchPlayerData(id2, compareResults2, compareLoader, compareError, false);

        Promise.all([p1, p2]).finally(() => {
             compareSearchButton.disabled = false;
             compareSearchButton.textContent = 'Comparer';
        });
    });

    // =================================================================
    // --- LOGIQUE DE FETCH & POPULATION (RÉUTILISABLE)
    // =================================================================

    async function fetchPlayerData(fullRiotId, containerElement, loaderElement, errorElement, forceUpdate = false, buttonElement = null) {
        containerElement.innerHTML = ''; 
        errorElement.style.display = 'none';
        loaderElement.style.display = 'block';

        if(buttonElement && buttonElement.id === 'searchButton') {
             buttonElement.classList.add('loading');
        } else if (buttonElement) {
            buttonElement.disabled = true;
        }

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
                if(data.playerInfo.bestAgentSplash) {
                    agentBackgroundArt.style.backgroundImage = `url(${data.playerInfo.bestAgentSplash})`;
                }
                if(data.playerInfo.bestMapSplash) {
                    mapBackgroundArt.style.backgroundImage = `url(${data.playerInfo.bestMapSplash})`;
                }
            }
            
            containerElement.innerHTML = profileTemplate;
            populateUI(data, containerElement); // populateUI utilisera le currentUser global
            addToHistory(fullRiotId);
            
        } catch (error) {
            console.error(error);
            showError(errorElement, `${fullRiotId}: ${error.message}`);
        } finally {
            loaderElement.style.display = 'none';
            if(buttonElement && buttonElement.id === 'searchButton') {
                buttonElement.classList.remove('loading');
            } else if (buttonElement) {
                buttonElement.disabled = false;
            }
        }
    }

    // MODIFIÉ: Logique des commentaires mise à jour
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

        // Stats Score Révélation
        const statsScoreWrapper = root.querySelector('.stats-score-value');
        const statsScoreNumber = root.querySelector('.score-number');
        const score = data.overviewStats.statsScore;
        
        statsScoreNumber.textContent = score;
        const lightness = 30 + (score / 1000) * 40;
        const scoreColor = `hsl(200, 100%, ${lightness}%)`;
        statsScoreNumber.style.color = scoreColor;
        
        statsScoreWrapper.addEventListener('click', () => {
            statsScoreWrapper.classList.remove('blurred');
        }, { once: true }); 


        // Gérer le bouton Suivre
        const followButton = root.querySelector('.follow-button');
        const riotId = data.playerInfo.name;
        followButton.dataset.riotid = riotId;
        
        if (followedPlayers.map(p => p.toLowerCase()).includes(riotId.toLowerCase())) {
            followButton.textContent = 'Suivi';
            followButton.classList.add('followed');
        } else {
            followButton.textContent = 'Suivre';
            followButton.classList.remove('followed');
        }
        
        followButton.onclick = (e) => { 
            toggleFollowPlayer(riotId, e.target); // Fonction modifiée
        };


        // Rang
        root.querySelector('.rankName').textContent = data.rankInfo.rankName || 'Unranked';
        root.querySelector('.rrPoints').textContent = data.rankInfo.rankName ? `${data.rankInfo.rr} RR` : '';
        root.querySelector('.rankImage').src = data.rankInfo.rankImageUrl || 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/0/largeicon.png';
        const rrPercent = (data.rankInfo.rr / 100) * 360;
        root.querySelector('.rrCircle').style.setProperty('--rr-percent', `${rrPercent}deg`);

        const rrChangeEl = root.querySelector('.rrChange');
        if (data.rankInfo.lastRRChange !== null && data.rankInfo.rankName && data.rankInfo.lastRRChange !== 0) {
            const change = data.rankInfo.lastRRChange;
            rrChangeEl.textContent = (change > 0) ? `+${change} RR` : `${change} RR`;
            rrChangeEl.className = 'rrChange tag'; 
            rrChangeEl.classList.add(change > 0 ? 'positive' : 'negative');
            rrChangeEl.style.display = 'inline-block';
        } else {
            rrChangeEl.style.display = 'none';
        }

        // Stats
        root.querySelector('.kdRatio').textContent = data.overviewStats.kd;
        root.querySelector('.winPercent').textContent = `${data.overviewStats.winRate}%`;
        root.querySelector('.hsPercent').textContent = `${data.overviewStats.hsPercent}%`;
        root.querySelector('.acs').textContent = data.overviewStats.acs;
        root.querySelector('.adr').textContent = data.overviewStats.adr;

        // Graphiques (10 derniers matchs)
        createSparkline(root.querySelector('.kdGraph'), data.historyData.kd);
        createSparkline(root.querySelector('.winRateGraph'), data.historyData.winRate, true); 
        createSparkline(root.querySelector('.hsGraph'), data.historyData.hs);
        createSparkline(root.querySelector('.acsGraph'), data.historyData.acs);
        createSparkline(root.querySelector('.adrGraph'), data.historyData.adr);

        // Analyse
        populateAnalysisCard(root.querySelector('.bestAgentName'), root.querySelector('.bestAgentStats'), root.querySelector('.bestAgentImage'), data.analysis.agents.best);
        populateAnalysisCard(root.querySelector('.worstAgentName'), root.querySelector('.worstAgentStats'), root.querySelector('.worstAgentImage'), data.analysis.agents.worst);
        populateAnalysisCard(root.querySelector('.bestMapName'), root.querySelector('.bestMapStats'), root.querySelector('.bestMapImage'), data.analysis.maps.best);
        populateAnalysisCard(root.querySelector('.worstMapName'), root.querySelector('.worstMapStats'), root.querySelector('.worstMapImage'), data.analysis.maps.worst);

        // Historique des matchs
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

        // --- NOUVEAU: Logique des Commentaires (MODIFIÉE) ---
        const commentForm = root.querySelector('#commentForm');
        const commentLoginPrompt = root.querySelector('#commentLoginPrompt');
        const latestCommentDisplay = root.querySelector('#latestCommentDisplay');
        const viewAllBtn = root.querySelector('#viewAllCommentsBtn');
        
        // 1. Afficher le widget de commentaire principal
        if (data.userComment) {
            // Le commentaire de l'utilisateur a la priorité (et n'est pas rééditable)
            latestCommentDisplay.innerHTML = '<h4 class="comment-widget-title">Votre Commentaire :</h4>';
            latestCommentDisplay.appendChild(createCommentElement(data.userComment));
        } else if (data.latestComment) {
            // Sinon, on montre le dernier commentaire public
            latestCommentDisplay.innerHTML = '<h4 class="comment-widget-title">Dernier Commentaire :</h4>';
            latestCommentDisplay.appendChild(createCommentElement(data.latestComment));
        } else {
            // Sinon, placeholder
            latestCommentDisplay.innerHTML = '<p class="no-comment-placeholder">Soyez le premier à laisser un commentaire !</p>';
        }

        // 2. Gérer l'affichage du formulaire (qui peut poster ?)
        if (currentUser) {
            // Connecté
            if (data.userComment) {
                // A déjà posté un commentaire (règle: 1 par profil)
                commentForm.style.display = 'none';
                commentLoginPrompt.style.display = 'none';
            } else {
                // Connecté et n'a pas posté
                commentForm.style.display = 'flex';
                commentLoginPrompt.style.display = 'none';
                attachCommentSubmitListener(root, data.playerInfo.name);
            }
        } else {
            // Déconnecté
            commentForm.style.display = 'none';
            commentLoginPrompt.style.display = 'block';
        }
        
        // 3. Gérer le bouton "Voir tout"
        viewAllBtn.addEventListener('click', () => {
            toggleAllComments(root, data.playerInfo.name);
        });
        
        // Mettre à jour le compteur
        updateCommentCount(root, data.playerInfo.name);


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
        table += '<thead><tr><th>Joueur</th><th>Rang</th><th>K/D/A</th><th>ACS</th></tr></thead><tbody>';
        
        players.forEach(p => {
            const acs = (p.stats.score / (p.stats.rounds_played || 1)).toFixed(0);
            
            const rankHtml = `<img src="${p.rank_icon_url || 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/0/smallicon.png'}" alt="${p.currenttier_patched}" title="${p.currenttier_patched}" class="scoreboard-rank-icon">`;
            const agentIcon = p.assets.agent.small;

            table += `
                <tr>
                    <td class="scoreboard-player-cell">
                        <img src="${agentIcon}" alt="${p.character}" title="${p.character}" class="scoreboard-agent-icon">
                        <span class="leaderboard-player-name" data-name="${p.name}" data-tag="${p.tag}">
                            ${p.name}#${p.tag}
                        </span>
                    </td>
                    <td>${rankHtml}</td>
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

        const graphData = [...data].reverse();

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
        const points = graphData.map((d, i) => {
            const x = padding + (i / (graphData.length - 1)) * width;
            const y = padding + (height - ((d.rr - minRR) / spread) * height);
            return `${x},${y}`;
        });
        path.setAttribute('d', 'M ' + points.join(' L '));
        svg.appendChild(path);

        graphData.forEach((d, i) => {
            const x = padding + (i / (graphData.length - 1)) * width;
            const y = padding + (height - ((d.rr - minRR) / spread) * height);
            
            const prevRank = (i > 0) ? graphData[i-1].rank : null;
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
    // --- SECTION ARMURERIE
    // =================================================================

    function filterArmory() {
        if (!armoryData) return; 
        
        const searchTerm = armorySearchInput.value.toLowerCase();
        const activeCategory = armoryCategories.querySelector('.active').dataset.category;
        
        populateArmoryGrid(armoryData, searchTerm, activeCategory);
    }

    async function fetchArmory() {
        if (armoryData) {
            filterArmory(); 
            return;
        }
        
        armoryLoader.style.display = 'block';
        armoryError.style.display = 'none';
        armoryGrid.innerHTML = '';

        try {
            const response = await fetch('/api/weapons');
            if (!response.ok) {
                const err = await response.json();
                throw new Error("Impossible de charger l'armurerie.");
            }
            const data = await response.json();
            armoryData = data; 
            populateArmoryGrid(data, '', 'all'); 
        } catch (error) {
            showError(armoryError, error.message);
        } finally {
            armoryLoader.style.display = 'none';
        }
    }

    function populateArmoryGrid(data, searchTerm = '', categoryFilter = 'all') {
        armoryGrid.innerHTML = '';
        
        const categories = {};
        data.forEach(weapon => {
            const categoryKey = weapon.category || 'EEquippableCategory::Unknown';
            if (!categories[categoryKey]) categories[categoryKey] = [];
            categories[categoryKey].push(weapon);
        });

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
            
            const categoryName = categoryKey.split('::')[1] || 'Arme';

            if (categoryFilter !== 'all' && categoryName !== categoryFilter) {
                return; 
            }

            let categoryHasResults = false; 
            const categoryTitle = document.createElement('h2');
            categoryTitle.textContent = categoryName;
            categoryTitle.className = 'armory-category-title';
            
            const weaponElements = []; 

            weapons.forEach(weapon => {
                const skinGrid = document.createElement('div');
                skinGrid.className = 'armory-skin-grid';
                
                const validSkins = weapon.skins.filter(s => 
                    s.displayIcon && 
                    !s.displayName.includes('Standard') && 
                    !s.displayName.includes('Aléatoire') &&
                    (searchTerm === '' || s.displayName.toLowerCase().includes(searchTerm)) 
                );
                
                if (validSkins.length > 0) {
                    const weaponTitle = document.createElement('h3'); 
                    weaponTitle.textContent = weapon.displayName;
                    weaponTitle.className = 'armory-weapon-title';
                    
                    validSkins.forEach(skin => {
                        const card = document.createElement('div');
                        card.className = 'armory-skin-card card clickable';
                        card.innerHTML = `
                            <img src="${skin.displayIcon}" alt="${skin.displayName}">
                            <h4>${skin.displayName}</h4>
                        `;
                        card.addEventListener('click', () => showSkinDetails(weapon.uuid, skin.uuid));
                        skinGrid.appendChild(card);
                    });

                    weaponElements.push(weaponTitle);
                    weaponElements.push(skinGrid);
                    categoryHasResults = true; 
                }
            });

            if (categoryHasResults) {
                armoryGrid.appendChild(categoryTitle);
                weaponElements.forEach(el => armoryGrid.appendChild(el));
            }
        });

        if (armoryGrid.innerHTML === '') {
            armoryGrid.innerHTML = '<p class="armory-no-skins" style="text-align: center; font-size: 1.1rem; grid-column: 1 / -1;">Aucun skin trouvé pour cette recherche.</p>';
        }
    }

    function showSkinDetails(weaponUuid, skinUuid) {
        const weapon = armoryData.find(w => w.uuid === weaponUuid);
        if (!weapon) return;
        const skin = weapon.skins.find(s => s.uuid === skinUuid);
        if (!skin) return;
        
        const hasLevels = skin.levels && skin.levels.length > 1;
        const hasChromas = skin.chromas && skin.chromas.length > 1;

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

        armoryDetailContainer.addEventListener('click', (e) => {
            const container = e.target.closest('.skin-detail-container');
            if (!container) return; 

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

        armoryDetailContainer.querySelector('.armory-back-button').addEventListener('click', () => {
            armoryListContainer.style.display = 'block';
            armoryDetailContainer.style.display = 'none';
        });

        armoryListContainer.style.display = 'none';
        armoryDetailContainer.style.display = 'block';
        
        const defaultLevelUuid = (skin.levels && skin.levels.length > 0) ? skin.levels[0].uuid : null;
        const defaultChromaUuid = (skin.chromas && skin.chromas.length > 0) ? skin.chromas[0].uuid : null;
        updateSkinDisplay(skin, armoryDetailContainer.querySelector('.skin-detail-container'), defaultLevelUuid, defaultChromaUuid);
    }
    
    function updateSkinDisplay(skin, containerElement, levelUuid, chromaUuid) {
        if (!containerElement) return; 
        
        const imageWrapper = containerElement.querySelector('.skin-carousel-image-wrapper');
        const skinNameEl = containerElement.querySelector('.skin-name');

        const level = levelUuid ? skin.levels.find(l => l.uuid === levelUuid) : null;
        const chroma = chromaUuid ? skin.chromas.find(c => c.uuid === chromaUuid) : null;

        let displayName = skin.displayName;
        let displayMedia = chroma ? chroma.fullRender : skin.displayIcon;

        if (chroma && chroma.displayName && !skin.displayName.includes(chroma.displayName) && !chroma.displayName.includes('Standard')) {
             displayName = `${skin.displayName} (${chroma.displayName.split('(').pop().replace(')','')})`;
        }
        
        if (level && level.streamedVideo) {
            imageWrapper.innerHTML = `<video src="${level.streamedVideo}" autoplay muted loop playsinline></video>`;
        } else {
            imageWrapper.innerHTML = `<img src="${displayMedia || 'https://via.placeholder.com/400x200'}" alt="${displayName}">`;
        }
        
        skinNameEl.textContent = displayName;
    }
    // --- FIN SECTION ARMURERIE ---
    
    
    // --- SECTION JOUEURS SUIVIS (MODIFIÉE POUR API) ---
    // =================================================================
    
    // MODIFIÉ: S'appuie sur 'currentUser' et 'followedPlayers' globaux
    function loadFollowedPlayersPage() {
        followedList.innerHTML = '';
        followedError.style.display = 'none';
        
        if (!currentUser) {
            followedList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Veuillez vous connecter pour voir vos joueurs suivis.</p>';
            return;
        }
        
        if (followedPlayers.length === 0) {
            followedList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Vous ne suivez aucun joueur. Utilisez le bouton "Suivre" sur un profil.</p>';
            return;
        }
        
        followedPlayers.forEach(riotId => {
            const item = document.createElement('div');
            item.className = 'followed-player-item';
            item.dataset.riotid = riotId;
            item.dataset.loaded = 'false';
            
            item.innerHTML = `
                <div class="followed-player-header">
                    <h4>${riotId}</h4>
                    <span class="expand-icon">+</span>
                </div>
                <div class="followed-player-stats-content">
                    <div class="loader" style="margin: 20px auto;"></div>
                </div>
            `;
            
            item.querySelector('.followed-player-header').addEventListener('click', () => {
                toggleFollowedPlayerStats(item, riotId);
            });
            
            followedList.appendChild(item);
        });
    }
    
    async function toggleFollowedPlayerStats(itemElement, riotId) {
        const isExpanded = itemElement.classList.contains('expanded');
        const isLoaded = itemElement.dataset.loaded === 'true';
        const statsContent = itemElement.querySelector('.followed-player-stats-content');
        
        if (isExpanded) {
            itemElement.classList.remove('expanded');
        } else {
            document.querySelectorAll('.followed-player-item.expanded').forEach(el => {
                if (el !== itemElement) el.classList.remove('expanded');
            });
            
            itemElement.classList.add('expanded');
            
            if (!isLoaded) {
                try {
                    const [name, tag] = riotId.split('#');
                    const url = `/api/stats/${name}/${tag}`; 
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.message || "Joueur non trouvé");
                    }
                    const data = await response.json();
                    
                    statsContent.innerHTML = `<div class="results-wrapper">${profileTemplate}</div>`;
                    populateUI(data, statsContent.querySelector('.results-wrapper'));
                    
                    itemElement.dataset.loaded = 'true';
                    
                } catch (error) {
                    statsContent.innerHTML = `<p class="error-message" style="margin: 15px;">${error.message}</p>`;
                }
            }
        }
    }
    
    // MODIFIÉ: Fonction de suivi/non-suivi asynchrone avec API
    async function toggleFollowPlayer(riotId, buttonElement) {
        if (!currentUser) {
            alert("Veuillez vous connecter pour suivre des joueurs.");
            return;
        }

        const isFollowed = followedPlayers.map(p => p.toLowerCase()).includes(riotId.toLowerCase());
        const url = isFollowed ? '/api/unfollow' : '/api/follow';

        // Désactiver le bouton pour éviter le double-clic
        buttonElement.disabled = true;
        
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ riotId: riotId })
            });

            if (!res.ok) throw new Error('Erreur serveur');

            // Mettre à jour l'état local (le tableau)
            if (isFollowed) {
                followedPlayers = followedPlayers.filter(p => p.toLowerCase() !== riotId.toLowerCase());
                buttonElement.textContent = 'Suivre';
                buttonElement.classList.remove('followed');
            } else {
                followedPlayers.push(riotId);
                buttonElement.textContent = 'Suivi';
                buttonElement.classList.add('followed');
            }
        } catch (err) {
            console.error("Erreur lors du suivi/non-suivi", err);
            alert("Une erreur est survenue. Veuillez réessayer.");
        } finally {
            // Réactiver le bouton
            buttonElement.disabled = false;
        }
    }
    // --- FIN SECTION SUIVIS ---
    
    // =================================================================
    // --- NOUVEAU: SECTION COMMENTAIRES ---
    // =================================================================
    
    // Formate la date (ex: "il y a 5 minutes")
    function timeAgo(date) {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        let interval = seconds / 31536000;
        if (interval > 1) return "il y a " + Math.floor(interval) + " an(s)";
        interval = seconds / 2592000;
        if (interval > 1) return "il y a " + Math.floor(interval) + " mois";
        interval = seconds / 86400;
        if (interval > 1) return "il y a " + Math.floor(interval) + " jour(s)";
        interval = seconds / 3600;
        if (interval > 1) return "il y a " + Math.floor(interval) + " heure(s)";
        interval = seconds / 60;
        if (interval > 1) return "il y a " + Math.floor(interval) + " minute(s)";
        return "à l'instant";
    }

    // Crée un élément de commentaire HTML
    function createCommentElement(comment) {
        const el = document.createElement('div');
        el.className = 'comment-item';
        el.innerHTML = `
            <img src="${comment.author_avatar || 'https://via.placeholder.com/40'}" alt="Avatar" class="comment-avatar">
            <div class="comment-body">
                <div class="comment-header">
                    <span class="comment-author">${comment.author_username}</span>
                    <span class="comment-date">${timeAgo(comment.created_at)}</span>
                </div>
                <p class="comment-text">${comment.comment_text}</p>
            </div>
        `;
        return el;
    }

    // Attache l'écouteur au bouton "Publier"
    function attachCommentSubmitListener(root, riotId) {
        const btn = root.querySelector('#publishCommentBtn');
        const textarea = root.querySelector('#commentTextarea');
        const errorEl = root.querySelector('#commentError');
        const latestCommentDisplay = root.querySelector('#latestCommentDisplay');
        const commentForm = root.querySelector('#commentForm');

        btn.onclick = async () => { // onclick pour éviter les doublons d'écouteurs
            const commentText = textarea.value;
            if (commentText.trim().length === 0) {
                showError(errorEl, "Le commentaire ne peut pas être vide.");
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Publication...';
            errorEl.style.display = 'none';

            try {
                const res = await fetch('/api/comments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ riotId, commentText })
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.message || 'Erreur inconnue');
                }

                const newComment = await res.json();
                
                // Réussite !
                textarea.value = '';
                commentForm.style.display = 'none'; // Cacher le formulaire
                
                // Mettre à jour le "dernier commentaire" pour afficher celui de l'utilisateur
                latestCommentDisplay.innerHTML = '<h4 class="comment-widget-title">Votre Commentaire :</h4>';
                latestCommentDisplay.appendChild(createCommentElement(newComment));

                // Mettre à jour la liste si elle est ouverte
                const commentsList = root.querySelector('#commentsList');
                if (root.querySelector('#commentsDropdown').style.display === 'block') {
                    commentsList.prepend(createCommentElement(newComment));
                }
                
                updateCommentCount(root, riotId); // Mettre à jour le compteur

            } catch (err) {
                showError(errorEl, err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = 'Publier';
            }
        };
    }
    
    // Ouvre/Ferme le menu déroulant de tous les commentaires
    async function toggleAllComments(root, riotId) {
        const dropdown = root.querySelector('#commentsDropdown');
        const isOpen = dropdown.style.display === 'block';

        if (isOpen) {
            dropdown.style.display = 'none';
        } else {
            dropdown.style.display = 'block';
            await fetchComments(root, riotId, 1); // Charger la première page
        }
    }
    
    // Récupère une page de commentaires
    async function fetchComments(root, riotId, page) {
        const [name, tag] = riotId.split('#');
        const loader = root.querySelector('#commentsLoader');
        const list = root.querySelector('#commentsList');
        const pagination = root.querySelector('#commentsPagination');

        loader.style.display = 'block';
        list.innerHTML = '';
        pagination.innerHTML = '';

        try {
            const res = await fetch(`/api/comments/${name}/${tag}?page=${page}`);
            const data = await res.json();

            if (data.comments.length === 0) {
                list.innerHTML = '<p class="no-comment-placeholder">Aucun commentaire trouvé.</p>';
            } else {
                data.comments.forEach(comment => {
                    list.appendChild(createCommentElement(comment));
                });
            }

            // Gérer la pagination
            if (data.pagination.totalPages > 1) {
                // Précédent
                const prevBtn = document.createElement('button');
                prevBtn.className = 'pagination-btn';
                prevBtn.textContent = '«';
                if (data.pagination.page === 1) prevBtn.disabled = true;
                prevBtn.onclick = () => fetchComments(root, riotId, page - 1);
                pagination.appendChild(prevBtn);

                // Pages (simple)
                for (let i = 1; i <= data.pagination.totalPages; i++) {
                    const pageBtn = document.createElement('button');
                    pageBtn.className = 'pagination-btn';
                    pageBtn.textContent = i;
                    if (i === page) pageBtn.classList.add('active');
                    pageBtn.onclick = () => fetchComments(root, riotId, i);
                    pagination.appendChild(pageBtn);
                }

                // Suivant
                const nextBtn = document.createElement('button');
                nextBtn.className = 'pagination-btn';
                nextBtn.textContent = '»';
                if (data.pagination.page === data.pagination.totalPages) nextBtn.disabled = true;
                nextBtn.onclick = () => fetchComments(root, riotId, page + 1);
                pagination.appendChild(nextBtn);
            }

        } catch (err) {
            list.innerHTML = '<p class="error-message">Impossible de charger les commentaires.</p>';
        } finally {
            loader.style.display = 'none';
        }
    }

    // Met à jour le compteur sur le bouton "Voir tout"
    async function updateCommentCount(root, riotId) {
        const [name, tag] = riotId.split('#');
        const btn = root.querySelector('#viewAllCommentsBtn');
        const countEl = root.querySelector('#commentCount');
        
        try {
            // On fait un appel léger pour juste 1 commentaire (page 1) pour avoir le total
            const res = await fetch(`/api/comments/${name}/${tag}?page=1`);
            const data = await res.json();
            const total = data.pagination.totalComments;
            
            if (total > 0) {
                countEl.textContent = total;
                btn.style.display = 'block';
            } else {
                btn.style.display = 'none';
            }
        } catch (err) {
            console.error("Erreur de comptage des commentaires", err);
            btn.style.display = 'none';
        }
    }

    // --- FIN SECTION COMMENTAIRES ---
});
