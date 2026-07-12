const {
    Client,
    GatewayIntentBits,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ApplicationCommandOptionType,
    StringSelectMenuBuilder,
    PermissionsBitField,
    MessageFlags
} = require('discord.js');

const fs = require('fs'); 

const cron = require('node-cron');

// Hàm hỗ trợ tạo số ngẫu nhiên cho vé số
function randDigits(n) {
    return Math.floor(Math.random() * Math.pow(10, n)).toString().padStart(n, '0');
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});
// KHIÊN CHỐNG SẬP BOT KHI CÓ LỖI API DISCORD
client.on('error', (error) => {
    console.error('⚠️ [BỎ QUA] Lỗi nội bộ Discord API:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [BỎ QUA] Lỗi Promise không xác định:', reason);
});

// ==========================================
// QUẢN LÝ TRẠNG THÁI GAME (BỘ NHỚ TỔNG HỢP)
// ==========================================
const activeGames = {
    caro: new Map(),
    taixiu: null,
    xidach: null,
    baucua: null,
    noitu: new Map(),   
    xepgach: new Map(), 
    covua: new Map(),   
    masoi: new Map()    
};

const ROLE_IMAGES = {
    'Sói': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/masoi.png',
    'Tiên tri': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/tientri.png',
    'Bảo vệ': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/baove.png',
    'Dân làng': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/danlang.png',
    'Thợ săn': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/thosan.png',
    'Phù thủy': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/',
    'Cupid': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/thantinhyeu.png',
    'Già làng': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/gialanh.png',
    'Phản bội': 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/phuthuy.png'
};

const COVER_IMAGE = 'https://raw.githubusercontent.com/Naknohack/Naknohackclentvng/main/menu.png';

// ==========================================
// HỆ THỐNG CHẶN COPY TIN NHẮN BOT (ANTI-LEAK)
// ==========================================
// Chỉ chặn khi người chơi gần như copy nguyên văn tin nhắn riêng của bot.
// Tin nhắn chat bình thường như "bên A bảo bên B là gì?" sẽ không bị chặn
// vì nó không khớp sát nội dung private message của bot.
const BOT_ROLE_MESSAGES = [
    "Bạn là SÓI. Hãy chọn mục tiêu để cắn đêm nay.",
    "Bạn là TIÊN TRI. Hãy soi 1 người để biết phe của họ.",
    "Bạn là BẢO VỆ. Hãy chọn 1 người để bảo vệ đêm nay.",
    "Bạn là PHÙ THỦY. Bạn có 1 bình CỨU và 1 bình ĐỘC.",
    "Bạn là CUPID. Hãy chọn 2 người để ghép đôi",
    "Bạn là THỢ SĂN. Nếu bạn bị giết đêm nay hoặc bị treo cổ",
    "Bạn là GIÀ LÀNG. Bạn có 2 mạng khi bị sói cắn.",
    "Bạn là BÁN SÓI / KẺ PHẢN BỘI. Bạn sẽ thắng nếu phe Sói thắng."
];

function normalizeLeakText(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9áàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function isCopiedBotMessage(userMsg) {
    const cleanUser = normalizeLeakText(userMsg);
    if (!cleanUser) return false;

    for (const botMsg of BOT_ROLE_MESSAGES) {
        const cleanBot = normalizeLeakText(botMsg);
        if (!cleanBot) continue;

        // Khớp y nguyên hoặc gần như y nguyên => coi là copy
        if (cleanUser === cleanBot) return true;
        if (cleanUser.includes(cleanBot) && cleanBot.length >= 18) return true;

        const botWords = cleanBot.split(' ');
        const userWords = new Set(cleanUser.split(' '));
        let matchCount = 0;

        for (const word of botWords) {
            if (userWords.has(word)) matchCount++;
        }

        // Chỉ bắt khi mức trùng rất cao để tránh chặn nhầm chat bình thường
        const similarity = botWords.length ? (matchCount / botWords.length) * 100 : 0;
        if (similarity >= 85 && cleanUser.length >= cleanBot.length - 2) {
            return true;
        }
    }
    return false;
}

function getRoleConfig(playerCount) {
    if (playerCount === 1) return ['Sói'];
    if (playerCount === 2) return ['Sói', 'Tiên tri'];
    if (playerCount === 3) return ['Sói', 'Tiên tri', 'Bảo vệ'];
    if (playerCount === 4) return ['Sói', 'Tiên tri', 'Bảo vệ', 'Dân làng'];
    if (playerCount === 5) return ['Sói', 'Tiên tri', 'Bảo vệ', 'Phù thủy', 'Dân làng'];
    if (playerCount === 6) return ['Sói', 'Sói', 'Tiên tri', 'Bảo vệ', 'Phù thủy', 'Cupid'];
    if (playerCount === 7) return ['Sói', 'Sói', 'Tiên tri', 'Bảo vệ', 'Phù thủy', 'Thợ săn', 'Cupid'];
    if (playerCount === 8) return ['Sói', 'Sói', 'Tiên tri', 'Bảo vệ', 'Phù thủy', 'Thợ săn', 'Cupid', 'Già làng'];
    if (playerCount === 9) return ['Sói', 'Sói', 'Bán sói', 'Tiên tri', 'Bảo vệ', 'Phù thủy', 'Thợ săn', 'Cupid', 'Già làng'];
    if (playerCount >= 10) return ['Sói', 'Sói', 'Sói', 'Bán sói', 'Tiên tri', 'Bảo vệ', 'Phù thủy', 'Thợ săn', 'Cupid', 'Già làng', 'Dân làng', 'Dân làng'].slice(0, playerCount);
    return Array(playerCount).fill('Dân làng'); 
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// ==========================================\n// CẤU HÌNH NÔNG TRẠI, ĐỘNG VẬT, MÓN ĂN\n// ==========================================\n
const SEEDS = {
    'luami': { name: 'Hạt giống Lúa Mì', price: 5000, time: 5 * 60 * 1000, harvest: 'Lúa Mì', yield: 2, icon: '🌾' },
    'ngo': { name: 'Hạt giống Ngô', price: 10000, time: 10 * 60 * 1000, harvest: 'Ngô', yield: 2, icon: '🌽' },
    'carot': { name: 'Hạt giống Cà Rốt', price: 15000, time: 15 * 60 * 1000, harvest: 'Cà Rốt', yield: 3, icon: '🥕' },
    'cachua': { name: 'Hạt giống Cà Chua', price: 20000, time: 20 * 60 * 1000, harvest: 'Cà Chua', yield: 3, icon: '🍅' },
    'khoaitay': { name: 'Hạt giống Khoai Tây', price: 25000, time: 30 * 60 * 1000, harvest: 'Khoai Tây', yield: 4, icon: '🥔' },
    'duahau': { name: 'Hạt giống Dưa Hấu', price: 50000, time: 60 * 60 * 1000, harvest: 'Dưa Hấu', yield: 1, icon: '🍉' },
    'dautay': { name: 'Hạt giống Dâu Tây', price: 40000, time: 45 * 60 * 1000, harvest: 'Dâu Tây', yield: 5, icon: '🍓' },
    'nho': { name: 'Hạt giống Nho', price: 60000, time: 90 * 60 * 1000, harvest: 'Nho', yield: 4, icon: '🍇' }
};

const FOODS = {
    'banhmi': { name: 'Bánh Mì', req: { 'Lúa Mì': 2 }, energy: 20, icon: '🥖' },
    'suabotruoi': { name: 'Sữa Bò Tươi', req: { 'Sữa': 1 }, energy: 15, icon: '🥛' },
    'trungopla': { name: 'Trứng Ốp La', req: { 'Trứng': 1 }, energy: 10, icon: '🍳' }
};

const ANIMALS = {
    'ga': { name: 'Gà', price: 50000, feed: 'Lúa Mì', produce: 'Trứng', time: 30 * 60 * 1000, icon: '🐔' },
    'bo': { name: 'Bò', price: 200000, feed: 'Ngô', produce: 'Sữa', time: 120 * 60 * 1000, icon: '🐄' },
    'lon': { name: 'Lợn', price: 150000, feed: 'Cà Rốt', produce: 'Thịt', time: 60 * 60 * 1000, icon: '🐖' },
    'cuu': { name: 'Cừu', price: 100000, feed: 'Lúa Mì', produce: 'Lông', time: 45 * 60 * 1000, icon: '🐑' }
};

let globalWeather = { name: '☀️ Nắng đẹp', growMultiplier: 1.1, diseaseRate: 1.0 };
// Bảng giá gốc của Nông sản & Sản phẩm động vật bán ra
const MARKET_BASE_PRICES = {
    'Lúa Mì': 3000,
    'Ngô': 6000,
    'Cà Rốt': 6000,
    'Cà Chua': 8000,
    'Khoai Tây': 8000,
    'Dưa Hấu': 65000,
    'Dâu Tây': 10000,
    'Nho': 20000,
    'Trứng': 5000,
    'Sữa': 12000,
    'Thịt': 25000,
    'Lông': 18000
};

// Biến lưu giá hiện tại của chợ & thông tin thương nhân
let currentMarketPrices = { ...MARKET_BASE_PRICES };
let specialMerchant = { active: false, item: null, multiplier: 1 };

// ==========================================
// DATABASE LƯU TRỮ RA FILE (1 FILE DUY NHẤT, TÁCH THEO SERVER)
// ==========================================
const DB_FILE = './database.json';
let db = {
    guilds: {},
    shop: {}
};

if (fs.existsSync(DB_FILE)) {
    try {
        const rawData = fs.readFileSync(DB_FILE, 'utf8');
        db = JSON.parse(rawData);
        if (!db.guilds) db.guilds = {};
        if (!db.shop) db.shop = {};
    } catch (err) {
        console.error('Lỗi khi đọc file database:', err);
    }
}

function saveData() {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4), 'utf8');
}

function getGuildData(guildId = 'global') {
    if (!db.guilds[guildId]) {
        db.guilds[guildId] = {
            balance: {},
            lastDaily: {},
            lastChatMoney: {},
            fishing: {},
            farmUsers: {},
            tradeSessions: {},
            tradeDrafts: {},
            farmSellSessions: {},
            prisonConfig: {}, 
            prisonUsers: {},  
            debts: {} // THÊM DÒNG NÀY ĐỂ LƯU NỢ
        };
        saveData();
    }

    const guildData = db.guilds[guildId];
    if (!guildData.balance) guildData.balance = {};
    if (!guildData.lastDaily) guildData.lastDaily = {};
    if (!guildData.lastChatMoney) guildData.lastChatMoney = {};
    if (!guildData.fishing) guildData.fishing = {};
    if (!guildData.farmUsers) guildData.farmUsers = {};
    if (!guildData.tradeSessions) guildData.tradeSessions = {};
    if (!guildData.tradeDrafts) guildData.tradeDrafts = {};
    if (!guildData.farmSellSessions) guildData.farmSellSessions = {};
    if (!guildData.prisonConfig) guildData.prisonConfig = {};
    if (!guildData.prisonUsers) guildData.prisonUsers = {};
    if (!guildData.debts) guildData.debts = {}; // Đảm bảo không bị lỗi undefined
    return guildData;
}

function getBalance(userId, guildId = 'global') {
    const guildData = getGuildData(guildId);
    if (guildData.balance[userId] === undefined) {
        guildData.balance[userId] = 1000;
        saveData();
    }
    return guildData.balance[userId];
}

function addBalance(userId, amount, guildId = 'global') {
    const guildData = getGuildData(guildId);
    if (guildData.balance[userId] === undefined) guildData.balance[userId] = 1000;
    guildData.balance[userId] += amount;
    saveData();
}

function saveFishingData() {
    saveData();
}


// ==========================================
// HỆ THỐNG CÂU CÁ (GHÉP TỪ SOURCE RIÊNG)
// ==========================================
const COMPONENTS = {
    lines: { 'Dây Cước Thường': 20000, 'Dây Cước Bền': 50000, 'Dây Carbon': 100000, 'Dây Nano': 150000, 'Dây Titan': 500000, 'Dây Thiên Hà': 1000000, 'Dây Hư Không': 2000000, 'Dây Vũ Trụ': 5000000 },
    hooks: { 'Lưỡi Câu Sắt': 5000, 'Lưỡi Câu Thép': 20000, 'Lưỡi Câu Bạc': 50000, 'Lưỡi Câu Vàng': 100000, 'Lưỡi Câu Titan': 300000, 'Lưỡi Câu Poseidon': 1000000, 'Lưỡi Câu Thần Long': 2000000, 'Lưỡi Câu Sáng Thế': 5000000 },
    floats: { 'Phao Gỗ': 5000, 'Phao Tre': 10000, 'Phao Nhựa': 10000, 'Phao Carbon': 50000, 'Phao Phát Sáng': 30000, 'Phao Hải Thần': 500000, 'Phao Thiên Hà': 1000000, 'Phao Vũ Trụ': 3000000 },
    reels: { 'Máy Câu Cũ': 100000, 'Máy Câu Thường': 300000, 'Máy Câu Chuyên Nghiệp': 1000000, 'Máy Câu Carbon': 2000000, 'Máy Câu Titan': 5000000, 'Máy Câu Hải Đế': 10000000, 'Máy Câu Thần Long': 20000000, 'Máy Câu Omega': 50000000 },
    baits: { 'Trùn Đất': 5000, 'Tôm Nhỏ': 10000, 'Cá Con': 10000, 'Mồi Tổng Hợp': 20000, 'Mồi Phát Sáng': 50000, 'Mồi Đại Dương': 100000, 'Mồi Huyền Thoại': 500000, 'Mồi Thần Biển': 1000000 },
    buffs: { 'Bùa May Mắn': 500000, 'Thuốc Rớt Đồ': 300000 }
};

const RODS = {
    '🎣 Cần Tre': { price: 0, dur: 10, res: 5, req: null },
    '🎣 Cần Carbon Pro': { price: 5000, dur: 50, res: 15, req: {'Dây Carbon':10, 'Lưỡi Câu Thép':5, 'Máy Câu Cũ':2} },
    '🎣 Cần Bass Master': { price: 15000, dur: 80, res: 20, req: {'Dây Carbon':15, 'Lưỡi Câu Thép':10, 'Phao Carbon':5} },
    '🎣 Cần Predator': { price: 30000, dur: 120, res: 28, req: {'Dây Nano':20, 'Lưỡi Câu Bạc':10, 'Máy Câu Thường':5} },
    '🎣 Cần River King': { price: 40000, dur: 135, res: 30, req: {'Dây Nano':25, 'Lưỡi Câu Bạc':15, 'Phao Carbon':10} },
    '🎣 Cần Sea Hunter': { price: 50000, dur: 150, res: 35, req: {'Dây Titan':30, 'Lưỡi Câu Vàng':20, 'Máy Câu Chuyên Nghiệp':10} },
    '🔱 Cần Titan': { price: 120000, dur: 200, res: 45, req: {'Dây Titan':50, 'Lưỡi Câu Titan':25, 'Máy Câu Carbon':10} },  
    '🔱 Cần Long Vương': { price: 250000, dur: 250, res: 55, req: {'Vảy Rồng':10, 'Dây Titan':50, 'Phao Hải Thần':20} },  
    '🔱 Cần Hải Thần': { price: 350000, dur: 300, res: 60, req: {'Ngọc Đại Dương':20, 'Mồi Thần Biển':10, 'Dây Titan':50} },  
    '🔱 Cần Kraken': { price: 500000, dur: 350, res: 68, req: {'Xúc Tu Kraken':15, 'Dây Thiên Hà':30, 'Lưỡi Câu Poseidon':20} },  
    '🔱 Cần Ngân Hà': { price: 750000, dur: 450, res: 72, req: {'Đá Thiên Hà':50, 'Lõi Vũ Trụ':20, 'Dây Thiên Hà':30} },  
    '✨ Cần Poseidon': { price: 800000, dur: 500, res: 75, req: {'Ngọc Poseidon':25, 'Xúc Tu Kraken':20, 'Cá Thần Biển':10} },  
    '✨ Cần Leviathan': { price: 1500000, dur: 700, res: 80, req: {'Vảy Leviathan':30, 'Răng Megalodon':10, 'Tim Thủy Quái':5} },  
    '✨ Cần Atlantis': { price: 2200000, dur: 850, res: 82, req: {'Cổ Vật Atlantis':50, 'Ngọc Đại Dương':20, 'Cá Đại Dương Cổ Đại':10} },  
    '✨ Cần Hải Đế': { price: 2600000, dur: 900, res: 84, req: {'Ngọc Poseidon':50, 'Vảy Leviathan':30, 'Thần Ngư Poseidon':10} },  
    '✨ Cần Thiên Long': { price: 3000000, dur: 1000, res: 85, req: {'Vảy Rồng':50, 'Cá Thiên Long':20, 'Cá Hắc Long':10} },  
    '🌌 Cần Thần Long': { price: 5000000, dur: 1500, res: 90, req: {'Vảy Rồng':100, 'Tinh Thể Thiên Hà':50, 'Cá Thiên Long':20} },  
    '🌌 Cần Vũ Trụ': { price: 8000000, dur: 1800, res: 91, req: {'Lõi Vũ Trụ':50, 'Cá Vũ Trụ':30, 'Đá Thiên Hà':20} },  
    '🌌 Cần Hỗn Mang': { price: 12000000, dur: 2200, res: 92, req: {'Mảnh Hỗn Mang':50, 'Cá Hỗn Mang':20, 'Cá Vương Giả':10} },  
    '🌌 Cần Thiên Giới': { price: 16000000, dur: 3000, res: 94, req: {'Tinh Thể Thiên Hà':100, 'Cá Thiên Sứ':50, 'Cá Ánh Trăng':25} },  
    '🌌 Cần Sáng Thế': { price: 20000000, dur: 5000, res: 95, req: {'Cá Sáng Thế':1, 'Lõi Vũ Trụ':100, 'Tinh Thể Thiên Hà':100} },   
    '☄️ Cần Void': { price: 50000000, dur: 7000, res: 96, req: {'Mảnh Void':50, 'Cá Void':10, 'Cthulhu':5} },  
    '☄️ Cần Origin': { price: 100000000, dur: 9000, res: 97, req: {'Tinh Thể Origin':50, 'Cá Origin':10, 'Leviathan':5} },  
    '☄️ Cần Entity': { price: 250000000, dur: 12000, res: 98, req: {'Lõi Entity':50, 'Cá Entity':10, 'Kraken Hư Không':5} },  
    '☄️ Cần Null': { price: 500000000, dur: 15000, res: 99, req: {'Mảnh Null':50, 'Cá Null':10, 'Leviathan Tận Thế':5} },  
    '☄️ Cần Omega': { price: 1000000000, dur: 25000, res: 99, req: {'Mảnh Void':100, 'Tinh Thể Origin':100, 'Lõi Entity':100, 'Mảnh Null':100, 'Cá Omega':10, 'Leviathan Tận Thế':1} }
};

const ZONES = {
    'Ao Làng': { fee: 0, level: 1, maxRarity: 'Rare' }, 'Sông Lớn': { fee: 100000, level: 10, maxRarity: 'Epic' }, 'Hồ Bí Ẩn': { fee: 1000000, level: 25, maxRarity: 'Legendary' },
    'Biển Đông': { fee: 10000000, level: 50, maxRarity: 'Mythic' }, 'Rãnh Đại Dương': { fee: 100000000, level: 80, maxRarity: 'Secret' },
    'Atlantis': { fee: 1000000000, level: 100, maxRarity: 'Secret' }, 'Hư Không': { fee: 10000000000, level: 150, maxRarity: 'Secret' }
};

const RANK_VAL = { 'Uncommon': 1, 'Rare': 2, 'Epic': 3, 'Legendary': 4, 'Mythic': 5, 'Secret': 6 };

const BAIT_BUFFS = {
    "Trùn Đất": { target: 'Uncommon', bonus: 0 }, "Tôm Nhỏ": { target: 'Rare', bonus: 5 }, "Cá Con": { target: 'Rare', bonus: 10 },
    "Mồi Tổng Hợp": { target: 'Epic', bonus: 15 }, "Mồi Phát Sáng": { target: 'Epic', bonus: 20 }, "Mồi Đại Dương": { target: 'Legendary', bonus: 30 },
    "Mồi Huyền Thoại": { target: 'Mythic', bonus: 50 }, "Mồi Thần Biển": { target: 'Secret', bonus: 75 }
};

const FISH_DATA = {
    Uncommon: { chance: 50, minPrice: 30000, maxPrice: 150000, breakChance: 10, list: ['Cá Lóc Đồng', 'Cá Tra', 'Cá Rô Phi', 'Cá Rô Đồng', 'Cá Trê Lai', 'Cá Trê Trắng', 'Cá Trê Vàng', 'Cá Basa', 'Cá Trắm Cỏ', 'Cá Tai Tượng', 'Cá Chim Trắng', 'Cá Diêu Hồng', 'Cá Leo', 'Cá Chạch', 'Cá Thát Lát', 'Cá Bống Tượng', 'Cá Sặc Rằn', 'Cá Mè Hoa', 'Cá Chốt', 'Cá Ngát', 'Cá He', 'Cá Dứa', 'Cá Măng Sữa', 'Cá Nàng Hai', 'Cá Chày'], drops: ['Vảy Rồng', 'Ngọc Đại Dương'] },
    Rare: { chance: 25, minPrice: 150000, maxPrice: 500000, breakChance: 30, list: ['Cá Hô', 'Cá Vồ Đém', 'Cá Chình', 'Cá Ngạnh', 'Cá Nheo', 'Cá Koi', 'Cá Tầm', 'Cá Măng', 'Cá Anh Vũ', 'Cá Bông Lau Khổng Lồ', 'Cá Hồi', 'Cá Tầm Siberia', 'Cá Chép Kính', 'Cá Chình Điện', 'Cá Hổ Sông'], drops: ['Xúc Tu Kraken', 'Cổ Vật Atlantis'] },
    Epic: { chance: 15, minPrice: 500000, maxPrice: 2000000, breakChance: 50, list: ['Cá Rồng Đỏ', 'Cá Kiếm', 'Cá Ngừ Đại Dương', 'Cá Thu Hoàng Kim', 'Cá Mập Con', 'Cá Đuối Khổng Lồ', 'Cá Cờ Xanh', 'Cá Mặt Quỷ', 'Cá Hổ Biển', 'Cá Kình Non', 'Cá Hổ Vàng', 'Cá Rồng Bạc'], drops: ['Đá Thiên Hà', 'Lõi Vũ Trụ'] },
    Legendary: { chance: 8, minPrice: 2000000, maxPrice: 20000000, breakChance: 70, list: ['Cá Rồng Vàng', 'Cá Mập Trắng', 'Cá Hỏa Long', 'Cá Băng Long', 'Cá Đại Dương Cổ Đại', 'Cá Thiên Hà', 'Cá Hư Không', 'Cá Hoàng Gia', 'Cá Pha Lê', 'Cá Ngọc Bích', 'Cá Thần Sấm', 'Cá Thần Gió'], drops: ['Ngọc Poseidon', 'Răng Megalodon', 'Tim Thủy Quái'] },
    Mythic: { chance: 1.9, minPrice: 20000000, maxPrice: 200000000, breakChance: 85, list: ['Cá Koi Vàng', 'Cá Rồng Bạch Kim', 'Cá Mập Búa', 'Cá Ngọc Trai', 'Cá Hoàng Kim', 'Cá Kim Cương', 'Cá Ánh Trăng', 'Cá Mặt Trời', 'Cá Thiên Sứ', 'Cá Bóng Tối', 'Cá Hắc Long', 'Cá Thiên Long', 'Cá Ngân Hà', 'Cá Hỗn Mang', 'Cá Vương Giả'], drops: ['Vảy Leviathan', 'Tinh Thể Thiên Hà', 'Mảnh Hỗn Mang'] },
    Secret: { chance: 0.1, minPrice: 500000000, maxPrice: 100000000000, breakChance: 95, list: ['Cá Vũ Trụ', 'Kraken', 'Megalodon', 'Jormungandr', 'Cá Sáng Thế', 'Cá Tận Thế', 'Hắc Long Vương', 'Cá Void', 'Cá Origin', 'Cá Entity', 'Cá Null', 'Cthulhu', 'Titan Đại Dương', 'Quái Ngư Abyss', 'Rồng Biển Cổ Đại', 'Thần Ngư Poseidon', 'Leviathan', 'Leviathan Tận Thế', 'Kraken Hư Không', 'Cá Omega'], drops: ['Mảnh Void', 'Tinh Thể Origin', 'Lõi Entity', 'Mảnh Null'] }
};

// ==========================================
// DỮ LIỆU ĐÀI XỔ SỐ 3 MIỀN
// ==========================================
const XS_STATIONS = {
    'Bắc': [
        'Hà Nội', 'Bắc Ninh', 'Hải Phòng', 'Nam Định', 'Quảng Ninh'
    ],
    'Trung': [
        'Đà Nẵng', 'Khánh Hòa', 'Bình Định', 'Quảng Bình', 'Quảng Trị', 
        'Quảng Nam', 'Quảng Ngãi', 'Phú Yên', 'Gia Lai', 'Kon Tum', 
        'Đắk Lắk', 'Đắk Nông', 'Ninh Thuận', 'Thừa Thiên Huế'
    ],
    'Nam': [
        'TP. Hồ Chí Minh', 'An Giang', 'Bạc Liêu', 'Bến Tre', 'Bình Dương', 
        'Bình Phước', 'Bình Thuận', 'Cà Mau', 'Cần Thơ', 'Đà Lạt', 'Đồng Nai', 
        'Đồng Tháp', 'Hậu Giang', 'Kiên Giang', 'Long An', 'Sóc Trăng', 
        'Tây Ninh', 'Tiền Giang', 'Trà Vinh', 'Vĩnh Long', 'Vũng Tàu'
    ]
};
const ALL_XS_STATIONS = [...XS_STATIONS['Bắc'], ...XS_STATIONS['Trung'], ...XS_STATIONS['Nam']];

function ensureBalanceProxy(userObj, userId, guildId) {
    const desc = Object.getOwnPropertyDescriptor(userObj, 'balance');
    if (desc && typeof desc.get === 'function' && typeof desc.set === 'function') return;

    Object.defineProperty(userObj, 'balance', {
        enumerable: true,
        configurable: true,
        get() {
            return getBalance(userId, guildId);
        },
        set(value) {
            const guildData = getGuildData(guildId);
            guildData.balance[userId] = value;
            saveData();
        }
    });
}

function fishingGetUser(userId, guildId = 'global') {
    const guildData = getGuildData(guildId);

    if (!guildData.fishing[userId]) {
        guildData.fishing[userId] = {
            level: 1,
            exp: 0,
            inventory: {},
            maxInv: 50,
            zone: 'Ao Làng',
            equip: { rod: '🎣 Cần Tre', rodPlus: 0, dur: 10, line: null, hook: null, float: null, reel: null, bait: null },
            buffs: { luck: 0, drop: 0 },
            lastDaily: 0,
            lastChatMoney: 0
        };
        saveData();
    }

    const userObj = guildData.fishing[userId];
    ensureBalanceProxy(userObj, userId, guildId);

    if (userObj.lastDaily === undefined) userObj.lastDaily = 0;
    if (userObj.lastChatMoney === undefined) userObj.lastChatMoney = 0;
    if (!userObj.inventory) userObj.inventory = {};
    if (!userObj.equip) {
        userObj.equip = { rod: '🎣 Cần Tre', rodPlus: 0, dur: 10, line: null, hook: null, float: null, reel: null, bait: null };
    }
    if (!userObj.buffs) userObj.buffs = { luck: 0, drop: 0 };
    if (userObj.maxInv === undefined) userObj.maxInv = 50;
    if (!userObj.zone) userObj.zone = 'Ao Làng';
    if (userObj.level === undefined) userObj.level = 1;
    if (userObj.exp === undefined) userObj.exp = 0;

    return userObj;
}


function getFarmUser(userId, guildId = 'global') {
    const guildData = getGuildData(guildId);

    if (!guildData.farmUsers[userId]) {
        guildData.farmUsers[userId] = {
            energy: 100,
            inventory: {},
            farm: {
                maxPlots: 5,
                plots: [],
                animals: [],
                upgrades: {
                    greenhouse: false,
                    autoWater: false,
                    autoPest: false
                }
            }
        };
        saveData();
    }

    const userObj = guildData.farmUsers[userId];

    if (userObj.energy === undefined) userObj.energy = 100;
    if (!userObj.inventory) userObj.inventory = {};
    if (!userObj.farm) {
        userObj.farm = {
            maxPlots: 5,
            plots: [],
            animals: [],
            upgrades: {
                greenhouse: false,
                autoWater: false,
                autoPest: false
            }
        };
    }
    if (!userObj.farm.upgrades) {
        userObj.farm.upgrades = { greenhouse: false, autoWater: false, autoPest: false };
    }
    if (!userObj.farm.plots) userObj.farm.plots = [];
    if (!userObj.farm.animals) userObj.farm.animals = [];
    if (userObj.farm.maxPlots === undefined) userObj.farm.maxPlots = 5;

    if (!Object.getOwnPropertyDescriptor(userObj, 'money')) {
        Object.defineProperty(userObj, 'money', {
            enumerable: true,
            configurable: true,
            get() {
                return getBalance(userId, guildId);
            },
            set(value) {
                const guildData = getGuildData(guildId);
                guildData.balance[userId] = value;
                saveData();
            }
        });
    }

    return userObj;
}


// ==========================================
// HỆ THỐNG NÔNG TRẠI / GIAO DỊCH
// ==========================================
function formatMoney(v) {
    return `${Math.max(0, Math.floor(Number(v) || 0)).toLocaleString('vi-VN')} VNĐ`;
}

function getSeedKeyByHarvestName(harvestName) {
    return Object.entries(SEEDS).find(([, seed]) => seed.harvest === harvestName)?.[0] || null;
}

function seedLabel(seedKey) {
    return SEEDS[seedKey]?.name || seedKey;
}

function isBlockedTradeItemName(name) {
    const t = String(name || '').toLowerCase();
    return t.includes('tiền') || t.includes('money') || t.includes('vnđ') || t.includes('vnd') || t.includes('thuốc') || t.includes('máy');
}

function getTradableInventory(userData) {
    const items = [];
    for (const [name, qty] of Object.entries(userData.inventory || {})) {
        const nQty = Number(qty) || 0;
        if (nQty <= 0) continue;
        if (isBlockedTradeItemName(name)) continue;
        items.push({ name, qty: nQty });
    }
    items.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    return items;
}

function getFreeFarmSlots(userData) {
    return Math.max(0, (userData.farm?.maxPlots || 0) - (userData.farm?.plots?.length || 0));
}

function getPlotStage(plot) {
    const seed = SEEDS[plot.seedKey];
    if (!seed || !plot.plantedAt || !plot.readyAt) return '❓';
    const total = Math.max(1, plot.readyAt - plot.plantedAt);
    const elapsed = Date.now() - plot.plantedAt;
    const progress = Math.max(0, Math.min(1, elapsed / total));
    if (progress < 0.33) return '🌱 Mới gieo';
    if (progress < 0.66) return '🌿 Đang lớn';
    if (progress < 1) return '🌳 Trưởng thành';
    return '🍎 Có thể thu hoạch';
}

function buildPlotName(plot) {
    const seed = SEEDS[plot.seedKey];
    const harvested = seed?.harvest || plot.seedKey;
    return `${seed?.icon || '🌱'} ${harvested}`;
}

function updateFarmDiseaseState(userData, guildId) {
    if (!userData?.farm?.plots) return;
    const now = Date.now();
    const weather = globalWeather || { diseaseRate: 1 };
    const plots = userData.farm.plots;
    const greenhouse = !!userData.farm?.upgrades?.greenhouse;
    const autoPest = !!userData.farm?.upgrades?.autoPest;
    const keep = [];

    for (const plot of plots) {
        if (!plot || plot.dead) continue;

        if (plot.sick) {
            const sickFor = now - (plot.sickAt || now);
            if (sickFor >= 24 * 60 * 60 * 1000) {
                continue;
            }
            keep.push(plot);
            continue;
        }

        if (plot.diseaseCheckedAt && now - plot.diseaseCheckedAt < 30 * 60 * 1000) {
            keep.push(plot);
            continue;
        }

        const seed = SEEDS[plot.seedKey];
        if (!seed) continue;

        const total = Math.max(1, plot.readyAt - plot.plantedAt);
        const progress = Math.max(0, Math.min(1, (now - plot.plantedAt) / total));
        let baseRate = progress < 0.33 ? 0.01 : progress < 0.66 ? 0.03 : 0.05;

        if (weather.diseaseRate) baseRate *= weather.diseaseRate;
        if (greenhouse) baseRate *= 0.5;
        if (autoPest) baseRate *= 0.35;

        plot.diseaseCheckedAt = now;

        if (Math.random() < baseRate) {
            plot.sick = true;
            plot.sickAt = now;
        }

        keep.push(plot);
    }

    userData.farm.plots = keep;
    saveData();
}

function applyFarmGrowthMods(seedKey, baseTime, userData) {
    let time = baseTime;
    const weather = globalWeather || { growMultiplier: 1 };
    if (weather.growMultiplier && weather.growMultiplier > 0) {
        time = Math.round(time / weather.growMultiplier);
    }
    if (userData?.farm?.upgrades?.autoWater) {
        time = Math.round(time * 0.9);
    }
    return Math.max(30 * 1000, time);
}

function createCropOptionsFromPlots(userData) {
    const ready = {};
    const now = Date.now();
    for (const plot of userData.farm.plots) {
        if (!plot || plot.dead) continue;
        if (plot.sick) continue;
        if (now < plot.readyAt) continue;
        const key = plot.seedKey;
        ready[key] = (ready[key] || 0) + 1;
    }
    return ready;
}

function buildFarmStatusEmbed(userData, guildName) {
    updateFarmDiseaseState(userData);
    const now = Date.now();
    const cropsReady = createCropOptionsFromPlots(userData);
    const plots = userData.farm.plots || [];
    const animals = userData.farm.animals || [];
    const lines = plots.slice(0, 12).map((plot, idx) => {
        const seed = SEEDS[plot.seedKey];
        const total = Math.max(1, plot.readyAt - plot.plantedAt);
        const progress = Math.max(0, Math.min(100, Math.floor(((now - plot.plantedAt) / total) * 100)));
        const state = plot.sick ? '🐛 Bị bệnh' : (now >= plot.readyAt ? '🍎 Sẵn sàng' : `${getPlotStage(plot)} • ${progress}%`);
        return `**${idx + 1}.** ${seed?.icon || '🌱'} **${seed?.harvest || plot.seedKey}** — ${state}`;
    });

    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`🌾 NÔNG TRẠI CỦA ${guildName?.toUpperCase() || 'BẠN'}`)
        .setDescription([
            `⚡ Thể lực: **${userData.energy}/100**`,
            `💰 Tiền: **${formatMoney(userData.money)}**`,
            `🌦️ Thời tiết: **${globalWeather?.name || 'Không rõ'}**`,
            `🌱 Đất trồng: **${plots.length}/${userData.farm.maxPlots} ô**`,
            `🐔 Vật nuôi: **${animals.length} con**`,
            `🧺 Nông sản sẵn thu hoạch: **${Object.keys(cropsReady).length} loại**`
        ].join('\n'))
        .addFields(
            { name: '📦 Kho hạt giống', value: Object.keys(SEEDS).map(k => `${SEEDS[k].icon} ${seedLabel(k)}: **${userData.inventory[seedLabel(k)] || 0}**`).join('\n').slice(0, 1024), inline: true },
            { name: '🍗 Kho thức ăn', value: Object.keys(FOODS).map(k => `${FOODS[k].icon} ${FOODS[k].name}: **${userData.inventory[FOODS[k].name] || 0}**`).join('\n').slice(0, 1024), inline: true },
            { name: '🌱 Trạng thái ô đất', value: lines.length ? lines.join('\n').slice(0, 1024) : 'Chưa có cây nào.', inline: false }
        )
        .setFooter({ text: 'Dùng !shophatgiong, !plant, !thuhoach, !trade, !an để thao tác' });

    return embed;
}

function createOptionListForSelect(items, limit = 25) {
    return items.slice(0, limit).map((item) => ({
        label: item.label.slice(0, 100),
        description: (item.description || '').slice(0, 100),
        value: item.value.slice(0, 100),
        emoji: item.emoji
    }));
}

function buildQuantityModal(customId, title, label, value = '1', placeholder = '') {
    const modal = new ModalBuilder()
        .setCustomId(customId)
        .setTitle(title.slice(0, 45));

    const qtyInput = new TextInputBuilder()
        .setCustomId('qty')
        .setLabel(label.slice(0, 45))
        .setStyle(TextInputStyle.Short)
        .setValue(String(value));

    if (placeholder) qtyInput.setPlaceholder(placeholder.slice(0, 100));

    modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
    return modal;
}

function getTradeStore(guildData) {
    if (!guildData.tradeSessions) guildData.tradeSessions = {};
    if (!guildData.tradeDrafts) guildData.tradeDrafts = {};
    if (!guildData.farmSellSessions) guildData.farmSellSessions = {};
    return guildData.tradeSessions;
}

function buildTradeEmbed(session) {
    const offerA = session.offers[session.userA] || { items: {}, confirmed: false };
    const offerB = session.offers[session.userB] || { items: {}, confirmed: false };
    const fmt = (offer) => {
        const entries = Object.entries(offer.items || {});
        return entries.length ? entries.map(([name, qty]) => `• ${name}: **${qty}**`).join('\n') : '— Trống —';
    };

    return new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🔁 GIAO DỊCH FARM')
        .setDescription(`👤 **Bên A:** <@${session.userA}>\n👤 **Bên B:** <@${session.userB}>\n\n⏳ Trạng thái: **${session.status}**`)
        .addFields(
            { name: `Bên A ${offerA.confirmed ? '✅' : '⏳'}`, value: fmt(offerA).slice(0, 1024), inline: true },
            { name: `Bên B ${offerB.confirmed ? '✅' : '⏳'}`, value: fmt(offerB).slice(0, 1024), inline: true }
        )
        .setFooter({ text: 'Không thể trade tiền, thuốc và máy' });
}

function buildTradeComponents(session) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade_add_${session.id}`).setLabel('➕ Thêm đồ').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`trade_confirm_${session.id}`).setLabel('✅ Xác nhận').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade_cancel_${session.id}`).setLabel('❌ Hủy').setStyle(ButtonStyle.Danger)
    );
    return [row1];
}

async function refreshTradeMessage(client, guildId, session) {
    try {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) return;
        const channel = await guild.channels.fetch(session.channelId).catch(() => null);
        if (!channel) return;
        const msg = await channel.messages.fetch(session.messageId).catch(() => null);
        if (!msg) return;
        await msg.edit({ embeds: [buildTradeEmbed(session)], components: buildTradeComponents(session) }).catch(() => {});
    } catch (e) {}
}

function makeSeedShopComponents() {
    const options = Object.keys(SEEDS).map(key => ({
        label: SEEDS[key].name,
        description: `Giá ${formatMoney(SEEDS[key].price)} • ${Math.round(SEEDS[key].time / 60000)} phút`,
        value: key,
        emoji: SEEDS[key].icon
    }));
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_seed_buy')
                .setPlaceholder('Chọn hạt giống muốn mua...')
                .addOptions(createOptionListForSelect(options))
        )
    ];
}

function makePlantComponents(userData) {
    const availableSeeds = Object.keys(SEEDS).filter(key => (userData.inventory[seedLabel(key)] || 0) > 0);
    const options = availableSeeds.map(key => ({
        label: SEEDS[key].name,
        description: `Đang có: ${userData.inventory[seedLabel(key)] || 0} hạt`,
        value: key,
        emoji: SEEDS[key].icon
    }));
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_seed_plant')
                .setPlaceholder('Chọn hạt giống để gieo...')
                .addOptions(createOptionListForSelect(options))
        )
    ];
}

function makeHarvestComponents(userData) {
    const ready = createCropOptionsFromPlots(userData);
    const options = [{ label: '🌾 Thu hoạch tất cả', description: 'Thu hoạch mọi cây đã chín', value: 'all', emoji: '🌾' }];
    for (const [seedKey, count] of Object.entries(ready)) {
        options.push({
            label: SEEDS[seedKey].name,
            description: `Đã chín: ${count} ô`,
            value: seedKey,
            emoji: SEEDS[seedKey].icon
        });
    }
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_harvest_crop')
                .setPlaceholder('Chọn cây muốn thu hoạch...')
                .addOptions(createOptionListForSelect(options))
        )
    ];
}

function makeFoodComponents(userData) {
    const availableFood = Object.keys(FOODS).filter(key => (userData.inventory[FOODS[key].name] || 0) > 0);
    const options = availableFood.map(key => ({
        label: FOODS[key].name,
        description: `Hồi +${FOODS[key].energy} thể lực • Có: ${userData.inventory[FOODS[key].name] || 0}`,
        value: key,
        emoji: FOODS[key].icon
    }));
    return [
        new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_food_eat')
                .setPlaceholder('Chọn món ăn...')
                .addOptions(createOptionListForSelect(options))
        )
    ];
}

function harvestPlotsBySeed(userData, seedKey, qty) {
    updateFarmDiseaseState(userData);
    const now = Date.now();
    const matched = [];
    for (let i = 0; i < userData.farm.plots.length; i++) {
        const p = userData.farm.plots[i];
        if (!p || p.dead || p.sick) continue;
        if (p.seedKey !== seedKey) continue;
        if (now < p.readyAt) continue;
        matched.push(i);
    }

    const take = Math.max(0, Math.min(qty, matched.length));
    const removed = [];
    for (let i = take - 1; i >= 0; i--) {
        removed.push(userData.farm.plots.splice(matched[i], 1)[0]);
    }

    const seed = SEEDS[seedKey];
    const isRare = Math.random() < 0.06;
    const isMutation = Math.random() < 0.01;
    const mult = isMutation ? 3 : (isRare ? 2 : 1);
    const total = removed.length * Math.max(1, seed.yield || 1) * mult;

    if (total > 0) {
        userData.inventory[seed.harvest] = (userData.inventory[seed.harvest] || 0) + total;
    }
    return { removedCount: removed.length, gained: total, isRare, isMutation };
}

function plantSeeds(userData, seedKey, qty) {
    updateFarmDiseaseState(userData);
    const free = getFreeFarmSlots(userData);
    const have = userData.inventory[seedLabel(seedKey)] || 0;
    const take = Math.max(0, Math.min(qty, free, have));
    if (take <= 0) return { planted: 0, reason: 'Không còn ô trống hoặc không đủ hạt giống.' };

    const seed = SEEDS[seedKey];
    const totalTime = applyFarmGrowthMods(seedKey, seed.time, userData);
    const now = Date.now();
    for (let i = 0; i < take; i++) {
        userData.farm.plots.push({
            id: `${seedKey}_${now}_${Math.random().toString(36).slice(2, 8)}`,
            seedKey,
            plantedAt: now,
            readyAt: now + totalTime,
            watered: false,
            fertilized: false,
            sick: false,
            sickAt: null,
            diseaseCheckedAt: now,
            dead: false
        });
    }
    userData.inventory[seedLabel(seedKey)] = have - take;
    return { planted: take, readyAt: now + totalTime };
}

function feedUser(userData, foodKey, qty) {
    const food = FOODS[foodKey];
    const have = userData.inventory[food.name] || 0;
    const take = Math.max(0, Math.min(qty, have));
    if (take <= 0) return { eaten: 0, energyGained: 0 };
    userData.inventory[food.name] = have - take;
    const energy = take * food.energy;
    userData.energy = Math.min(100, (userData.energy || 0) + energy);
    return { eaten: take, energyGained: energy };
}

function getFarmOverviewText(userData) {
    updateFarmDiseaseState(userData);
    const ready = createCropOptionsFromPlots(userData);
    const plots = userData.farm.plots || [];
    return `🌱 Ô đất: **${plots.length}/${userData.farm.maxPlots}**\n🧺 Loại cây chín: **${Object.keys(ready).length}**\n⚡ Thể lực: **${userData.energy}/100**\n💰 Tiền: **${formatMoney(userData.money)}**`;
}

function getSellableCropEntries(userData) {
    const items = [];
    for (const [seedKey, seed] of Object.entries(SEEDS)) {
        const cropName = seed.harvest;
        const qty = Number(userData.inventory?.[cropName] || 0);
        if (qty <= 0) continue;
        const price = currentMarketPrices[cropName] ?? MARKET_BASE_PRICES[cropName] ?? 0;
        items.push({
            seedKey,
            cropName,
            qty,
            price
        });
    }
    return items.sort((a, b) => a.cropName.localeCompare(b.cropName, 'vi'));
}

function buildBanSellComponents(userData, sessionId) {
    const crops = getSellableCropEntries(userData);
    const options = crops.slice(0, 25).map((item) => ({
        label: `${SEEDS[item.seedKey]?.icon || '🌾'} ${item.cropName}`,
        description: `Có ${item.qty} • Giá ${formatMoney(item.price)}`,
        value: item.seedKey
    }));

    const select = new StringSelectMenuBuilder()
        .setCustomId(`ban_select_${sessionId}`)
        .setPlaceholder('Chọn nhiều loại cây muốn bán...')
        .setMinValues(1)
        .setMaxValues(Math.max(1, options.length))
        .addOptions(createOptionListForSelect(options));

    const row1 = new ActionRowBuilder().addComponents(select);
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`ban_confirm_${sessionId}`).setLabel('💸 Bán').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`ban_clear_${sessionId}`).setLabel('🧹 Bỏ chọn').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`ban_cancel_${sessionId}`).setLabel('❌ Hủy').setStyle(ButtonStyle.Danger)
    );

    return [row1, row2];
}

function buildBanSellEmbed(userData, session) {
    const selected = Array.isArray(session?.selected) ? session.selected : [];
    const crops = getSellableCropEntries(userData);
    const selectedEntries = crops.filter(item => selected.includes(item.seedKey));
    let estimatedTotal = 0;
    for (const item of selectedEntries) {
        estimatedTotal += item.qty * item.price;
    }

    const descParts = [
        'Chọn nhiều loại cây trồng để bán cùng lúc.',
        'Khi bấm **💸 Bán**, bot sẽ bán toàn bộ số lượng của những loại bạn đã chọn.'
    ];

    if (specialMerchant?.active && specialMerchant.item) {
        descParts.push(`⭐ Thương nhân đang thu mua cao: **${specialMerchant.item}** x${Number(specialMerchant.multiplier || 1).toFixed(1)}`);
    }

    const selectedText = selectedEntries.length
        ? selectedEntries.map(item => `• ${SEEDS[item.seedKey]?.icon || '🌾'} **${item.cropName}** ×${item.qty} → **${formatMoney(item.price * item.qty)}**`).join('\n')
        : 'Chưa chọn cây nào.';

    const availableText = crops.length
        ? crops.slice(0, 8).map(item => `• ${SEEDS[item.seedKey]?.icon || '🌾'} **${item.cropName}**: **${item.qty}**  |  ${formatMoney(item.price)}/cây`).join('\n')
        : 'Không có nông sản nào trong kho.';

    return new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🛒 BÁN NÔNG SẢN')
        .setDescription(descParts.join('\n'))
        .addFields(
            { name: '📦 Đang có thể bán', value: availableText.slice(0, 1024), inline: false },
            { name: '✅ Đã chọn', value: selectedText.slice(0, 1024), inline: false },
            { name: '💰 Tạm tính', value: `**${formatMoney(estimatedTotal)}**`, inline: false }
        )
        .setFooter({ text: 'Giá thay đổi theo thị trường mỗi giờ' });
}

function getBanSessionStore(guildData) {
    if (!guildData.farmSellSessions) guildData.farmSellSessions = {};
    return guildData.farmSellSessions;
}
// ==========================================
// HỆ THỐNG TẢI TỪ ĐIỂN NỐI TỪ
// ==========================================
const vtWords = new Set();
const dictionaryFiles = ['Tudien.txt', 'Tudien2.txt', 'Tudien3.txt'];

let totalLoaded = 0;

for (const dictionaryFile of dictionaryFiles) {
    if (fs.existsSync(`./${dictionaryFile}`)) {
        const content = fs.readFileSync(`./${dictionaryFile}`, 'utf8');
        const lines = content.split(/\r?\n/);
        let count = 0;

        for (const line of lines) {
            const word = line.trim().toLowerCase();
            if (word) {
                if (!vtWords.has(word)) {
                    vtWords.add(word);
                    count++;
                }
            }
        }

        totalLoaded += count;
        console.log(`[NỐI TỪ] Đã nạp thành công ${count} từ từ file ${dictionaryFile}.`);
    } else {
        console.log(`[⚠️ CẢNH BÁO] Không tìm thấy file ${dictionaryFile}! Vui lòng tải file vào thư mục.`);
    }
}

console.log(`[NỐI TỪ - TỔNG KẾT] Đã tải tổng cộng ${vtWords.size} từ vựng vào bộ nhớ!`);

const PREFIX = '!';
const ADMIN_ID = '1020868400672686080';

client.once('ready', async () => {
    console.log(`🤖 Bot Game All-In-One Sẵn Sàng: ${client.user.tag}`);
    try {
        
        setInterval(async () => {
            for (const guildId in db.guilds) {
                const guildData = db.guilds[guildId];
                const guild = client.guilds.cache.get(guildId);
                if (!guild) continue;

                const prisonRole = guild.roles.cache.get(guildData.prisonConfig?.roleId);
                const prisonChannel = guild.channels.cache.get(guildData.prisonConfig?.channelId);

                // ==========================================
                // 1. KIỂM TRA ĐÒI NỢ (Quá hạn -> Bỏ tù)
                // ==========================================
                if (guildData.debts && Object.keys(guildData.debts).length > 0) {
                    for (const userId in guildData.debts) {
                        const debt = guildData.debts[userId];
                        
                        // Quá thời hạn vay mà chưa trả
                        if (Date.now() >= debt.deadline) {
                            const factor = debt.factor;
                            const prisonHours = factor * 5; // Tù 5 tiếng x factor
                            
                            // Tạo hồ sơ tù nhân
                            guildData.prisonUsers[userId] = {
                                releaseTime: Date.now() + (prisonHours * 60 * 60 * 1000),
                                tasks: {
                                    quet_rac: { current: 0, required: factor },
                                    trong_rau: { current: 0, required: factor },
                                    ve_sinh: { current: 0, required: factor },
                                    cho_heo_an: { current: 0, required: factor }
                                }
                            };

                            // Gắn role tù nhân
                            try {
                                const member = await guild.members.fetch(userId).catch(() => null);
                                if (member && prisonRole) {
                                    await member.roles.add(prisonRole).catch(() => {});
                                }
                            } catch(e) {}

                            // Xóa nợ do đã quy đổi thành hình phạt tù
                            delete guildData.debts[userId];
                            saveData();

                            // Thông báo ra kênh nhà tù
                            if (prisonChannel) {
                                prisonChannel.send(`🚨 **CẢNH BÁO TÍN DỤNG ĐEN** 🚨\n<@${userId}> đã bùng khoản nợ **${debt.amount.toLocaleString()} VNĐ**! Hệ thống đã bắt giữ và tống giam đối tượng trong **${prisonHours} giờ** để lao động trừ nợ!`);
                            }
                        }
                    }
                }

                // ==========================================
                // 2. KIỂM TRA HẾT HẠN TÙ (Được thả tự do)
                // ==========================================
                if (guildData.prisonUsers && Object.keys(guildData.prisonUsers).length > 0) {
                    for (const userId in guildData.prisonUsers) {
                        const prisonData = guildData.prisonUsers[userId];
                        
                        if (Date.now() >= prisonData.releaseTime) {
                            try {
                                const member = await guild.members.fetch(userId).catch(() => null);
                                if (member && prisonRole) {
                                    await member.roles.remove(prisonRole).catch(() => {});
                                }
                            } catch(e) {}
                            
                            delete guildData.prisonUsers[userId];
                            saveData();

                            if (prisonChannel) {
                                prisonChannel.send(`⏰ <@${userId}> đã mãn hạn tù công ích, được trả tự do! Lần sau nhớ trả nợ đúng hạn nhé.`);
                            }
                        }
                    }
                }
                
            }
        }, 60000); // Quét mỗi 1 phút
        
           cron.schedule('0 17 * * *', async () => {
    console.log('⏳ Hệ thống bắt đầu tiến hành mở thưởng xổ số Đa Đài...');
    
    for (const guildId in db.guilds) {
        const guildData = db.guilds[guildId];
        if (!guildData.lotteryConfig || !guildData.lotteryConfig.dais || guildData.lotteryConfig.dais.length === 0 || !guildData.lotteryConfig.channelId) continue;
        
        const channel = client.channels.cache.get(guildData.lotteryConfig.channelId);
        if (!channel) continue;

        const dais = guildData.lotteryConfig.dais;
        const results = {};

        // 1. Quay số ngẫu nhiên độc lập cho từng đài đã chọn
        dais.forEach(dai => {
            results[dai] = {
                g8: [randDigits(2)],
                g7: [randDigits(3)],
                g6: [randDigits(4), randDigits(4), randDigits(4)],
                g5: [randDigits(4)],
                g4: [randDigits(5), randDigits(5), randDigits(5), randDigits(5), randDigits(5), randDigits(5), randDigits(5)],
                g3: [randDigits(5), randDigits(5)],
                g2: [randDigits(5)],
                g1: [randDigits(5)],
                gdb: randDigits(6)
            };
        });

        const prizeMoney = {
            g8: 100000, g7: 200000, g6: 400000, g5: 1000000, g4: 3000000, 
            g3: 10000000, g2: 15000000, g1: 30000000, gdb: 2000000000,
            gphu: 50000000, gkk: 6000000
        };

        let winnersLog = [];

        // 2. Tiến hành dò số đa đài cho từng người chơi
        if (guildData.lotteryUsers) {
            for (const [userId, userLottery] of Object.entries(guildData.lotteryUsers)) {
                let userTotalWin = 0;
                let winningTicketsCount = 0;
                let winDetails = [];

                for (const [daiName, tickets] of Object.entries(userLottery)) {
                    if (!results[daiName] || !tickets || tickets.length === 0) continue;
                    const res = results[daiName];

                    tickets.forEach(ticket => {
                        let isTicketWon = false;

                        const checkPrize = (resArray, prizeName, money) => {
                            for (let r of resArray) {
                                if (ticket.endsWith(r)) {
                                    userTotalWin += money;
                                    winDetails.push(`giải ${prizeName} đài ${daiName} (\`${ticket}\`)`);
                                    isTicketWon = true;
                                }
                            }
                        };

                        checkPrize(res.g8, 'Tám', prizeMoney.g8);
                        checkPrize(res.g7, 'Bảy', prizeMoney.g7);
                        checkPrize(res.g6, 'Sáu', prizeMoney.g6);
                        checkPrize(res.g5, 'Năm', prizeMoney.g5);
                        checkPrize(res.g4, 'Tư', prizeMoney.g4);
                        checkPrize(res.g3, 'Ba', prizeMoney.g3);
                        checkPrize(res.g2, 'Nhì', prizeMoney.g2);
                        checkPrize(res.g1, 'Nhất', prizeMoney.g1);

                        if (ticket === res.gdb) {
                            userTotalWin += prizeMoney.gdb;
                            winDetails.push(`Đặc Biệt đài ${daiName} (\`${ticket}\`)`);
                            isTicketWon = true;
                        } else {
                            if (ticket.slice(1) === res.gdb.slice(1)) {
                                userTotalWin += prizeMoney.gphu;
                                winDetails.push(`Phụ ĐB đài ${daiName} (\`${ticket}\`)`);
                                isTicketWon = true;
                            } else {
                                let matchCount = 0;
                                for (let i = 0; i < 6; i++) {
                                    if (ticket[i] === res.gdb[i]) matchCount++;
                                }
                                if (matchCount === 5) {
                                    userTotalWin += prizeMoney.gkk;
                                    winDetails.push(`Khuyến Khích đài ${daiName} (\`${ticket}\`)`);
                                    isTicketWon = true;
                                }
                            }
                        }

                        if (isTicketWon) winningTicketsCount++;
                    });
                }

                if (userTotalWin > 0) {
                    addBalance(userId, userTotalWin, guildId);
                    winnersLog.push(`• <@${userId}> trúng tổng cộng **${winningTicketsCount} vé**, nhận thưởng: **${userTotalWin.toLocaleString()} VNĐ**\n  ↳ *Chi tiết:* ${winDetails.join(', ')}`);
                }
            }

            // Tự động xóa dữ liệu vé cũ để chuẩn bị vòng lặp mới
            guildData.lotteryUsers = {};
            saveData();
        }

        // 3. UI BẢNG KẾT QUẢ ĐÃ SỬA LỖI CHO 3-4 ĐÀI
        const embedResult = new EmbedBuilder()
            .setTitle(`📢 BẢNG KẾT QUẢ XỔ SỐ KIẾN THIẾT ĐA ĐÀI 📢`)
            .setColor('#e74c3c')
            .setDescription(`**Các tỉnh mở thưởng hôm nay:** ${dais.map(d => `**${d}**`).join(' ⇄ ')}`)
            .setTimestamp();

        const prizesOrder = [
            { key: 'g8', name: 'Giải Tám (2 chữ số)' },
            { key: 'g7', name: 'Giải Bảy (3 chữ số)' },
            { key: 'g6', name: 'Giải Sáu (4 chữ số)' },
            { key: 'g5', name: 'Giải Năm (4 chữ số)' },
            { key: 'g4', name: 'Giải Tư (5 chữ số)' },
            { key: 'g3', name: 'Giải Ba (5 chữ số)' },
            { key: 'g2', name: 'Giải Nhì (5 chữ số)' },
            { key: 'g1', name: 'Giải Nhất (5 chữ số)' },
            { key: 'gdb', name: '💥 GIẢI ĐẶC BIỆT (6 chữ số) 💥' }
        ];

        prizesOrder.forEach(p => {
            // Đã đổi từ join(' | ') sang join('\n') để tránh lỗi dàn trang khi có quá nhiều đài
            let rowContent = dais.map(dai => {
                const val = results[dai][p.key];
                const cleanVal = Array.isArray(val) ? val.join(' - ') : val;
                return `**[${dai.substring(0, 7)}]** \`${cleanVal}\``;
            }).join('\n');

            // Cắt chuỗi ở mức 1024 ký tự để đề phòng Discord chặn gửi tin nhắn (Discord API Limit)
            embedResult.addFields({ name: `🔹 ${p.name}`, value: rowContent.substring(0, 1024), inline: false });
        });

        await channel.send({ embeds: [embedResult] });

        // 4. Tag thông báo cụ thể danh sách người chiến thắng
        if (winnersLog.length > 0) {
            // Nếu winner log quá dài cũng có thể lỗi, cắt mảng nếu cần thiết
            const maxMsgLength = 1900;
            let currentMsg = `🎉 **CHÚC MỪNG CÁC TỶ PHÚ NGÀY HÔM NAY:**\n`;
            
            for (const log of winnersLog) {
                if (currentMsg.length + log.length > maxMsgLength) {
                    await channel.send(currentMsg);
                    currentMsg = `${log}\n`;
                } else {
                    currentMsg += `${log}\n`;
                }
            }
            if (currentMsg.trim() !== '') await channel.send(currentMsg);
            
        } else {
            await channel.send('😢 Kết quả đối chiếu: Hôm nay không có ai may mắn trúng số cả. Hẹn mọi người vào đài quay ngày mai nhé!');
        }
    }
}, { timezone: "Asia/Ho_Chi_Minh" });

// Hệ thống Thời tiết & Thị trường (Chạy mỗi 1 giờ)
cron.schedule('0 * * * *', () => {
    // 1. CẬP NHẬT THỜI TIẾT
    const r = Math.random();
    if (r < 0.40) globalWeather = { name: '☀️ Nắng đẹp', growMultiplier: 1.1, diseaseRate: 1.0 };
    else if (r < 0.65) globalWeather = { name: '🌧️ Mưa', growMultiplier: 1.2, diseaseRate: 1.0 };
    else if (r < 0.80) globalWeather = { name: '🌥️ Âm u', growMultiplier: 1.0, diseaseRate: 1.0 };
    else if (r < 0.90) globalWeather = { name: '🌬️ Gió mạnh', growMultiplier: 0.9, diseaseRate: 1.0 };
    else if (r < 0.95) globalWeather = { name: '🔥 Nắng nóng', growMultiplier: 0.8, diseaseRate: 1.0 };
    else if (r < 0.98) globalWeather = { name: '⛈️ Bão', growMultiplier: 1.0, diseaseRate: 1.0 };
    else globalWeather = { name: '🐛 Mùa sâu bệnh', growMultiplier: 1.0, diseaseRate: 2.0 };
    
    // 2. CẬP NHẬT GIÁ CHỢ (Dao động ngẫu nhiên từ -10% đến +10%)
    const items = Object.keys(MARKET_BASE_PRICES);
    for (const item of items) {
        const base = MARKET_BASE_PRICES[item];
        // Tính tỷ lệ dao động từ -0.1 đến +0.1
        const fluctuation = (Math.random() * 0.2) - 0.1; 
        currentMarketPrices[item] = Math.round(base * (1 + fluctuation));
    }

    // 3. THƯƠNG NHÂN ĐẶC BIỆT (30% xuất hiện mỗi giờ, thu mua 1 món giá x1.5 đến x2)
    specialMerchant.active = false;
    specialMerchant.item = null;
    if (Math.random() < 0.30) {
        specialMerchant.active = true;
        // Chọn ngẫu nhiên 1 mặt hàng
        const randomItem = items[Math.floor(Math.random() * items.length)];
        specialMerchant.item = randomItem;
        specialMerchant.multiplier = 1.5 + (Math.random() * 0.5); // x1.5 đến x2.0
        
        // Cập nhật giá thu mua đặc biệt luôn vào bảng giá hiện tại
        currentMarketPrices[randomItem] = Math.round(MARKET_BASE_PRICES[randomItem] * specialMerchant.multiplier);
    }

    console.log(`[HỆ THỐNG] Đã cập nhật Thời tiết: ${globalWeather.name} và Biến động giá Chợ.`);
});


        const slashCommands = [
            {
                name: 'give',
                description: 'Tặng tiền cho người dùng khác',
                options: [
                    { name: 'user', description: 'Người nhận', type: ApplicationCommandOptionType.User, required: true },
                    { name: 'money', description: 'Số tiền', type: ApplicationCommandOptionType.Integer, required: true }
                ]
            },
            {
                name: 'buff',
                description: 'Lệnh Admin: Bơm tiền ẩn danh',
                options: [
                    { name: 'user', description: 'Chọn người nhận', type: ApplicationCommandOptionType.User, required: true },
                    { name: 'money', description: 'Số tiền cấp', type: ApplicationCommandOptionType.Integer, required: true }
                ]
            },
            {
                name: 'sell',
                description: 'Lệnh Admin: Thêm role vào Cửa Hàng (Shop)',
                options: [
                    { name: 'role', description: 'Chọn role muốn bán', type: ApplicationCommandOptionType.Role, required: true },
                    { name: 'price', description: 'Mức giá bán ra (VNĐ)', type: ApplicationCommandOptionType.Integer, required: true },
                    { name: 'code', description: 'Mã số hàng hóa (VD: 404)', type: ApplicationCommandOptionType.String, required: true }
                ]
            },
            { name: 'nangcap', description: 'Nâng cấp chỉ số cần câu (+1, +2...)', options: [] },
            { name: 'update', description: 'Lò rèn: Chế tạo/Tiến hóa Cần Câu (Cần có nguyên liệu)', options: [] },
            {
                name: 'rest',
                description: 'Lệnh Admin: Thu hồi nợ/tịch thu tiền của Member',
                options: [
                    { name: 'user', description: 'Người bị thu hồi', type: ApplicationCommandOptionType.User, required: true },
                    { name: 'money', description: 'Số tiền thu', type: ApplicationCommandOptionType.Integer, required: true }
                ]
            },
            {
                name: 'capquyenkenh',
                description: 'Cài đặt kênh nhà tù và role hình phạt (Chỉ Admin/Owner)',
                options: [
                    { name: 'nha_tu', description: 'Chọn kênh văn bản làm khu vực nhà tù công ích', type: ApplicationCommandOptionType.Channel, required: true },
                    { name: 'role', description: 'Chọn role sẽ bị gắn khi người dùng bị bỏ tù', type: ApplicationCommandOptionType.Role, required: true }
                ]
            },
            {
                name: 'borrow',
                description: 'Vay tiền ngân hàng (Trả gấp 10 lần trong 15 phút, quá hạn sẽ bị đi tù)',
                options: [
                    { name: 'money', description: 'Số tiền muốn vay', type: ApplicationCommandOptionType.Integer, required: true }
                ]
            },
            { name: 'trano', description: 'Thanh toán nợ tín dụng đen (Trả x10 số tiền đã vay ban đầu)', options: [] },
            {
                name: 'broadcast',
                description: 'Lệnh Admin: Trợ cấp tiền đồng loạt theo Role',
                options: [
                    { name: 'role', description: 'Role nhận tiền', type: ApplicationCommandOptionType.Role, required: true },
                    { name: 'money', description: 'Số tiền trợ cấp', type: ApplicationCommandOptionType.Integer, required: true }
                ]
            },
            {
                name: 'doino',
                description: 'Lệnh Chủ Bot: Đòi nợ khẩn cấp và thiết lập thời gian chót (phút)',
                options: [
                    { name: 'phut', description: 'Số phút cuối cùng trước khi tất cả con nợ bị bỏ tù', type: ApplicationCommandOptionType.Integer, required: true }
                ]
            },
            {
                name: 'tratudo',
                description: 'Lệnh Admin/Owner: Đặc xá, trả tự do ngay lập tức cho 1 người đang ở tù',
                options: [
                    { name: 'user', description: 'Chọn người dùng muốn trả tự do', type: ApplicationCommandOptionType.User, required: true }
                ]
            },
            {
                name: 'dailyveso',
                description: 'Cài đặt các đài xổ số và kênh báo kết quả (Chỉ Admin/Owner)',
                default_member_permissions: '8',
                options: [
                    {
                        name: 'mien',
                        description: 'Chọn khu vực miền',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                        choices: [
                            { name: 'Miền Bắc (5 đài)', value: 'Bắc' },
                            { name: 'Miền Trung (14 đài)', value: 'Trung' },
                            { name: 'Miền Nam (21 đài)', value: 'Nam' }
                        ]
                    },
                    {
                        name: 'kenhbaotrung',
                        description: 'Chọn kênh văn bản để bot tự động báo kết quả',
                        type: ApplicationCommandOptionType.Channel,
                        required: true,
                        channel_types: [0]
                    },
                    { name: 'dai1', description: 'Chọn đài xổ số thứ 1 (Bắt buộc)', type: ApplicationCommandOptionType.String, required: true, autocomplete: true },
                    { name: 'dai2', description: 'Chọn đài xổ số thứ 2 (Tùy chọn)', type: ApplicationCommandOptionType.String, required: false, autocomplete: true },
                    { name: 'dai3', description: 'Chọn đài xổ số thứ 3 (Tùy chọn)', type: ApplicationCommandOptionType.String, required: false, autocomplete: true },
                    { name: 'dai4', description: 'Chọn đài xổ số thứ 4 (Tùy chọn)', type: ApplicationCommandOptionType.String, required: false, autocomplete: true }
                ]
            }
        ];
        await client.application.commands.set(slashCommands);
        await Promise.all([...client.guilds.cache.values()].map(guild => guild.commands.set(slashCommands).catch(() => null)));
    } catch (e) {
        console.error(e);
    }
});
// ==========================================
// HỆ THỐNG LỆNH TIN NHẮN (PREFIX COMMANDS)
// ==========================================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    const userId = message.author.id;
    const guildId = message.guild?.id || 'global';
    const guildData = getGuildData(guildId);
    const userData = getFarmUser(userId, guildId);
// Nếu user chưa có data nông trại thì thêm vào
if (!userData.farm) {
    userData.energy = 100; // Thể lực tối đa 100
    userData.farm = {
        maxPlots: 5, // Số ô đất
        plots: [],   // Chứa các cây đang gieo { seedId: 'luami', plantTime: Date.now(), watered: false, sick: false }
        animals: [], // Chứa động vật đang nuôi
        upgrades: {
            greenhouse: false,
            autoWater: false,
            autoPest: false
        }
    };
}

    // ---------------------------------------------------------
    // [THÊM MỚI] CHẶN COPY TIN NHẮN BOT TRONG GAME MA SÓI
    // ---------------------------------------------------------
    if (activeGames.masoi && activeGames.masoi.has(guildId)) {
        const game = activeGames.masoi.get(guildId);

        // Chỉ kiểm tra người đang tham gia ván và chỉ chặn khi copy gần nguyên văn
        if (game.players.includes(userId) && isCopiedBotMessage(message.content)) {
            await message.delete().catch(() => {});
            const warnMsg = await message.reply(
                `🚨 **CẢNH BÁO GIAN LẬN!** 🚨\n<@${userId}> đã copy gần nguyên văn tin nhắn vai trò của bot.\n⛔ Tin nhắn đã bị chặn, nhưng **ván Ma Sói vẫn tiếp tục chạy bình thường**.`
            ).catch(() => null);

            if (warnMsg) {
                setTimeout(() => {
                    warnMsg.delete().catch(() => {});
                }, 5000);
            }

            return;
        }
    }

    if (!guildData.lastChatMoney[userId] || Date.now() - guildData.lastChatMoney[userId] >= 240000) {
        guildData.lastChatMoney[userId] = Date.now();
        saveData();
        addBalance(userId, 15, guildId);
    }

    if (typeof activeGames !== 'undefined' && !activeGames.noitu) {
        activeGames.noitu = new Map();
    }

    // GAME NỐI TỪ TỰ ĐỘNG KHI CHAT
    if (typeof activeGames !== 'undefined' && activeGames.noitu && activeGames.noitu.has(message.channel.id) && !message.content.startsWith(PREFIX)) {
        const game = activeGames.noitu.get(message.channel.id);
        const input = message.content.trim().toLowerCase();

        if (game.lastUserId === message.author.id) {
            return message.reply('⚠️ Bạn vừa nối rồi, hãy đợi người khác nối tiếp nhé!').then(m => setTimeout(() => m.delete(), 3000));
        }

        if (!vtWords.has(input)) {
            return message.reply('<a:emoji_76:1524195723996823612> Từ này không có trong từ điển Tiếng Việt hợp lệ! Chữ khác đi nào.').then(m => setTimeout(() => m.delete(), 4000));
        }

        if (game.usedWords.has(input)) {
            return message.reply('<a:emoji_76:1524195723996823612> Từ này đã được sử dụng trước đó trong trận này rồi!').then(m => setTimeout(() => m.delete(), 4000));
        }

        const currentWordsArr = game.currentWord.split(' ');
        const lastSyllableOfCurrent = currentWordsArr[currentWordsArr.length - 1]; 
        
        const inputWordsArr = input.split(' ');
        const firstSyllableOfInput = inputWordsArr[0]; 

        if (lastSyllableOfCurrent !== firstSyllableOfInput) {
            return message.reply(`<a:emoji_76:1524195723996823612> Sai luật rồi! Bạn phải tìm từ bắt đầu bằng chữ **"${lastSyllableOfCurrent.toUpperCase()}"**.`);
        }

        game.currentWord = input;
        game.lastUserId = message.author.id;
        game.usedWords.add(input);

        const reward = 150;
        addBalance(message.author.id, reward, guildId);
        const nextSyllableTarget = inputWordsArr[inputWordsArr.length - 1];
        
        await message.react('<a:emoji_75:1524039622668189806> ');
        return message.reply(`🎉 **Chính xác!** <@${message.author.id}> nhận được **+${reward.toLocaleString()}💸 VNĐ**\n👉 Từ hiện tại: **${input.toUpperCase()}**\n👉 Người tiếp theo nối chữ: **${nextSyllableTarget.toUpperCase()}**`);
    }
  
    if (!message.content.startsWith(PREFIX)) return;
    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

        // ==========================================
    // HỆ THỐNG KIỂM TRA & LÀM NHIỆM VỤ NHÀ TÙ
    // ==========================================
    if (guildData.prisonUsers && guildData.prisonUsers[userId]) {
        const prisonData = guildData.prisonUsers[userId];
        const prisonRole = message.guild.roles.cache.get(guildData.prisonConfig?.roleId);

        // 1. Kiểm tra: Nếu hết thời gian phạt tù (Tự động gỡ án khi có tương tác chat)
        if (Date.now() >= prisonData.releaseTime) {
            delete guildData.prisonUsers[userId];
            saveData(); // Lưu lại data (thay thế bằng hàm lưu data thực tế của bạn nếu khác tên)
            if (prisonRole) await message.member.roles.remove(prisonRole).catch(() => {});
            return message.reply('⏰ **Thời tự do đã đến!** Thời gian thụ án của bạn đã kết thúc, hệ thống đã gỡ role nhà tù.');
        }

        const fullMsg = message.content.trim().toLowerCase();
        const prisonTasks = ['!quet rac', '!trong rau', '!ve sinh nha ve sinh', '!cho heo an'];
        
        // 2. Xử lý khi người dùng gõ ĐÚNG lệnh nhiệm vụ nhà tù
        if (prisonTasks.includes(fullMsg)) {
            // Kiểm tra xem có đang làm nhiệm vụ đúng kênh nhà tù không (nếu có setup kênh)
            if (guildData.prisonConfig?.channelId && message.channel.id !== guildData.prisonConfig.channelId) {
                return message.reply(`⚠️ Bạn đang chịu án phạt tù! Vui lòng di chuyển sang kênh <#${guildData.prisonConfig.channelId}> để thực hiện lao động cải tạo.`);
            }

            let taskKey = null;
            let taskName = '';

            // Map lệnh với key trong data
            if (fullMsg === '!quet rac') { taskKey = 'quet_rac'; taskName = 'Quét rác 🧹'; }
            else if (fullMsg === '!trong rau') { taskKey = 'trong_rau'; taskName = 'Trồng rau 🌱'; }
            else if (fullMsg === '!ve sinh nha ve sinh') { taskKey = 've_sinh'; taskName = 'Vệ sinh nhà vệ sinh 🧻'; }
            else if (fullMsg === '!cho heo an') { taskKey = 'cho_heo_an'; taskName = 'Cho Heo ăn 🐷'; }

            if (taskKey) {
                const currentTask = prisonData.tasks[taskKey];
                
                // Kiểm tra xem nhiệm vụ này đã đủ chỉ tiêu chưa
                if (currentTask.current >= currentTask.required) {
                    return message.reply(`<a:emoji_75:1523998959570522263> Bạn đã hoàn thành hạn ngạch của công việc **${taskName}** rồi, hãy làm các công việc khác còn thiếu!`);
                }

                // Cộng tiến độ nhiệm vụ
                currentTask.current += 1;
                saveData(); // Lưu lại data

                // Kiểm tra tổng thể: Xem tất cả 4 công việc đã đạt chỉ tiêu chưa
                const t = prisonData.tasks;
                const isAllFinished = (t.quet_rac.current >= t.quet_rac.required) &&
                                      (t.trong_rau.current >= t.trong_rau.required) &&
                                      (t.ve_sinh.current >= t.ve_sinh.required) &&
                                      (t.cho_heo_an.current >= t.cho_heo_an.required);

                // Nếu đã làm xong hết -> Trả tự do
                if (isAllFinished) {
                    delete guildData.prisonUsers[userId];
                    saveData();
                    if (prisonRole) await message.member.roles.remove(prisonRole).catch(() => {});
                    return message.reply(`🎉 **MÃN HẠN TÙ TRƯỚC THỜI HẠN!** Bạn đã hoàn thành toàn bộ lao động cải tạo một cách xuất sắc. Bạn đã được gỡ bỏ role nhà tù và trả lại tự do!`);
                } else {
                    // Nếu chưa xong hết -> Báo cáo tiến độ hiện tại
                    return message.reply(`🛠️ Bạn vừa thực hiện: **${taskName}** thành công! (${currentTask.current}/${currentTask.required} lần).\n📊 **Tiến độ cải tạo hiện tại:**\n• 🧹 Quét rác: \`${t.quet_rac.current}/${t.quet_rac.required}\`\n• 🌱 Trồng rau: \`${t.trong_rau.current}/${t.trong_rau.required}\`\n• 🧻 Vệ sinh: \`${t.ve_sinh.current}/${t.ve_sinh.required}\`\n• 🐷 Cho heo ăn: \`${t.cho_heo_an.current}/${t.cho_heo_an.required}\``);
                }
            }
        }
        
        // 3. Chặn các lệnh khác (Nhưng cho phép chat bình thường)
        // Lưu ý: Chữ "!" ở đây là prefix mặc định của bot, bạn có thể thay thế bằng biến prefix của riêng bạn (vd: config.prefix)
        if (fullMsg.startsWith('!')) {
            return message.reply('⚠️ **Bạn đang chịu án phạt tù!** Bạn bị tước quyền sử dụng các lệnh bot (câu cá, mini-game, ví tiền...). Vui lòng hoàn thành nhiệm vụ công ích để được trả tự do!');
        }
        
        // Trả về (return) nếu muốn người chơi bị cấm cả chat bình thường:
        // return message.reply('⚠️ Bọn tội phạm không được phép lên tiếng!'); 
    }
    
    if (command === 'diemdanh') {
        if (guildData.lastDaily[userId] && Date.now() - guildData.lastDaily[userId] < 86400000) {
            return message.reply('⏰ Bạn đã điểm danh hôm nay rồi!');
        }
        guildData.lastDaily[userId] = Date.now();
        saveData();
        addBalance(userId, 200, guildId);
        return message.reply(`🎉 **${message.author.username}** điểm danh nhận **200💸 VNĐ**!`);
    }
    
    if (command === 'vi' || command === 'money') {
        return message.reply(`👛 Ví của bạn: **${getBalance(userId, guildId)}💸 VNĐ**`);
    }

        if (command === 'xephang' || command === 'top') {
        // 1. Phản hồi ngay lập tức để người dùng không thấy bot bị đơ
        const loadingMsg = await message.reply("⏳ Đang tải bảng xếp hạng, chờ một chút nhé...");

        // 2. Lấy danh sách từ Database và sắp xếp TẤT CẢ từ cao xuống thấp trước
        const allBalances = Object.entries(guildData.balance).sort((a, b) => b[1] - a[1]);
        
        const top10 = [];

        // 3. Quét từ người giàu nhất xuống, tìm đủ 10 người TRONG SERVER thì dừng
        for (const [userId, bal] of allBalances) {
            if (top10.length >= 10) break; // Đã đủ 10 người thì thoát vòng lặp ngay lập tức

            try {
                // Ưu tiên check bộ nhớ tạm (cache) cực nhanh
                let member = message.guild.members.cache.get(userId);
                
                // Nếu không có trong cache, mới gọi API để check ĐÚNG 1 người này
                if (!member) {
                    member = await message.guild.members.fetch(userId).catch(() => null);
                }

                // Nếu người này có mặt trong server, đưa vào danh sách top
                if (member) {
                    top10.push([userId, bal]);
                }
            } catch (err) {
                // Bỏ qua nếu có lỗi (ví dụ user không tồn tại)
                continue;
            }
        }

        // 4. Format nội dung bảng xếp hạng
        let desc = top10.length === 0 
            ? 'Chưa có ai trong danh sách của server này.' 
            : top10.map((entry, index) => {
                let rank = index + 1;
                let medal = rank === 1 ? '🥇' : rank === 2 ? ' 🥈' : rank === 3 ? '🥉' : '🏅';
                return `${medal} **Top ${rank}:** <@${entry[0]}> \`${entry[1].toLocaleString()}💸\``;
            }).join('\n\n');

        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle(`🏆 BẢNG XẾP HẠNG ĐẠI GIA - ${message.guild.name.toUpperCase()} 🏆`)
            .setDescription(desc)
            .setTimestamp();
        
        // 5. Cập nhật lại tin nhắn "Đang tải..." thành Bảng xếp hạng
        return loadingMsg.edit({ content: null, embeds: [embed] });
    }

    if (command === 'shop') {
        const guildId = message.guild.id;
        const serverShop = db.shop[guildId] || {};
        const shopItems = Object.keys(serverShop);
        
        if (shopItems.length === 0) return message.reply('🛒 Hiện tại server này chưa có mặt hàng nào được bày bán!');
        
        let desc = 'Dưới đây là các Role đang được bày bán.\nBấm nút **Mua Role** bên dưới và nhập mã số để giao dịch!\n\n';
        for (const code of shopItems) {
            const item = serverShop[code];
            desc += `• <@&${item.roleId}>: **${item.price.toLocaleString()} VNĐ💸** (Mã: \`${code}\`)\n`;
        }

        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle(`🛒 CỬA HÀNG GIAO DỊCH ROLE - ${message.guild.name.toUpperCase()} 🛒`)
            .setDescription(desc)
            .setFooter({ text: 'Bot tự động cấp role sau khi giao dịch thành công' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_buy_role').setLabel('🛒 Mua Role').setStyle(ButtonStyle.Success)
        );
        return message.reply({ embeds: [embed], components: [row] });
    }


    if (command === 'shoplinhkien') {
        const buildMenu = (id, placeholder, items) => {
            return new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(id)
                    .setPlaceholder(placeholder)
                    .addOptions(Object.entries(items).map(([k, v]) => ({
                        label: k.slice(0, 100),
                        description: `Giá: ${v.toLocaleString()} VNĐ`,
                        value: `buy_${k}`
                    })).slice(0, 25))
            );
        };

        const row1 = buildMenu('menu_linhkien_1', '🧵 Chọn Dây Câu & 🪝 Lưỡi Câu', { ...COMPONENTS.lines, ...COMPONENTS.hooks });
        const row2 = buildMenu('menu_linhkien_2', '🎈 Chọn Phao & ⚙️ Máy Câu', { ...COMPONENTS.floats, ...COMPONENTS.reels });
        const row3 = buildMenu('menu_linhkien_3', '🪱 Chọn Mồi & 💊 Buff', { ...COMPONENTS.baits, ...COMPONENTS.buffs });

        const content = '🛠️ **CỬA HÀNG LINH KIỆN & TÚI ĐỒ**\nNhấp vào các danh sách để mua trực tiếp:';
        return message.reply({ content, components: [row1, row2, row3] });
    }

    if (command === 'shopveso') {
    if (!guildData.lotteryConfig || !guildData.lotteryConfig.dais || guildData.lotteryConfig.dais.length === 0) {
        return message.reply('⚠️ Admin chưa thiết lập danh sách đài mở thưởng hôm nay (dùng lệnh `/dailyveso`)!');
    }
    
    const dais = guildData.lotteryConfig.dais;
    const embed = new EmbedBuilder()
        .setTitle('🎫 ĐẠI LÝ VÉ SỐ KIẾN THIẾT MIỀN NAM - ĐA ĐÀI')
        .setDescription(`**Các đài hôm nay:**\n${dais.map((d, idx) => `**${idx + 1}.** Đài __${d}__`).join('\n')}\n\n**Giá vé:** 10,000 VNĐ 💸 / 1 tờ\n**Giờ quay thưởng:** 16:30 chiều hàng ngày.\n\n🎟️ *Hãy chọn đài bạn muốn mua ở các nút bấm phía dưới:*`)
        .setColor('#f1c40f')
        .setImage('https://i.imgur.com/uGzJkC0.png');

    const row = new ActionRowBuilder();
    dais.forEach((dai, index) => {
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`btnveso_${index}`)
                .setLabel(`Mua đài ${dai}`)
                .setStyle(ButtonStyle.Primary)
                .setEmoji('🎫')
        );
    });

    return message.reply({ embeds: [embed], components: [row] });
}
    
        if (command === 'vesotoi') {
        if (!guildData.lotteryUsers || !guildData.lotteryUsers[userId] || Object.keys(guildData.lotteryUsers[userId]).length === 0) {
            return message.reply('🎫 Hôm nay bạn chưa mua tờ vé số nào cả! Hãy dùng lệnh `!shopveso` để mua ngay.');
        }

        const userLottery = guildData.lotteryUsers[userId];
        const embed = new EmbedBuilder()
            .setTitle('🎫 VÉ SỐ CÁ NHÂN HÔM NAY')
            .setDescription('Danh sách các tờ vé số bạn đang nắm giữ chờ giờ mở thưởng:')
            .setColor('#3498db')
            .setTimestamp();

        let countTotal = 0;
        let fieldCount = 0;
        let limitReached = false;

        for (const [daiName, tickets] of Object.entries(userLottery)) {
            if (limitReached) break;
            
            if (Array.isArray(tickets) && tickets.length > 0) {
                countTotal += tickets.length;
                
                // Cắt nhỏ mảng vé (mỗi phần 80 vé ~ 800 ký tự) để không vượt quá giới hạn 1024 của Discord
                const chunkSize = 80; 
                for (let i = 0; i < tickets.length; i += chunkSize) {
                    // Discord giới hạn tối đa 25 fields mỗi Embed, ta chừa 1 field để báo lỗi nếu quá nhiều
                    if (fieldCount >= 24) {
                        embed.addFields({
                            name: '⚠️ Lưu ý',
                            value: 'Số lượng vé của bạn quá khủng (vượt quá giới hạn hiển thị của Discord). Hãy chờ đến giờ quay thưởng để xem kết quả nhé!',
                            inline: false
                        });
                        limitReached = true;
                        break;
                    }

                    const chunk = tickets.slice(i, i + chunkSize);
                    const chunkString = `\`${chunk.join('`, `')}\``;
                    
                    const fieldName = (i === 0) 
                        ? `📍 Đài ${daiName} (${tickets.length} tờ)` 
                        : `📍 Đài ${daiName} (Tiếp theo...)`;
                        
                    embed.addFields({
                        name: fieldName,
                        value: chunkString,
                        inline: false
                    });
                    fieldCount++;
                }
            }
        }

        if (countTotal === 0) {
            return message.reply('🎫 Hôm nay bạn chưa sở hữu tờ vé số hợp lệ nào cả!');
        }
        
        return message.reply({ embeds: [embed] });
    }
    
    if (command === 'shopcan') {
        const embed = new EmbedBuilder().setColor('#f1c40f').setTitle('🏪 TẠP HÓA CẦN CÂU (MUA BẰNG TIỀN)');
        let desc = 'Đây là cửa hàng mua cần câu nhanh chóng bằng VNĐ.\n⚠️ **Lưu ý:** Mua xong sẽ vứt bỏ cần đang sử dụng và trang bị ngay lập tức cần mới!\n\n';
        const options = [];

        for (const [name, stats] of Object.entries(RODS)) {
            if (stats.price === 0) continue;
            desc += `**${name}**\n• Giá mua: ${stats.price.toLocaleString()} VNĐ 💸 | Độ bền: ${stats.dur} | Lực kéo: ${stats.res}\n`;
            if (options.length < 25) {
                options.push({
                    label: name.slice(0, 100),
                    description: `Lực kéo: ${stats.res} | Mua: ${stats.price.toLocaleString()} VNĐ`,
                    value: `buyrod_${name}`
                });
            }
        }
        embed.setDescription(desc.slice(0, 4000));
        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_shopcan_buy').setPlaceholder('🛒 Chọn cần câu muốn MUA NGAY').addOptions(options)
        );
        return message.reply({ embeds: [embed], components: [selectMenu] });
    }

    if (command === 'khuvuc' || command === 'doikhuvuccau') {
        const options = Object.entries(ZONES).map(([k, v]) => ({
            label: k.slice(0, 100),
            description: `Yêu cầu Lv: ${v.level} | Phí: ${v.fee.toLocaleString()} VNĐ`,
            value: `zone_${k}`
        }));
        const selectMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_doikhuvuc').setPlaceholder('🗺️ Chọn vùng biển muốn ra khơi!').addOptions(options.slice(0, 25))
        );
        return message.reply({ content: '🚤 **BẾN TÀU DI CHUYỂN**\nChọn khu vực bạn muốn cập bến từ danh sách:', components: [selectMenu] });
    }

    if (command === 'kho' || command === 'profile') {
        const user = fishingGetUser(userId, guildId);
        const embed = new EmbedBuilder().setColor('#2f3136').setTitle(`🎒 HỒ SƠ & TÚI ĐỒ: ${message.author.username}`);
        let equipStr = `🎣 Cần: **${user.equip.rod} (+${user.equip.rodPlus})** [Bền: ${user.equip.dur}/${RODS[user.equip.rod].dur}]\n🧵 Dây: **${user.equip.line || 'Trống'}**\n🪝 Lưỡi: **${user.equip.hook || 'Trống'}**\n🎈 Phao: **${user.equip.float || 'Trống'}**\n⚙️ Máy: **${user.equip.reel || 'Trống'}**\n🪱 Mồi: **${user.equip.bait || 'Trống'}** (Trong kho: ${user.inventory[user.equip.bait] || 0} mồi)`;
        let invStr = Object.entries(user.inventory).map(([k, v]) => `• ${k}: x${v}`).join('\n');
        if (!invStr) invStr = '*Túi đồ trống không.*';

        embed.addFields(
            { name: '👤 Cấp Độ & Tiền', value: `Cấp độ: **${user.level}** (EXP: ${user.exp})\nTài sản: **${user.balance.toLocaleString()} VNĐ 💸**\nKhu Vực Hiện Tại: **${user.zone}**`, inline: false },
            { name: '🛠️ Tình Trạng Trang Bị', value: equipStr, inline: false },
            { name: `📦 Kho Đồ Lưu Trữ (${Object.keys(user.inventory).length}/${user.maxInv})`, value: invStr.substring(0, 1024), inline: false }
        );

        const equipableItems = Object.keys(user.inventory).filter(item =>
            COMPONENTS.lines[item] || COMPONENTS.hooks[item] || COMPONENTS.floats[item] || COMPONENTS.reels[item] || COMPONENTS.baits[item]
        ).slice(0, 25);

        const componentsArr = [];
        if (equipableItems.length > 0) {
            const options = equipableItems.map(item => {
                let icon = '📦';
                if (COMPONENTS.lines[item]) icon = '🧵';
                if (COMPONENTS.hooks[item]) icon = '🪝';
                if (COMPONENTS.floats[item]) icon = '🎈';
                if (COMPONENTS.reels[item]) icon = '⚙️';
                if (COMPONENTS.baits[item]) icon = '🪱';
                return {
                    label: `${icon} ${item}`.slice(0, 100),
                    description: `Đang có: ${user.inventory[item]} cái`,
                    value: `equip_${item}`
                };
            });

            componentsArr.push(
                new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('menu_trangbi')
                        .setPlaceholder('🎒 Click để mang trang bị (Tick nhiều mục cùng lúc)')
                        .setMinValues(1)
                        .setMaxValues(Math.min(equipableItems.length, 5))
                        .addOptions(options)
                )
            );
        }

        return message.reply({ embeds: [embed], components: componentsArr });
    }
// Lệnh xem Nông Trại
if (command === 'farm' || command === 'nongtrai') {
    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle(`🚜 Nông Trại của ${message.author.username}`)
        .addFields(
            { name: '⚡ Thể lực', value: `${userData.energy}/100`, inline: true },
            { name: '💰 Tiền', value: `${userData.money.toLocaleString()} VNĐ💸`, inline: true },
            { name: '🌦️ Thời tiết hiện tại', value: globalWeather.name, inline: false },
            { name: '🌱 Đất trồng', value: `Đang dùng: ${userData.farm.plots.length}/${userData.farm.maxPlots} ô`, inline: false }
        );
    return message.reply({ embeds: [embed] });
}

// Lệnh nông trại: xem tổng quan
if (command === 'farm' || command === 'nongtrai') {
    const embed = buildFarmStatusEmbed(userData, message.guild?.name);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`farm_btn_shop_${message.author.id}`).setLabel('🛒 Shop hạt giống').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`farm_btn_plant_${message.author.id}`).setLabel('🌱 Gieo hạt').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`farm_btn_harvest_${message.author.id}`).setLabel('🍎 Thu hoạch').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(`farm_btn_food_${message.author.id}`).setLabel('🍽️ Ăn').setStyle(ButtonStyle.Secondary)
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`farm_btn_trade_${message.author.id}`).setLabel('🔁 Trade').setStyle(ButtonStyle.Primary)
    );
    return message.reply({ embeds: [embed], components: [row, row2] });
}

// Lệnh Shop Hạt Giống
if (command === 'shophatgiong') {
    const components = makeSeedShopComponents();
    return message.reply({ content: '🛒 **CỬA HÀNG HẠT GIỐNG**\nHãy chọn hạt giống bạn muốn mua:', components });
}

// Lệnh Gieo Hạt
if (command === 'plant') {
    const availableSeeds = Object.keys(SEEDS).filter(key => (userData.inventory[seedLabel(key)] || 0) > 0);
    updateFarmDiseaseState(userData);

    if (availableSeeds.length === 0) return message.reply('❌ Bạn không có hạt giống nào trong kho!');
    if (getFreeFarmSlots(userData) <= 0) return message.reply('❌ Đất trồng đã đầy!');

    const options = availableSeeds.map(key => ({
        label: SEEDS[key].name,
        description: `Đang có: ${userData.inventory[seedLabel(key)] || 0} hạt`,
        value: key,
        emoji: SEEDS[key].icon
    }));

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_seed_plant')
            .setPlaceholder('Chọn hạt giống để gieo...')
            .addOptions(createOptionListForSelect(options))
    );

    return message.reply({ content: '🌱 **GIEP HẠT**\nChọn loại hạt giống bạn muốn trồng:', components: [row] });
}

// Lệnh Thu hoạch
if (command === 'thuhoach' || command === 'harvest') {
    const ready = createCropOptionsFromPlots(userData);
    const keys = Object.keys(ready);
    if (keys.length === 0) return message.reply('❌ Chưa có cây nào đủ chín để thu hoạch!');
    const row = makeHarvestComponents(userData)[0];
    return message.reply({ content: '🍎 **THU HOẠCH**\nChọn loại cây muốn thu hoạch:', components: [row] });
}

// Lệnh Ăn nạp thể lực
if (command === 'an') {
    const availableFood = Object.keys(FOODS).filter(key => (userData.inventory[FOODS[key].name] || 0) > 0);
    if (availableFood.length === 0) return message.reply('❌ Bạn không có thức ăn nào trong kho đồ (Hãy chế biến từ nông sản)!');

    const options = availableFood.map(key => ({
        label: FOODS[key].name,
        description: `Hồi: +${FOODS[key].energy} Thể lực | Đang có: ${userData.inventory[FOODS[key].name] || 0}`,
        value: key,
        emoji: FOODS[key].icon
    }));

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('select_food_eat')
            .setPlaceholder('Chọn món ăn...')
            .addOptions(createOptionListForSelect(options))
    );
    return message.reply({ content: '🍽️ **BÀN ĂN**\nChọn món để nạp lại thể lực:', components: [row] });
}

// Lệnh Trade
if (command === 'trade') {
    const target = message.mentions.users.first();
    if (!target) return message.reply('❌ Dùng: `!trade @người_chơi`');
    if (target.bot) return message.reply('❌ Không thể trade với bot!');
    if (target.id === userId) return message.reply('❌ Bạn không thể trade với chính mình!');

    const sessionId = `${message.guild.id}_${Date.now()}_${userId}_${target.id}`;
    const session = {
        id: sessionId,
        guildId,
        channelId: message.channel.id,
        messageId: null,
        userA: userId,
        userB: target.id,
        status: 'pending',
        offers: {
            [userId]: { items: {}, confirmed: false },
            [target.id]: { items: {}, confirmed: false }
        },
        createdAt: Date.now()
    };

    guildData.tradeSessions[sessionId] = session;
    guildData.tradeDrafts[sessionId] = {};
    saveData();

    const embed = buildTradeEmbed(session).setDescription(`👤 **Bên A:** <@${userId}>\n👤 **Bên B:** <@${target.id}>\n\nBên B bấm **Chấp nhận** để bắt đầu trao đổi.`);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`trade_accept_${sessionId}`).setLabel('✅ Chấp nhận').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`trade_decline_${sessionId}`).setLabel('❌ Từ chối').setStyle(ButtonStyle.Danger)
    );

    const sent = await message.reply({ content: `<@${target.id}>`, embeds: [embed], components: [row] });
    session.messageId = sent.id;
    saveData();
    return;
}
// Lệnh xem bảng giá Chợ
if (command === 'cho' || command === 'market') {
    let marketInfo = '';
    
    for (const [item, basePrice] of Object.entries(MARKET_BASE_PRICES)) {
        const currentPrice = currentMarketPrices[item];
        // Tính xem giá đang tăng hay giảm để hiện icon
        let trend = currentPrice > basePrice ? '📈' : (currentPrice < basePrice ? '📉' : '➖');
        
        // Highlight nếu đây là mặt hàng thương nhân đang thu mua
        if (specialMerchant.active && specialMerchant.item === item) {
            marketInfo += `⭐ **${item}**: ${currentPrice.toLocaleString()} VNĐ💸 (Đại gia thu mua giá x${specialMerchant.multiplier.toFixed(1)})\n`;
        } else {
            marketInfo += `${trend} **${item}**: ${currentPrice.toLocaleString()} VNĐ💸\n`;
        }
    }

    const embed = new EmbedBuilder()
        .setColor('#f1c40f')
        .setTitle('🛒 THỊ TRƯỜNG NÔNG SẢN')
        .setDescription(`*Giá cả thay đổi mỗi giờ. Hãy canh lúc giá cao để bán nhé!*\n\n${marketInfo}`)
        .setFooter({ text: 'Dùng !ban để mở UI bán nông sản nhiều loại cùng lúc' });

    return message.reply({ embeds: [embed] });
}

    if (command === 'ban') {
        updateFarmDiseaseState(userData);
        const crops = getSellableCropEntries(userData);
        if (!crops.length) return message.reply('❌ Bạn chưa có nông sản nào để bán!');

        const sessionId = `${guildId}_${userId}_${Date.now()}`;
        const store = getBanSessionStore(guildData);
        store[sessionId] = {
            id: sessionId,
            userId,
            guildId,
            channelId: message.channel.id,
            messageId: null,
            selected: [],
            createdAt: Date.now()
        };
        saveData();

        const embed = buildBanSellEmbed(userData, store[sessionId]);
        const components = buildBanSellComponents(userData, sessionId);
        const sent = await message.reply({
            content: '🛒 **BÁN NÔNG SẢN**\nChọn nhiều loại cây rồi bấm **💸 Bán** để bán toàn bộ số lượng đã chọn.',
            embeds: [embed],
            components
        });
        store[sessionId].messageId = sent.id;
        saveData();
        return;
    }

    if (command === 'suacan') {
        const user = fishingGetUser(userId, guildId);
        const rodData = RODS[user.equip.rod];
        if (user.equip.dur >= rodData.dur) return message.reply('✨ Cần câu của bạn vẫn nguyên vẹn!');
        const missing = rodData.dur - user.equip.dur;
        let fixCost = Math.floor(rodData.price * 0.15 * (missing / rodData.dur));
        if (fixCost === 0 && missing > 0) fixCost = 500;

        if (user.balance < fixCost) return message.reply(`❌ Bạn cần **${fixCost.toLocaleString()} VNĐ 💸** để bảo trì!`);
        user.balance -= fixCost;
        user.equip.dur = rodData.dur;
        saveFishingData();
        return message.reply(`🔧 Đã nhờ thợ rèn bảo dưỡng cần **${user.equip.rod}** với chi phí **${fixCost.toLocaleString()} VNĐ 💸**!`);
    }

    if (command === 'banca') {
        const user = fishingGetUser(userId, guildId);
        let totalEarned = 0; let log = []; let allFishes = {};
        for (let r in FISH_DATA) { FISH_DATA[r].list.forEach(f => { allFishes[f] = FISH_DATA[r]; }); }

        for (let [item, qty] of Object.entries(user.inventory)) {
            if (allFishes[item]) {
                let minP = allFishes[item].minPrice; let maxP = allFishes[item].maxPrice;
                let fishTotal = 0;
                for (let i = 0; i < qty; i++) fishTotal += Math.floor(Math.random() * (maxP - minP + 1)) + minP;
                totalEarned += fishTotal;
                log.push(`• Bán ${qty}x ${item}: **${fishTotal.toLocaleString()} VNĐ 💸**`);
                delete user.inventory[item];
            }
        }
        if (totalEarned === 0) return message.reply('❌ Giỏ cá trống không, lấy gì mà bán!');
        user.balance += totalEarned;
        saveFishingData();
        const embed = new EmbedBuilder().setColor('#2ecc71').setTitle('💰 HÓA ĐƠN THU MUA HẢI SẢN').setDescription(log.join('\n') + `\n\n**Tổng thu nhập bán cá:** \`${totalEarned.toLocaleString()} VNĐ 💸\``);
        return message.reply({ embeds: [embed] });
    }

if (command === 'cauca' || command === 'fish') {
    const user = fishingGetUser(userId, guildId);
    if (user.equip.dur <= 0) return message.reply('❌ Cần câu của bạn đã gãy! Hãy dùng `!suacan` để bảo trì.');
    if (!user.equip.line) return message.reply('❌ Cần câu chưa móc Dây Câu!');
    if (!user.equip.hook) return message.reply('❌ Cần câu chưa gắn Lưỡi Câu!');
    if (!user.equip.bait) return message.reply('❌ Bạn không thể thả câu chay mà không có Mồi!');
    if (!user.inventory[user.equip.bait] || user.inventory[user.equip.bait] <= 0) {
        user.equip.bait = null; saveFishingData(); return message.reply('❌ Mồi đã dùng hết sạch, hãy ghé shop mua thêm!');
    }    

    // =======================================================
    // GHÉP BƯỚC 4: KIỂM TRA & TRỪ THỂ LỰC KHI CÂU CÁ
    // =======================================================
    // Khởi tạo phòng hờ nếu data người chơi cũ chưa kịp có energy
    if (userData.energy === undefined) userData.energy = 100;

    if (userData.energy < 10) {
        return message.reply('❌ Bạn đang kiệt sức! Hãy dùng lệnh `!an` để nạp thêm thể lực trước khi quăng cần.');
    }
    
    // Trừ 10 thể lực
    userData.energy -= 10;
    // =======================================================

    user.inventory[user.equip.bait] -= 1;
    if (user.inventory[user.equip.bait] <= 0) delete user.inventory[user.equip.bait];
    user.equip.dur -= 1;

    const rodStats = RODS[user.equip.rod];
    const baitInfo = BAIT_BUFFS[user.equip.bait];
    const hasLuck = user.buffs.luck > Date.now();
    const hasDropBuff = user.buffs.drop > Date.now();

    let chances = { Uncommon: 50, Rare: 25, Epic: 15, Legendary: 8, Mythic: 1.9, Secret: 0.1 };
    if (baitInfo && baitInfo.bonus > 0 && baitInfo.target) {
        if (user.equip.bait === 'Mồi Thần Biển') { chances.Mythic += 35; chances.Secret += 40; } 
        else { chances[baitInfo.target] += baitInfo.bonus; }
    }
    if (hasLuck) { chances.Mythic += 20; chances.Secret += 10; chances.Legendary += 30; }

    let rarity = 'Uncommon';
    let roll = Math.random() * Object.values(chances).reduce((a, b) => a + b, 0);

    if (roll <= chances.Secret) rarity = 'Secret';
    else if (roll <= chances.Secret + chances.Mythic) rarity = 'Mythic';
    else if (roll <= chances.Secret + chances.Mythic + chances.Legendary) rarity = 'Legendary';
    else if (roll <= chances.Secret + chances.Mythic + chances.Legendary + chances.Epic) rarity = 'Epic';
    else if (roll <= chances.Secret + chances.Mythic + chances.Legendary + chances.Epic + chances.Rare) rarity = 'Rare';
    else rarity = 'Uncommon';

    const zoneMaxRarity = ZONES[user.zone].maxRarity;
    if (RANK_VAL[rarity] > RANK_VAL[zoneMaxRarity]) rarity = zoneMaxRarity;

    const fishCategory = FISH_DATA[rarity];
    const fishName = fishCategory.list[Math.floor(Math.random() * fishCategory.list.length)];
    let catchPower = rodStats.res + (user.equip.rodPlus * 2);
    let finalBreakChance = Math.max(4, Math.min(95, fishCategory.breakChance - catchPower));

    let breakText = ''; let caughtText = '';
    if (Math.random() * 100 < finalBreakChance) {
        breakText = `💥 Căng quá!! Cá quá khỏe làm đứt **${user.equip.line}** của bạn!`;
        user.equip.line = null;
        if (Math.random() < 0.5) { breakText += ` Bay màu luôn **${user.equip.hook}**!`; user.equip.hook = null; }
    } else {
        caughtText = `🎉 Đớp mồi rồi!! Kéo thành công **1x ${fishName}** [${rarity}].`;
        if (Math.random() * 100 < (hasDropBuff ? 60 : 15)) {
            let dropItem = fishCategory.drops[Math.floor(Math.random() * fishCategory.drops.length)];
            caughtText += `\n🎁 Quái ngư nhả ra: **1x ${dropItem}** (Nguyên liệu chế đồ).`;
            if (!user.inventory[dropItem] && Object.keys(user.inventory).length >= user.maxInv) {
                caughtText += `\n⚠️ Kho đồ ĐẦY, đành vứt lại nguyên liệu này!`;
            } else { user.inventory[dropItem] = (user.inventory[dropItem] || 0) + 1; }
        }

        if (!user.inventory[fishName] && Object.keys(user.inventory).length >= user.maxInv) {
            caughtText += `\n⚠️ Túi đồ ĐẦY! Đành thả con cá này về biển...`;
        } else {
            user.inventory[fishName] = (user.inventory[fishName] || 0) + 1;
            user.exp += Math.floor(Math.random() * 20) + 10;
        }
    }

    if (user.equip.dur <= 0) breakText += `\n⚠️ **RẮC RẮC!** Cần câu đã cạn độ bền và nát bươm!`;
    let levelUpText = '';
    if (user.exp >= user.level * 100) {
        user.level += 1; user.exp = 0;
        levelUpText = `\n🌟 **TUYỆT VỜI! LÊN CẤP!** Kỹ năng câu cá đạt Level **${user.level}**.`;
    }
    
    // Lưu lại data câu cá (hàm gốc của bạn)
    saveFishingData();
    // Lưu lại data người chơi chứa thể lực (tuỳ thuộc vào hàm save chung của bạn, ví dụ: fs.writeFileSync)
    // saveUserData(); 

    const embed = new EmbedBuilder()
        .setColor(breakText ? '#e74c3c' : '#3498db')
        .setTitle(`🎣 ${message.author.username} đang quăng cần tại ${user.zone}...`)
        .setDescription(`${caughtText}${breakText}${levelUpText}\n\n*(Cần bền: ${user.equip.dur}/${rodStats.dur}) | ⚡ Thể lực: ${userData.energy}/100*`); // Thêm chỉ số thể lực vào đuôi Embed
        
    return message.reply({ embeds: [embed] });
}

    if (command === 'taixiu' || command === 'tx') {
        if (activeGames.taixiu) return message.reply('⚠️ Đang có một sòng Tài Xỉu chuẩn bị lắc rồi!');
        activeGames.taixiu = { status: 'betting', bets: [], mainMessage: null };
        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('🎲 SÒNG BẠC TÀI XỈU 🎲')
            .setDescription('Vui lòng click các nút bên dưới để chọn cửa và đặt cược!\n\n**Danh sách đặt cược:**\n*Chưa có ai đặt cửa.*')
            .setFooter({ text: 'Thời gian đặt cược kết thúc sau 40 giây!' });
        
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tx_btn_tai').setLabel('Tài (11-17)').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tx_btn_xiu').setLabel('Xỉu (4-10)').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('tx_btn_chan').setLabel('Chẵn').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tx_btn_le').setLabel('Lẻ').setStyle(ButtonStyle.Secondary)
        );
        const msg = await message.channel.send({ embeds: [embed], components: [row] });
        activeGames.taixiu.mainMessage = msg;

        setTimeout(async () => {
            try {
                const game = activeGames.taixiu;
                if (!game || game.status !== 'betting') return;

                if (game.bets.length === 0) {
                    activeGames.taixiu = null;
                    return await msg.edit({ content: '🎲 Sòng Tài Xỉu giải tán vì không có ai đặt cược!', embeds: [], components: [] }).catch(()=>{});
                }
                
                game.status = 'finished';
                const d1 = Math.floor(Math.random() * 6) + 1;
                const d2 = Math.floor(Math.random() * 6) + 1;
                const d3 = Math.floor(Math.random() * 6) + 1;
                const sum = d1 + d2 + d3;
                
                const isBao = (sum === 3 || sum === 18);
                const isTai = sum >= 11 && sum <= 17;
                const isXiu = sum >= 4 && sum <= 10;
                const isChan = sum % 2 === 0;
                const isLe = sum % 2 !== 0;
                
                const resultMain = isBao ? 'BÃO (Nhà cái ăn trọn)' : (isTai ? 'TÀI' : 'XỈU');
                const resultSub = isChan ? 'CHẴN' : 'LẺ';
                let logResult = `📊 **KẾT QUẢ XÚC XẮC:**\n 🎲 **${d1} - ${d2} - ${d3}** (Tổng: **${sum}**)\n➡️ **${resultMain}** | **${resultSub}**\n\n🏁 **BẢNG TRẢ THƯỞNG:**\n`;
                
                game.bets.forEach(b => {
                    let win = false;
                    if (!isBao) {
                        if (b.choice === 'tai' && isTai) win = true;
                        if (b.choice === 'xiu' && isXiu) win = true;
                        if (b.choice === 'chan' && isChan) win = true;
                        if (b.choice === 'le' && isLe) win = true;
                    }
                    if (win) {
                        addBalance(b.userId, b.amount, guildId);
                        logResult += `• <@${b.userId}> chọn **${b.choiceName}**: **THẮNG** 🎉 **+${b.amount}💸**\n`;
                    } else {
                        addBalance(b.userId, -b.amount, guildId);
                        logResult += `• <@${b.userId}> chọn **${b.choiceName}**: **THUA** 💸 **-${b.amount}💸**\n`;
                    }
                });

                const endEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🏆 TỔNG KẾT TÀI XỈU 🏆').setDescription(logResult).setTimestamp();
                await msg.edit({ embeds: [endEmbed], components: [] }).catch(()=>{});
                activeGames.taixiu = null;
            } catch(e) { activeGames.taixiu = null; }
        }, 40000);
    }

    if (command === 'xepgach' || command === 'tetris') {
        if (activeGames.xepgach.has(userId)) {
            return message.reply('⚠️ Bạn đang có một ván xếp gạch đang diễn ra rồi! Hãy chơi xong hoặc bấm ⏹ để kết thúc.');
        }

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('🎮 TRÒ CHƠI XẾP GẠCH 🎮')
            .setDescription('Đang khởi tạo bàn chơi...');
        const msg = await message.reply({ embeds: [embed] });
        
        const game = new TetrisGame(userId, msg);
        activeGames.xepgach.set(userId, game);
        game.start(); 
        return;
    }
    
    if (command === 'caro') {
        const opponent = message.mentions.users.first();
        if (!opponent || opponent.bot || opponent.id === userId) return message.reply("<a:emoji_76:1524195723996823612> Bạn phải tag một người chơi khác (không phải bot) để thách đấu!");
        if (activeGames.caro.has(message.channel.id)) return message.reply("⚠️ Kênh này đang có một ván Caro diễn ra, hãy đợi họ chơi xong!");
        
        const game = {
            p1: userId,
            p2: opponent.id,
            turn: userId,
            board: Array(9).fill('⬜')
        };
        activeGames.caro.set(message.channel.id, game);
        
        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('Cờ Caro')
            .setDescription(`Ván đấu giữa <@${userId}> (<a:emoji_76:1524195723996823612>) và <@${opponent.id}> (⭕)\n*Cần 4 quân liên tiếp để chiến thắng.*\n\n👉 Lượt đánh hiện tại: <@${userId}> (<a:emoji_76:1524195723996823612>)`);
        return message.channel.send({ embeds: [embed], components: createCaroComponents(game.board, message.channel.id) });
    }

    if (command === 'xidach' || command === 'blackjack') {
        if (activeGames.xidach) return message.reply('⚠️ Đang có một sòng Xì Dách đang diễn ra, vui lòng chờ!');
        activeGames.xidach = { status: 'waiting', dealerId: userId, players: [], dealerCards: [], deck: createDeck(), mainMessage: null };
        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('🃏 SÒNG XÌ DÁCH')
            .setDescription(`👑 Nhà Cái: <@${userId}>\n\nBấm nút **Tham Gia** bên dưới để đặt cược.\n\n**Bàn cược:**\n*Trống.*`)
            .setFooter({ text: 'Tự động đóng đăng ký sau 30 giây!' });
        
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pvp_xd_join').setLabel('🙋 Tham Gia (Nhà Con)').setStyle(ButtonStyle.Primary));
        const msg = await message.channel.send({ embeds: [embed], components: [row] });
        activeGames.xidach.mainMessage = msg;

        setTimeout(async () => {
            const game = activeGames.xidach; 
            if (!game || game.status !== 'waiting') return;
            
            if (game.players.length === 0) { 
                activeGames.xidach = null; 
                return msg.edit({ content: '🃏 Sòng rã vì không ai tham gia.', embeds: [], components: [] }).catch(()=>{}); 
            }
            
            const totalBet = game.players.reduce((sum, p) => sum + p.bet, 0);
            if (getBalance(game.dealerId, guildId) < totalBet) { 
                activeGames.xidach = null; 
                return msg.edit({ content: `<a:emoji_76:1524195723996823612> Nhà Cái không đủ tiền bảo hiểm (Cần: ${totalBet}💸). Sòng bị hủy!`, embeds: [], components: [] }).catch(()=>{}); 
            }
            
            game.status = 'players_turn';
            game.players.forEach(p => p.cards.push(game.deck.pop(), game.deck.pop()));
            game.dealerCards.push(game.deck.pop(), game.deck.pop());
            
            const playEmbed = new EmbedBuilder()
                .setColor('#2f3136')
                .setTitle('🃏 SÒNG XÌ DÁCH')
                .setDescription(`👑 Nhà Cái: <@${game.dealerId}> [ Đang giấu bài ]\n\n**Bàn cược:**\n${game.players.map(p => `• <@${p.id}>: *Đang suy nghĩ...*`).join('\n')}\n\n*Bấm nút bên dưới để điều khiển bài kín đáo.*`);
                
            const rowPlay = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('pvp_xd_check').setLabel('👁️ Kiểm Tra Bài & Thao Tác').setStyle(ButtonStyle.Success));
            await msg.edit({ embeds: [playEmbed], components: [rowPlay] }).catch(()=>{});
            
            setTimeout(async () => { 
                if (activeGames.xidach && activeGames.xidach.status === 'players_turn') await startDealerTurn(); 
            }, 50000);
        }, 30000);
    }

    if (command === 'masoi') {
        const guildId = message.guild.id;
        if (activeGames.masoi.has(guildId)) {
            return message.reply('⚠️ Đang có một ván Ma Sói diễn ra ở server này rồi!');
        }

        const gameData = {
            status: 'waiting',
            players: [],
            playerRoles: {},
            channel: message.channel
        };
        activeGames.masoi.set(guildId, gameData);

        const embed = new EmbedBuilder()
            .setTitle('🐺 TRÒ CHƠI MA SÓI SẮP BẮT ĐẦU 🐺')
            .setDescription('Nhấn nút bên dưới để tham gia! Trò chơi sẽ bắt đầu sau **40s**.')
            .setImage(COVER_IMAGE)
            .setColor('#2c3e50');
            
        const joinBtn = new ButtonBuilder()
            .setCustomId('join_masoi')
            .setLabel('Tham Gia')
            .setStyle(ButtonStyle.Primary);
            
        const row = new ActionRowBuilder().addComponents(joinBtn);
        const lobbyMsg = await message.channel.send({ embeds: [embed], components: [row] });
        const collector = lobbyMsg.createMessageComponentCollector({ time: 40000 }); 

        collector.on('collect', async i => {
            if (i.replied || i.deferred) return; 
            if (i.customId === 'join_masoi') {
                if (!gameData.players.includes(i.user.id)) {
                    gameData.players.push(i.user.id);
                    await i.reply({ content: `Bạn đã tham gia! Hiện có ${gameData.players.length} người.`, ephemeral: true }).catch(()=>{});
                } else {
                    await i.reply({ content: 'Bạn đã ở trong phòng chờ rồi!', ephemeral: true }).catch(()=>{});
                }
            }
        });
        
        collector.on('end', async () => {
            if (gameData.players.length < 4) {
                message.channel.send('Không đủ người chơi (cần ít nhất 4 người). Hủy ván Ma Sói!');
                activeGames.masoi.delete(guildId);
                return;
            }
            startGame(guildId, gameData);
        });
        return;
    }
    
    if (command === 'baucua') {
        if (activeGames.baucua) return message.reply('⚠️ Đang có một sòng Bầu Cua chuẩn bị lắc rồi!');
        activeGames.baucua = { status: 'betting', bets: [], mainMessage: null };
        const embed = new EmbedBuilder()
            .setColor('#2f3136')
            .setTitle('🎲 SÒNG BẦU CUA TÔM CÁ 🎲')
            .setDescription('Vui lòng click nút **Đặt Cược** để chọn linh vật và nhập số tiền cược!\n\n**Danh sách đặt cược:**\n*Chưa có ai đặt cửa.*')
            .setFooter({ text: 'Thời gian đặt cược kết thúc sau 40 giây!' });
            
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bc_btn_join').setLabel('💰 Tiến Hành Đặt Cược').setStyle(ButtonStyle.Primary));
        const msg = await message.channel.send({ embeds: [embed], components: [row] });
        activeGames.baucua.mainMessage = msg;

        setTimeout(async () => {
            try {
                const game = activeGames.baucua;
                if (!game || game.status !== 'betting') return;

                if (game.bets.length === 0) {
                    activeGames.baucua = null;
                    return await msg.edit({ content: '🎲 Sòng Bầu Cua giải tán vì không có ai đặt cược ván này!', embeds: [], components: [] });
                }

                game.status = 'finished';
                const items = [
                    { name: 'Bầu', emoji: '🍇' }, { name: 'Cua', emoji: '🦀' }, { name: 'Tôm', emoji: '🦐' }, 
                    { name: 'Cá', emoji: '🐟' }, { name: 'Gà', emoji: '🐓' }, { name: 'Nai', emoji: '🦌' }
                ];

                const d1 = items[Math.floor(Math.random() * items.length)];
                const d2 = items[Math.floor(Math.random() * items.length)];
                const d3 = items[Math.floor(Math.random() * items.length)];
                const results = [d1.name, d2.name, d3.name];
                
                let logResult = `📊 **KẾT QUẢ ĐĨA LẮC:**\n 🔹 ${d1.emoji} **${d1.name}** | ${d2.emoji} **${d2.name}** | ${d3.emoji} **${d3.name}**\n\n🏁 **BẢNG TRẢ THƯỞNG CHI TIẾT:**\n`;
                
                game.bets.forEach(b => {
                    const matchCount = results.filter(r => r === b.choice).length;
                    if (matchCount > 0) {
                        const winAmount = b.amount * matchCount;
                        addBalance(b.userId, winAmount, guildId);
                        logResult += `• <@${b.userId}> chọn **${b.choice}**: **THẮNG** 🎉 **+${winAmount}💸**\n`;
                    } else {
                        addBalance(b.userId, -b.amount, guildId);
                        logResult += `• <@${b.userId}> chọn **${b.choice}**: **THUA** 💸 **-${b.amount}💸**\n`;
                    }
                });
                
                const endEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🏆 TỔNG KẾT PHIÊN BẦU CUA 🏆').setDescription(logResult).setTimestamp();
                await msg.edit({ embeds: [endEmbed], components: [] });
                activeGames.baucua = null;
            } catch(e) { activeGames.baucua = null; }
        }, 40000);
    }
    if (command === 'noitu') {
        const subCommand = args[0]?.toLowerCase();
        if (subCommand === 'start') {
            if (activeGames.noitu.has(message.channel.id)) {
                return message.reply('<a:emoji_76:1524195723996823612> Trận nối từ đang diễn ra ở kênh này rồi!');
            }
            if (vtWords.size === 0) {
                return message.reply('<a:emoji_76:1524195723996823612> Dữ liệu từ điển trống! Hãy kiểm tra lại xem file `Tudien.txt` đã có trong thư mục chưa.');
            }
            
            const polySyllabicWords = Array.from(vtWords).filter(w => w.includes(' '));
            const randomWord = polySyllabicWords[Math.floor(Math.random() * polySyllabicWords.length)];
            
            activeGames.noitu.set(message.channel.id, {
                currentWord: randomWord,
                lastUserId: null,
                usedWords: new Set([randomWord])
            });
            
            const currentWordsArr = randomWord.split(' ');
            const nextTarget = currentWordsArr[currentWordsArr.length - 1];
            
            const embed = new EmbedBuilder()
                .setColor('#0099ff')
                .setTitle('🎮 TRÒ CHƠI NỐI TỪ - TIẾNG VIỆT 🎮')
                .setDescription(`Trận đấu đã chính thức bắt đầu!\n\n🔹 Từ khởi đầu: **${randomWord.toUpperCase()}**\n\n👉 Hãy chat một từ có nghĩa bắt đầu bằng chữ: **${nextTarget.toUpperCase()}**`)
                .setFooter({ text: 'Mẹo: Chat thẳng từ vào đây, không cần thêm dấu !' })
                .setTimestamp();
            return message.reply({ embeds: [embed] });
        }

        if (subCommand === 'stop') {
            if (!activeGames.noitu.has(message.channel.id)) {
                return message.reply('<a:emoji_76:1524195723996823612> Kênh này hiện tại không có trận nối từ nào đang chạy.');
            }
            activeGames.noitu.delete(message.channel.id);
            return message.reply('⏹️ **Đã kết thúc trò chơi nối từ.** Hẹn gặp lại các bạn!');
        }

        return message.reply('ℹ️ **Lệnh game nối từ:**\n• `!noitu start`: Bắt đầu chơi.\n• `!noitu stop`: Dừng trò chơi.');
    }
        // ==========================================
    // LỆNH GAME SLOT MACHINE (MÁY ĐÁNH BẠC)
    // ==========================================
    if (command === 'mayquaythuong' || (command === 'slot' && args[0] === 'machine')) {
        const embed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🎰 MÁY ĐÁNH BẠC (SLOT MACHINE) 🎰')
            .setDescription('Nhấn vào nút bên dưới để nhập số tiền cược!\n\n**Luật chơi:**\n🍎 Quay trúng **3 trái cây giống nhau**: Nhận **x2** tiền cược.\n💥 Ngược lại: Mất tiền cược.\n*(Sử dụng 10 loại trái cây nhiệt đới)*');

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                // Gắn userId vào ID nút để tránh người khác bấm hộ
                .setCustomId(`btn_slot_bet_${message.author.id}`) 
                .setLabel('💰 Nhập Tiền Cược')
                .setStyle(ButtonStyle.Success)
        );

        return message.reply({ embeds: [embed], components: [row] });
    }
    
});

// ==========================================
// TỔNG HỢP XỬ LÝ SỰ KIỆN (INTERACTIONS)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guildId || 'global';
        const guildData = getGuildData(guildId);
        const userData = getFarmUser(userId, guildId);
        const id = interaction.customId || interaction.commandName || null;

if (interaction.isStringSelectMenu()) {
    // SHOP HẠT GIỐNG -> mở modal nhập số lượng mua
    if (interaction.customId === 'select_seed_buy') {
        const seedKey = interaction.values[0];
        const modal = buildQuantityModal(
            `modal_buyseed_${seedKey}`,
            `Mua ${seedLabel(seedKey)}`,
            'Nhập số lượng muốn mua:',
            '1',
            `Giá ${formatMoney(SEEDS[seedKey].price)}`
        );
        await interaction.showModal(modal);
        return;
    }

    // GIEO HẠT -> mở modal nhập số lượng gieo
    if (interaction.customId === 'select_seed_plant') {
        const seedKey = interaction.values[0];
        const available = userData.inventory[seedLabel(seedKey)] || 0;
        const free = getFreeFarmSlots(userData);
        if (available <= 0) return interaction.reply({ content: '❌ Hạt giống này đã hết trong kho!', ephemeral: true });
        if (free <= 0) return interaction.reply({ content: '❌ Đất trồng đã đầy!', ephemeral: true });

        const modal = buildQuantityModal(
            `modal_plant_${seedKey}`,
            `Gieo ${seedLabel(seedKey)}`,
            'Nhập số lượng muốn gieo:',
            '1',
            `Tối đa: ${Math.min(available, free)}`
        );
        await interaction.showModal(modal);
        return;
    }

    // THU HOẠCH -> mở modal nhập số lượng thu
    if (interaction.customId === 'select_harvest_crop') {
        const seedKey = interaction.values[0];
        if (seedKey === 'all') {
            const ready = createCropOptionsFromPlots(userData);
            let totalInfo = [];
            let totalGained = 0;
            for (const key of Object.keys(ready)) {
                const result = harvestPlotsBySeed(userData, key, ready[key]);
                if (result.removedCount > 0) {
                    totalInfo.push(`• ${seedLabel(key)}: +${result.gained}`);
                    totalGained += result.gained;
                }
            }
            saveData();
            return interaction.reply({ content: totalInfo.length ? `🍎 **THU HOẠCH THÀNH CÔNG**\n${totalInfo.join('\n')}` : '❌ Chưa có cây nào đủ chín.', ephemeral: true });
        }

        const ready = createCropOptionsFromPlots(userData);
        const maxQty = ready[seedKey] || 0;
        if (maxQty <= 0) return interaction.reply({ content: '❌ Loại cây này chưa đủ chín!', ephemeral: true });

        const modal = buildQuantityModal(
            `modal_harvest_${seedKey}`,
            `Thu hoạch ${seedLabel(seedKey)}`,
            'Nhập số ô muốn thu hoạch:',
            String(maxQty),
            `Tối đa: ${maxQty}`
        );
        await interaction.showModal(modal);
        return;
    }

    // ĂN -> chọn món rồi ăn 1 cái
    if (interaction.customId === 'select_food_eat') {
        const foodKey = interaction.values[0];
        const result = feedUser(userData, foodKey, 1);
        saveData();
        if (!result.eaten) return interaction.reply({ content: '❌ Bạn không còn món này trong kho!', ephemeral: true });
        return interaction.reply({ content: `🍽️ Bạn đã ăn **${FOODS[foodKey].name}** và hồi phục **${result.energyGained}** thể lực!`, ephemeral: true });
    }
}

if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith('modal_buyseed_')) {
        const seedKey = interaction.customId.replace('modal_buyseed_', '');
        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const totalCost = SEEDS[seedKey].price * qty;

        if (userData.money < totalCost) {
            return interaction.reply({ content: `❌ Không đủ tiền! Bạn cần **${formatMoney(totalCost)}**`, ephemeral: true });
        }
        userData.money -= totalCost;
        userData.inventory[seedLabel(seedKey)] = (userData.inventory[seedLabel(seedKey)] || 0) + qty;
        saveData();
        return interaction.reply({ content: `✅ Mua thành công **${qty}x ${SEEDS[seedKey].name}** với giá **${formatMoney(totalCost)}**`, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_plant_')) {
        const seedKey = interaction.customId.replace('modal_plant_', '');
        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const result = plantSeeds(userData, seedKey, qty);
        saveData();
        if (!result.planted) return interaction.reply({ content: `❌ ${result.reason || 'Không thể gieo lúc này.'}`, ephemeral: true });
        return interaction.reply({ content: `🌱 Đã gieo thành công **${result.planted}x ${SEEDS[seedKey].name}**!`, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_harvest_')) {
        const seedKey = interaction.customId.replace('modal_harvest_', '');
        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const result = harvestPlotsBySeed(userData, seedKey, qty);
        saveData();
        if (!result.removedCount) return interaction.reply({ content: '❌ Không có cây nào đủ chín để thu hoạch!', ephemeral: true });

        let msg = `🍎 Thu hoạch **${result.removedCount}** ô **${SEEDS[seedKey].name}** và nhận **${result.gained} ${SEEDS[seedKey].harvest}**.`;
        if (result.isMutation) msg += '\n💎 Có một lô **đột biến**!';
        else if (result.isRare) msg += '\n⭐ Có một lô **thu hoạch hiếm**!';
        return interaction.reply({ content: msg, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_buyanimal_')) {
        const animalKey = interaction.customId.replace('modal_buyanimal_', '');
        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const result = buyAnimals(userData, animalKey, qty);
        saveData();
        if (!result.bought) return interaction.reply({ content: `❌ ${result.reason || 'Không thể mua gia súc.'}`, ephemeral: true });
        return interaction.reply({ content: `✅ Đã mua **${result.bought}x ${ANIMALS[animalKey].name}** với giá **${formatMoney(ANIMALS[animalKey].price * result.bought)}**`, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_feedanimal_')) {
        const animalKey = interaction.customId.replace('modal_feedanimal_', '');
        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const result = feedAnimals(userData, animalKey, qty);
        saveData();
        if (!result.fed) return interaction.reply({ content: `❌ ${result.reason || 'Không thể cho ăn.'}`, ephemeral: true });
        return interaction.reply({ content: `🍽️ Đã cho ăn **${result.fed}x ${ANIMALS[animalKey].name}** thành công!`, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_slaughteranimal_')) {
        const animalKey = interaction.customId.replace('modal_slaughteranimal_', '');
        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const result = slaughterAnimals(userData, animalKey, qty);
        saveData();
        if (!result.slain) return interaction.reply({ content: `❌ ${result.reason || 'Không thể giết mổ.'}`, ephemeral: true });
        return interaction.reply({ content: `🔪 Đã giết mổ **${result.slain}x ${ANIMALS[animalKey].name}** và nhận **${result.products} ${ANIMALS[animalKey].produce}**!`, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_eggcollect_')) {
        const animalKey = interaction.customId.replace('modal_eggcollect_', '');
        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const result = collectEggs(userData, qty);
        saveData();
        if (!result.collected) return interaction.reply({ content: `❌ ${result.reason || 'Không thể nhặt trứng.'}`, ephemeral: true });
        return interaction.reply({ content: `🥚 Đã nhặt **${result.eggs} trứng** từ **${result.collected}x ${ANIMALS[animalKey].name}**!`, ephemeral: true });
    }

    if (interaction.customId.startsWith('modal_expandland_')) {
        const qtyPerPack = parseInt(interaction.customId.replace('modal_expandland_', '')) || 0;
        const packs = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const totalPlots = qtyPerPack * packs;
        const current = userData.farm?.maxPlots || 0;
        const nextTotal = current + totalPlots;
        if (nextTotal > LAND_MAX_PLOTS) {
            return interaction.reply({ content: `❌ Vượt quá giới hạn tối đa **${LAND_MAX_PLOTS} ô đất**.`, ephemeral: true });
        }
        const perPlot = getLandPricePerPlot();
        const totalCost = perPlot * totalPlots;
        if (userData.money < totalCost) {
            return interaction.reply({ content: `❌ Không đủ tiền! Bạn cần **${formatMoney(totalCost)}**`, ephemeral: true });
        }
        userData.money -= totalCost;
        userData.farm.maxPlots = nextTotal;
        saveData();
        return interaction.reply({ content: `✅ Đã mở rộng **+${totalPlots} ô đất** với giá **${formatMoney(totalCost)}**.`, ephemeral: true });
    }

    if (interaction.customId.startsWith('trade_qty_')) {
        const sessionId = interaction.customId.replace('trade_qty_', '');
        const session = guildData.tradeSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên trade đã hết hạn.', ephemeral: true });
        const chosen = guildData.tradeDrafts?.[sessionId]?.[userId];
        if (!chosen) return interaction.reply({ content: '❌ Bạn chưa chọn vật phẩm để trade.', ephemeral: true });

        const qty = Math.max(1, parseInt(interaction.fields.getTextInputValue('qty')) || 1);
        const myOffer = session.offers[userId] || (session.offers[userId] = { items: {}, confirmed: false });
        const have = userData.inventory[chosen] || 0;
        if (have < qty) return interaction.reply({ content: `❌ Bạn chỉ có **${have}** ${chosen}.`, ephemeral: true });
        myOffer.items[chosen] = (myOffer.items[chosen] || 0) + qty;
        myOffer.confirmed = false;

        guildData.tradeDrafts[sessionId][userId] = null;
        saveData();
        await refreshTradeMessage(client, guildId, session);
        return interaction.reply({ content: `✅ Đã thêm **${qty}x ${chosen}** vào giao dịch.`, ephemeral: true });
    }
}

if (interaction.isButton()) {
    const cid = interaction.customId || '';
    if (cid.startsWith('farm_btn_')) {
        const action = cid.split('_')[2];
        const ownerId = cid.split('_')[3];
        if (ownerId && ownerId !== userId) {
            return interaction.reply({ content: '⚠️ Đây không phải nút của bạn.', ephemeral: true });
        }

        if (action === 'shop') {
            return interaction.reply({ content: '🛒 **CỬA HÀNG HẠT GIỐNG**', components: makeSeedShopComponents(), ephemeral: true });
        }
        if (action === 'plant') {
            const availableSeeds = Object.keys(SEEDS).filter(key => (userData.inventory[seedLabel(key)] || 0) > 0);
            if (availableSeeds.length === 0) return interaction.reply({ content: '❌ Bạn không có hạt giống nào trong kho!', ephemeral: true });
            return interaction.reply({ content: '🌱 **GIEP HẠT**', components: makePlantComponents(userData), ephemeral: true });
        }
        if (action === 'harvest') {
            const ready = createCropOptionsFromPlots(userData);
            if (!Object.keys(ready).length) return interaction.reply({ content: '❌ Chưa có cây nào đủ chín để thu hoạch!', ephemeral: true });
            return interaction.reply({ content: '🍎 **THU HOẠCH**', components: makeHarvestComponents(userData), ephemeral: true });
        }
        if (action === 'food') {
            const availableFood = Object.keys(FOODS).filter(key => (userData.inventory[FOODS[key].name] || 0) > 0);
            if (availableFood.length === 0) return interaction.reply({ content: '❌ Bạn không có thức ăn nào trong kho!', ephemeral: true });
            return interaction.reply({ content: '🍽️ **BÀN ĂN**', components: makeFoodComponents(userData), ephemeral: true });
        }
        if (action === 'trade') {
            return interaction.reply({ content: '🔁 Dùng `!trade @người_chơi` để mở giao dịch.', ephemeral: true });
        }
    }

    if (cid.startsWith('ban_confirm_')) {
        const sessionId = cid.replace('ban_confirm_', '');
        const session = guildData.farmSellSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên bán nông sản đã hết hạn.', ephemeral: true });
        if (session.userId !== userId) return interaction.reply({ content: '⚠️ Phiên này không phải của bạn.', ephemeral: true });

        const selected = Array.isArray(session.selected) ? session.selected : [];
        if (!selected.length) return interaction.reply({ content: '❌ Bạn chưa chọn loại cây nào để bán.', ephemeral: true });

        updateFarmDiseaseState(userData);
        let totalEarned = 0;
        const soldLines = [];
        let soldCount = 0;

        for (const seedKey of selected) {
            const seed = SEEDS[seedKey];
            if (!seed) continue;
            const cropName = seed.harvest;
            const have = Number(userData.inventory?.[cropName] || 0);
            if (have <= 0) continue;
            const price = currentMarketPrices[cropName] ?? MARKET_BASE_PRICES[cropName] ?? 0;
            const earned = have * price;
            totalEarned += earned;
            soldCount += 1;
            soldLines.push(`• ${seed.icon || '🌾'} ${cropName} ×${have} → **${formatMoney(earned)}**`);
            userData.inventory[cropName] = 0;
            delete userData.inventory[cropName];
        }

        if (totalEarned <= 0) {
            return interaction.reply({ content: '❌ Không còn nông sản nào hợp lệ trong lựa chọn của bạn.', ephemeral: true });
        }

        userData.money += totalEarned;
        delete guildData.farmSellSessions[sessionId];
        saveData();

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle('✅ BÁN NÔNG SẢN THÀNH CÔNG')
            .setDescription(soldLines.join('\n').slice(0, 3900))
            .addFields({ name: '💸 Tổng tiền nhận', value: `**${formatMoney(totalEarned)}**`, inline: false });

        await interaction.update({ content: null, embeds: [embed], components: [] }).catch(async () => {
            await interaction.reply({ content: `✅ Đã bán thành công và nhận **${formatMoney(totalEarned)}**`, ephemeral: true });
        });
        return;
    }

    if (cid.startsWith('ban_clear_')) {
        const sessionId = cid.replace('ban_clear_', '');
        const session = guildData.farmSellSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên bán nông sản đã hết hạn.', ephemeral: true });
        if (session.userId !== userId) return interaction.reply({ content: '⚠️ Phiên này không phải của bạn.', ephemeral: true });
        session.selected = [];
        saveData();
        const embed = buildBanSellEmbed(userData, session);
        return interaction.update({ embeds: [embed], components: buildBanSellComponents(userData, sessionId) });
    }

    if (cid.startsWith('ban_cancel_')) {
        const sessionId = cid.replace('ban_cancel_', '');
        const session = guildData.farmSellSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên bán nông sản đã hết hạn.', ephemeral: true });
        if (session.userId !== userId) return interaction.reply({ content: '⚠️ Phiên này không phải của bạn.', ephemeral: true });
        delete guildData.farmSellSessions[sessionId];
        saveData();
        return interaction.update({ content: '❌ Đã hủy bán nông sản.', embeds: [], components: [] }).catch(() => {});
    }

    if (cid.startsWith('trade_accept_')) {
        const sessionId = cid.replace('trade_accept_', '');
        const session = guildData.tradeSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên trade đã hết hạn.', ephemeral: true });
        if (interaction.user.id !== session.userB) return interaction.reply({ content: '⚠️ Chỉ người được mời mới có thể chấp nhận.', ephemeral: true });
        session.status = 'active';
        saveData();
        await refreshTradeMessage(client, guildId, session);
        return interaction.reply({ content: '✅ Bạn đã chấp nhận trade. Bấm **Thêm đồ** để chọn vật phẩm.', ephemeral: true });
    }

    if (cid.startsWith('trade_decline_')) {
        const sessionId = cid.replace('trade_decline_', '');
        const session = guildData.tradeSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên trade đã hết hạn.', ephemeral: true });
        if (interaction.user.id !== session.userB) return interaction.reply({ content: '⚠️ Chỉ người được mời mới có thể từ chối.', ephemeral: true });
        delete guildData.tradeSessions[sessionId];
        delete guildData.tradeDrafts[sessionId];
        saveData();
        await interaction.update({ content: '❌ Giao dịch đã bị từ chối.', embeds: [], components: [] }).catch(() => {});
        return;
    }

    if (cid.startsWith('trade_add_')) {
        const sessionId = cid.replace('trade_add_', '');
        const session = guildData.tradeSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên trade đã hết hạn.', ephemeral: true });
        if (![session.userA, session.userB].includes(interaction.user.id)) return interaction.reply({ content: '⚠️ Bạn không nằm trong phiên trade này.', ephemeral: true });

        const tradables = getTradableInventory(getFarmUser(interaction.user.id, guildId));
        if (!tradables.length) return interaction.reply({ content: '❌ Bạn không có vật phẩm hợp lệ để trade.', ephemeral: true });

        const select = new StringSelectMenuBuilder()
            .setCustomId(`trade_pick_${sessionId}`)
            .setPlaceholder('Chọn vật phẩm muốn thêm vào trade')
            .addOptions(createOptionListForSelect(tradables.map(it => ({
                label: it.name,
                description: `Đang có: ${it.qty}`,
                value: it.name,
                emoji: '📦'
            }))));

        return interaction.reply({ content: '📦 Chọn vật phẩm:', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
    }

    if (cid.startsWith('trade_confirm_')) {
        const sessionId = cid.replace('trade_confirm_', '');
        const session = guildData.tradeSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên trade đã hết hạn.', ephemeral: true });
        if (![session.userA, session.userB].includes(interaction.user.id)) return interaction.reply({ content: '⚠️ Bạn không nằm trong phiên trade này.', ephemeral: true });

        const myOffer = session.offers[interaction.user.id];
        myOffer.confirmed = !myOffer.confirmed;
        session.status = myOffer.confirmed ? 'active' : 'active';
        saveData();
        await refreshTradeMessage(client, guildId, session);

        const otherId = interaction.user.id === session.userA ? session.userB : session.userA;
        const otherOffer = session.offers[otherId];

        if (myOffer.confirmed && otherOffer.confirmed && session.status !== 'countdown') {
            session.status = 'countdown';
            saveData();
            await refreshTradeMessage(client, guildId, session);

            setTimeout(async () => {
                const latest = guildData.tradeSessions?.[sessionId];
                if (!latest || latest.status !== 'countdown') return;
                const latestA = latest.offers?.[latest.userA];
                const latestB = latest.offers?.[latest.userB];
                if (!latestA?.confirmed || !latestB?.confirmed) return;
                const a = latest.offers[latest.userA];
                const b = latest.offers[latest.userB];

                const uA = getFarmUser(latest.userA, guildId);
                const uB = getFarmUser(latest.userB, guildId);

                const canTransfer = (fromUser, offer) => {
                    for (const [name, qty] of Object.entries(offer.items || {})) {
                        if ((fromUser.inventory[name] || 0) < qty) return false;
                    }
                    return true;
                };

                if (!canTransfer(uA, a) || !canTransfer(uB, b)) {
                    latest.status = 'failed';
                    saveData();
                    await refreshTradeMessage(client, guildId, latest);
                    return;
                }

                for (const [name, qty] of Object.entries(a.items || {})) {
                    uA.inventory[name] -= qty;
                    uB.inventory[name] = (uB.inventory[name] || 0) + qty;
                }
                for (const [name, qty] of Object.entries(b.items || {})) {
                    uB.inventory[name] -= qty;
                    uA.inventory[name] = (uA.inventory[name] || 0) + qty;
                }

                delete guildData.tradeSessions[sessionId];
                delete guildData.tradeDrafts[sessionId];
                saveData();

                await refreshTradeMessage(client, guildId, { ...latest, status: 'hoàn tất' });
                const guild = client.guilds.cache.get(guildId);
                const ch = guild ? await guild.channels.fetch(latest.channelId).catch(() => null) : null;
                if (ch) {
                    await ch.send(`✅ Giao dịch thành công giữa <@${latest.userA}> và <@${latest.userB}>!`);
                }
            }, 3000);
        }
        return interaction.reply({ content: `✅ Bạn đã ${myOffer.confirmed ? 'xác nhận' : 'bỏ xác nhận'} giao dịch.`, ephemeral: true });
    }

    if (cid.startsWith('trade_cancel_')) {
        const sessionId = cid.replace('trade_cancel_', '');
        const session = guildData.tradeSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên trade đã hết hạn.', ephemeral: true });
        if (![session.userA, session.userB].includes(interaction.user.id)) return interaction.reply({ content: '⚠️ Bạn không nằm trong phiên trade này.', ephemeral: true });
        delete guildData.tradeSessions[sessionId];
        delete guildData.tradeDrafts[sessionId];
        saveData();
        return interaction.update({ content: '❌ Giao dịch đã bị hủy.', embeds: [], components: [] }).catch(() => {});
    }

    if (cid.startsWith('trade_pick_')) {
        const sessionId = cid.replace('trade_pick_', '');
        const session = guildData.tradeSessions?.[sessionId];
        if (!session) return interaction.reply({ content: '❌ Phiên trade đã hết hạn.', ephemeral: true });
        if (![session.userA, session.userB].includes(interaction.user.id)) return interaction.reply({ content: '⚠️ Bạn không nằm trong phiên trade này.', ephemeral: true });
        const itemName = interaction.values[0];
        if (!guildData.tradeDrafts[sessionId]) guildData.tradeDrafts[sessionId] = {};
        guildData.tradeDrafts[sessionId][interaction.user.id] = itemName;
        saveData();

        const modal = buildQuantityModal(
            `trade_qty_${sessionId}`,
            `Trade ${itemName}`,
            'Nhập số lượng muốn trade:',
            '1',
            `Vật phẩm: ${itemName}`
        );
        return interaction.showModal(modal);
    }
}

        // --- 0. XỬ LÝ AUTOCOMPLETE (GỢI Ý TỰ ĐỘNG CHO ĐÀI XỔ SỐ) ---
        if (interaction.isAutocomplete()) {
            const commandName = interaction.commandName;
            if (commandName === 'dailyveso') {
                const focusedValue = interaction.options.getFocused().toLowerCase();
                const selectedMien = interaction.options.getString('mien'); // Lấy miền người dùng đã chọn trước đó

                let validStations = ALL_XS_STATIONS;
                // Nếu đã chọn miền, gợi ý đài sẽ bị khóa theo miền đó
                if (selectedMien && XS_STATIONS[selectedMien]) {
                    validStations = XS_STATIONS[selectedMien];
                }

                // Lọc theo từ khóa người dùng gõ (và luôn giới hạn trả về tối đa 25 theo luật Discord)
                const filtered = validStations
                    .filter(station => station.toLowerCase().includes(focusedValue))
                    .slice(0, 25);
                    
                await interaction.respond(
                    filtered.map(station => ({ name: station, value: station }))
                );
            }
            return;
        }
        
        // ---> ĐOẠN CODE THÊM MỚI Ở ĐÂY <---
        // KIỂM TRA TRẠNG THÁI TÙ GIAM ĐỂ CHẶN TƯƠNG TÁC BUTTON, MENU, SLASH COMMANDS
        if (guildData.prisonUsers && guildData.prisonUsers[userId]) {
            const prisonData = guildData.prisonUsers[userId];
            // Nếu vẫn đang trong thời gian phạt tù
            if (Date.now() < prisonData.releaseTime) {
                return interaction.reply({ 
                    content: '⚠️ **Bạn đang chịu án phạt tù!** Bạn không thể tương tác với nút bấm hoặc lệnh của bot lúc này.', 
                    ephemeral: true 
                });
            } else {
                // Nếu đã hết hạn tù thì gỡ án và cho đi tiếp
                const prisonRole = interaction.guild?.roles.cache.get(guildData.prisonConfig?.roleId);
                if (prisonRole) await interaction.member.roles.remove(prisonRole).catch(() => {});
                delete guildData.prisonUsers[userId];
                saveData();
            }
        }

        // --- 1. LỆNH SLASH COMMANDS ---
        if (interaction.isChatInputCommand()) {
            const { commandName, options, user } = interaction;

                   if (commandName === 'dailyveso') {
            const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.guild.ownerId === interaction.user.id;
            if (!isAdmin) return interaction.reply({ content: '❌ Chỉ Quản trị viên mới có thể sử dụng lệnh này!', ephemeral: true });
            
            const mien = interaction.options.getString('mien');
            const channel = interaction.options.getChannel('kenhbaotrung');
            const dais = [];
            
            for (let i = 1; i <= 4; i++) {
                const daiVal = interaction.options.getString(`dai${i}`);
                if (daiVal && !dais.includes(daiVal)) {
                    // Kiểm tra kỹ xem người dùng có nhập chuẩn tên đài không
                    if (ALL_XS_STATIONS.includes(daiVal)) {
                        dais.push(daiVal);
                    }
                }
            }

            if (dais.length === 0) {
                return interaction.reply({ content: '❌ Bạn chưa chọn đài hợp lệ nào! Hãy dùng danh sách gợi ý.', ephemeral: true });
            }

            if (!guildData.lotteryConfig) guildData.lotteryConfig = {};
            guildData.lotteryConfig.mien = mien;
            guildData.lotteryConfig.dais = dais; 
            guildData.lotteryConfig.channelId = channel.id;
            saveData();

            return interaction.reply({ 
                content: `<a:emoji_75:1523998959570522263> **Cài đặt hệ thống đa đài thành công!**\n🗺️ Khu vực: **Miền ${mien}**\n📍 Đài mở thưởng hôm nay: **${dais.join(', ')}**\n📣 Kênh báo kết quả: <#${channel.id}>`, 
                ephemeral: true 
            });
        }

            
if (commandName === 'capquyenkenh') {
    const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.guild.ownerId === user.id;
    if (!isAdmin) return interaction.reply({ content: '❌ Chỉ Chủ Server hoặc Quản trị viên mới có thể sử dụng lệnh này!', ephemeral: true });

    const nhaTuChannel = options.getChannel('nha_tu');
    const prisonRole = options.getRole('role');

    guildData.prisonConfig = {
        channelId: nhaTuChannel.id,
        roleId: prisonRole.id
    };
    saveData();

    return interaction.reply({ 
        content: `<a:emoji_75:1523998959570522263> **Thiết lập hệ thống tù giam thành công!**\n📍 Kênh cải tạo: <#${nhaTuChannel.id}>\n🎭 Role tù nhân: <@&${prisonRole.id}>`, 
        ephemeral: true 
    });
}

if (commandName === 'borrow') {
        // Tính toán số nợ (x10) và thời gian (15 phút)
    const debtAmount = money * 10; 
    const duration = 15 * 60 * 1000; // 15 phút 

    // CHỈNH SỬA Ở ĐÂY: Hệ số phạt dựa vào SỐ TIỀN PHẢI TRẢ (debtAmount)
    // Cứ 100k tiền NỢ sẽ tăng hệ số lên 1 (VD: Vay 100k -> Nợ 1 Triệu -> Hệ số 10 -> Tù 50 tiếng, mỗi nv 10 lần)
    const factor = Math.max(1, Math.ceil(debtAmount / 100000)); 

    // Cộng tiền vay vào tài khoản người dùng
    addBalance(userId, money, guildId);

    // Ghi nhận nợ vào hệ thống
    guildData.debts[userId] = {
        amount: debtAmount, 
        originalAmount: money,
        deadline: Date.now() + duration, 
        factor: factor // Lưu hệ số khủng này vào database
    };
    saveData();

    const embed = new EmbedBuilder()
        .setColor('#e74c3c')
        .setTitle('💸 HỢP ĐỒNG TÍN DỤNG ĐEN ĐÃ KÝ 💸')
        .setDescription(`👤 Người vay: <@${userId}>\n💰 Số tiền thực nhận: **${money.toLocaleString()} VNĐ**\n\n⚠️ **KHOẢN NỢ PHẢI TRẢ (x10):** **${debtAmount.toLocaleString()} VNĐ**\n⏳ **Thời hạn vay:** **15 phút**.\n\n👉 Hãy dùng lệnh \`/trano\` để thanh toán khoản nợ này trước khi hết hạn!\n🚨 *Nếu quá hạn 15 phút mà chưa trả, bạn sẽ bị bắt giam để đày lao động công ích!*`)
        .setTimestamp();

    return interaction.reply({ embeds: [embed] });
}

if (commandName === 'trano') {
    if (!guildData.debts || !guildData.debts[userId]) {
        return interaction.reply({ content: '<a:emoji_75:1523998959570522263> Hồ sơ trong sạch! Bạn hiện không có khoản nợ tín dụng đen nào.', ephemeral: true });
    }

    const debt = guildData.debts[userId];
    const currentBalance = getBalance(userId, guildId);

    // Kiểm tra tiền xem có đủ trả không
    if (currentBalance < debt.amount) {
        return interaction.reply({ content: `❌ Bạn không đủ tiền! Bạn cần **${debt.amount.toLocaleString()} VNĐ** để trả nợ. (Ví hiện tại: ${currentBalance.toLocaleString()} VNĐ)`, ephemeral: true });
    }

    // Trừ tiền trả nợ và xoá hồ sơ nợ
    addBalance(userId, -debt.amount, guildId);
    delete guildData.debts[userId];
    saveData();

    const embed = new EmbedBuilder()
        .setColor('#2ecc71')
        .setTitle('<a:emoji_75:1523998959570522263> THANH TOÁN NỢ THÀNH CÔNG')
        .setDescription(`Cảm ơn <@${userId}> đã thanh toán đủ khoản nợ **${debt.amount.toLocaleString()} VNĐ**.\nBạn đã an toàn không bị xã hội đen tìm tới và tống giam!`)
        .setTimestamp();

    return interaction.reply({ embeds: [embed] });
}

if (commandName === 'doino') {
    // ADMIN_ID đã được khai báo ở dòng 70 trong source của bạn
    if (userId !== ADMIN_ID) {
        return interaction.reply({ content: '❌ Bạn không phải là Chủ Bot (Đại Ca) để dùng lệnh này!', ephemeral: true });
    }

    const phut = options.getInteger('phut');
    if (phut <= 0) return interaction.reply({ content: '❌ Thời gian chót phải lớn hơn 0!', ephemeral: true });

    const debts = guildData.debts;
    if (!debts || Object.keys(debts).length === 0) {
        return interaction.reply({ content: '<a:emoji_75:1523998959570522263> Hiện tại server không có ai đang vay nặng lãi cả. Không cần đòi!', ephemeral: true });
    }

    const debtorIds = Object.keys(debts);
    const deadlineTime = Date.now() + (phut * 60 * 1000);
    let pings = [];

    // Duyệt qua tất cả con nợ
    for (const dId of debtorIds) {
        // 1. Gia hạn thời gian chót bằng với số phút Chủ bot yêu cầu
        debts[dId].deadline = deadlineTime;
        
        // 2. Tính lại hệ số phạt nặng hơn dựa trên SỐ TIỀN NỢ (đã x10)
        // Cứ mỗi 100,000đ NỢ = 1 Hệ số. Nợ 1 triệu = Hệ số 10.
        const heavyFactor = Math.max(1, Math.ceil(debts[dId].amount / 100000));
        debts[dId].factor = heavyFactor; 
        
        pings.push(`<@${dId}>`);
    }
    saveData();

    const embed = new EmbedBuilder()
        .setColor('#8b0000') // Màu đỏ sẫm
        .setTitle('🚨 TỐI HẬU THƯ TỪ CHỦ NỢ 🚨')
        .setDescription(`Đại ca <@${ADMIN_ID}> đã ra lệnh thu hồi nợ khẩn cấp!\n\nTất cả những người có tên dưới đây có đúng **${phut} phút** để thanh toán toàn bộ khoản nợ bằng lệnh \`/trano\`.\n\n⚠️ **CẢNH BÁO:** Nếu không trả đúng hạn, hệ thống sẽ tự động tống giam vào nhà tù.\n📈 **Nợ càng nhiều, thời gian thụ án càng lâu và khối lượng lao động công ích càng khổng lồ!**`)
        .addFields({ name: '👤 Danh sách con nợ bị truy nã:', value: pings.join(', ') })
        .setTimestamp();

    // Ping tất cả con nợ ở ngoài nội dung để họ nhận được thông báo đỏ
    return interaction.reply({ content: `🔔 **Kêu gọi:** ${pings.join(', ')}`, embeds: [embed] });
}

            if (commandName === 'tratudo') {
                // 1. Kiểm tra quyền hạn: Chỉ Admin hoặc Owner mới được dùng
                const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.guild.ownerId === user.id;
                if (!isAdmin) {
                    return interaction.reply({ content: '❌ Chỉ Chủ Server hoặc Quản trị viên mới có thể sử dụng lệnh này!', ephemeral: true });
                }

                // 2. Lấy thông tin user được tag
                const targetUser = options.getUser('user');
                const targetId = targetUser.id;

                // 3. Kiểm tra xem người này có đang ở trong tù không
                if (!guildData.prisonUsers || !guildData.prisonUsers[targetId]) {
                    return interaction.reply({ content: `⚠️ <@${targetId}> hiện tại đang là công dân lương thiện, không có án phạt tù nào!`, ephemeral: true });
                }

                // 4. Xóa dữ liệu tù nhân và lưu database
                delete guildData.prisonUsers[targetId];
                saveData();

                // 5. Gỡ Role nhà tù (nếu có setup)
                const prisonRole = interaction.guild.roles.cache.get(guildData.prisonConfig?.roleId);
                if (prisonRole) {
                    try {
                        const member = await interaction.guild.members.fetch(targetId).catch(() => null);
                        if (member) {
                            await member.roles.remove(prisonRole).catch(() => {});
                        }
                    } catch (e) {
                        console.error('Lỗi gỡ role khi trả tự do:', e);
                    }
                }

                // 6. Thông báo thành công
                const embed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🕊️ QUYẾT ĐỊNH ĐẶC XÁ 🕊️')
                    .setDescription(`Admin/Owner <@${user.id}> đã ban hành lệnh đặc xá!\n\nToàn bộ án phạt công ích của <@${targetId}> đã được gỡ bỏ. Đối tượng đã được trả lại toàn bộ quyền sử dụng bot và tương tác bình thường.`)
                    .setTimestamp();

                return interaction.reply({ embeds: [embed] });
            }
            
            if (commandName === 'buff') {
                if (user.id !== ADMIN_ID) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Bạn không có quyền sử dụng lệnh này!', ephemeral: true });
                const targetUser = options.getUser('user'); 
                const amount = options.getInteger('money');
                addBalance(targetUser.id, amount, guildId);
                return interaction.reply({ content: `⚡ **[ADMIN SYSTEM]** Đã buff ẩn danh **+${amount}💸** cho <@${targetUser.id}>.\nSố dư mới: \`${getBalance(targetUser.id, guildId)}💸\``, ephemeral: true });
            }

            if (commandName === 'give') {
                const targetUser = options.getUser('user');
                const amount = options.getInteger('money');
                if (amount <= 0 || getBalance(user.id, guildId) < amount) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Số tiền không hợp lệ hoặc bạn không đủ số dư!', ephemeral: true });
                addBalance(user.id, -amount, guildId); 
                addBalance(targetUser.id, amount, guildId);
                return interaction.reply({ content: `💸 <@${user.id}> đã chuyển **${amount}💸** cho <@${targetUser.id}>!` });
            }

            if (commandName === 'sell') {
                const isAdmin = interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) || interaction.guild.ownerId === user.id;
                if (!isAdmin) {
                    return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Chỉ Chủ Server hoặc Admin mới có thể sử dụng lệnh này!', ephemeral: true });
                }
                
                const role = options.getRole('role');
                const price = options.getInteger('price');
                const code = options.getString('code');
                const guildId = interaction.guildId;
                
                if (!db.shop[guildId]) db.shop[guildId] = {};
                db.shop[guildId][code] = { roleId: role.id, price: price };
                saveData();

                return interaction.reply({ 
                    content: `<a:emoji_75:1524039622668189806>  Thành công! Bạn đã đặt bán role <@&${role.id}> tại cửa hàng của server này.\n💸 Mức giá: **${price.toLocaleString()} VNĐ**\n📦 Mã hàng hóa: \`${code}\``, 
                    ephemeral: true 
                });
            }
        }

        // --- 2. NÚT BẤM (BUTTONS) ---
        if (interaction.isButton()) {
        
                 if (id && id.startsWith('btnveso_')) {
    const index = parseInt(id.split('_')[1]);
    if (!guildData.lotteryConfig || !guildData.lotteryConfig.dais || !guildData.lotteryConfig.dais[index]) {
        return interaction.reply({ content: '⚠️ Đài này không còn tồn tại hoặc dữ liệu cấu hình đã thay đổi!', ephemeral: true });
    }
    const daiName = guildData.lotteryConfig.dais[index];

    const modal = new ModalBuilder()
        .setCustomId(`modalveso_${index}`)
        .setTitle(`Mua Vé Số - Đài ${daiName}`);

    const qtyInput = new TextInputBuilder()
        .setCustomId('veso_qty')
        .setLabel(`Số lượng mua đài ${daiName} (10k/tờ)`)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Ví dụ: 5')
        .setRequired(true);

    modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));
    await interaction.showModal(modal);
    return;
}

            
                        // NÚT MỞ BẢNG NHẬP TIỀN SLOT MACHINE
            if (id.startsWith('btn_slot_bet_')) {
                const targetUserId = id.split('_')[3];
                
                // Kiểm tra xem có đúng người gõ lệnh bấm không
                if (interaction.user.id !== targetUserId) {
                    return interaction.reply({ content: '❌ Máy quay này không phải của bạn! Hãy tự gõ lệnh !mayquaythuong.', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId('modal_slot_bet')
                    .setTitle('🎰 Đặt Cược Slot Machine');

                const input = new TextInputBuilder()
                    .setCustomId('slot_bet_amount')
                    .setLabel('Nhập số tiền bạn muốn cược:')
                    .setPlaceholder('Ví dụ: 100')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }
            
            // XỬ LÝ NÚT BẤM MỞ BẢNG MA SÓI (DẠNG ẨN)
            if (id.startsWith('masoi_panel_')) {
                const guildId = id.replace('masoi_panel_', '');
                const game = activeGames.masoi.get(guildId);
                
                if (!game || game.status !== 'night') {
                    return interaction.reply({ content: '❌ Hiện không phải ban đêm hoặc ván đấu đã kết thúc!', ephemeral: true });
                }
                
                if (!game.players.includes(userId) || !game.playerRoles[userId].alive) {
                    return interaction.reply({ content: '👻 Bạn không có quyền tham gia hoặc đã chết!', ephemeral: true });
                }

                if (!game.nightActionUsedUsers) game.nightActionUsedUsers = new Set();
                if (game.nightActionUsedUsers.has(userId)) {
                    return interaction.reply({ content: '⛔ Bạn đã mở và dùng kỹ năng đêm nay rồi. Mỗi người chỉ được thao tác **1 lần** mỗi đêm!', ephemeral: true });
                }
                game.nightActionUsedUsers.add(userId);

                const userRole = game.playerRoles[userId].role;
                const alivePlayers = game.players.filter(id => game.playerRoles[id].alive);

                let skillText = "Bạn không có kỹ năng đặc biệt. Hãy ngủ ngon!";
                let components = [];

                // Discord select menu chỉ hỗ trợ tối đa 25 lựa chọn.
                // Nếu phòng đông, ta vẫn hiển thị menu bằng cách rút gọn danh sách an toàn.
                const buildOptions = (ids, limit = 25) => ids.slice(0, limit).map(id => {
                    const u = client.users.cache.get(id);
                    const rawName = (u?.username || `Người chơi ${String(id).slice(-4)}`).toString();
                    return {
                        label: rawName.slice(0, 100),
                        value: id
                    };
                });

                const options = buildOptions(alivePlayers);

                if (userRole === 'Sói') {
                    skillText = "Bạn là SÓI. Hãy chọn mục tiêu để cắn đêm nay.";
                    components.push(new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId(`wolf_${guildId}`).setPlaceholder('Chọn mục tiêu cắn...').addOptions(options)
                    ));
                } else if (userRole === 'Tiên tri') {
                    // Thêm điều kiện check xem Tiên tri đã soi chưa
                    if (game.nightActions.seerTarget) {
                        skillText = "Bạn là TIÊN TRI. Bạn đã sử dụng kỹ năng soi người trong đêm nay rồi, hãy ngủ ngon!";
                    } else {
                        skillText = "Bạn là TIÊN TRI. Hãy soi 1 người để biết phe của họ.";
                        components.push(new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder().setCustomId(`seer_${guildId}`).setPlaceholder('Chọn người để soi...').addOptions(options)
                        ));
                    }
                } else if (userRole === 'Bảo vệ') {
                    skillText = "Bạn là BẢO VỆ. Hãy chọn 1 người để bảo vệ đêm nay.";
                    if (options.length > 0) {
                        components.push(new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder()
                                .setCustomId(`guard_${guildId}`)
                                .setPlaceholder('Chọn người để bảo vệ...')
                                .addOptions(options)
                        ));
                        if (alivePlayers.length > 25) {
                            skillText += "\n\n⚠️ Danh sách đã được rút gọn còn 25 người đầu tiên do giới hạn của Discord.";
                        }
                    } else {
                        skillText += "\n\n⚠️ Không có người chơi nào khả dụng để bảo vệ.";
                    }
                } else if (userRole === 'Phù thủy') {
                    skillText = "Bạn là PHÙ THỦY. Bạn có 1 bình CỨU và 1 bình ĐỘC.\n*(Mẹo: Bạn có thể chọn cứu 1 người để bảo vệ họ khỏi Sói. Nếu muốn dùng cả 2 bình trong 1 đêm, hãy dùng 1 bình trước, sau đó bấm lại nút 'Xem Vai Trò' ở tin nhắn gốc để dùng bình còn lại).*";

                    // Menu Bình Cứu
                    if (!game.witchSaveUsed) {
                        const saveOptions = [...options, { label: '🧬 Bỏ qua (Không cứu)', value: 'skip_save' }];
                        components.push(new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder().setCustomId(`witch_save_${guildId}`).setPlaceholder('Dùng Bình Cứu cho ai?').addOptions(saveOptions)
                        ));
                    } else {
                        skillText += "\n\n❌ **Bạn đã sử dụng hết Bình Cứu!**";
                    }

                    // Menu Bình Độc
                    if (!game.witchPoisonUsed) {
                        const poisonOptions = [...options, { label: '🧪 Bỏ qua (Không độc)', value: 'skip_poison' }];
                        components.push(new ActionRowBuilder().addComponents(
                            new StringSelectMenuBuilder().setCustomId(`witch_poison_${guildId}`).setPlaceholder('Tạt Bình Độc vào ai?').addOptions(poisonOptions)
                        ));
                    } else {
                        skillText += "\n\n❌ **Bạn đã sử dụng hết Bình Độc!**";
                    }
                } else if (userRole === 'Cupid') {
                    skillText = "Bạn là CUPID. Hãy chọn 2 người để ghép đôi (Họ sẽ sống chết có nhau).";
                    components.push(new ActionRowBuilder().addComponents(
                        new StringSelectMenuBuilder().setCustomId(`cupid_${guildId}`).setPlaceholder('Ghép đôi 2 người...').setMinValues(2).setMaxValues(2).addOptions(options)
                    ));
                } else if (userRole === 'Thợ săn') {
                    skillText = "Bạn là THỢ SĂN. Nếu bạn bị giết đêm nay hoặc bị treo cổ, bạn sẽ mang theo 1 người bất kỳ.";
                } else if (userRole === 'Già làng') {
                    skillText = `Bạn là GIÀ LÀNG. Bạn có 2 mạng khi bị sói cắn. Số mạng hiện tại: ${game.playerRoles[userId].hp}`;
                } else if (userRole === 'Bán sói' || userRole === 'Phản bội') {
                    skillText = "Bạn là BÁN SÓI / KẺ PHẢN BỘI. Bạn sẽ thắng nếu phe Sói thắng. Hãy trà trộn!";
                }

                const roleEmbed = new EmbedBuilder()
                    .setTitle('🎭 VAI TRÒ CỦA BẠN 🎭')
                    .setDescription(`Vai trò của bạn: **${userRole.toUpperCase()}**\n\n📌 **Nhiệm vụ:** ${skillText}\n\n*(Lưu ý: Bạn chỉ có thể chọn 1 lần duy nhất trong đêm)*`)
                    .setColor('#9b59b6');

                return interaction.reply({ embeds: [roleEmbed], components: components, ephemeral: true });
            }

            // GAME XẾP GẠCH
            if (id.startsWith('tetris_')) {
                const game = activeGames.xepgach.get(userId);
                if (!game) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Ván game này đã kết thúc hoặc không tồn tại!', ephemeral: true });
                const action = id.replace('tetris_', '');
                
                if (action === 'stop') {
                    game.gameOver(interaction);
                    return;
                }

                if (!game.isGameOver) {
                    if (action === 'left') game.move(-1, 0);
                    if (action === 'right') game.move(1, 0);
                    if (action === 'rotate') game.rotate();
                    if (action === 'down') game.hardDrop();
                    
                    game.resetTick();
                    game.render(interaction);
                }
                return;
            }
            
            if (id === 'btn_buy_role') {
                const modal = new ModalBuilder()
                    .setCustomId('modal_buy_role')
                    .setTitle('Thanh Toán Cửa Hàng');
                const input = new TextInputBuilder()
                    .setCustomId('buy_code_input')
                    .setLabel('Nhập Mã Role Muốn Mua:')
                    .setPlaceholder('Ví dụ: 404')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);
                    
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }
            
            // GAME CARO
            if (id.startsWith('caro_')) {
                const parts = id.split('_');
                const channelId = parts[1]; 
                const index = parseInt(parts[2]);
                const game = activeGames.caro.get(channelId);
                
                if (!game) return interaction.reply({ content: 'Cờ Caro', ephemeral: true });
                if (userId !== game.turn) return interaction.reply({ content: '❌ Chưa đến lượt của bạn!', ephemeral: true });
                if (game.board[index] !== '⬜') return interaction.reply({ content: '❌Ô này đã được đánh rồi!', ephemeral: true });
                
                const symbol = game.turn === game.p1 ? '❌' : '⭕';
                game.board[index] = symbol;
                
                if (checkWin(game.board, symbol)) {
                    activeGames.caro.delete(channelId);
                    const embed = new EmbedBuilder().setColor('#2f3136').setTitle('Cờ caro').setDescription(`🎉 Chúc mừng <@${game.turn}> (${symbol}) đã giành chiến thắng chung cuộc!`);
                    return interaction.update({ embeds: [embed], components: createCaroComponents(game.board, channelId, true) });
                }

                if (!game.board.includes('⬜')) {
                    activeGames.caro.delete(channelId);
                    const embed = new EmbedBuilder().setColor('#2f3136').setTitle('Cờ Caro').setDescription(`🤝 Bàn cờ đã đầy! Trận đấu kết thúc với kết quả Hòa!`);
                    return interaction.update({ embeds: [embed], components: createCaroComponents(game.board, channelId, true) });
                }

                game.turn = game.turn === game.p1 ? game.p2 : game.p1;
                const nextSymbol = game.turn === game.p1 ? '❌' : '⭕';
                const embed = new EmbedBuilder().setColor('#2f3136').setTitle('Cờ Caro').setDescription(`Ván đấu giữa <@${game.p1}> (<a:emoji_76:1524195723996823612>) và <@${game.p2}> (⭕)\n*Cần 4 quân liên tiếp để chiến thắng.*\n\n👉 Đến lượt của: <@${game.turn}> (${nextSymbol})`);
                return interaction.update({ embeds: [embed], components: createCaroComponents(game.board, channelId) });
            }

            // GAME TÀI XỈU
            if (id.startsWith('tx_btn_')) {
                if (!activeGames.taixiu || activeGames.taixiu.status !== 'betting') {
                    return await interaction.reply({ content: '❌ Sòng đã đóng hoặc đang lắc!', ephemeral: true });
                }

                const choice = id.split('_')[2];
                const choiceName = choice === 'tai' ? 'Tài' : choice === 'xiu' ? 'Xỉu' : choice === 'chan' ? 'Chẵn' : 'Lẻ';
                
                const modal = new ModalBuilder().setCustomId(`modal_tx_bet_${choice}`).setTitle(`Đặt cược: ${choiceName}`);
                const input = new TextInputBuilder().setCustomId('tx_amount_input').setLabel('Nhập tiền đặt:').setStyle(TextInputStyle.Short).setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }

            // GAME BẦU CUA
            if (id === 'bc_btn_join') {
                if (!activeGames.baucua || activeGames.baucua.status !== 'betting') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Sòng đã đóng hoặc đang lắc!', ephemeral: true });
                const selectMenu = new StringSelectMenuBuilder().setCustomId('bc_select_choice').setPlaceholder('Chọn linh vật đặt cược...').addOptions([
                    { label: '🍇 Bầu', value: 'Bầu' }, { label: '🦀 Cua', value: 'Cua' }, { label: '🦐 Tôm', value: 'Tôm' },
                    { label: '🐟 Cá', value: 'Cá' }, { label: '🐓 Gà', value: 'Gà' }, { label: '🦌 Nai', value: 'Nai' }
                ]);
                
                return interaction.reply({ content: '?? Bước 1: Hãy chọn linh vật muốn cược:', components: [new ActionRowBuilder().addComponents(selectMenu)], ephemeral: true });
            }

            // GAME XÌ DÁCH
            if (id.startsWith('pvp_') || id.startsWith('dealer_')) {
                const xd = activeGames.xidach;
                if (!xd) return; 

                if (id === 'pvp_xd_join') {
                    if (xd.status !== 'waiting') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Sòng đã đóng đăng ký!', ephemeral: true });
                    if (userId === xd.dealerId) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Bạn là Nhà Cái!', ephemeral: true });
                    if (xd.players.some(p => p.id === userId)) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Đã có mặt trên bàn!', ephemeral: true });
                    
                    const modal = new ModalBuilder().setCustomId('modal_pvp_bet').setTitle('Tiền Cược Xì Dách');
                    const input = new TextInputBuilder().setCustomId('pvp_bet_input').setLabel('Nhập tiền cược:').setStyle(TextInputStyle.Short).setRequired(true);
                    
                    modal.addComponents(new ActionRowBuilder().addComponents(input));
                    await interaction.showModal(modal);
                    return;
                }

                if (id === 'pvp_xd_check') {
                    if (xd.status !== 'players_turn') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Sai giai đoạn thao tác!', ephemeral: true });
                    const player = xd.players.find(p => p.id === userId);
                    if (!player) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Bạn không ở trong sòng này!', ephemeral: true });
                    return sendPvpPrivateMenu(interaction, player);
                }

                if (id === 'pvp_hit') {
                    if (xd.status !== 'players_turn') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Sai giai đoạn chơi!', ephemeral: true });
                    const player = xd.players.find(p => p.id === userId);
                    if (!player || player.status !== 'playing') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Lỗi hệ thống.', ephemeral: true });
                    
                    player.cards.push(xd.deck.pop());
                    const pInfo = calculatePoints(player.cards);
                    
                    if (pInfo.points > 21) {
                        player.status = 'quac';
                        await interaction.update({ content: `💥 Bài bạn: ${formatCards(player.cards)} (${pInfo.points}đ) -> Bạn bị **QUẮC**!`, components: [] });
                        await updateMainUI(); 
                        return checkAutoSwitchToDealer();
                    } else if (player.cards.length === 5) {
                        player.status = 'stand';
                        await interaction.update({ content: `🔥 Bài bạn: ${formatCards(player.cards)} -> **Ngũ Linh**! Chờ kết quả.`, components: [] });
                        await updateMainUI(); 
                        return checkAutoSwitchToDealer();
                    }
                    return sendPvpPrivateMenu(interaction, player, true);
                }

                if (id === 'pvp_stand') {
                    const player = xd.players.find(p => p.id === userId);
                    if (!player || player.status !== 'playing') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Lỗi thao tác.', ephemeral: true });
                    player.status = 'stand';
                    await interaction.update({ content: `🔒 Bạn đã dằn bài bí mật! Chờ nhà cái xử lý.`, components: [] });
                    await updateMainUI();
                    return checkAutoSwitchToDealer();
                }

                if (id === 'dealer_hit') {
                    if (userId !== xd.dealerId) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Bạn không phải Nhà Cái!', ephemeral: true });
                    xd.dealerCards.push(xd.deck.pop());
                    
                    const dInfo = calculatePoints(xd.dealerCards);
                    if (dInfo.points > 21 || xd.dealerCards.length === 5) return finishPvpGame();
                    const dEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🃏 XÌ DÁCH PVP: LƯỢT NHÀ CÁI 🃏').setDescription(`👑 Nhà Cái <@${xd.dealerId}> vừa rút bài ẩn...`);
                    return interaction.update({ embeds: [dEmbed] });
                }

                if (id === 'dealer_stand') {
                    if (userId !== xd.dealerId) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Bạn không phải Nhà Cái!', ephemeral: true });
                    const dInfo = calculatePoints(xd.dealerCards);
                    if (dInfo.points < 15 && dInfo.special === 'Thường') return interaction.reply({ content: '⚠️ Dưới 15 điểm chưa đủ tuổi dằn bài!', ephemeral: true });
                    await interaction.deferUpdate(); 
                    return finishPvpGame();
                }
            }
        }
        // --- 3. MENU DROP-DOWN ---
        if (interaction.isStringSelectMenu()) {
            
            if (id === 'bc_select_choice') {
                if (!activeGames.baucua || activeGames.baucua.status !== 'betting') return interaction.update({ content: '<a:emoji_76:1524195723996823612> Ván đã đóng cửa cược!', components: [] });
                const choice = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`modal_bc_bet_${choice}`).setTitle(`Đặt cược: ${choice}`);
                const input = new TextInputBuilder().setCustomId('bc_amount_input').setLabel('Nhập tiền đặt:').setStyle(TextInputStyle.Short).setRequired(true);
                
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await interaction.showModal(modal);
                return;
            }

            // BỘ LẮNG NGHE KỸ NĂNG ĐÊM (MA SÓI MENU)
            if (id.includes('_')) {
                const parts = id.split('_');
                const action = parts[0];
                const guildId = parts.length === 3 ? parts[2] : parts[1]; 
                
                if (['wolf', 'seer', 'guard', 'witch', 'cupid'].includes(action)) {
                    const game = activeGames.masoi.get(guildId);
                    
                    if (!game || game.status !== 'night') {
                        return interaction.reply({ content: '❌ Giai đoạn ban đêm đã kết thúc, bạn thao tác quá chậm!', ephemeral: true }).catch(()=>{});
                    }

                    const targetId = interaction.values[0];
                    
                    try {
                        if (action === 'wolf') {
                            game.nightActions.wolfVotes[targetId] = (game.nightActions.wolfVotes[targetId] || 0) + 1;
                            await interaction.update({ content: `🐺 Đã ghi nhận! Bạn đã bầu cắn <@${targetId}>.`, embeds: [], components: [] });
                        } else if (action === 'seer') {
                            const role = game.playerRoles[targetId].role;
                            const team = (role === 'Sói') ? 'Sói 🐺' : 'Dân Làng 🧑‍🌾';
                            await interaction.update({ content: `👁️ **Kết quả soi:** <@${targetId}> thuộc phe **${team}**!`, embeds: [], components: [] });
                        } else if (action === 'guard') {
                            game.nightActions.guardTarget = targetId;
                            await interaction.update({ content: `🛡️ Đã ghi nhận! Bạn đang bảo vệ <@${targetId}>.`, embeds: [], components: [] });
                        } else if (action === 'witch') {
                            const targetId = interaction.values[0];
                            
                            if (parts[1] === 'poison') {
                                if (targetId === 'skip_poison') {
                                    await interaction.update({ content: `🧪 Bạn đã không dùng Bình Độc đêm nay.`, embeds: [], components: [] });
                                } else {
                                    game.nightActions.poisonTarget = targetId;
                                    game.witchPoisonUsed = true;
                                    await interaction.update({ content: `🧪 Đã ghi nhận! Bạn tạt Bình Độc vào <@${targetId}>.\n*(Nếu muốn dùng tiếp Bình Cứu, hãy nhấn lại nút Xem Vai Trò ở kênh chat)*`, embeds: [], components: [] });
                                }
                            } else if (parts[1] === 'save') {
                                if (targetId === 'skip_save') {
                                    await interaction.update({ content: `🧬 Bạn đã không dùng Bình Cứu đêm nay.`, embeds: [], components: [] });
                                } else {
                                    game.nightActions.saveTarget = targetId;
                                    game.witchSaveUsed = true;
                                    await interaction.update({ content: `🧬 Đã ghi nhận! Bạn dùng Bình Cứu bảo vệ <@${targetId}>.\n*(Nếu muốn dùng tiếp Bình Độc, hãy nhấn lại nút Xem Vai Trò ở kênh chat)*`, embeds: [], components: [] });
                                }
                            }
                    } else if (action === 'cupid') {
                            const t1 = interaction.values[0];
                            const t2 = interaction.values[1];
                            game.nightActions.cupidTargets = [t1, t2];
                            await interaction.update({ content: `💘 Bạn đã ghép đôi <@${t1}> và <@${t2}>. Nếu 1 người chết, người kia sẽ chết theo!`, embeds: [], components: [] });
                        }
                    } catch (e) {}
                    return;
                }
            }
        }

        // --- 4. SUBMIT MODAL (GỬI THÔNG TIN) ---
        if (interaction.isModalSubmit()) {
        if (id && id.startsWith('modalveso_')) {
    const index = parseInt(id.split('_')[1]);
    if (!guildData.lotteryConfig || !guildData.lotteryConfig.dais || !guildData.lotteryConfig.dais[index]) {
        return interaction.reply({ content: '⚠️ Không tìm thấy thông tin đài xổ số hợp lệ!', ephemeral: true });
    }
    const daiName = guildData.lotteryConfig.dais[index];
    const qtyStr = interaction.fields.getTextInputValue('veso_qty');
    const qty = parseInt(qtyStr);

    if (isNaN(qty) || qty <= 0) {
        return interaction.reply({ content: '❌ Số lượng vé nhập vào không hợp lệ!', ephemeral: true });
    }

    const totalCost = qty * 10000;
    const currentBal = getBalance(userId, guildId);

    if (currentBal < totalCost) {
        return interaction.reply({ 
            content: `❌ Bạn không đủ tiền! Cần **${totalCost.toLocaleString()} VNĐ** để mua ${qty} tờ đài **${daiName}**. Hiện tại bạn chỉ có ${currentBal.toLocaleString()} VNĐ.`, 
            ephemeral: true 
        });
    }

    // Trừ tiền thông qua hàm có sẵn của hệ thống bot
    addBalance(userId, -totalCost, guildId);

    // Lưu trữ vé phân tách theo đài
    if (!guildData.lotteryUsers) guildData.lotteryUsers = {};
    if (!guildData.lotteryUsers[userId]) guildData.lotteryUsers[userId] = {};
    if (!guildData.lotteryUsers[userId][daiName]) guildData.lotteryUsers[userId][daiName] = [];

    let newTickets = [];
    for (let i = 0; i < qty; i++) {
        const ticketStr = randDigits(6);
        newTickets.push(ticketStr);
        guildData.lotteryUsers[userId][daiName].push(ticketStr);
    }
    saveData();

    return interaction.reply({ 
        content: `🎉 Bạn đã đặt mua thành công **${qty}** tờ vé số đài **${daiName}**!\n💸 Tổng chi phí: **${totalCost.toLocaleString()} VNĐ**.\n🎫 Danh sách dãy số kiểm tra: \`${newTickets.join('`, `')}\``, 
        ephemeral: true 
    });
}

                        // MODAL NHẬP TIỀN SLOT MACHINE VÀ XỬ LÝ QUAY
            if (id === 'modal_slot_bet') {
                const amountStr = interaction.fields.getTextInputValue('slot_bet_amount');
                const amount = parseInt(amountStr);

                // 1. Kiểm tra số tiền hợp lệ
                if (isNaN(amount) || amount <= 0) {
                    return interaction.reply({ content: '❌ Số tiền cược không hợp lệ! Phải là một con số lớn hơn 0.', ephemeral: true });
                }

                if (getBalance(userId, guildId) < amount) {
                    return interaction.reply({ content: '❌ Bạn không có đủ tiền trong ví để cược số tiền này!', ephemeral: true });
                }

                // 2. Trừ tiền cược ngay lập tức để tránh bug spam
                addBalance(userId, -amount, guildId);

                // 3. Xóa nút bấm của menu cược và bắt đầu hiệu ứng quay
                const spinningEmbed = new EmbedBuilder()
                    .setColor('#e67e22')
                    .setTitle('🎰 MÁY ĐANG QUAY... 🎰')
                    .setDescription(`Tiền cược: **${amount.toLocaleString()} VNĐ💸**\n\n**[ 🔄 | 🔄 | 🔄 ]**\n\n*Đang chờ kết quả...*`);

                await interaction.update({ embeds: [spinningEmbed], components: [] });

                // 4. Đợi 2 giây để tạo cảm giác hồi hộp rồi tính kết quả
                setTimeout(async () => {
                    // Danh sách 10 loại trái cây
                    const fruits = ['🍎', '🍊', '🍇', '🍉', '🍓', '🍒', '🍍', '🥝', '🍌', '🍑'];
                    
                    // Random ra 3 kết quả
                    // Mẹo nhỏ: Để game không quá khó nhằn, tôi đã chỉnh tỉ lệ xíu. Nếu bạn muốn random ngẫu nhiên 100%, hãy dùng fruits[Math.floor(Math.random() * fruits.length)] cho cả 3.
                    const slot1 = fruits[Math.floor(Math.random() * fruits.length)];
                    const slot2 = fruits[Math.floor(Math.random() * fruits.length)];
                    
                    // Giúp dễ trúng hơn 1 chút: Có 15% cơ hội ô thứ 3 sẽ trùng luôn với ô 1 và 2 nếu ô 1 và 2 đã trùng nhau.
                    let slot3;
                    if (slot1 === slot2 && Math.random() < 0.15) {
                        slot3 = slot1;
                    } else {
                        slot3 = fruits[Math.floor(Math.random() * fruits.length)];
                    }

                    const isWin = (slot1 === slot2 && slot2 === slot3);
                    let resultText = '';

                    // 5. Cộng thưởng (nếu trúng)
                    if (isWin) {
                        const winAmount = amount * 2;
                        addBalance(userId, winAmount, guildId); // Cộng lại tiền x2
                        resultText = `🎉 **JACKPOT! ĐỘC ĐẮC!** 🎉\nBạn đã nhận được **${winAmount.toLocaleString()} VNĐ💸** (Tiền thưởng x2)!`;
                    } else {
                        resultText = `💥 **TRƯỢT RỒI!** 💥\nBạn đã mất **${amount.toLocaleString()} VNĐ💸**. Chúc may mắn lần sau!`;
                    }

                    // 6. Chỉnh sửa tin nhắn thành kết quả cuối cùng
                    const resultEmbed = new EmbedBuilder()
                        .setColor(isWin ? '#2ecc71' : '#e74c3c')
                        .setTitle('🎰 KẾT QUẢ SLOT MACHINE 🎰')
                        .setDescription(`Tiền cược: **${amount.toLocaleString()} VNĐ💸**\n\n**[ ${slot1} | ${slot2} | ${slot3} ]**\n\n${resultText}`);

                    await interaction.message.edit({ embeds: [resultEmbed] });
                }, 2000); // 2000ms = 2 giây
                return;
            }
            
            // Xử Lý Mua Role Trong Shop
            if (id === 'modal_buy_role') {
                const code = interaction.fields.getTextInputValue('buy_code_input');
                const guildId = interaction.guildId;
                const serverShop = db.shop[guildId] || {};
                const item = serverShop[code];

                if (!item) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Giao dịch thất bại: Mã số không tồn tại trong cửa hàng của server này!', ephemeral: true });
                const price = item.price;
                
                if (getBalance(userId, guildId) < price) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Giao dịch thất bại: Số dư trong tài khoản bạn không đủ.', ephemeral: true });
                
                const role = interaction.guild.roles.cache.get(item.roleId);
                if (!role) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Giao dịch thất bại: Role này không còn tồn tại trên server, vui lòng báo Admin!', ephemeral: true });

                const member = await interaction.guild.members.fetch(userId).catch(() => interaction.member);
                if (member.roles.cache.has(role.id)) {
                    return interaction.reply({ 
                        content: `<a:emoji_75:1524039622668189806>  Giao dịch hoàn tất: Bạn đã có sẵn role <@&${role.id}> rồi nên bot không cấp lại và không trừ tiền.`, 
                        ephemeral: true 
                    });
                }

                try {
                    await member.roles.add(role);
                    addBalance(userId, -price, guildId);
                    return interaction.reply({ 
                        content: `<a:emoji_75:1524039622668189806>  Giao dịch thành công! Bạn đã mua thành công role <@&${role.id}> với giá **${price.toLocaleString()} VNĐ💸**.`, 
                        ephemeral: true 
                    });
                } catch (err) {
                    console.error('Lỗi khi cấp role:', err);
                    return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Giao dịch thất bại: Bot không có đủ quyền ưu tiên để cấp role này. Vui lòng liên hệ Admin!', ephemeral: true });
                }
            }

            // MODAL TÀI XỈU
            if (id.startsWith('modal_tx_bet_')) {                          
                if (!activeGames.taixiu || activeGames.taixiu.status !== 'betting') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Đã hết giờ!', ephemeral: true });
                const hasBetted = activeGames.taixiu.bets.some(b => b.userId === userId);
                if (hasBetted) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Bạn đã đặt cược trong ván này rồi, mỗi ván chỉ được chọn 1 cửa!', ephemeral: true });

                const choice = id.replace('modal_tx_bet_', '');
                const amount = parseInt(interaction.fields.getTextInputValue('tx_amount_input'));                                                                           
                if (isNaN(amount) || amount < 10) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Tối thiểu 10 VNĐ!', ephemeral: true });
                if (getBalance(userId, guildId) < amount) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Số dư tài khoản không đủ!', ephemeral: true });
                
                const choiceMap = { tai: 'Tài', xiu: 'Xỉu', chan: 'Chẵn', le: 'Lẻ' };                                                 
                const choiceName = choiceMap[choice];
                activeGames.taixiu.bets.push({ userId, choice, amount, choiceName });                                                 
                
                const listStr = activeGames.taixiu.bets.map(b => `• <@${b.userId}> đặt cửa **${b.choiceName}**: **[ ${b.amount}💸 ]**`).join('\n');
                const updateEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🎲 SÒNG BẠC TÀI XỈU 🎲').setDescription(`Vui lòng click các nút bên dưới để chọn cửa và đặt cược!\n\n**Danh sách đặt cược:**\n${listStr}`);
                
                await interaction.reply({ content: `<a:emoji_75:1524039622668189806>  Đặt cược thành công **${amount}💸** vào cửa **${choiceName}**!`, ephemeral: true });
                return activeGames.taixiu.mainMessage.edit({ embeds: [updateEmbed] }).catch(()=>{});
            }

            // MODAL BẦU CUA
            if (id.startsWith('modal_bc_bet_')) {
                if (!activeGames.baucua || activeGames.baucua.status !== 'betting') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Đã hết giờ!', ephemeral: true });
                const choice = id.replace('modal_bc_bet_', '');
                const amount = parseInt(interaction.fields.getTextInputValue('bc_amount_input'));
                
                if (isNaN(amount) || amount < 10) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Tối thiểu 10 VNĐ!', ephemeral: true });
                if (getBalance(userId, guildId) < amount) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Số dư tài khoản không đủ!', ephemeral: true });
                
                activeGames.baucua.bets.push({ userId, choice, amount });
                const listStr = activeGames.baucua.bets.map(b => `• <@${b.userId}> đặt cửa **${b.choice}**: **[ ${b.amount}💸 ]**`).join('\n');
                const updateEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🎲 SÒNG BẦU CUA TÔM CÁ 🎲').setDescription(`Vui lòng click nút **Đặt Cược** để chọn linh vật và nhập số tiền cược!\n\n**Danh sách đặt cược:**\n${listStr}`);
                
                await interaction.reply({ content: `<a:emoji_75:1524039622668189806>  Đặt cược thành công **${amount}💸** vào **${choice}**!`, ephemeral: true });
                return activeGames.baucua.mainMessage.edit({ embeds: [updateEmbed] }).catch(()=>{});
            }
            // MODAL XÌ DÁCH
            if (id === 'modal_pvp_bet') {
                const game = activeGames.xidach;
                if (!game || game.status !== 'waiting') return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Đã đóng cửa sòng!', ephemeral: true });
                
                const bet = parseInt(interaction.fields.getTextInputValue('pvp_bet_input'));
                if (isNaN(bet) || bet < 10) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Tối thiểu 10 VNĐ!', ephemeral: true });
                if (getBalance(userId, guildId) < bet) return interaction.reply({ content: '<a:emoji_76:1524195723996823612> Tài khoản không đủ!', ephemeral: true });
                
                game.players.push({ id: userId, bet: bet, cards: [], status: 'playing' });
                const listStr = game.players.map(p => `• <@${p.id}> đặt cược: **[ ${p.bet}💸 ]**`).join('\n');
                const updateEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🃏 SÒNG XÌ DÁCH TRUYỀN THỐNG (PVP) 🃏').setDescription(`👑 Nhà Cái: <@${game.dealerId}>\n\nBấm nút **Tham Gia** bên dưới để đặt cược.\n\n**Bàn cược:**\n${listStr}`);
                
                await interaction.reply({ content: `<a:emoji_75:1524039622668189806>  Vô cược **${bet}💸** thành công!`, ephemeral: true });
                return game.mainMessage.edit({ embeds: [updateEmbed] }).catch(()=>{});
            }
        }
    } catch (error) {
        console.error('Lỗi khi xử lý tương tác:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '<a:emoji_76:1524195723996823612> Đã xảy ra lỗi hệ thống khi xử lý tương tác này.', ephemeral: true }).catch(() => {});
        }
    }
});

// ==========================================
// CÁC HÀM PHỤ TRỢ (HELPER FUNCTIONS)
// ==========================================
function createCaroComponents(board, channelId, disableAll = false) {
    const rows = [];
    for (let i = 0; i < 3; i++) { 
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) { 
            const index = i * 3 + j;
            const cell = board[index];
            let style = ButtonStyle.Secondary;
            
            if (cell === '❌') style = ButtonStyle.Primary;
            else if (cell === '⭕') style = ButtonStyle.Danger;
            
            row.addComponents(new ButtonBuilder().setCustomId(`caro_${channelId}_${index}`).setLabel(cell).setStyle(style).setDisabled(disableAll || cell !== '⬜'));
        }
        rows.push(row);
    }
    return rows;
}

function checkWin(board, symbol) {
    const size = 3; 
    const winTarget = 3;
    const checkLine = (x, y, dx, dy) => {
        let count = 0;
        for (let i = 0; i < winTarget; i++) {
            const nx = x + i * dx;
            const ny = y + i * dy;
            if (nx >= 0 && nx < size && ny >= 0 && ny < size && board[ny * size + nx] === symbol) count++;
            else break;
        }
        return count === winTarget;
    };
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (checkLine(x, y, 1, 0) || checkLine(x, y, 0, 1) || checkLine(x, y, 1, 1) || checkLine(x, y, 1, -1)) return true;
        }
    }
    return false;
}

async function updateMainUI() {
    const game = activeGames.xidach;
    if (!game || game.status !== 'players_turn') return;
    const listStatus = game.players.map(p => p.status === 'playing' ? `• <@${p.id}>: *Đang suy nghĩ...*` : `• <@${p.id}>: **Đã hoàn thành lượt** (Bài ẩn)`).join('\n');
    const playEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🃏 XÌ DÁCH PVP: LƯỢT NHÀ CON RÚT BÀI 🃏').setDescription(`👑 Nhà Cái: <@${game.dealerId}> [ Đang giấu bài ]\n\n**Bàn cược:**\n${listStatus}`);
    await game.mainMessage.edit({ embeds: [playEmbed] }).catch(()=>{});
}

async function checkAutoSwitchToDealer() {
    const game = activeGames.xidach;
    if (!game) return;
    if (!game.players.some(p => p.status === 'playing')) await startDealerTurn();
}

async function startDealerTurn() {
    const game = activeGames.xidach;
    if (!game || game.status !== 'players_turn') return;
    
    game.status = 'dealer_turn';
    const dInfo = calculatePoints(game.dealerCards);
    if (dInfo.special === 'Xì Dách' || dInfo.special === 'Xì Bàng') return finishPvpGame();
    
    const dEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🃏 XÌ DÁCH PVP: LƯỢT NHÀ CÁI 🃏').setDescription(`👑 Đến lượt Nhà Cái <@${game.dealerId}> kiểm soát sòng!\n\nHãy chọn Rút bài hoặc Dừng.`);
    const dRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('dealer_hit').setLabel('🃏 Rút Bài').setStyle(ButtonStyle.Primary), 
        new ButtonBuilder().setCustomId('dealer_stand').setLabel('🔒 Dừng Bài (So điểm)').setStyle(ButtonStyle.Danger)
    );
    await game.mainMessage.edit({ embeds: [dEmbed], components: [dRow] }).catch(()=>{});
}

async function finishPvpGame() {
    const game = activeGames.xidach;
    if (!game || game.status === 'finished') return;
    
    game.status = 'finished';
    const dInfo = calculatePoints(game.dealerCards);
    let finalLog = `👑 **NHÀ CÁI <@${game.dealerId}> LẬT BÀI:**\n${formatCards(game.dealerCards)} (Tổng: **${dInfo.points}**đ — *${dInfo.special}*)\n\n🏁 **KẾT QUẢ TOÀN BÀN:**\n`;
    
    game.players.forEach(p => {
        const pInfo = calculatePoints(p.cards); 
        let win = false; 
        let tie = false; 
        let reason = '';
        
        if (p.status === 'quac') { win = false; reason = 'Nhà Con Quắc'; }
        else if (dInfo.points > 21) { win = true; reason = 'Nhà Cái Quắc'; }
        else {
            const pPower = { 'Xì Bàng': 4, 'Xì Dách': 3, 'Ngũ Linh': 2, 'Thường': 1 }[pInfo.special];
            const dPower = { 'Xì Bàng': 4, 'Xì Dách': 3, 'Ngũ Linh': 2, 'Thường': 1 }[dInfo.special];
            
            if (pPower > dPower) { win = true; reason = `Thắng bằng ${pInfo.special}`; }
            else if (pPower < dPower) { win = false; reason = `Thua do Cái có ${dInfo.special}`; }
            else {
                if (pInfo.points > dInfo.points) { win = true; reason = 'Điểm cao hơn'; }
                else if (pInfo.points < dInfo.points) { win = false; reason = 'Điểm thấp hơn'; }
                else { tie = true; reason = 'Hòa điểm'; }
            }
        }

        if (tie) {
            finalLog += `• <@${p.id}>: **HÒA VỐN** 🤝 | Bài: ${formatCards(p.cards)} (${reason})\n`;
        } else if (win) { 
            addBalance(p.id, p.bet, guildId);
            addBalance(game.dealerId, -p.bet, guildId); 
            finalLog += `• <@${p.id}>: **THẮNG** 🎉 **+${p.bet}💸** | Bài: ${formatCards(p.cards)} (${reason})\n`;
        } else { 
            addBalance(p.id, -p.bet, guildId); 
            addBalance(game.dealerId, p.bet, guildId);
            finalLog += `• <@${p.id}>: **THUA** 💸 **-${p.bet}💸** | Bài: ${formatCards(p.cards)} (${reason})\n`; 
        }
    });
    
    const endEmbed = new EmbedBuilder().setColor('#2f3136').setTitle('🏆 TỔNG KẾT VÁN XÌ DÁCH 🏆').setDescription(finalLog).setTimestamp();
    await game.mainMessage.edit({ embeds: [endEmbed], components: [] }).catch(()=>{});
    activeGames.xidach = null;
}

function createDeck() {
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = [
        { name: '2', val: 2 }, { name: '3', val: 3 }, { name: '4', val: 4 }, 
        { name: '5', val: 5 }, { name: '6', val: 6 }, { name: '7', val: 7 }, 
        { name: '8', val: 8 }, { name: '9', val: 9 }, { name: '10', val: 10 }, 
        { name: 'J', val: 10 }, { name: 'Q', val: 10 }, { name: 'K', val: 10 }, 
        { name: 'A', val: 11 }
    ];
    let deck = []; 
    for (let s of suits) {
        for (let r of ranks) {
            deck.push({ name: `${r.name}${s}`, rankName: r.name, value: r.val });
        }
    }
    
    for (let i = deck.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]]; 
    }
    return deck;
}

function calculatePoints(cards) {
    let total = 0;
    let aces = 0;
    cards.forEach(c => { 
        total += c.value; 
        if (c.rankName === 'A') aces++; 
    });
    
    if (cards.length === 2 && aces === 2) return { points: 21, special: 'Xì Bàng' };
    if (cards.length === 2 && total === 21) return { points: 21, special: 'Xì Dách' };
    
    while (total > 21 && aces > 0) { 
        total -= 10;
        aces--; 
    }
    
    if (cards.length === 5 && total <= 21) return { points: total, special: 'Ngũ Linh' };
    return { points: total, special: 'Thường' };
}

function formatCards(cards) { 
    return cards.map(c => `\`[ ${c.name} ]\``).join(' ');
}

function sendPvpPrivateMenu(interaction, player, isUpdate = false) {
    const info = calculatePoints(player.cards);
    if (info.special === 'Xì Dách' || info.special === 'Xì Bàng') {
        player.status = 'stand';
        const txt = `✨ Bài đặc biệt: **${info.special}**! Bài: ${formatCards(player.cards)}`;
        return isUpdate ? interaction.update({ content: txt, components: [] }) : interaction.reply({ content: txt, ephemeral: true });
    }
    
    const data = {
        content: `🃏 **Bài của bạn:** ${formatCards(player.cards)}\n🧮 Điểm: **${info.points}**`,                             
        components: [new ActionRowBuilder().addComponents(             
            new ButtonBuilder().setCustomId('pvp_hit').setLabel('🃏 Rút Thêm Lá').setStyle(ButtonStyle.Primary).setDisabled(player.cards.length >= 5),    
            new ButtonBuilder().setCustomId('pvp_stand').setLabel('🔒 Dừng Bài').setStyle(ButtonStyle.Danger)                 
        )], 
        ephemeral: true                          
    };
    
    return isUpdate ? interaction.update(data) : interaction.reply(data);
}

// ==========================================
// ENGINE TRÒ CHƠI XẾP GẠCH (TETRIS CORE)
// ==========================================
const TETROMINOES = {
    I: { shape: [[1,1,1,1]], color: '🟦' },
    J: { shape: [[1,0,0],[1,1,1]], color: '🟫' },
    L: { shape: [[0,0,1],[1,1,1]], color: '🟧' },
    O: { shape: [[1,1],[1,1]], color: '🟨' },
    S: { shape: [[0,1,1],[1,1,0]], color: '🟩' },
    T: { shape: [[0,1,0],[1,1,1]], color: '🟪' },
    Z: { shape: [[1,1,0],[0,1,1]], color: '🟥' }
};

class TetrisGame {
    constructor(userId, message) {
        this.userId = userId;
        this.message = message;
        this.guildId = message.guild?.id || 'global';
        this.width = 10;
        this.height = 15;
        this.board = Array(this.height).fill().map(() => Array(this.width).fill('⬛'));
        
        this.score = 0;
        this.linesCleared = 0;
        this.level = 1;
        this.combo = 1;
        this.isGameOver = false;
        
        this.currentPiece = null;
        this.nextPiece = this.getRandomPiece();
        this.tickTimer = null;
    }

    getRandomPiece() {
        let pool = ['I', 'O', 'T', 'J', 'L', 'S', 'Z'];
        if (this.level < 3) pool.push('I', 'O', 'I'); 
        if (this.level >= 5) pool.push('S', 'Z', 'S', 'Z');

        const randKey = pool[Math.floor(Math.random() * pool.length)];
        return { 
            shape: TETROMINOES[randKey].shape, 
            color: TETROMINOES[randKey].color,
            x: 3, y: 0 
        };
    }

    start() {
        this.spawnPiece();
        this.render();
        this.resetTick();
    }

    spawnPiece() {
        this.currentPiece = this.nextPiece;
        this.nextPiece = this.getRandomPiece();
        if (this.checkCollision(this.currentPiece.x, this.currentPiece.y, this.currentPiece.shape)) {
            this.gameOver();
        }
    }

    getSpeed() {
        if (this.level === 1) return 1200;
        if (this.level === 2) return 1000;
        if (this.level === 3) return 800;
        if (this.level === 4) return 700;
        if (this.level === 5) return 600;
        if (this.level >= 10) return 300;
        return 600 - ((this.level - 5) * 50);
    }

    resetTick() {
        if (this.tickTimer) clearTimeout(this.tickTimer);
        if (this.isGameOver) return;
        this.tickTimer = setTimeout(() => {
            this.tick();
        }, this.getSpeed());
    }

    tick() {
        if (this.isGameOver) return;
        if (!this.move(0, 1)) {
            this.lockPiece();
        }
        this.render();
        this.resetTick();
    }

    move(dx, dy) {
        if (this.checkCollision(this.currentPiece.x + dx, this.currentPiece.y + dy, this.currentPiece.shape)) {
            return false;
        }
        this.currentPiece.x += dx;
        this.currentPiece.y += dy;
        return true;
    }

    hardDrop() {
        while (this.move(0, 1)) {} 
        this.lockPiece();
    }

    rotate() {
        const shape = this.currentPiece.shape;
        const newShape = shape[0].map((val, index) => shape.map(row => row[index]).reverse());
        if (!this.checkCollision(this.currentPiece.x, this.currentPiece.y, newShape)) {
            this.currentPiece.shape = newShape;
        }
    }

    checkCollision(x, y, shape) {
        for (let row = 0; row < shape.length; row++) {
            for (let col = 0; col < shape[row].length; col++) {
                if (shape[row][col]) {
                    let newX = x + col;
                    let newY = y + row;
                    if (newX < 0 || newX >= this.width || newY >= this.height || (newY >= 0 && this.board[newY][newX] !== '⬛')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    lockPiece() {
        for (let row = 0; row < this.currentPiece.shape.length; row++) {
            for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                if (this.currentPiece.shape[row][col]) {
                    if (this.currentPiece.y + row >= 0) {
                        this.board[this.currentPiece.y + row][this.currentPiece.x + col] = this.currentPiece.color;
                    }
                }
            }
        }
        this.clearLines();
        this.spawnPiece();
    }

    clearLines() {
        let linesClearedNow = 0;
        for (let row = this.height - 1; row >= 0; row--) {
            if (this.board[row].every(cell => cell !== '⬛')) {
                this.board.splice(row, 1);
                this.board.unshift(Array(this.width).fill('⬛'));
                linesClearedNow++;
                row++; 
            }
        }

        if (linesClearedNow > 0) {
            this.linesCleared += linesClearedNow;
            this.combo++;
            const points = linesClearedNow * 100 * this.level * this.combo;
            this.score += points;
            this.checkLevelUp();
        } else {
            this.combo = 1;
        }
    }

    checkLevelUp() {
        if (this.score >= 1500) this.level = Math.max(this.level, 5);
        else if (this.score >= 700) this.level = Math.max(this.level, 4);
        else if (this.score >= 300) this.level = Math.max(this.level, 3);
        else if (this.score >= 100) this.level = Math.max(this.level, 2);

        const lineLevel = Math.floor(this.linesCleared / 10) + 1;
        if (lineLevel > this.level) this.level = lineLevel;
    }

    async render(interaction = null) {
        if (this.isGameOver) return;
        const renderBoard = this.board.map(row => [...row]);
        if (this.currentPiece) {
            for (let row = 0; row < this.currentPiece.shape.length; row++) {
                for (let col = 0; col < this.currentPiece.shape[row].length; col++) {
                    if (this.currentPiece.shape[row][col] && this.currentPiece.y + row >= 0) {
                        renderBoard[this.currentPiece.y + row][this.currentPiece.x + col] = this.currentPiece.color;
                    }
                }
            }
        }

        let boardStr = renderBoard.map(row => row.join('')).join('\n');
        let nextPieceStr = this.nextPiece.shape.map(row => 
            row.map(cell => cell ? this.nextPiece.color : '⬛').join('')
        ).join('\n');
        
        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(`🎮 Xếp Gạch - Level: ${this.level}`)
            .setDescription(`Điểm: **${this.score}** | Combo: **x${this.combo}**\n\n${boardStr}\n\n**Block kế tiếp:**\n${nextPieceStr}`);
            
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('tetris_left').setLabel('◀').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('tetris_right').setLabel('▶').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('tetris_rotate').setLabel('🔄').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('tetris_down').setLabel('⏬ Rơi').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('tetris_stop').setLabel('⏹').setStyle(ButtonStyle.Secondary)
        );
        
        try {
            if (interaction) {
                await interaction.update({ embeds: [embed], components: [row] }).catch(()=>{});
            } else {
                await this.message.edit({ embeds: [embed], components: [row] }).catch(()=>{});
            }
        } catch (e) {}
    }

    async gameOver(interaction = null) {
        this.isGameOver = true;
        if (this.tickTimer) clearTimeout(this.tickTimer);
        activeGames.xepgach.delete(this.userId);

        const moneyEarned = Math.floor(this.score / 10);
        if (moneyEarned > 0) {
            addBalance(this.userId, moneyEarned, this.guildId);
        }

        const embed = new EmbedBuilder()
            .setColor('#e74c3c')
            .setTitle('💀 GAME OVER 💀')
            .setDescription(`Người chơi: <@${this.userId}>\n📊 Cấp độ đạt được: **Level ${this.level}**\n⭐ Tổng điểm: **${this.score}**\n\n💸 Tiền thưởng nhận được: **+${moneyEarned.toLocaleString()} VNĐ💸**`)
            .setTimestamp();
            
        try {
            if (interaction) {
                await interaction.update({ embeds: [embed], components: [] }).catch(()=>{});
            } else {
                await this.message.edit({ embeds: [embed], components: [] }).catch(()=>{});
            }
        } catch (e) {}
    }
}
// ==========================================
// ENGINE TRÒ CHƠI MA SÓI (CÓ KỸ NĂNG ĐÊM)
// ==========================================
async function startGame(guildId, game) {
    game.status = 'playing';
    game.day = 0;
    const roles = getRoleConfig(game.players.length);
    shuffleArray(roles);

    for (let i = 0; i < game.players.length; i++) {
        let hp = roles[i] === 'Già làng' ? 2 : 1;
        game.playerRoles[game.players[i]] = { role: roles[i], alive: true, hp: hp };
    }

    await game.channel.send(`🐺 **Trò chơi bắt đầu với ${game.players.length} người!**\nHệ thống sẽ tự động chuyển sang Ban Đêm ngay bây giờ...`);
    setTimeout(() => startNight(guildId, game), 3000); 
}

const MASOI_TIMERS = {
    PRE_NIGHT: 3000,
    NIGHT: 40000,
    DISCUSS: 30000,
    VOTE: 30000,
    NEXT_NIGHT: 30000
};

async function startNight(guildId, game) {
    game.status = 'night';
    game.nightActions = { wolfVotes: {}, guardTarget: null, seerTarget: null, poisonTarget: null, saveTarget: null, cupidTargets: [] };
    game.nightActionUsedUsers = new Set();

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`masoi_panel_${guildId}`)
            .setLabel('🌙 Xem Vai Trò & Dùng Kỹ Năng')
            .setStyle(ButtonStyle.Primary)
    );

    await game.channel.send({ 
        content: '🌙 **TRỜI ĐÃ TỐI... MỌI NGƯỜI ĐI NGỦ.**\nTất cả người chơi hãy nhấn vào nút bên dưới để xem vai trò và hành động (Tin nhắn sẽ được ẩn với người khác).\n⏳ Các bạn có **40 giây**!', 
        components: [row] 
    });

    setTimeout(() => processNight(guildId, game), MASOI_TIMERS.NIGHT);
}

function processNight(guildId, game) {
    let highestVote = 0;
    let killedByWolf = null;
    let deadThisNight = new Set();

    for (const [target, count] of Object.entries(game.nightActions.wolfVotes)) {
        if (count > highestVote) {
            highestVote = count;
            killedByWolf = String(target);
        }
    }

    // ĐIỀU KIỆN CHẾT DO SÓI: Bị sói cắn VÀ Không được Bảo vệ VÀ Không được Phù Thủy cứu
    if (killedByWolf) {
        const isProtected = String(game.nightActions.guardTarget) === killedByWolf;
        const isSaved = String(game.nightActions.saveTarget) === killedByWolf;

        if (!isProtected && !isSaved) {
            if (game.playerRoles[killedByWolf].role === 'Già làng') {
                game.playerRoles[killedByWolf].hp -= 1;
                if (game.playerRoles[killedByWolf].hp <= 0) deadThisNight.add(killedByWolf);
            } else {
                deadThisNight.add(killedByWolf);
            }
        }
    }

    // ĐIỀU KIỆN CHẾT DO BÌNH ĐỘC
    const pt = game.nightActions.poisonTarget;
    if (pt && pt !== 'skip_poison' && game.playerRoles[pt] && game.playerRoles[pt].alive) {
        deadThisNight.add(pt);
    }

    if (game.nightActions.cupidTargets.length === 2) {
        const [t1, t2] = game.nightActions.cupidTargets;
        if (deadThisNight.has(t1) && !deadThisNight.has(t2)) deadThisNight.add(t2);
        else if (deadThisNight.has(t2) && !deadThisNight.has(t1)) deadThisNight.add(t1);
    }

    for (let id of deadThisNight) {
        game.playerRoles[id].alive = false;
    }

    const thosanArray = Array.from(deadThisNight);
    for (const deadId of thosanArray) {
        if (game.playerRoles[deadId].role === 'Thợ săn') {
            const aliveOthers = game.players.filter(id => game.playerRoles[id].alive);
            if (aliveOthers.length > 0) {
                const randomTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
                game.playerRoles[randomTarget].alive = false;
                deadThisNight.add(randomTarget);
                game.channel.send(`🔫 **Bằng!!!** Thợ săn <@${deadId}> trước khi chết đã nổ súng kéo theo <@${randomTarget}>!`);
            }
        }
    }

    startMorning(guildId, game, Array.from(deadThisNight));
}

async function startMorning(guildId, game, deadPlayers) {
    game.status = 'morning';
    game.day = (game.day || 0) + 1;
    let desc = 'Mặt trời đã lên. Mọi người thức dậy.';
    if (deadPlayers.length > 0) {
        desc += `\nĐêm qua, có **${deadPlayers.length} người** đã mất mạng: ` + deadPlayers.map(id => `<@${id}>`).join(', ');
    } else {
        desc += `\nMột đêm vô cùng bình yên, không có ai chết!`;
    }

    const morningEmbed = new EmbedBuilder()
        .setTitle('🌅 TRỜI SÁNG 🌅')
        .setDescription(`${desc}\n\nCác bạn có **30 giây** để thảo luận tìm ra Ma Sói trước khi bỏ phiếu treo cổ.`)
        .setColor('#f1c40f');
    await game.channel.send({ embeds: [morningEmbed] });

    if (!checkWinCondition(guildId, game)) {
        setTimeout(() => startVote(guildId, game), MASOI_TIMERS.DISCUSS);
    }
}

async function startVote(guildId, game) {
    game.status = 'voting';
    const alivePlayers = game.players.filter(id => game.playerRoles[id].alive);
    const options = alivePlayers.map(id => {
        const u = client.users.cache.get(id);
        return { label: u ? u.username : `Người chơi`, value: id };
    });
    options.push({ label: 'Bỏ qua (Skip)', value: 'skip' });

    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder().setCustomId('vote_menu').setPlaceholder('Chọn người để treo cổ...').addOptions(options)
    );
    const voteMsg = await game.channel.send({ 
        content: '⚖️ **THỜI GIAN BỎ PHIẾU (30 giây):** Hãy chọn người bạn nghi ngờ nhất!', 
        components: [row] 
    });

    const votes = {}; 
    const votedUsers = new Set();
    const collector = voteMsg.createMessageComponentCollector({ time: MASOI_TIMERS.VOTE });

    collector.on('collect', async i => {
        if (i.replied || i.deferred) return;
        if (!game.playerRoles[i.user.id]?.alive) return i.reply({ content: 'Người chết không được vote!', ephemeral: true });
        if (votedUsers.has(i.user.id)) return i.reply({ content: 'Bạn đã bỏ phiếu rồi!', ephemeral: true });

        const target = i.values[0];
        votedUsers.add(i.user.id);
        votes[target] = (votes[target] || 0) + 1;
        await i.reply({ content: `Bạn đã khóa phiếu bầu của mình!`, ephemeral: true });
    });

    collector.on('end', () => processVoteResult(guildId, game, votes, voteMsg));
}


async function processVoteResult(guildId, game, votes, voteMsg = null) {
    try {
        if (voteMsg) {
            await voteMsg.edit({ components: [] }).catch(() => {});
        }
    } catch (e) {}

    let highestVoteCount = 0;
    let hangedUser = null;
    let tie = false;

    for (const [target, count] of Object.entries(votes)) {
        if (count > highestVoteCount) {
            highestVoteCount = count;
            hangedUser = target;
            tie = false;
        } else if (count === highestVoteCount) {
            tie = true;
        }
    }

    const resultLines = [];
    const voteEntries = Object.entries(votes).sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return String(a[0]).localeCompare(String(b[0]));
    });

    if (voteEntries.length === 0) {
        resultLines.push('• Chưa có phiếu hợp lệ nào được ghi nhận.');
    } else {
        for (const [target, count] of voteEntries) {
            if (target === 'skip') {
                resultLines.push(`• Bỏ phiếu trống: **${count} phiếu**`);
            } else {
                resultLines.push(`• <@${target}>: **${count} phiếu**`);
            }
        }
    }

    const revealLines = [];

    if (tie || hangedUser === 'skip' || hangedUser === null) {
        revealLines.push('⚖️ Không ai bị treo cổ hôm nay do hòa phiếu hoặc đa số chọn Skip!');
    } else if (game.playerRoles[hangedUser]) {
        game.playerRoles[hangedUser].alive = false;
        revealLines.push(`⚖️ <@${hangedUser}> đã bị treo cổ!`);
        revealLines.push(`🎭 Vai trò công khai: **${game.playerRoles[hangedUser].role.toUpperCase()}**`);

        if (game.playerRoles[hangedUser].role === 'Thợ săn') {
            const aliveOthers = game.players.filter(id => game.playerRoles[id].alive);
            if (aliveOthers.length > 0) {
                const randomTarget = aliveOthers[Math.floor(Math.random() * aliveOthers.length)];
                game.playerRoles[randomTarget].alive = false;

                revealLines.push(`🔫 **Thợ săn** <@${hangedUser}> đã kéo theo <@${randomTarget}>!`);
                revealLines.push(`🎭 Vai trò công khai của <@${randomTarget}>: **${game.playerRoles[randomTarget].role.toUpperCase()}**`);
            }
        }
    }

    const resultEmbed = new EmbedBuilder()
        .setTitle('📊 KẾT QUẢ BỎ PHIẾU')
        .setColor('#e74c3c')
        .setDescription(
            `**Kết quả bỏ phiếu:**\n${resultLines.join('\n')}\n\n` +
            `**Diễn biến sau bỏ phiếu:**\n${revealLines.join('\n')}`
        )
        .setTimestamp();

    await game.channel.send({ embeds: [resultEmbed] }).catch(() => {});

    if (!checkWinCondition(guildId, game)) {
        const statusEmbed = buildMasoiStatusEmbed(game);
        await game.channel.send({ embeds: [statusEmbed] }).catch(() => {});
        setTimeout(() => startNight(guildId, game), MASOI_TIMERS.NEXT_NIGHT);
    }
}

function buildMasoiStatusEmbed(game) {
    const alivePlayers = game.players.filter(id => game.playerRoles[id]?.alive);
    const deadPlayers = game.players.filter(id => game.playerRoles[id] && !game.playerRoles[id].alive);

    const aliveText = alivePlayers.length > 0
        ? alivePlayers.map(id => `<@${id}>`).join(', ')
        : 'Không có ai';
    const deadText = deadPlayers.length > 0
        ? deadPlayers.map(id => `<@${id}>`).join(', ')
        : 'Không có ai';

    return new EmbedBuilder()
        .setTitle('📊 Trạng thái game')
        .setColor('#9b59b6')
        .addFields(
            { name: 'Ngày', value: String(game.day || 1), inline: false },
            { name: 'Người sống', value: String(alivePlayers.length), inline: false },
            { name: 'Người chết', value: String(deadPlayers.length), inline: false },
            { name: 'Còn sống', value: aliveText, inline: false },
            { name: 'Đã chết', value: deadText, inline: false }
        )
        .setTimestamp();
}
function checkWinCondition(guildId, game) {
    let wolves = 0, villagers = 0;
    let winningTeam = null;

    // Đếm số lượng Sói và Dân Làng còn sống
    for (const data of Object.values(game.playerRoles)) {
        if (data.alive) {
            if (data.role === 'Sói') wolves++;
            else villagers++;
        }
    }

    // Kiểm tra điều kiện thắng
    if (wolves === 0) winningTeam = 'Dân Làng';
    else if (wolves >= villagers) winningTeam = 'Ma Sói';

    // Xử lý khi có phe chiến thắng
    if (winningTeam) {
        let roleRevealText = "\n\n**🎭 CÔNG BỐ VAI TRÒ NGƯỜI CHƠI 🎭**\n";
        // Lấy tất cả danh sách để hiển thị, bao gồm cả Sói
        for (const [id, data] of Object.entries(game.playerRoles)) {
            const statusIcon = data.alive ? "🟢 Sống" : "💀 Đã chết";
            roleRevealText += `• <@${id}>: **${data.role.toUpperCase()}** (${statusIcon})\n`;
        }

        const winEmbed = new EmbedBuilder()
            .setTitle('🏆 TRÒ CHƠI KẾT THÚC 🏆')
            .setDescription(`Phe chiến thắng: **${winningTeam}**\n\nMỗi người sống sót thuộc phe thắng nhận được **100,000 VNĐ** 💸!${roleRevealText}`)
            .setColor(winningTeam === 'Dân Làng' ? '#3498db' : '#e74c3c');
            
        game.channel.send({ embeds: [winEmbed] });

        // CHỈ trả thưởng cho người chơi thuộc phe thắng VÀ còn sống
        for (const [id, data] of Object.entries(game.playerRoles)) {
            const isWolf = data.role === 'Sói';
            if (data.alive && ((winningTeam === 'Dân Làng' && !isWolf) || (winningTeam === 'Ma Sói' && isWolf))) {
                try { addBalance(id, 100000, guildId); } catch (e) {}
            }
        }
        
        // Xóa game khỏi bộ nhớ sau khi kết thúc
        activeGames.masoi.delete(guildId);
        return true;
    }
    return false;
}



// ==========================================
// CÂU CÁ - TƯƠNG TÁC RIÊNG (GHÉP THÊM)
// ==========================================
client.on('interactionCreate', async (interaction) => {
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guildId || 'global';
        const user = fishingGetUser(userId, guildId);

        if (interaction.isChatInputCommand()) {
            if (interaction.commandName === 'update') {
                const options = [];
                for (const [name, stats] of Object.entries(RODS)) {
                    if (!stats.req) continue;
                    if (options.length < 25) {
                        options.push({
                            label: name.slice(0, 100),
                            description: `Độ bền: ${stats.dur} | Lực kéo: ${stats.res}`,
                            value: `upgraderod_${name}`
                        });
                    }
                }
                const selectMenu = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('menu_update_rod').setPlaceholder('⚒️ Chọn bản vẽ để tiến hành rèn đúc').addOptions(options)
                );
                return interaction.reply({ content: '⚒️ **LÒ RÈN CẦN CÂU (CHẾ TẠO BẰNG NGUYÊN LIỆU)**\nHãy chọn loại cần câu bạn muốn chế tạo (Nếu đủ đồ, thợ rèn sẽ chế ngay lập tức):', components: [selectMenu] });
            }

            if (interaction.commandName === 'nangcap') {
                const currentPlus = user.equip.rodPlus;
                const upgradeCost = 50000 + (currentPlus * 100000);
                const failChance = Math.min(80, currentPlus * 10);

                if (user.balance < upgradeCost) return interaction.reply({ content: `❌ Phí bảo kê lò rèn để đập lên +${currentPlus + 1} là **${upgradeCost.toLocaleString()} VNĐ**. Bạn không đủ tiền!`, ephemeral: true });

                user.balance -= upgradeCost;
                if (Math.random() * 100 < failChance) {
                    let dropText = '';
                    if (currentPlus >= 3) {
                        user.equip.rodPlus -= 1;
                        dropText = `\n⚠️ Cần câu bị mẻ và giáng cấp xuống thành +${user.equip.rodPlus}.`;
                    }
                    saveFishingData();
                    return interaction.reply({ content: `💥 ẦM M... Bùm!! Cường hóa xịt. Tiêu hao **${upgradeCost.toLocaleString()} VNĐ** mà chẳng được gì.${dropText}` });
                }

                user.equip.rodPlus += 1;
                saveFishingData();
                return interaction.reply({ content: `✨ **TING TING! CƯỜNG HÓA THÀNH CÔNG!** Cần câu tỏa hào quang. Trạng thái hiện tại: **${user.equip.rod} (+${user.equip.rodPlus})**` });
            }

            if (interaction.commandName === 'rest') {
                if (interaction.user.id !== ADMIN_ID) return interaction.reply({ content: '❌ Chỉ Admin tối cao mới có quyền dùng lệnh này!', ephemeral: true });
                const targetUser = interaction.options.getUser('user');
                const amount = interaction.options.getInteger('money');
                const tUser = fishingGetUser(targetUser.id, guildId);

                tUser.balance -= amount;
                if (tUser.balance < 0) tUser.balance = 0;
                saveFishingData();
                return interaction.reply({ content: `🚓 **[THU HỒI TÀI SẢN]** Đã tịch thu **${amount.toLocaleString()} VNĐ** của <@${targetUser.id}>!\nSố dư còn lại của họ: \`${tUser.balance.toLocaleString()} VNĐ\`` });
            }

            if (interaction.commandName === 'broadcast') {
                if (interaction.user.id !== ADMIN_ID) return interaction.reply({ content: '❌ Chỉ Admin tối cao mới có quyền dùng lệnh này!', ephemeral: true });
                const targetRole = interaction.options.getRole('role');
                const amount = interaction.options.getInteger('money');

                await interaction.deferReply();

                try {
                    const guildMembers = await interaction.guild.members.fetch();
                    const roleMembers = guildMembers.filter(m => m.roles.cache.has(targetRole.id) && !m.user.bot);
                    let count = 0;

                    roleMembers.forEach(member => {
                        const u = fishingGetUser(member.id, guildId);
                        u.balance += amount;
                        count++;
                    });
                    saveFishingData();

                    return interaction.editReply({ content: `🎉 **[PHÚC LỢI SERVER]** Đã phát thành công gói trợ cấp **${amount.toLocaleString()} VNĐ** cho **${count}** thành viên sở hữu role **${targetRole.name}**!` });
                } catch (e) {
                    return interaction.editReply({ content: `❌ Lỗi khi lấy danh sách thành viên! Hãy chắc chắn bạn đã bật "SERVER MEMBERS INTENT" trong Developer Portal. Chi tiết lỗi: ${e.message}` });
                }
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId.startsWith('modal_buy_')) {
                const itemName = interaction.customId.replace('modal_buy_', '');
                const rawQuantity = interaction.fields.getTextInputValue('quantity');
                const quantity = parseInt(rawQuantity);

                if (isNaN(quantity) || quantity <= 0) {
                    return interaction.reply({ content: '❌ Số lượng nhập không hợp lệ!', ephemeral: true });
                }

                let price = 0;
                for (let cat of Object.values(COMPONENTS)) { if (cat[itemName]) price = cat[itemName]; }

                const totalPrice = price * quantity;

                if (user.balance < totalPrice) {
                    return interaction.reply({ content: `❌ Bạn cần **${totalPrice.toLocaleString()} VNĐ** để mua ${quantity}x ${itemName}!`, ephemeral: true });
                }

                if (!user.inventory[itemName] && Object.keys(user.inventory).length >= user.maxInv) {
                    return interaction.reply({ content: '🎒 Kho đồ của bạn đã ĐẦY!', ephemeral: true });
                }

                user.balance -= totalPrice;
                user.inventory[itemName] = (user.inventory[itemName] || 0) + quantity;

                if (itemName === 'Bùa May Mắn' || itemName === 'Thuốc Rớt Đồ') {
                    const buffType = itemName === 'Bùa May Mắn' ? 'luck' : 'drop';
                    if (user.buffs[buffType] < Date.now()) user.buffs[buffType] = Date.now();
                    user.buffs[buffType] += 3600000 * quantity;
                    user.inventory[itemName] -= quantity;
                    if (user.inventory[itemName] <= 0) delete user.inventory[itemName];
                }

                saveFishingData();
                return interaction.reply({ content: `<a:emoji_75:1524039622668189806> Mua thành công **${quantity}x ${itemName}** với tổng giá **${totalPrice.toLocaleString()} VNĐ**!`, ephemeral: true });
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'menu_trangbi') {
                const items = interaction.values.map(v => v.replace('equip_', ''));
                let equippedLog = [];

                for (const item of items) {
                    if (!user.inventory[item] || user.inventory[item] <= 0) continue;

                    let type = null;
                    if (COMPONENTS.lines[item]) type = 'line';
                    if (COMPONENTS.hooks[item]) type = 'hook';
                    if (COMPONENTS.floats[item]) type = 'float';
                    if (COMPONENTS.reels[item]) type = 'reel';
                    if (COMPONENTS.baits[item]) type = 'bait';
                    if (!type) continue;

                    if (user.equip[type] && type !== 'bait') {
                        user.inventory[user.equip[type]] = (user.inventory[user.equip[type]] || 0) + 1;
                    }

                    user.equip[type] = item;
                    if (type !== 'bait') {
                        user.inventory[item] -= 1;
                        if (user.inventory[item] <= 0) delete user.inventory[item];
                    }

                    equippedLog.push(`**${item}**`);
                }

                saveFishingData();
                return interaction.reply({ content: `<a:emoji_75:1524039622668189806> Bạn đã lắp thành công các trang bị sau vào cần câu:\n${equippedLog.join(', ')}`, ephemeral: true });
            }

            if (interaction.customId.startsWith('menu_linhkien')) {
                const itemName = interaction.values[0].replace('buy_', '');
                const modal = new ModalBuilder().setCustomId(`modal_buy_${itemName}`).setTitle(`Mua ${itemName}`);
                const quantityInput = new TextInputBuilder()
                    .setCustomId('quantity')
                    .setLabel('Nhập số lượng muốn mua:')
                    .setStyle(TextInputStyle.Short)
                    .setValue('1')
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(quantityInput));
                await interaction.showModal(modal);
                return;
            }

            if (interaction.customId === 'menu_ruong') {
                const type = interaction.values[0];
                let price = 0; let addSlot = 0;
                if (type === 'buy_ruong_50') { price = 500000; addSlot = 50; }
                if (type === 'buy_ruong_100') { price = 2000000; addSlot = 100; }
                if (type === 'buy_ruong_200') { price = 10000000; addSlot = 200; }

                if (user.balance < price) return interaction.reply({ content: `❌ Bạn không đủ **${price.toLocaleString()} VNĐ** để mua Rương này!`, ephemeral: true });

                user.balance -= price;
                user.maxInv += addSlot;
                saveFishingData();
                return interaction.reply({ content: `<a:emoji_75:1524039622668189806> Nâng cấp thành công! Kho hiện tại chứa được tối đa **${user.maxInv}** slots.`, ephemeral: true });
            }

            if (interaction.customId === 'menu_doikhuvuc') {
                const zoneName = interaction.values[0].replace('zone_', '');
                const zoneData = ZONES[zoneName];

                if (user.level < zoneData.level) return interaction.reply({ content: `❌ Bạn cần Level **${zoneData.level}** để ra ${zoneName}!`, ephemeral: true });
                if (user.balance < zoneData.fee) return interaction.reply({ content: `❌ Bạn cần **${zoneData.fee.toLocaleString()} VNĐ** nộp phí bến bãi!`, ephemeral: true });

                user.balance -= zoneData.fee;
                user.zone = zoneName;
                saveFishingData();
                return interaction.reply({ content: `🚤 Căng buồm! Bạn đã di chuyển đến **${zoneName}**. Bắt đầu câu cá thôi!`, ephemeral: true });
            }

            if (interaction.customId === 'menu_shopcan_buy') {
                const rodName = interaction.values[0].replace('buyrod_', '');
                const rodData = RODS[rodName];

                if (user.balance < rodData.price) return interaction.reply({ content: `❌ Bạn cần **${rodData.price.toLocaleString()} VNĐ** để tậu ${rodName}!`, ephemeral: true });

                user.balance -= rodData.price;
                user.equip.rod = rodName; user.equip.rodPlus = 0; user.equip.dur = rodData.dur;
                saveFishingData();
                return interaction.reply({ content: `<a:emoji_75:1524039622668189806> Bạn đã mua sắm và trang bị lập tức **${rodName}** với giá **${rodData.price.toLocaleString()} VNĐ**! Cần cũ đã bị vứt bỏ.`, ephemeral: true });
            }

            if (interaction.customId === 'menu_update_rod') {
                const rodName = interaction.values[0].replace('upgraderod_', '');
                const targetRod = RODS[rodName];

                let missingInfo = '';
                for (const [mat, qty] of Object.entries(targetRod.req)) {
                    const has = user.inventory[mat] || 0;
                    if (has < qty) missingInfo += `• ${mat}: Đang có ${has}/${qty} cái\n`;
                }

                if (missingInfo !== '') {
                    const embed = new EmbedBuilder().setColor('#e74c3c').setTitle('❌ KHÔNG ĐỦ NGUYÊN LIỆU').setDescription(`Để chế tạo **${rodName}**, kho đồ của bạn đang thiếu:\n${missingInfo}`);
                    return interaction.reply({ embeds: [embed], ephemeral: true });
                }

                for (const [mat, qty] of Object.entries(targetRod.req)) {
                    user.inventory[mat] -= qty;
                    if (user.inventory[mat] <= 0) delete user.inventory[mat];
                }

                user.equip.rod = rodName; user.equip.rodPlus = 0; user.equip.dur = targetRod.dur;
                saveFishingData();
                return interaction.reply({ content: `⚒️ Vang dội tiếng búa! Bạn đã rèn và tự động khoác lên người thần binh: 🎉 **${rodName}**!`, ephemeral: true });
            }
        }
    } catch (error) {
        console.error('Lỗi khi xử lý câu cá:', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '<a:emoji_76:1524195723996823612> Đã xảy ra lỗi hệ thống khi xử lý câu cá.', ephemeral: true }).catch(() => {});
        }
    }
});

client.login('thay token');
