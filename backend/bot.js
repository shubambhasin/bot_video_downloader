require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const app = express();
const PORT = process.env.PORT || 3009;

// Store user selections
const userSelections = {};

// Extract video URL function (same as in your script)
const extractVideoURL = async (url) => {
    try {
        // Fetch the HTML content of the webpage
        const { data } = await axios.get(url);

        // Load the HTML content into cheerio
        const $ = cheerio.load(data);

        // Attempt to find the video URL by searching for the video inside the <video> tag
        const videoUrl = $('video#mainvideo').attr('src');

        // if (videoUrl) {
        //     const fullUrl = videoUrl.startsWith('//') ? 'https:' + videoUrl : videoUrl;
        //     console.log('Video URL:', fullUrl);
        //     return;
        // }
        let streamUrl = ""
        // If not found in video tag, search inside script tags
        $('script').each((i, el) => {
            const scriptContent = $(el).html();

            // Check if the video URL is embedded in the script
            const videoUrlMatch = scriptContent.match(/get_video\?id=[^"]+/);
            if (videoUrlMatch) {
                const videoUrl = videoUrlMatch[0];
                // console.log('ShubamBHasin', 'https:' + videoUrl);
                streamUrl = 'https:' + videoUrl;

                // Step 1: Extract everything before `').substring(1).substring(2)`
                let substring = streamUrl.split("').substring")[0].slice(6);

                // Step 2: Format it as `https://streamtape/${substring}`
                let formattedURL = `https://streamtape.com/${substring}`;
                console.log('ShubamBHasin', formattedURL);
                                return formattedURL + '&stream=1';
                            }
                });
                console.log("check oneeee", streamUrl)
                let substring1 = streamUrl.split("').substring")[0].slice(6);

                // Step 2: Format it as `https://streamtape/${substring}`
                let formattedURL1 = `https://streamtape.com/${substring1}&stream=1`;
                return formattedURL1;
        console.log('Video URL not found.');
    } catch (error) {
        console.error('Error fetching the webpage:', error);
    }
};

// Handle /start command
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;

    const options = {
        reply_markup: {
            inline_keyboard: [
                [{ text: "StreamTape", callback_data: "streamtape" }],
                [{ text: "Other Service (Coming Soon)", callback_data: "other" }]
            ]
        }
    };

    bot.sendMessage(chatId, "📽️ Select a video service:", options);
});

// Handle button click (Service selection)
bot.on("callback_query", (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const service = callbackQuery.data;

    if (service === "other") {
        return bot.sendMessage(chatId, "🚧 This service is not available yet.");
    }

    userSelections[chatId] = service;
    bot.sendMessage(chatId, "✅ Selected: StreamTape\nNow send me the video link.");
});

// Handle video link input
bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    // Ignore commands
    if (text.startsWith('/')) return;

    if (!userSelections[chatId]) {
        return bot.sendMessage(chatId, "⚠️ Please select a service first using /start.");
    }

    bot.sendMessage(chatId, "🔍 Fetching the video link... Please wait.");

    const videoUrl = await extractVideoURL(text);
    
    if (videoUrl) {
        bot.sendMessage(chatId, `✅ Here is your download link:\n${videoUrl}`);
    } else {
        bot.sendMessage(chatId, "❌ Failed to fetch the video link. Please check the URL and try again.");
    }
});

// Start Express server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
