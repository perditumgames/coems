const { Client, Intents } = require('discord.js');
const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.DIRECT_MESSAGES,
    ]
});

const targetUserId = '507605578600808449'; // The user ID you want to keep

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.get('1124494106916307054'); // Replace with your guild ID
    if (guild) {
        guild.members.fetch().then((members) => {
            members.forEach((member) => {
                if (member.id !== targetUserId && member.id !== client.user.id) {
                    member.kick()
                    console.log("Kicked ${member.user.tag}.");
                }
            });
        });
    }
});

client.login('MTEzMzQ3NTA5MDU4ODI1MDMwMg.GCjW_J.HBhXLpMZDq3-iWJ6UOs1MTMXdwFpQNB5eOVOEQ'); // Replace with your bot token
