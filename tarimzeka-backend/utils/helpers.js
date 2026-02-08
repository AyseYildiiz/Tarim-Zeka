const crypto = require('crypto');
const nodemailer = require('nodemailer');

// Turkish character normalization
const normalizeTrKey = (value) => {
    if (!value) return '';
    return value
        .toString()
        .trim()
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/\u0307/g, '')
        .replace(/ç/g, 'c')
        .replace(/ğ/g, 'g')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ş/g, 's')
        .replace(/ü/g, 'u');
};

const normalizeMapKeys = (map) => {
    const out = {};
    Object.entries(map).forEach(([key, value]) => {
        out[normalizeTrKey(key)] = value;
    });
    return out;
};

// Turkish capitalization
const capitalizeTr = (value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    if (!trimmed) return trimmed;
    const first = trimmed[0].toLocaleUpperCase('tr-TR');
    return first + trimmed.slice(1);
};

const deepCapitalizeTr = (obj) => {
    if (Array.isArray(obj)) return obj.map(deepCapitalizeTr);
    if (obj && typeof obj === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(obj)) {
            out[k] = deepCapitalizeTr(v);
        }
        return out;
    }
    return capitalizeTr(obj);
};

// Safe JSON parsing
const safeJsonParse = (value) => {
    if (typeof value !== 'string') return value ?? null;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
};

// Week number calculation
function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Password reset token functions
const createResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

const hashToken = (token) => {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// Mail transporter
const getMailTransporter = () => {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
};

module.exports = {
    normalizeTrKey,
    normalizeMapKeys,
    capitalizeTr,
    deepCapitalizeTr,
    safeJsonParse,
    getWeekNumber,
    createResetToken,
    hashToken,
    getMailTransporter
};
