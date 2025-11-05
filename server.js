const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

// ------------------------------------------------------------------
// ⬇️ METTEZ VOTRE CLÉ API RIOT GAMES ICI ⬇️
// ------------------------------------------------------------------
// (Nous allons utiliser les variables d'environnement pour l'hébergement)
const RIOT_API_KEY = process.env.RIOT_API_KEY; 
// ------------------------------------------------------------------

if (!RIOT_API_KEY) {
    console.error("ERREUR : RIOT_API_KEY n'est pas définie. Vérifiez vos variables d'environnement.");
}

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));

// Axios 'instance' pour réutiliser les headers de l'API Riot
const riotApi = axios.create({
    headers: {
        "X-Riot-Token": RIOT_API_KEY
    }
});

// ----- API Backend -----
app.get('/api/stats/:name/:tag', async (req, res) => {
    try {
        const { name, tag } = req.params;

        // --- ÉTAPE 1: Obtenir le PUUID (ID unique) avec le Riot ID ---
        // Note: 'europe' est pour le compte, 'eu' est pour les matchs
        const accountResponse = await riotApi.get(`https://europe.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${name}/${tag}`);
        const puuid = accountResponse.data.puuid;

        if (!puuid) {
            return res.status(404).json({ message: "Compte Riot non trouvé." });
        }

        // --- ÉTAPE 2: Obtenir la liste des 5 derniers matchs ---
        const matchListResponse = await riotApi.get(`https://eu.api.riotgames.com/val/match/v1/matchlists/by-puuid/${puuid}?count=5`);
        const matchIds = matchListResponse.data.history.map(match => match.matchId);

        if (matchIds.length === 0) {
            return res.status(200).json({ 
                playerName: `${name}#${tag}`, 
                message: "Ce joueur n'a pas de matchs récents."
            });
        }

        // --- ÉTAPE 3 & 4: Boucler sur chaque match pour les détails et calculer les stats ---
        let totalKills = 0;
        let totalDeaths = 0;
        let totalHeadshots = 0;
        let totalShotsFired = 0; // Pour le %HS
        let totalWins = 0;
        let processedMatches = [];

        for (const matchId of matchIds) {
            const matchResponse = await riotApi.get(`https://eu.api.riotgames.com/val/match/v1/matches/${matchId}`);
            const matchData = matchResponse.data;
            
            // Trouver notre joueur dans le match
            const playerStats = matchData.players.find(p => p.puuid === puuid);
            
            if (playerStats) {
                // Agrégation des stats
                totalKills += playerStats.stats.kills;
                totalDeaths += playerStats.stats.deaths;
                
                // Calcul HS
                totalHeadshots += playerStats.stats.headshots;
                totalShotsFired += (playerStats.stats.headshots + playerStats.stats.bodyshots + playerStats.stats.legshots);
                
                // Est-ce une victoire ?
                const playerTeam = playerStats.teamId;
                const winningTeam = matchData.teams.find(t => t.won === true)?.teamId;
                if (playerTeam === winningTeam) {
                    totalWins++;
                }

                // Formatter les données du match pour le frontend
                processedMatches.push({
                    map: matchData.matchInfo.mapName,
                    result: (playerTeam === winningTeam) ? "Victoire" : "Défaite",
                    kda: `${playerStats.stats.kills}/${playerStats.stats.deaths}/${playerStats.stats.assists}`
                });
            }
        }

        // --- ÉTAPE 5: Calculer les stats finales ---
        const kdRatio = (totalDeaths === 0) ? totalKills : (totalKills / totalDeaths).toFixed(2);
        const hsPercent = (totalShotsFired === 0) ? 0 : ((totalHeadshots / totalShotsFired) * 100).toFixed(1);
        const winRate = ((totalWins / matchIds.length) * 100).toFixed(0);

        // Renvoie les données propres au Frontend
        res.json({
            // Le frontend s'attend à ces noms de variables
            data: {
                platformInfo: {
                    platformUserHandle: accountResponse.data.gameName ? `${accountResponse.data.gameName}#${accountResponse.data.tagLine}` : `${name}#${tag}`,
                    avatarUrl: "" // L'API Riot ne fournit pas l'avatar, on laisse vide
                },
                segments: [
                    {
                        type: 'overview',
                        stats: {
                            level: { value: 'N/A' }, // L'API Riot ne fournit pas le niveau
                            kd: { value: kdRatio },
                            headshotsPercentage: { value: hsPercent },
                            matchesWinPct: { value: winRate }
                        }
                    }
                ],
                matches: processedMatches.map(m => ({ // Format simplifié pour le script.js
                    metadata: { mapName: m.map },
                    segments: [{
                        stats: {
                            matchesWon: { value: m.result === "Victoire" ? 1 : 0 },
                            kills: { value: m.kda.split('/')[0] },
                            deaths: { value: m.kda.split('/')[1] },
                            assists: { value: m.kda.split('/')[2] },
                        }
                    }]
                }))
            }
        });

    } catch (error) {
        console.error("Erreur lors de l'appel à l'API Riot:", error.message);
        res.status(error.response?.status || 500).json({ 
            message: "Impossible de récupérer les stats du joueur. (Vérifiez la clé API, le Riot ID ou la région)" 
        });
    }
});

// ----- Démarrage du serveur -----
app.listen(port, () => {
    console.log(`Serveur démarré ! Ouvrez http://localhost:${port} dans votre navigateur.`);
});