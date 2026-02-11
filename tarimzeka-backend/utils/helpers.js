const crypto = require('crypto');
const sgMail = require('@sendgrid/mail');

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


// SendGrid mail sender
const sendMail = async ({ to, subject, text, html, from, replyTo }) => {
    if (!process.env.SENDGRID_API_KEY) {
        throw new Error('SENDGRID_API_KEY env değişkeni eksik!');
    }
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    const msg = {
        to,
        from: from || process.env.SMTP_FROM,
        subject,
        text,
        html,
        replyTo: replyTo || process.env.SMTP_FROM
    };
    console.log('SendGrid msg:', msg);
    return sgMail.send(msg);
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
    sendMail
};
