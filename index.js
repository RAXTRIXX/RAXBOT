import 'dotenv/config'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} from '@whiskeysockets/baileys'
import pino from 'pino'
import qrcode from 'qrcode-terminal'
import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { evaluate } from 'mathjs'
import fs from 'node:fs'
import { Sticker, StickerTypes } from 'wa-sticker-formatter'

const BOT_NAME = process.env.BOT_NAME || 'RAXBOT'
const PREFIX = process.env.PREFIX || '.'
const OWNER = (process.env.OWNER_NUMBER || '').replace(/\D/g, '')
const AUTH_DIR = './auth_info'
const DATA_FILE = './group-settings.json'
const MOD_FILE = './moderators.json'
const moderators = new Set((process.env.MODERATOR_NUMBERS || '').split(',').map(x => x.replace(/\D/g, '')).filter(Boolean))
try { for (const n of JSON.parse(fs.readFileSync(MOD_FILE, 'utf8'))) moderators.add(String(n).replace(/\D/g, '')) } catch {}
const rl = createInterface({ input, output })

function readSettings() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) }
  catch { return {} }
}
const settings = readSettings()
function saveSettings() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(settings, null, 2))
}
function getText(message) {
  const m = message.message || {}
  return m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption || ''
}
function jidNumber(jid = '') { return jid.split('@')[0].split(':')[0] }
function isOwner(sender) { return Boolean(OWNER) && jidNumber(sender) === OWNER }
function isModerator(sender) { return moderators.has(jidNumber(sender)) }
function isStaff(sender) { return isOwner(sender) || isModerator(sender) }
function saveModerators() { fs.writeFileSync(MOD_FILE, JSON.stringify([...moderators], null, 2)) }
function categoryMenu(category, sender) {
  const menus = {
    all: `╭─「 RAXBOT • ALL 」\n│ .menu sticker\n│ .menu game\n│ .menu anime\n│ .menu grup\n│ .menu owner\n│\n│ .ping  .time  .date\n│ .quote .calc <angka>\n│ .botinfo .runtime\n╰────────────`,
    sticker: `╭─「 STICKER 」\n│ .sticker (kirim/balas gambar)\n╰────────────`,
    game: `╭─「 GAME 」\n│ .tebakangka\n│ .jawab <1-10>\n│ .coin\n│ .dice\n╰────────────`,
    anime: `╭─「 ANIME 」\n│ .anime (rekomendasi acak)\n╰────────────`,
    grup: `╭─「 GRUP 」\n│ .groupinfo\n│ .tagall <pesan> (admin/staff)\n│ .hidetag <pesan> (admin/staff)\n│ .welcome on/off (admin)\n│ .antilink on/off (admin)\n╰────────────`,
    owner: `╭─「 OWNER / MODERATOR 」\n│ .owner\n│ .runtime\n│ .botinfo\n${isOwner(sender) ? '│ .addmod <nomor> (owner)\n│ .delmod <nomor> (owner)\n' : ''}╰────────────`
  }
  return menus[category] || 'Kategori tidak ditemukan. Ketik .menu all.'
}
const games = new Map()
const animeList = [
  'Fullmetal Alchemist: Brotherhood — petualangan dan alkimia',
  'Haikyuu!! — olahraga dan persahabatan',
  'Spy x Family — komedi dan keluarga',
  'Dr. Stone — sains dan petualangan',
  'Mob Psycho 100 — aksi dan komedi',
  'Frieren: Beyond Journey’s End — fantasi dan perjalanan'
]
function groupSettings(jid) {
  settings[jid] ??= { welcome: false, antilink: false }
  return settings[jid]
}
const quotes = [
  'Sedikit demi sedikit, lama-lama menjadi bukit.',
  'Kesalahan adalah kesempatan untuk belajar.',
  'Konsisten lebih penting daripada terburu-buru.',
  'Mulai dari yang kecil, lalu tingkatkan kemampuan.'
]

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR)
  let version
  try { ({ version } = await fetchLatestBaileysVersion()) } catch {}
  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    browser: ['RAXBOT', 'Chrome', '1.0.0']
  })

  sock.ev.on('creds.update', saveCreds)
  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\nScan QR ini dari WhatsApp > Perangkat tertaut > Tautkan perangkat:\n')
      qrcode.generate(qr, { small: true })
    }
    if (connection === 'open') console.log(`\n✅ ${BOT_NAME} terhubung ke WhatsApp.`)
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log('Koneksi terputus. Mencoba menyambungkan kembali...')
        setTimeout(() => startBot().catch(console.error), 3000)
      } else {
        console.log('Sesi logout. Hapus folder auth_info lalu jalankan ulang untuk pairing baru.')
      }
    }
  })

  // Pairing code diminta hanya jika belum ada sesi terdaftar.
  if (!state.creds.registered) {
    const phone = (await rl.question('Nomor WhatsApp bot (kode negara, angka saja; contoh 62812xxxxxxx): ')).replace(/\D/g, '')
    if (!/^62\d{8,13}$/.test(phone)) {
      console.log('Format nomor Indonesia tidak valid. Hentikan bot dan jalankan ulang.')
      process.exit(1)
    }
    try {
      const code = await sock.requestPairingCode(phone)
      console.log(`\nKode pairing RAXBOT: ${code}\nMasukkan di WhatsApp > Perangkat tertaut > Tautkan dengan nomor telepon.\nJANGAN bagikan kode ini kepada siapa pun.\n`)
    } catch (err) {
      console.error('Gagal meminta kode pairing:', err.message)
    }
  }

  sock.ev.on('group-participants.update', async (event) => {
    const cfg = groupSettings(event.id)
    if (!cfg.welcome) return
    try {
      const metadata = await sock.groupMetadata(event.id)
      for (const user of event.participants) {
        if (event.action === 'add') {
          await sock.sendMessage(event.id, {
            text: `Halo @${jidNumber(user)}! Selamat datang di ${metadata.subject}.`,
            mentions: [user]
          })
        }
      }
    } catch {}
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue
      const jid = msg.key.remoteJid
      if (!jid || jid === 'status@broadcast') continue
      const sender = msg.key.participant || jid
      const text = getText(msg).trim()
      if (!text) continue
      const isGroup = jid.endsWith('@g.us')
      const isCmd = text.startsWith(PREFIX)
      const [commandRaw, ...args] = isCmd ? text.slice(PREFIX.length).trim().split(/\s+/) : []
      const command = (commandRaw || '').toLowerCase()
      const argText = args.join(' ')

      // Moderasi tautan sederhana: hanya berjalan jika diaktifkan oleh admin.
      if (isGroup && !msg.key.fromMe && groupSettings(jid).antilink && /https?:\/\/chat\.whatsapp\.com\/\S+/i.test(text)) {
        try {
          const metadata = await sock.groupMetadata(jid)
          const botJid = sock.user.id.split(':')[0] + '@s.whatsapp.net'
          const botAdmin = metadata.participants.some(p => p.id === botJid && ['admin', 'superadmin'].includes(p.admin))
          const senderInfo = metadata.participants.find(p => p.id === sender)
          const senderAdmin = ['admin', 'superadmin'].includes(senderInfo?.admin)
          if (botAdmin && !senderAdmin) {
            await sock.sendMessage(jid, { delete: msg.key })
            await sock.sendMessage(jid, { text: 'Tautan undangan grup dihapus oleh RAXBOT. Ikuti aturan grup ya.' })
          }
        } catch {}
      }

      if (!isCmd) {
        if (/^(hai|halo|hello|assalamualaikum)$/i.test(text)) {
          await sock.sendMessage(jid, { text: `Halo! Aku ${BOT_NAME}. Ketik ${PREFIX}menu untuk melihat fitur.` }, { quoted: msg })
        }
        continue
      }

      try {
        switch (command) {
          case 'menu': {
            const category = (args[0] || 'all').toLowerCase()
            if (category === 'owner' && !isStaff(sender)) {
              await sock.sendMessage(jid, { text: '⛔ Menu ini khusus owner dan moderator.' }, { quoted: msg }); break
            }
            await sock.sendMessage(jid, { text: categoryMenu(category, sender) }, { quoted: msg }); break
          }
          case 'help':
            await sock.sendMessage(jid, { text: categoryMenu('all', sender) }, { quoted: msg }); break
          case 'ping':
            await sock.sendMessage(jid, { text: '🏓 Pong! RAXBOT aktif.' }, { quoted: msg }); break
          case 'sticker': {
            const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage
            const imageMessage = msg.message?.imageMessage || quoted?.imageMessage
            if (!imageMessage) {
              await sock.sendMessage(jid, { text: 'Kirim gambar dengan caption .sticker atau balas gambar dengan .sticker.' }, { quoted: msg }); break
            }
            const source = msg.message?.imageMessage ? msg : {
              key: { ...msg.key, id: msg.message.extendedTextMessage.contextInfo.stanzaId,
                remoteJid: jid, participant: msg.message.extendedTextMessage.contextInfo.participant },
              message: quoted
            }
            const media = await downloadMediaMessage(source, 'buffer', {}, { logger: pino({ level: 'silent' }) })
            const sticker = new Sticker(media, { pack: 'RAXBOT', author: 'RAXBOT', type: StickerTypes.FULL, quality: 65 })
            await sock.sendMessage(jid, { sticker: await sticker.toBuffer() }, { quoted: msg }); break
          }
          case 'tebakangka': {
            const answer = 1 + Math.floor(Math.random() * 10)
            games.set(jid, { answer, expires: Date.now() + 60000 })
            await sock.sendMessage(jid, { text: '🎮 Tebak angka dari 1 sampai 10! Kamu punya waktu 60 detik. Jawab dengan .jawab <angka>.' }, { quoted: msg }); break
          }
          case 'jawab': {
            const game = games.get(jid)
            const guess = Number(args[0])
            if (!game || Date.now() > game.expires) {
              games.delete(jid)
              await sock.sendMessage(jid, { text: 'Belum ada permainan aktif. Ketik .tebakangka.' }, { quoted: msg }); break
            }
            if (!Number.isInteger(guess) || guess < 1 || guess > 10) {
              await sock.sendMessage(jid, { text: 'Masukkan angka 1 sampai 10. Contoh: .jawab 7' }, { quoted: msg }); break
            }
            if (guess === game.answer) {
              games.delete(jid)
              await sock.sendMessage(jid, { text: '🎉 Benar! Kamu berhasil menebak angkanya.' }, { quoted: msg })
            } else {
              await sock.sendMessage(jid, { text: guess < game.answer ? 'Terlalu kecil! Coba lagi.' : 'Terlalu besar! Coba lagi.' }, { quoted: msg })
            }
            break
          }
          case 'anime': {
            const item = animeList[Math.floor(Math.random() * animeList.length)]
            await sock.sendMessage(jid, { text: `🍥 Rekomendasi anime:\\n${item}` }, { quoted: msg }); break
          }
          case 'botinfo':
            await sock.sendMessage(jid, { text: `🤖 ${BOT_NAME}\nPlatform: Termux / Node.js\nLibrary: Baileys\nMode: command-based\nPrefix: ${PREFIX}` }, { quoted: msg }); break
          case 'time':
            await sock.sendMessage(jid, { text: `🕒 ${new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB` }, { quoted: msg }); break
          case 'date':
            await sock.sendMessage(jid, { text: `📅 ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' })}` }, { quoted: msg }); break
          case 'quote':
            await sock.sendMessage(jid, { text: `💡 ${quotes[Math.floor(Math.random() * quotes.length)]}` }, { quoted: msg }); break
          case 'coin':
            await sock.sendMessage(jid, { text: `🪙 ${Math.random() < 0.5 ? 'ANGKA' : 'GAMBAR'}` }, { quoted: msg }); break
          case 'dice':
            await sock.sendMessage(jid, { text: `🎲 Hasil dadu: ${1 + Math.floor(Math.random() * 6)}` }, { quoted: msg }); break
          case 'calc': {
            if (!argText || argText.length > 100 || !/^[\d+\-*/().,%\s^]+$/.test(argText)) {
              await sock.sendMessage(jid, { text: `Contoh: ${PREFIX}calc 12*(4+2)` }, { quoted: msg }); break
            }
            const result = evaluate(argText)
            if (typeof result !== 'number' || !Number.isFinite(result)) throw new Error('Hasil tidak valid')
            await sock.sendMessage(jid, { text: `🧮 ${argText} = ${result}` }, { quoted: msg }); break
          }
          case 'owner':
            await sock.sendMessage(jid, { text: OWNER ? `👑 Owner: wa.me/${OWNER}` : 'Nomor owner belum diatur di file .env.' }, { quoted: msg }); break
          case 'runtime':
            await sock.sendMessage(jid, { text: `⏱️ RAXBOT berjalan selama ${Math.floor(process.uptime())} detik.` }, { quoted: msg }); break
          case 'addmod':
          case 'delmod': {
            if (!isOwner(sender)) {
              await sock.sendMessage(jid, { text: '⛔ Perintah ini khusus owner bot.' }, { quoted: msg }); break
            }
            const number = (args[0] || '').replace(/\D/g, '')
            if (!/^62\d{8,13}$/.test(number)) {
              await sock.sendMessage(jid, { text: `Format: ${PREFIX}${command} 62812xxxxxxx` }, { quoted: msg }); break
            }
            if (command === 'addmod') moderators.add(number)
            else moderators.delete(number)
            saveModerators()
            await sock.sendMessage(jid, { text: `✅ ${number} ${command === 'addmod' ? 'ditambahkan sebagai moderator' : 'dihapus dari moderator'}.` }, { quoted: msg }); break
          }
          case 'groupinfo': {
            if (!isGroup) { await sock.sendMessage(jid, { text: 'Perintah ini hanya untuk grup.' }); break }
            const metadata = await sock.groupMetadata(jid)
            await sock.sendMessage(jid, { text: `👥 ${metadata.subject}\nAnggota: ${metadata.participants.length}\nID: ${jid}\nDeskripsi: ${metadata.desc || '-'}` }, { quoted: msg }); break
          }
          case 'tagall':
          case 'hidetag': {
            if (!isGroup) { await sock.sendMessage(jid, { text: 'Perintah ini hanya untuk grup.' }); break }
            const metadata = await sock.groupMetadata(jid)
            const caller = metadata.participants.find(p => p.id === sender)
            if (!isStaff(sender) && !['admin', 'superadmin'].includes(caller?.admin)) {
              await sock.sendMessage(jid, { text: 'Khusus admin grup atau owner bot.' }); break
            }
            const mentions = metadata.participants.map(p => p.id)
            const body = argText || 'Perhatian semua anggota.'
            await sock.sendMessage(jid, { text: `${command === 'tagall' ? '📢 TAG ALL' : '📣 INFO GRUP'}\n${body}`, mentions }, { quoted: msg }); break
          }
          case 'welcome':
          case 'antilink': {
            if (!isGroup) { await sock.sendMessage(jid, { text: 'Perintah ini hanya untuk grup.' }); break }
            const metadata = await sock.groupMetadata(jid)
            const caller = metadata.participants.find(p => p.id === sender)
            if (!isStaff(sender) && !['admin', 'superadmin'].includes(caller?.admin)) {
              await sock.sendMessage(jid, { text: 'Hanya admin grup atau owner bot yang dapat mengubah pengaturan.' }); break
            }
            const value = args[0]?.toLowerCase()
            if (!['on', 'off'].includes(value)) {
              await sock.sendMessage(jid, { text: `Gunakan ${PREFIX}${command} on atau ${PREFIX}${command} off` }); break
            }
            groupSettings(jid)[command] = value === 'on'
            saveSettings()
            await sock.sendMessage(jid, { text: `✅ ${command} ${value.toUpperCase()}` }, { quoted: msg }); break
          }
          default:
            await sock.sendMessage(jid, { text: `Perintah tidak dikenal. Ketik ${PREFIX}menu.` }, { quoted: msg })
        }
      } catch (err) {
        console.error('Command error:', err)
        await sock.sendMessage(jid, { text: 'Maaf, perintah gagal diproses. Coba lagi.' }, { quoted: msg }).catch(() => {})
      }
    }
  })
}

startBot().catch(err => {
  console.error('RAXBOT gagal dijalankan:', err)
  process.exit(1)
})
