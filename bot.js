const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const cron = require('node-cron');
const { knex } = require('./database.js'); 
const axios = require('axios'); 

// --- REMPLISSEZ CES 4 VALEURS ---
const BOT_TOKEN = 'VOTRE_TOKEN_DE_BOT_DISCORD';       // ◀️◀️ REMPLISSEZ CECI
const CLIENT_ID = 'VOTRE_CLIENT_ID_DISCORD';       // ◀️◀️ REMPLISSEZ CECI
const HENRIK_API_KEY = "HDEV-bee70120-1e3c-4403-88a8-a2078f1f99a0"; // ◀️◀️ REMPLISSEZ CECI
const YOUR_WEBSITE_URL = "http://localhost:3000"; // URL de votre serveur web
// --- FIN ---

const henrikApi = axios.create({
    baseURL: 'https://api.henrikdev.xyz',
    headers: { 'Authorization': HENRIK_API_KEY }
});

// API pour votre propre serveur
const localApi = axios.create({
    baseURL: YOUR_WEBSITE_URL
});


const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// Définir la commande Slash
const commands = [
    {
        name: 'setchannel',
        description: 'Définit ce salon pour recevoir vos notifications de fin de partie.',
    },
];

// Enregistrer la commande Slash
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} est connecté !`);
    try {
        console.log('Enregistrement des commandes Slash...');
        await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        console.log('Commandes Slash enregistrées.');
    } catch (error) {
        console.error(error);
    }
});

// Gérer les interactions
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'setchannel') {
        const discord_id = interaction.user.id;
        const channel_id = interaction.channel.id;

        try {
            const user = await knex('users').where({ discord_id: discord_id }).first();
            if (!user) {
                await interaction.reply({ 
                    content: `Vous devez d'abord vous connecter sur le site RadianiteDB (${YOUR_WEBSITE_URL}) pour lier votre compte Discord !`,
                    ephemeral: true 
                });
                return;
            }

            await knex('users').where({ discord_id: discord_id }).update({
                discord_channel_id: channel_id
            });
            
            await interaction.reply({ 
                content: `Parfait ! Les notifications pour vos joueurs suivis seront envoyées dans ce salon (#${interaction.channel.name}).`,
                ephemeral: true 
            });
        } catch (err) {
            console.error(err);
            await interaction.reply({ content: 'Une erreur est survenue.', ephemeral: true });
        }
    }
});

// --- LE MOTEUR DU BOT ---
// Fonction pour dormir (évite le spam d'API)
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Fonction de vérification
async function checkFollowedPlayers() {
    console.log('Vérification des nouveaux matchs...');
    
    // 1. Obtenir tous les joueurs suivis uniques et leur salon
    const subscriptions = await knex('followed_players')
        .join('users', 'users.id', 'followed_players.user_id')
        .whereNotNull('users.discord_channel_id')
        .select('followed_players.riot_id', 'users.discord_channel_id', 'users.discord_id');

    if (subscriptions.length === 0) {
        console.log('Aucun joueur suivi avec un salon configuré.');
        return;
    }

    // 2. Regrouper par joueur (pour ne vérifier chaque joueur qu'une fois)
    const playersToWatch = new Map();
    for (const sub of subscriptions) {
        if (!playersToWatch.has(sub.riot_id)) {
            playersToWatch.set(sub.riot_id, []);
        }
        playersToWatch.get(sub.riot_id).push({ 
            channel: sub.discord_channel_id,
            user: sub.discord_id 
        });
    }

    // 3. Boucler sur chaque joueur unique
    for (const [riotId, targets] of playersToWatch.entries()) {
        try {
            const [name, tag] = riotId.split('#');
            
            // 4. Obtenir les 5 derniers matchs
            const matchRes = await henrikApi.get(`/valorant/v3/matches/eu/${name}/${tag}?filter=competitive&size=5`);
            if (matchRes.data.data.length === 0) continue;
            
            const latestMatch = matchRes.data.data[0];
            const latestMatchId = latestMatch.metadata.matchid;

            // 5. Vérifier si ce match est nouveau
            const memory = await knex('bot_memory').where({ riot_id: riotId }).first();
            const lastAnnouncedId = memory ? memory.last_match_id : null;

            if (latestMatchId !== lastAnnouncedId) {
                console.log(`Nouveau match trouvé pour ${riotId}: ${latestMatchId}`);
                
                // 6. C'est un nouveau match ! Récupérer les stats complètes
                const playerStats = latestMatch.players.all_players.find(p => p.name.toLowerCase() === name.toLowerCase());
                const team = latestMatch.teams[playerStats.team.toLowerCase()];
                
                const kda = `${playerStats.stats.kills}/${playerStats.stats.deaths}/${playerStats.stats.assists}`;
                const kd = (playerStats.stats.deaths === 0) ? playerStats.stats.kills : (playerStats.stats.kills / playerStats.stats.deaths).toFixed(2);
                const acs = Math.round(playerStats.stats.score / latestMatch.metadata.rounds_played);
                
                // 7. Tenter de récupérer le changement de RR (le point faible)
                let rrChange = "N/A";
                try {
                    const statsRes = await localApi.get(`/api/stats/${name}/${tag}`);
                    if (statsRes.data.rankInfo.lastRRChange) {
                        rrChange = statsRes.data.rankInfo.lastRRChange > 0 ? `+${statsRes.data.rankInfo.lastRRChange}` : `${statsRes.data.rankInfo.lastRRChange}`;
                    }
                } catch (e) { console.warn(`Impossible de fetch le RR pour ${name}#${tag}: ${e.message}`); }

                // 8. Construire l'Embed
                const embed = new EmbedBuilder()
                    .setTitle(`Nouveau match pour ${riotId}`)
                    .setColor(team.has_won ? 0x00FF00 : 0xFF0000)
                    .setThumbnail(playerStats.assets.agent.small)
                    .addFields(
                        { name: 'Résultat', value: `${team.has_won ? 'Victoire' : 'Défaite'} (${team.rounds_won} - ${team.rounds_lost})`, inline: true },
                        { name: 'Map', value: latestMatch.metadata.map, inline: true },
                        { name: 'K/D/A', value: kda, inline: true },
                        { name: 'K/D Ratio', value: kd, inline: true },
                        { name: 'ACS', value: acs.toString(), inline: true },
                        { name: 'Changement RR', value: rrChange, inline: true }
                    )
                    .setTimestamp(new Date(latestMatch.metadata.game_start * 1000));

                // 9. Envoyer à tous les abonnés
                for (const target of targets) {
                    try {
                        const channel = await client.channels.fetch(target.channel);
                        if (channel) {
                            channel.send({ content: `<@${target.user}>, un joueur que vous suivez a terminé sa partie !`, embeds: [embed] });
                        }
                    } catch (err) {
                        console.error(`Impossible d'envoyer au salon ${target.channel}`, err.message);
                        // L'utilisateur a peut-être quitté le serveur ou supprimé le salon
                    }
                }

                // 10. Mettre à jour la mémoire
                if (memory) {
                    await knex('bot_memory').where({ riot_id: riotId }).update({ last_match_id: latestMatchId });
                } else {
                    await knex('bot_memory').insert({ riot_id: riotId, last_match_id: latestMatchId });
                }
            }
        } catch (err) {
            if (err.response && err.response.status === 429) {
                console.warn('Rate limit atteinte ! Pause...');
                await sleep(60000); // Pause d'une minute
            } else {
                console.error(`Erreur lors de la vérification de ${riotId}:`, err.message);
            }
        }
        
        // 11. NE PAS SPAMMER L'API !
        await sleep(5000); // 5 secondes d'attente entre chaque joueur
    }
    console.log('Vérification terminée.');
}

// Lancer la tâche toutes les 5 minutes
cron.schedule('*/5 * * * *', checkFollowedPlayers);

client.login(BOT_TOKEN);
