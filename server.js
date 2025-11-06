const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const HENRIK_API_KEY = "HDEV-bee70120-1e3c-4403-88a8-a2078f1f99a0";

if (!HENRIK_API_KEY) {
    console.error("ERREUR : HENRIK_API_KEY n'est pas définie.");
}

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

const henrikApi = axios.create({
    baseURL: 'https://api.henrikdev.xyz',
    headers: { 'Authorization': HENRIK_API_KEY }
});

// --- Cache de données ---
let leaderboardCache = { data: null, timestamp: 0 };
let playerStatsCache = {}; 
let valorantApiData = { maps: {}, agents: {} }; 
// --- NOUVEAU ---
let weaponCache = { data: null, timestamp: 0 }; 
// --- FIN NOUVEAU ---

// --- Récupérer les données de valorant-api.com au démarrage ---
async function fetchValorantApiData() {
    try {
        console.log("Mise à jour des données de valorant-api.com (maps & agents)...");
        const [mapsRes, agentsRes] = await Promise.all([
            axios.get('https://valorant-api.com/v1/maps'),
            axios.get('https://valorant-api.com/v1/agents?isPlayableCharacter=true')
        ]);

        mapsRes.data.data.forEach(map => {
            if (map.displayName && map.splash) {
                valorantApiData.maps[map.displayName] = {
                    splash: map.splash, // Splash art pour le fond
                    list: map.listViewIcon // Image pour l'historique
                };
            }
        });
        agentsRes.data.data.forEach(agent => {
            if (agent.displayName && agent.displayIconSmall && agent.backgroundGradientColors && agent.fullPortrait) {
                valorantApiData.agents[agent.displayName] = {
                    icon: agent.displayIconSmall,
                    splash: agent.fullPortrait, // Splash art pour le fond
                    background: agent.backgroundGradientColors
                };
            }
        });
        
        console.log("Données de valorant-api.com chargées avec succès.");
    } catch (error) {
        console.error("Erreur lors de la récupération des données de valorant-api.com:", error.message);
    }
}

// --- Fonction d'aide pour trouver le meilleur/pire (MAPS/AGENTS) ---
const getBestWorst = (statsObject) => {
    const statsArray = Object.values(statsObject);
    if (statsArray.length === 0) return { best: null, worst: null };
    statsArray.forEach(item => {
        item.winRate = (item.wins / item.count) * 100;
        item.kd = (item.deaths === 0) ? item.kills : (item.kills / item.deaths).toFixed(2);
    });
    statsArray.sort((a, b) => b.winRate - a.winRate || b.count - a.count);
    const best = statsArray.length > 0 ? { ...statsArray[0] } : null;
    statsArray.sort((a, b) => a.winRate - b.winRate || b.count - a.count);
    const worst = statsArray.length > 0 ? { ...statsArray[0] } : null;
    return { best, worst };
};

// --- Endpoint N°1 : STATS DU JOUEUR (avec cache) ---
app.get('/api/stats/:name/:tag', async (req, res) => {
    const { name, tag } = req.params;
    const cacheKey = `${name}#${tag}`.toLowerCase();
    const forceUpdate = req.query.force === 'true';
    const now = Date.now();

    if (!forceUpdate && playerStatsCache[cacheKey] && (now - playerStatsCache[cacheKey].timestamp < 600000)) {
        return res.json(playerStatsCache[cacheKey].data);
    }

    try {
        // --- ÉTAPE 1: Compte ---
        const accountRes = await henrikApi.get(`/valorant/v1/account/${name}/${tag}`);
        if (!accountRes.data || !accountRes.data.data) {
            return res.status(404).json({ message: "Compte non trouvé." });
        }
        const { puuid, region, account_level, card, name: gameName, tag: gameTag } = accountRes.data.data;
        if (!puuid || !region) {
            return res.status(404).json({ message: "PUUID ou Région non trouvés." });
        }

        // --- ÉTAPE 2: Appels en parallèle ---
        const matchPromises = [];
        for (let page = 1; page <= 5; page++) {
            matchPromises.push(
                henrikApi.get(`/valorant/v3/matches/${region}/${name}/${tag}?filter=competitive&season=current&size=10&page=${page}`)
            );
        }

        const [mmrRes, mmrHistoryRes, ...matchResults] = await Promise.all([
            henrikApi.get(`/valorant/v2/mmr/${region}/${name}/${tag}`),
            henrikApi.get(`/valorant/v1/mmr-history/${region}/${name}/${tag}`), 
            ...matchPromises
        ].map(p => p.catch(e => e))); 

        const rankData = (mmrRes && !(mmrRes instanceof Error)) ? mmrRes.data.data.current_data : {};
        
        let rrHistory = [];
        if (mmrHistoryRes && !(mmrHistoryRes instanceof Error) && mmrHistoryRes.data.data) {
            rrHistory = mmrHistoryRes.data.data.map(match => ({
                rr: match.ranking_in_tier,
                rank: match.currenttierpatched,
                rank_icon: match.images.large, 
                change: match.mmr_change_to_last_game, 
                date: match.date 
            })).reverse();
        }

        let allMatches = [];
        for (const res of matchResults) {
            if (res && !(res instanceof Error) && res.data.data) {
                allMatches.push(...res.data.data);
            }
        }

        if (!allMatches || allMatches.length === 0) {
            return res.status(404).json({ message: "Aucun match compétitif récent trouvé pour ce joueur." });
        }

        let kdHistory = [], winHistory = [], acsHistory = [], adrHistory = [], hsHistory = [];
        let totalKills = 0, totalDeaths = 0, totalHeadshots = 0, totalShotsFired = 0;
        let totalDamage = 0, totalRounds = 0, totalPlaytime = 0, totalWins = 0, totalAcs = 0, validAcsGames = 0;
        let mapStats = {}, agentStats = {};
        let processedMatchHistory = [];

        for (const match of allMatches) {

            // --- DÉBUT DE LA CORRECTION ---
            // On vérifie que les objets principaux du match existent avant de continuer.
            // Si l'une de ces propriétés est null, on ignore ce match.
            if (!match || !match.players || !match.players.all_players || !match.metadata || !match.teams) {
                console.warn(`Match (ID: ${match?.metadata?.matchid || 'inconnu'}) ignoré : données incomplètes (players, metadata ou teams).`);
                continue; // Passe au match suivant
            }
            // --- FIN DE LA CORRECTION ---

            const player = match.players.all_players.find(p => p.puuid === puuid);
            
            // --- DEUXIÈME SÉCURITÉ ---
            // On vérifie aussi que le joueur a bien été trouvé ET qu'il a des stats
            if (!player || !player.stats) {
                console.warn(`Joueur ${name}#${tag} non trouvé dans le match ${match.metadata.matchid} (ou stats manquantes).`);
                continue; // Passe au match suivant
            }
            // --- FIN DE LA DEUXIÈME SÉCURITÉ ---

            const playerStats = player.stats;
            const mapName = match.metadata.map;
            const agentName = player.character;
            const roundsPlayed = player.stats.rounds_played || match.metadata.rounds_played;

            if (roundsPlayed === 0) continue; 

            const matchKills = playerStats.kills;
            const matchDeaths = playerStats.deaths;
            const matchDeathsForKD = matchDeaths > 0 ? matchDeaths : 1;
            const matchHS = playerStats.headshots;
            const matchShots = playerStats.headshots + playerStats.bodyshots + playerStats.legshots;
            const matchAcs = (playerStats.score / roundsPlayed);
            const matchAdr = (player.damage_made / roundsPlayed);
            
            if (matchAcs > 500) continue; 

            const playerTeam = player.team ? player.team.toLowerCase() : null;
            let hasWon = false;
            if (playerTeam && match.teams && match.teams[playerTeam]) {
                hasWon = match.teams[playerTeam].has_won;
            }
            const matchResult = hasWon ? "Victoire" : "Défaite";

            if (kdHistory.length < 10) {
                kdHistory.push(matchKills / matchDeathsForKD);
                winHistory.push(hasWon ? 1 : 0);
                acsHistory.push(matchAcs);
                adrHistory.push(matchAdr);
                hsHistory.push(matchShots > 0 ? (matchHS / matchShots) * 100 : 0);
            }

            totalKills += matchKills;
            totalDeaths += matchDeaths;
            totalRounds += roundsPlayed;
            totalDamage += player.damage_made;
            totalPlaytime += match.metadata.game_length;
            totalAcs += matchAcs; 
            validAcsGames++; 
            totalHeadshots += matchHS;
            totalShotsFired += matchShots;
            if (hasWon) totalWins++;

            const mapImage = valorantApiData.maps[mapName]?.list || match.metadata.map_data?.asset || null;
            const mapSplash = valorantApiData.maps[mapName]?.splash || mapImage; 
            if (!mapStats[mapName]) mapStats[mapName] = { name: mapName, wins: 0, losses: 0, count: 0, kills: 0, deaths: 0, image: mapImage, splash: mapSplash };
            mapStats[mapName].count++;
            mapStats[mapName].kills += matchKills;
            mapStats[mapName].deaths += matchDeaths;
            if (hasWon) mapStats[mapName].wins++; else mapStats[mapName].losses++;

            const agentImage = valorantApiData.agents[agentName]?.icon || player.assets?.agent?.small || null;
            const agentSplash = valorantApiData.agents[agentName]?.splash || null;
            if (!agentStats[agentName]) agentStats[agentName] = { name: agentName, wins: 0, losses: 0, count: 0, kills: 0, deaths: 0, image: agentImage, splash: agentSplash, background: valorantApiData.agents[agentName]?.background };
            agentStats[agentName].count++;
            agentStats[agentName].kills += matchKills;
            agentStats[agentName].deaths += matchDeaths;
            if (hasWon) agentStats[agentName].wins++; else agentStats[agentName].losses++;
            
            processedMatchHistory.push({
                matchId: match.metadata.matchid,
                map: mapName,
                mapImage: mapImage,
                agentImage: agentImage,
                result: matchResult,
                kda: `${matchKills}/${matchDeaths}/${playerStats.assists}`,
                kd: (matchKills / matchDeathsForKD).toFixed(2),
                acs: matchAcs.toFixed(0),
                hsPercent: (matchShots > 0 ? (matchHS / matchShots) * 100 : 0).toFixed(1)
            });
        }

        // --- Calculs finaux ---
        const gameCount = allMatches.length;
        const kd = (totalDeaths === 0) ? totalKills : (totalKills / totalDeaths);
        const hsPercent = (totalShotsFired === 0) ? 0 : ((totalHeadshots / totalShotsFired) * 100);
        const winRate = (gameCount === 0) ? 0 : ((totalWins / gameCount) * 100);
        const acs = (validAcsGames === 0) ? 0 : (totalAcs / validAcsGames); 
        const adr = (totalRounds === 0) ? 0 : (totalDamage / totalRounds);
        
        let rawStatsScore = (kd * 250) + (acs * 2.0) + (adr * 1.0) + (winRate * 1.5) + (hsPercent * 1.0);
        let statsScore = Math.min(Math.round(rawStatsScore), 1000); 
        
        const mostPlayedAgent = Object.values(agentStats).sort((a, b) => b.count - a.count)[0];
        const mostPlayedMap = Object.values(mapStats).sort((a, b) => b.count - a.count)[0];

        const finalStats = {
            kd: kd.toFixed(2),
            hsPercent: hsPercent.toFixed(1),
            winRate: winRate.toFixed(0),
            adr: adr.toFixed(1),
            acs: acs.toFixed(1),
            playtimeMinutes: Math.floor(totalPlaytime / 60000),
            statsScore: statsScore
        };
        
        const historyData = {
            kd: kdHistory.reverse(),
            winRate: winHistory.reverse(),
            acs: acsHistory.reverse(),
            adr: adrHistory.reverse(),
            hs: hsHistory.reverse()
        };

        // --- Réponse ---
        const responseData = {
            playerInfo: {
                name: `${gameName}#${gameTag}`,
                level: account_level,
                avatarUrl: card?.small || null,
                gameCount: gameCount,
                playtimeMinutes: finalStats.playtimeMinutes,
                bestAgentSplash: mostPlayedAgent?.splash || null,
                bestMapSplash: mostPlayedMap?.splash || null
            },
            rankInfo: {
                rankName: rankData.currenttierpatched,
                rr: rankData.ranking_in_tier,
                rankImageUrl: rankData.images?.large || null
            },
            overviewStats: { ...finalStats },
            historyData: historyData,
            rrHistory: rrHistory,
            analysis: {
                maps: getBestWorst(mapStats),
                agents: getBestWorst(agentStats)
            },
            matchHistory: processedMatchHistory 
        };
        
        playerStatsCache[cacheKey] = {
            data: responseData,
            timestamp: now
        };

        res.json(responseData);

    } catch (error) {
        console.error("Erreur (Stats):", error.message, error.stack);
        res.status(500).json({ message: "Erreur serveur interne." });
    }
});

// --- Endpoint N°2 : LEADERBOARD ---
app.get('/api/leaderboard/eu', async (req, res) => {
    const now = Date.now();
    if (leaderboardCache.data && (now - leaderboardCache.timestamp < 3600000)) {
        return res.json(leaderboardCache.data);
    }
    try {
        const response = await henrikApi.get('/valorant/v1/leaderboard/eu');
        leaderboardCache = {
            data: response.data.data,
            timestamp: now
        };
        res.json(response.data.data);
    } catch (error) {
        console.error("Erreur (Leaderboard):", error.message);
        res.status(500).json({ message: "Impossible de charger le leaderboard." });
    }
});

// --- Endpoint N°3 : DÉTAILS DU MATCH ---
app.get('/api/match/:matchId', async (req, res) => {
    try {
        const { matchId } = req.params;
        const response = await henrikApi.get(`/valorant/v2/match/${matchId}`);
        res.json(response.data.data);
    } catch (error)
 {
        console.error("Erreur (Match):", error.message);
        res.status(500).json({ message: "Impossible de charger les détails du match." });
    }
});

// --- NOUVEAU Endpoint N°4 : ARMURERIE ---
app.get('/api/weapons', async (req, res) => {
    const now = Date.now();
    // Cache d'une journée (86400000 ms) car les armes changent peu
    if (weaponCache.data && (now - weaponCache.timestamp < 86400000)) { 
        return res.json(weaponCache.data);
    }
    try {
        const response = await axios.get('https://valorant-api.com/v1/weapons?language=fr-FR');
        // On ne garde que les données utiles (les skins ont bcp de data)
        const filteredData = response.data.data.map(weapon => ({
            uuid: weapon.uuid,
            displayName: weapon.displayName,
            displayIcon: weapon.displayIcon,
            category: weapon.category,
            skins: weapon.skins.map(skin => ({
                uuid: skin.uuid,
                displayName: skin.displayName,
                displayIcon: skin.displayIcon,
                wallpaper: skin.wallpaper,
                chromas: skin.chromas.map(chroma => ({
                    uuid: chroma.uuid,
                    displayName: chroma.displayName,
                    displayIcon: chroma.displayIcon,
                    fullRender: chroma.fullRender,
                    swatch: chroma.swatch
                })),
                levels: skin.levels.map(level => ({
                    uuid: level.uuid,
                    displayName: level.displayName,
                    displayIcon: level.displayIcon,
                    streamedVideo: level.streamedVideo
                }))
            })).filter(skin => skin.displayIcon) // Filtrer les skins sans image (ex: Standard)
        }));
        
        weaponCache = {
            data: filteredData,
            timestamp: now
        };
        res.json(filteredData);
    } catch (error) {
        console.error("Erreur (Armurerie):", error.message);
        res.status(500).json({ message: "Impossible de charger l'armurerie." });
    }
});
// --- FIN NOUVEAU ---

// --- Démarrage ---
app.listen(port, () => {
    console.log(`Serveur démarré ! Ouvrez http://localhost:${port} dans votre navigateur.`);
    fetchValorantApiData(); 
});