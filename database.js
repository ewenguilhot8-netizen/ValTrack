const knex = require('knex')({
    client: 'sqlite3',
    connection: {
        filename: './radianite.db' // Le fichier de votre BDD
    },
    useNullAsDefault: true
});

async function setupDatabase() {
    if (!await knex.schema.hasTable('users')) {
        await knex.schema.createTable('users', table => {
            table.increments('id').primary();
            table.string('discord_id').unique().notNullable();
            table.string('username');
            table.string('avatar');
            table.string('discord_channel_id'); // Le salon où le bot doit poster
        });
        console.log("Table 'users' créée.");
    }

    if (!await knex.schema.hasTable('followed_players')) {
        await knex.schema.createTable('followed_players', table => {
            table.increments('id').primary();
            table.integer('user_id').unsigned().references('id').inTable('users');
            table.string('riot_id').notNullable();
        });
        console.log("Table 'followed_players' créée.");
    }
    
    // Table pour le bot, pour éviter les notifications en double
    if (!await knex.schema.hasTable('bot_memory')) {
        await knex.schema.createTable('bot_memory', table => {
            table.string('riot_id').primary();
            table.string('last_match_id');
        });
        console.log("Table 'bot_memory' créée.");
    }

    // Table des Commentaires
    if (!await knex.schema.hasTable('player_comments')) {
        await knex.schema.createTable('player_comments', table => {
            table.increments('id').primary();
            table.string('riot_id').notNullable().index(); // Index pour des recherches rapides
            table.string('author_discord_id').notNullable();
            table.string('author_username').notNullable();
            table.string('author_avatar');
            table.text('comment_text').notNullable();
            table.timestamp('created_at').defaultTo(knex.fn.now());
        });
        console.log("Table 'player_comments' créée.");
    }
}

// Exporter knex et la fonction d'init
module.exports = { knex, setupDatabase };
