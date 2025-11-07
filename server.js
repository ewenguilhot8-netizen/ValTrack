const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { knex, setupDatabase } = require('./database.js');

// Imports pour l'authentification
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

const HENRIK_API_KEY = "HDEV-bee70120-1e3c-4403-88a8-a2078f1f99a0"; 

if (!HENRIK_API_KEY) {
    console.error("ERREUR : HENRIK_API_KEY n'est pas définie.");
}

const app = express();
const port = 3000;

app.use(cors());
app.use(express.static('public'));
app.use(express.json()); // <-- CORRECTION: Ajouté pour lire req.body

// --- CORRECTION: henrikApi doit être défini ICI ---
const henrikApi = axios.create({
    baseURL: 'https://api.henrikdev.xyz',
    headers: { 'Authorization': HENRIK_API_KEY }
});
// --- FIN DE LA CORRECTION ---


// --- Configuration Passport & Session ---
app.use(session({
    secret: 'Brj2sBvW84Lnq5LvK72N7DAeSOYt0wCO', // Changez ceci
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => {
    done(null, user.id); 
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await knex('users').where({ id: id }).first();
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

passport.use(new DiscordStrategy({
    // --- IMPORTANT: Remplissez ces valeurs ---
    clientID: '1436123733197590624',       // ◀️◀️ REMPLISSEZ CECI
    clientSecret: 'Brj2sBvW84Lnq5LvK72N7DAeSOYt0wCO', // ◀️◀️ REMPLISSEZ CECI
    // --- FIN ---
    callbackURL: 'https://radianitedb.lol/auth/discord/callback',
    scope: ['identify', 'guilds'] 
}, async (accessToken, refreshToken, profile, done) => {
    try {
        const { id, username, avatar, discriminator } = profile;
        const discord_id = id;
        const fullUsername = `${username}#${discriminator}`;

        let user = await knex('users').where({ discord_id: discord_id }).first();
        
        if (user) {
            await knex('users').where({ discord_id: discord_id }).update({
                username: fullUsername,
                avatar: avatar ? `https://cdn.discordapp.com/avatars/${discord_id}/${avatar}.png` : null
            });
            const updatedUser = await knex('users').where({ discord_id: discord_id }).first();
            return done(null, updatedUser);
        } else {
            const [newUser] = await knex('users').insert({
                discord_id: discord_id,
                username: fullUsername,
                avatar: avatar ? `https://cdn.discordapp.com/avatars/${discord_id}/${avatar}.png` : null
            }).returning('*');
            return done(null, newUser);
        }
    } catch (err) {
        return done(err, null);
    }
}));

// --- Routes d'Authentification ---
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', 
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/'); 
    }
);

app.get('/auth/logout', (req, res, next) => {
    req.logout((err) => { 
        if (err) { return next(err); }
        res.redirect('/');
    });
});

app.get('/api/me', (req, res) => {
    if (req.isAuthenticated()) {
        res.json(req.user);
    } else {
        res.status(401).json({ message: 'Non authentifié' });
    }
});

function ensureAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    res.status(401).json({ message: 'Vous devez être connecté' });
}

// --- Routes pour les joueurs suivis (connectées à la BDD) ---
app.get('/api/followed', ensureAuthenticated, async (req, res) => {
    const followed = await knex('followed_players').where({ user_id: req.user.id });
    res.json(followed.map(p => p.riot_id));
});

app.post('/api/follow', ensureAuthenticated, async (req, res) => {
    const { riotId } = req.body; // Ceci devrait maintenant fonctionner
    if (!riotId) return res.status(400).json({ message: 'riotId manquant' });

    const existing = await knex('followed_players')
        .where({ user_id: req.user.id, riot_id: riotId })
        .first();
    
    if (!existing) {
        await knex('followed_players').insert({
            user_id: req.user.id,
            riot_id: riotId
        });
    }
    res.status(201).json({ message: 'Joueur suivi' });
});

app.post('/api/unfollow', ensureAuthenticated, async (req, res) => {
    const { riotId } = req.body;
    if (!riotId) return res.status(400).json({ message: 'riotId manquant' });

    await knex('followed_players')
        .where({ user_id: req.user.id, riot_id: riotId })
        .del();
        
    res.status(200).json({ message: 'Suivi retiré' });
});

// --- Filtre de positivité (basique) ---
const negativeWords = ['nul', 'mauvais', 'horrible', 'trash', 'int', 'bot'];
function isCommentNegative(text) {
    const lowerText = text.toLowerCase();
    return negativeWords.some(word => lowerText.includes(word));
}

// --- Routes pour les commentaires ---
app.post('/api/comments', ensureAuthenticated, async (req, res) => {
    const { riotId, commentText } = req.body;
    
    if (!riotId || !commentText) {
        return res.status(400).json({ message: 'riotId ou commentaire manquant' });
    }
    if (commentText.length > 500) {
        return res.status(400).json({ message: 'Commentaire trop long (500 max)' });
    }
    if (isCommentNegative(commentText)) {
        return res.status(400).json({ message: 'Votre commentaire semble négatif. Restons positifs !' });
    }

    try {
        // --- Vérifier si l'utilisateur a déjà commenté ---
        const existingComment = await knex('player_comments')
            .where({
                riot_id: riotId,
                author_discord_id: req.user.discord_id
            })
            .first();

        if (existingComment) {
            return res.status(403).json({ message: 'Vous avez déjà commenté ce profil.' });
        }
        // --- FIN DE LA VÉRIFICATION ---

        const [newComment] = await knex('player_comments').insert({
            riot_id: riotId,
            author_discord_id: req.user.discord_id,
            author_username: req.user.username,
            author_avatar: req.user.avatar,
            comment_text: commentText
        }).returning('*'); // Renvoie le commentaire créé

        res.status(201).json(newComment);
    } catch (err) {
        console.error("Erreur (Commentaire):", err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

app.get('/api/comments/:name/:tag', async (req, res) => {
    const { name, tag } = req.params;
    const riotId = `${name}#${tag}`;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    try {
        const comments = await knex('player_comments')
            .where({ riot_id: riotId })
            .orderBy('created_at', 'desc')
            .limit(limit)
            .offset(offset);
        
        const countResult = await knex('player_comments')
            .where({ riot_id: riotId })
            .count('id as total')
            .first();
            
        const total = countResult.total;
        const totalPages = Math.ceil(total / limit);

        res.json({
            comments,
            pagination: {
                page,
                totalPages,
                totalComments: total
            }
        });
    } catch (err) {
        console.error("Erreur (Get Commentaires):", err);
        res.status(500).json({ message: 'Erreur serveur' });
    }
});

// --- Cache de données ---
let leaderboardCache = { data: null, timestamp: 0 };
let playerStatsCache = {}; 
let valorantApiData = { maps: {}, agents: {}, ranks: {} };
let weaponCache = { data: null, timestamp: 0 }; 

// --- Récupérer les données de valorant-api.com au démarrage ---
async function fetchValorantApiData() {
    try {
        console.log("Mise à jour des données de valorant-api.com (maps, agents, ranks)...");
        const [mapsRes, agentsRes, tiersRes] = await Promise.all([
            axios.get('https://valorant-api.com/v1/maps'),
            axios.get('https://valorant-api.com/v1/agents?isPlayableCharacter=true'),
            axios.get('https://valorant-api.com/v1/competitivetiers')
        ]);

        mapsRes.data.data.forEach(map => {
            if (map.displayName && map.splash) {
                valorantApiData.maps[map.displayName] = {
                    splash: map.splash,
                    list: map.listViewIcon
                };
            }
        });
        agentsRes.data.data.forEach(agent => {
            if (agent.displayName && agent.displayIconSmall && agent.backgroundGradientColors && agent.fullPortrait) {
                valorantApiData.agents[agent.displayName] = {
                    icon: agent.displayIconSmall,
                    splash: agent.fullPortrait,
                    background: agent.backgroundGradientColors
                };
            }
        });
        
        tiersRes.data.data.forEach(episode => {
            if (episode.tiers) {
                episode.tiers.forEach(tier => {
                    if (tier.tier !== 0 && tier.smallIcon) {
                        valorantApiData.ranks[tier.tier] = tier.smallIcon;
                    }
                });
            }
        });
        valorantApiData.ranks[0] = 'https://media.valorant-api.com/competitivetiers/564d8e28-c226-3180-6285-e48a390db8b1/0/smallicon.png';
        
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

    // --- Logique pour récupérer les commentaires ---
    const getComments = async () => {
        const latestCommentRes = knex('player_comments')
            .where({ riot_id: cacheKey })
            .orderBy('created_at', 'desc')
            .first();

        let userCommentRes = null;
        if (req.isAuthenticated()) {
            userCommentRes = knex('player_comments')
                .where({ riot_id: cacheKey, author_discord_id: req.user.discord_id })
                .first();
        }
        
        const [latestComment, userComment] = await Promise.all([
            latestCommentRes,
            userCommentRes
        ]);

        return {
            latestComment: (latestComment && !(latestComment instanceof Error)) ? latestComment : null,
            userComment: (userComment && !(userComment instanceof Error)) ? userComment : null
        };
    };
    // --- FIN ---

    if (!forceUpdate && playerStatsCache[cacheKey] && (now - playerStatsCache[cacheKey].timestamp < 600000)) {
        let cachedData = { ...playerStatsCache[cacheKey].data };
        // Attacher les commentaires aux données en cache
        const { latestComment, userComment } = await getComments();
        cachedData.latestComment = latestComment;
        cachedData.userComment = userComment;
        
        return res.json(cachedData);
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

        // --- Appel des commentaires inclus ---
        const [mmrRes, mmrHistoryRes, comments, ...matchResults] = await Promise.all([
            henrikApi.get(`/valorant/v2/mmr/${region}/${name}/${tag}`),
            henrikApi.get(`/valorant/v1/mmr-history/${region}/${name}/${tag}`), 
            getComments(), // NOUVEAU
            ...matchPromises
        ].map(p => p.catch(e => e))); 
        // --- FIN ---

        const rankData = (mmrRes && !(mmrRes instanceof Error)) ? mmrRes.data.data.current_data : {};
        const { latestComment, userComment } = (comments && !(comments instanceof Error)) ? comments : { latestComment: null, userComment: null };
        
        let rrHistory = [];
        if (mmrHistoryRes && !(mmrHistoryRes instanceof Error) && mmrHistoryRes.data.data) {
            rrHistory = mmrHistoryRes.data.data.map(match => ({
                rr: match.ranking_in_tier,
                rank: match.currenttierpatched,
                rank_icon: match.images.large, 
                change: match.mmr_change_to_last_game, 
                date: match.date 
            })); 
        }

        let allMatches = [];
        for (const res of matchResults) {
            if (res && !(res instanceof Error) && res.data.data) {
                allMatches.push(...res.data.data);
            }
        }

        // --- Dédupliquer les matchs ---
        const uniqueMatchesMap = new Map();
        allMatches.forEach(match => {
            if (match && match.metadata && match.metadata.matchid) {
                uniqueMatchesMap.set(match.metadata.matchid, match);
            }
        });
        const uniqueMatches = Array.from(uniqueMatchesMap.values());

        if (!uniqueMatches || uniqueMatches.length === 0) { 
            return res.status(404).json({ message: "Aucun match compétitif récent trouvé pour ce joueur." });
        }

        // ... (Boucle 'for (const match of uniqueMatches)') ...
        let kdHistory = [], winHistory = [], acsHistory = [], adrHistory = [], hsHistory = [];
        let totalKills = 0, totalDeaths = 0, totalHeadshots = 0, totalShotsFired = 0;
        let totalDamage = 0, totalRounds = 0, totalPlaytime = 0;
        let totalWins = 0, totalAcs = 0, validAcsGames = 0;
        let mapStats = {}, agentStats = {};
        let processedMatchHistory = [];
        for (const match of uniqueMatches) {
            if (!match || !match.players || !match.players.all_players || !match.metadata || !match.teams) {
                console.warn(`Match (ID: ${match?.metadata?.matchid || 'inconnu'}) ignoré : données incomplètes (players, metadata ou teams).`);
                continue; 
            }
            const player = match.players.all_players.find(p => p.puuid === puuid);
            if (!player || !player.stats) {
                console.warn(`Joueur ${name}#${tag} non trouvé dans le match ${match.metadata.matchid} (ou stats manquantes).`);
                continue; 
            }
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
        // ... (Fin de la boucle) ...


        // --- Calculs finaux ---
        const gameCount = uniqueMatches.length;
        const kd = (totalDeaths === 0) ? totalKills : (totalKills / totalDeaths);
        const hsPercent = (totalShotsFired === 0) ? 0 : ((totalHeadshots / totalShotsFired) * 100);
        const winRate = (gameCount === 0) ? 0 : ((totalWins / gameCount) * 100);
        const acs = (validAcsGames === 0) ? 0 : (totalAcs / validAcsGames); 
        const adr = (totalRounds === 0) ? 0 : (totalDamage / totalRounds);
        
        // --- Formule Stats Score (inchangée) ---
        const wrScore = Math.min(winRate * 3, 300); 
        const kdScore = Math.min((kd / 2.0) * 250, 250);
        const acsScore = Math.min((acs / 400) * 300, 300);
        const hsScore = Math.min((hsPercent / 40) * 100, 100);
        const adrScore = Math.min((adr / 250) * 50, 50);
        let rawStatsScore = wrScore + kdScore + acsScore + hsScore + adrScore;
        let statsScore = Math.round(rawStatsScore); 
        
        const lastRRChange = (rrHistory.length > 0) ? rrHistory[0].change : null;
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
                rankImageUrl: rankData.images?.large || null,
                lastRRChange: lastRRChange
            },
            overviewStats: { ...finalStats },
            historyData: historyData,
            rrHistory: rrHistory,
            analysis: {
                maps: getBestWorst(mapStats),
                agents: getBestWorst(agentStats)
            },
            matchHistory: processedMatchHistory,
            latestComment: latestComment, // NOUVEAU
            userComment: userComment      // NOUVEAU
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
        
        const data = response.data.data;
        
        const addRankIcon = (player) => {
            if (player && valorantApiData.ranks) {
                player.rank_icon_url = valorantApiData.ranks[player.currenttier] || valorantApiData.ranks[0];
            }
            return player;
        };

        if (data && data.players) {
            if (data.players.red) {
                data.players.red = data.players.red.map(addRankIcon);
            }
            if (data.players.blue) {
                data.players.blue = data.players.blue.map(addRankIcon);
            }
        }

        res.json(data);
    } catch (error) {
        console.error("Erreur (Match):", error.message);
        res.status(500).json({ message: "Impossible de charger les détails du match." });
    }
});


// --- Endpoint N°4 : ARMURERIE ---
app.get('/api/weapons', async (req, res) => {
    const now = Date.now();
    if (weaponCache.data && (now - weaponCache.timestamp < 86400000)) { 
        return res.json(weaponCache.data);
    }
    try {
        // CORRECTION: Utiliser axios, pas henrikApi pour une URL externe
        const response = await axios.get('https://valorant-api.com/v1/weapons?language=fr-FR');
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
            })).filter(skin => skin.displayIcon)
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


// --- Démarrage ---
app.listen(port, () => {
    console.log(`Serveur démarré ! Ouvrez http://localhost:${port} dans votre navigateur.`);
    setupDatabase(); // Initialise la BDD
    fetchValorantApiData(); 

});

