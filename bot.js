const { Client, GatewayIntentBits } = require('discord.js');
const { MessageAttachment, MessageEmbed } = require('discord.js');
const Discord = require('discord.js');
const https = require('https');
const QRReader = require('qrcode-reader');
const Jimp = require('jimp');
const { base64encode, base64decode } = require('nodejs-base64');
const { google } = require('googleapis');
const QRCode = require('qrcode');
const fs = require('fs');
const lame = require('node-lame');
const wav = require('wav');
const morse = require('morse-node').create("ITU");
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');

// Load bans data from bans.json
let bans = JSON.parse(fs.readFileSync('bans.json', 'utf8'));

// Initialize nextId with 1 if it is null
if (bans.nextId === null) {
  bans.nextId = 1;
}

// Define the intents your bot will use as an array of strings
const intents = ['GUILDS', 'GUILD_MESSAGES'];

const client = new Client({ intents });
const prefix = 'sw!';
const banID = 1;

// YouTube Data API credentials (replace with your own)
const youtubeApiKey = 'AIzaSyDoVZX9iEApOgDVG-JXAxjaZbSNLYCzZpo';

const youtube = google.youtube({
  version: 'v3',
  auth: youtubeApiKey,
});

client.once('ready', () => {
  console.log('Bot is online!');
  registerSlashCommands();
});

function saveBanReason(banId, reason) {
  fs.appendFile('ban_reasons.txt', `Ban ID: ${banId}, Reason: ${reason}\n`, (err) => {
    if (err) {
      console.error('Error saving ban reason:', err);
    }
  });
}

async function generateQRCode(text) {
  return new Promise((resolve, reject) => {
    QRCode.toBuffer(text, { type: 'png' }, (err, buffer) => {
      if (err) {
        reject(err);
      } else {
        resolve(buffer);
      }
    });
  });
}

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options } = interaction;

  if (commandName === 'encodeb64') {
    const text = options.getString('text');
    if (!text) {
      return interaction.reply({ content: 'Please provide text to encode.', ephemeral: true });
    }
    const encodedText = base64encode(text);
    interaction.reply({ content: 'Encoded text: ' + encodedText, ephemeral: true });
  } else if (commandName === 'cdecode') {
    const text = options.getString('text');
    if (!text) {
      return interaction.reply({ content: 'Please provide text to decode.', ephemeral: true });
    }

    const decipheredTexts = [];
    for (let offset = 1; offset <= 26; offset++) {
      try {
        const decipheredText = caesarDecipher(text, offset);
        decipheredTexts.push(`Offset ${offset}: ${decipheredText}`);
      } catch (err) {
        console.error(`Error deciphering with offset ${offset}:`, err);
      }
    }
    
    interaction.reply({ content: decipheredTexts.join('\n'), ephemeral: false });
  } else if (commandName === 'decodeb64') {
    const text = options.getString('text');
    if (!text) {
      return interaction.reply({ content: 'Please provide text to decode.', ephemeral: true });
    }
    try {
      const decodedText = base64decode(text);
      interaction.reply({ content: 'Decoded text: ' + decodedText, ephemeral: false });
    } catch (err) {
      console.error('Error decoding Base64:', err);
      interaction.reply({ content: 'An error occurred while decoding the Base64 text.', ephemeral: true });
    }
  } else if (commandName === 'qrencode') {
    const text = options.getString('text');
    if (!text) {
      return interaction.reply({ content: 'Please provide text to generate a QR code.', ephemeral: true });
    }
  
    // Generate QR code image
    try {
      const qrCodeImageBuffer = await generateQRCode(text);
      const qrCodeAttachment = new MessageAttachment(qrCodeImageBuffer, 'qrcode.png');
  
      const embed = new MessageEmbed()
        .setTitle('QR Code')
        .setDescription(`QR code for: ${text}`)
        .setImage('attachment://qrcode.png');
  
      interaction.reply({ embeds: [embed], files: [qrCodeAttachment], ephemeral: false });
    } catch (err) {
      console.error('Error generating QR code:', err);
      interaction.reply({ content: 'An error occurred while generating the QR code.', ephemeral: true });
    }
  } else if (commandName === 'ban') {
    const user = options.getUser('user');
    const reason = options.getString('reason');

    if (user) {
      if (!interaction.member.permissions.has('BAN_MEMBERS')) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      }

  // Ban the user
  try {
    // Generate a new ban ID using nextId and update nextId for the next ban
    const banId = bans.nextId++;
    console.log(`Ban ID generated: ${banId}`);
    
    const reason = options.getString('reason') || 'Breaking server rules'; // Get the provided reason or use 'No reason provided' as default

    bans[banId] = {
      user: user.id,
      reason: reason,
    };
    console.log(`New ban entry added with ID ${banId}`);
    
    fs.writeFileSync('bans.json', JSON.stringify(bans, null, 2)); // Save the updated bans data to bans.json
    console.log('Bans data saved to bans.json');

    await interaction.guild.members.ban(user, { reason: `Ban ID: ${banId} - ${reason}` });
    console.log(`Successfully banned ${user.tag} with ID ${banId}.`);
    
    interaction.reply({ content: `Successfully banned ${user.tag}. Reason: ${reason}`, ephemeral: false });
  } catch (error) {
    console.error('Error banning user:', error);
    interaction.reply({ content: 'An error occurred while banning the user.', ephemeral: true });
  }
    } else {
      interaction.reply({ content: 'Please provide a valid member to ban.', ephemeral: true });
    }
  } else if (commandName === 'kick') {
    const user = options.getUser('user');
    const reason = options.getString('reason'); // Get the reason parameter from the interaction

    if (user) {
      // Check if the user invoking the command has the necessary permissions to kick members
      if (!interaction.member.permissions.has('KICK_MEMBERS')) {
        return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
      }

      try {
        // Kick the user with the provided reason
        await interaction.guild.members.kick(user, { reason: reason });

        const kicks = JSON.parse(fs.readFileSync('kicks.json', 'utf8'));
        const kickId = kicks.nextId++;
        kicks[kickId] = { user: user.id, reason: reason || 'No reason provided' };
        fs.writeFileSync('kicks.json', JSON.stringify(kicks));

        interaction.reply({ content: `Successfully kicked ${user.tag}.\nReason: ${reason || 'No reason provided'}`, ephemeral: false });
      } catch (error) {
        console.error('Error kicking user:', error);
        interaction.reply({ content: 'An error occurred while kicking the user.', ephemeral: true });
      }
    } else {
      interaction.reply({ content: 'Please provide a valid member to kick.', ephemeral: true });
    }
  } else if (commandName === 'lookup') {
    // Command to lookup reasons for a specific ban ID
    const banId = options.getInteger('banid');
    if (!banId) {
      return interaction.reply({ content: 'Please provide a valid ban ID to lookup.', ephemeral: true });
    }

    fs.readFile('ban_reasons.txt', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading ban reasons file:', err);
        return interaction.reply({ content: 'An error occurred while looking up the ban reason.', ephemeral: true });
      }

      const lines = data.split('\n');
      const result = lines.find((line) => line.includes(`Ban ID: ${banId}`));

      if (result) {
        interaction.reply({ content: `Ban ID ${banId} Reason: ${result.split('Reason:')[1]}`, ephemeral: false });
      } else {
        interaction.reply({ content: 'Ban ID not found or reason not available.', ephemeral: false });
      }
    });
  } else if (commandName === 'reason') {
    // Command to add a reason to a specific ban ID
    const banId = options.getInteger('banid');
    const reason = options.getString('reason');

    if (!banId || !reason) {
      return interaction.reply({ content: 'Please provide a valid ban ID and reason to add.', ephemeral: true });
    }

    fs.readFile('ban_reasons.txt', 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading ban reasons file:', err);
        return interaction.reply({ content: 'An error occurred while adding the ban reason.', ephemeral: true });
      }

      const lines = data.split('\n');
      const resultIndex = lines.findIndex((line) => line.includes(`Ban ID: ${banId}`));

      if (resultIndex !== -1) {
        // Replace the existing reason
        lines[resultIndex] = `Ban ID: ${banId}, Reason: ${reason}`;
      } else {
        // Add a new reason
        lines.push(`Ban ID: ${banId}, Reason: ${reason}`);
      }

      // Update the text file with the new data
      fs.writeFile('ban_reasons.txt', lines.join('\n'), 'utf8', (err) => {
        if (err) {
          console.error('Error saving ban reasons:', err);
          return interaction.reply({ content: 'An error occurred while saving the ban reason.', ephemeral: true });
        }
        interaction.reply({ content: `Ban ID ${banId} Reason updated: ${reason}`, ephemeral: true });
      });
    });
  } else if (commandName === 'decodemorse') {
    const attachment = interaction.attachments.first;
    if (!attachment || !attachment.name.endsWith('.mp3') || !attachment.name.endsWith('.wav')) {
      await interaction.reply('Please attach an audio file (MP3 or WAV) to decode.');
      return;
    }

    try {
      const audioBuffer = await fs.promises.readFile(attachment.url);
      const decodedText = await decodeMorseFromAudio(audioBuffer);
      await interaction.reply(`Decoded Morse Code: ${decodedText}`);
    } catch (error) {
      console.error('Error decoding Morse code:', error);
      await interaction.reply('Error decoding Morse code.');
    }
  }
});

async function handleQRCode(text) {
  try {
    const qrCodeImage = await generateQRCodeImage(text);
    return qrCodeImage;
  } catch (err) {
    console.error('Error generating QR code:', err);
    throw err;
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.attachments.size > 0) {
    const url = message.attachments.first().url;
    try {
      if (message.channel.type === 'GUILD_TEXT') {
        const decodedData = await handleQRCode(url);
        if (decodedData) {
          message.channel.send('Decoded QR code: ' + decodedData);
        } else {
          message.channel.send('Failed to decode QR code.');
        }
      }
    } catch (err) {
      // console.error('QR code decoding error:', err);
    }
  }
});

async function handleQRCode(imageURL) {
  return new Promise((resolve, reject) => {
    https.get(imageURL, async (response) => {
      let data = [];
      response.on('data', (chunk) => {
        data.push(chunk);
      });
      response.on('end', async () => {
        try {
          const buffer = Buffer.concat(data);
          const qrCodeReader = new QRReader();
          const image = await Jimp.read(buffer);
          const qrCodeResult = await new Promise((resolve, reject) => {
            qrCodeReader.callback = (err, value) => (err ? reject(err) : resolve(value));
            qrCodeReader.decode(image.bitmap);
          });

          if (qrCodeResult && qrCodeResult.result) {
            resolve(qrCodeResult.result);
          } else {
            reject(new Error('QR code decoding failed.'));
          }
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}

function caesarDecipher(text, offset) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  return text
    .split('')
    .map((char) => {
      if (alphabet.includes(char.toLowerCase())) {
        const isUpperCase = char === char.toUpperCase();
        const charIndex = alphabet.indexOf(char.toLowerCase());
        const newIndex = (charIndex - offset + 26) % 26;
        return isUpperCase ? alphabet[newIndex].toUpperCase() : alphabet[newIndex];
      }
      return char;
    })
    .join('');
}

function registerSlashCommands() {
  const commands = [
    {
      name: 'encodeb64',
      description: 'Encode text to base64.',
      options: [
        {
          name: 'text',
          description: 'The text to encode.',
          type: 'STRING',
          required: true,
        },
      ],
    },
    {
      name: 'cdecode',
      description: 'Decode text using the Caesar cipher. Will print all combinations.',
      options: [
        {
          name: 'text',
          description: 'The text to decode.',
          type: 'STRING',
          required: true,
        },
      ],
    },
    {
      name: 'decodeb64',
      description: 'Decode Base64 text.',
      options: [
        {
          name: 'text',
          description: 'The Base64-encoded text to decode.',
          type: 'STRING',
          required: true,
        },
      ],
    },
    {
      name: 'qrencode',
      description: 'Generate a QR code for the given text.',
      options: [
        {
          name: 'text',
          description: 'The text to encode in the QR code.',
          type: 'STRING',
          required: true,
        },
      ],
    },
    {
      name: 'ban',
      description: 'Ban a member from the server.',
      options: [
        {
          name: 'user',
          description: 'The user to ban.',
          type: 'USER',
          required: true,
        },
        {
          name: 'reason',
          description: 'The reason for the ban.',
          type: 'STRING',
          required: false, // Reason is now optional
        },
      ],
    },
    {
      name: 'kick',
      description: 'Kick a member from the server.',
      options: [
        {
          name: 'user',
          description: 'The user to kick.',
          type: 'USER',
          required: true,
        },
        {
          name: 'reason',
          description: 'The reason for the kick.',
          type: 'STRING',
          required: false, // Reason is now optional
        },
      ],
    },
    {
      name: 'lookup',
      description: 'Lookup the reason for a ban by ID.',
      options: [
        {
          name: 'banid',
          description: 'The ID of the ban to lookup.',
          type: 'INTEGER',
          required: true,
        },
      ],
    },
    {
      name: 'reason',
      description: 'Add or update a reason for a ban by ID.',
      options: [
        {
          name: 'banid',
          description: 'The ID of the ban to add/update reason.',
          type: 'INTEGER',
          required: true,
        },
        {
          name: 'reason',
          description: 'The reason for the ban.',
          type: 'STRING',
          required: true,
        },
      ],
    },
    {
      name: 'about',
      description: 'Info about the bot.',
      options: [],
    },
  ];

  client.application.commands.set(commands).then(() => {
    console.log('Slash commands registered!');
  }).catch(console.error);
}

require('dotenv').config();
client.login(process.env.TOKEN);

