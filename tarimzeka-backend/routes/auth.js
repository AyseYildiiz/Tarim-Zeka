const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../config/database');
const { createResetToken, hashToken, sendMail } = require('../utils/helpers');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const APP_URL = process.env.APP_URL || 'tarimzekamobile://reset-password';

// Register
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, location } = req.body;

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'Bu email zaten kullanılıyor' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: { name, email, phone, password: hashedPassword, location }
        });

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, location: user.location }
        });
    } catch (error) {
        res.status(500).json({ error: 'Kayıt sırasında hata oluştu' });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Email veya şifre hatalı' });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Email veya şifre hatalı' });
        }

        const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET);

        res.json({
            token,
            user: { id: user.id, name: user.name, email: user.email, location: user.location }
        });
    } catch (error) {
        res.status(500).json({ error: 'Giriş sırasında hata oluştu' });
    }
});

// Forgot Password
router.post('/forgot-password', async (req, res) => {
    try {
        console.log('Şifre sıfırlama isteği alındı:', req.body.email);
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'E-posta gerekli' });
        }

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.json({ message: 'Eğer hesap varsa link gönderildi' });
        }

        const token = createResetToken();
        const tokenHash = hashToken(token);
        const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

        await prisma.passwordReset.create({
            data: { userId: user.id, tokenHash, expiresAt }
        });

        const subject = 'TarimZeka - Sifre Sifirlama';
        const text = [
            'Sifrenizi yenilemek icin asagidaki kodu uygulamada kullanin:',
            token, '',
            'Kodu kopyalayip uygulamaya yapistirin.', '',
            'Kod 30 dakika gecerlidir.'
        ].join('\n');

        const html = `
<!doctype html>
<html>
    <body style="margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:24px;">
            <div style="background:#ffffff;border-radius:12px;padding:24px;border:1px solid #e5e7eb;">
                <h2 style="margin:0 0 12px 0;color:#111827;">TarimZeka Sifre Sifirlama</h2>
                <p style="margin:0 0 16px 0;color:#374151;">Sifrenizi yenilemek icin asagidaki kodu uygulamada kullanin.</p>
                <div style="background:#f3f4f6;border-radius:10px;padding:12px 16px;display:block;max-width:100%;">
                    <span style="font-family:Courier New,Courier,monospace;font-size:16px;color:#111827;word-break:break-all;line-height:1.4;display:block;text-align:center;">${token}</span>
                </div>
                <p style="margin:12px 0 0 0;color:#6b7280;font-size:13px;">Kodu kopyalayip uygulamaya yapistirin.</p>
                <p style="margin:16px 0 0 0;color:#9ca3af;font-size:12px;">Kod 30 dakika gecerlidir.</p>
            </div>
        </div>
    </body>
</html>`;
        try {
            console.log('Mail gönderiliyor:', user.email);
            await sendMail({
                from: process.env.SMTP_FROM,
                to: user.email,
                subject,
                text,
                html,
                replyTo: process.env.SMTP_FROM
            });
            console.log('Mail gönderildi:', user.email);
        } catch (mailError) {
            console.error('Mail gönderme hatası:', mailError);
        }

        return res.json({ message: 'Eğer hesap varsa link gönderildi' });
    } catch (error) {
        res.status(500).json({ error: 'Sifre sifirlama basarisiz' });
    }
});

// Reset Password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return res.status(400).json({ error: 'Token ve yeni sifre gerekli' });
        }

        const tokenHash = hashToken(token);
        const resetRecord = await prisma.passwordReset.findUnique({ where: { tokenHash } });

        if (!resetRecord || resetRecord.usedAt || resetRecord.expiresAt < new Date()) {
            return res.status(400).json({ error: 'Token gecersiz veya suresi dolmus' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id: resetRecord.userId },
            data: { password: hashedPassword }
        });

        await prisma.passwordReset.update({
            where: { id: resetRecord.id },
            data: { usedAt: new Date() }
        });

        return res.json({ message: 'Sifre guncellendi' });
    } catch (error) {
        res.status(500).json({ error: 'Sifre sifirlama basarisiz' });
    }
});

module.exports = router;
