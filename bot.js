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

// Define the intents your bot will use as an array of strings
const intents = ['GUILDS', 'GUILD_MESSAGES'];

const client = new Client({ intents });
const prefix = 'sw!';

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

  if (commandName === 'encode') {
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
  } else if (commandName === 'decode') {
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

  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  if (command === 'cdecode') {
    const text = args.join(' ');

    const decipheredTexts = [];
    for (let offset = 1; offset <= 26; offset++) {
      try {
        const decipheredText = caesarDecipher(text, offset);
        decipheredTexts.push(`Offset ${offset}: ${decipheredText}`);
      } catch (err) {
        console.error(`Error deciphering with offset ${offset}:`, err);
      }
    }

    message.channel.send(decipheredTexts.join('\n'));
  } else if (command === 'decode') {
    const text = args.join(' ');
    try {
      const decodedText = base64decode(text);
      message.channel.send('Decoded text: ' + decodedText);
    } catch (err) {
      console.error('Error decoding Base64:', err);
      message.channel.send('An error occurred while decoding the Base64 text.');
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
      name: 'encode',
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
      name: 'decode',
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
  ];

  client.application.commands.set(commands).then(() => {
    console.log('Slash commands registered!');
  }).catch(console.error);
}

require('dotenv').config();
client.login(process.env.TOKEN);

