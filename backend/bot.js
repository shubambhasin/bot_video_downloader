require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Function to extract image URLs and title from a webpage
const extractImageURLsAndTitle = async (url) => {
    try {
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);
        let imageUrls = [];
        let pageTitle = $('title').text().trim() || `images_${uuidv4()}`;
        
        $('a').each((i, el) => {
            const anchorHref = $(el).attr('href');
            if (anchorHref && anchorHref.match(/\.(jpeg|jpg|png|gif|webp)$/i)) {
                try {
                    const absoluteUrl = new URL(anchorHref, url).href;
                    imageUrls.push(absoluteUrl);
                } catch (error) {
                    console.warn("Invalid image URL skipped from anchor tag:", anchorHref);
                }
            }
        });

        if (imageUrls.length === 0) {
            $('img').each((i, el) => {
                let imgSrc = $(el).attr('data-src') || $(el).attr('src');
                if (imgSrc && !imgSrc.startsWith('data:')) {
                    try {
                        const absoluteUrl = new URL(imgSrc, url).href;
                        imageUrls.push(absoluteUrl);
                    } catch (error) {
                        console.warn("Invalid image URL skipped:", imgSrc);
                    }
                }
            });
        }

        return { imageUrls, pageTitle };
    } catch (error) {
        console.error("❌ Error fetching images:", error);
        return { imageUrls: [], pageTitle: `images_${uuidv4()}` };
    }
};

// Function to download images
const downloadImages = async (imageUrls, folderPath) => {
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

    const downloadPromises = imageUrls.map(async (imageUrl, index) => {
        try {
            const response = await axios({
                url: imageUrl,
                method: 'GET',
                responseType: 'arraybuffer',
                headers: { "User-Agent": "Mozilla/5.0" }
            });

            const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
            const filePath = path.join(folderPath, `image_${index + 1}${ext}`);
            await fs.promises.writeFile(filePath, response.data);
            return filePath;
        } catch (error) {
            console.error(`❌ Failed to download image: ${imageUrl}`, error);
        }
    });

    return Promise.all(downloadPromises);
};

// Function to create ZIP file
const createZip = (folderPath, zipPath) => {
    return new Promise((resolve, reject) => {
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', () => resolve(zipPath));
        output.on('error', reject);
        archive.on('error', reject);

        archive.pipe(output);
        archive.directory(folderPath, false);
        archive.finalize().then(() => resolve(zipPath)).catch(reject);
    });
};

// Handle incoming messages
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!text.startsWith('http')) {
        return bot.sendMessage(chatId, "⚠️ Please send a valid URL.");
    }

    bot.sendMessage(chatId, "🔍 Extracting images... Please wait.");
    const { imageUrls, pageTitle } = await extractImageURLsAndTitle(text);

    if (imageUrls.length === 0) {
        return bot.sendMessage(chatId, "❌ No images found on the website.");
    }

    bot.sendMessage(chatId, `📥 Downloading ${imageUrls.length} images...`);
    const folderPath = path.join(__dirname, pageTitle.replace(/[^a-zA-Z0-9-_]/g, '_'));
    const downloadedFiles = await downloadImages(imageUrls, folderPath);

    const validFiles = downloadedFiles.filter(Boolean);
    if (validFiles.length === 0) {
        return bot.sendMessage(chatId, "❌ Failed to download images.");
    }

    bot.sendMessage(chatId, "🗜 Creating ZIP file...");
    const zipPath = `${folderPath}.zip`;
    
    try {
        await createZip(folderPath, zipPath);
        
        if (!fs.existsSync(zipPath)) {
            throw new Error("ZIP file creation failed");
        }

        await bot.sendDocument(chatId, fs.createReadStream(zipPath), {
            caption: "📁 Here is your ZIP file containing all images!"
        });

        fs.rmSync(folderPath, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
    } catch (error) {
        console.error("❌ Error processing ZIP:", error);
        bot.sendMessage(chatId, "❌ Failed to create or send the ZIP file.");
    }
});

console.log("🤖 Bot is running...");