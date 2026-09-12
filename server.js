const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

const lerDados = () => {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8')); }
  catch { return []; }
};
const salvarDados = (dados) => fs.writeFileSync(DB_FILE, JSON.stringify(dados, null, 2));

// ---------- STATUS ----------
app.get('/status', (req, res) => {
  res.json({ api: 'gets invio on', status: 'online', hora: new Date().toISOString() });
});

// ---------- 1º FORMULÁRIO ----------
app.post('/enviar', (req, res) => {
  const {
    nome, idade, profissao, signo, estadoCivil, temFilhos,
    religiao, temVinculo, whatsapp, instagram, endereco, moraOnde, achouSite,
  } = req.body;

  const obrigatorios = { nome, idade, profissao, signo, estadoCivil, temFilhos, religiao, temVinculo, whatsapp, endereco, moraOnde, achouSite };
  const faltando = Object.keys(obrigatorios).filter(k => !obrigatorios[k]);
  if (faltando.length > 0) {
    return res.status(400).json({ sucesso: false, erro: 'Campos faltando: ' + faltando.join(', ') });
  }

  const dados = lerDados();
  const novo = {
    id: Date.now(),
    nome, idade, profissao, signo, estadoCivil, temFilhos,
    religiao, temVinculo, whatsapp,
    instagram: instagram || '-',
    endereco, moraOnde, achouSite,
    recebidoEm: new Date().toISOString(),
    util: null,
  };

  dados.push(novo);
  salvarDados(dados);

  res.status(201).json({ sucesso: true, mensagem: 'Cadastro recebido!', dados: novo });
});

// ---------- 2º FORMULÁRIO (ÚTIL) ----------
app.post('/enviar-util', (req, res) => {
  const { refId, sexo, calmo, triste, apelido, lazer, naoFaria } = req.body;

  if (!refId) return res.status(400).json({ sucesso: false, erro: 'refId faltando.' });
  if (!sexo || !calmo || !triste || !apelido || !lazer || !naoFaria) {
    return res.status(400).json({ sucesso: false, erro: 'Preencha todos os campos.' });
  }

  const dados = lerDados();
  const idx = dados.findIndex(d => d.id === Number(refId));
  if (idx === -1) {
    return res.status(404).json({ sucesso: false, erro: 'Cadastro original não encontrado.' });
  }

  dados[idx].util = { sexo, calmo, triste, apelido, lazer, naoFaria };
  salvarDados(dados);

  res.json({ sucesso: true, mensagem: 'Formulário útil recebido!' });
});

// ---------- LISTAR ----------
app.get('/dados', (req, res) => {
  const dados = lerDados();
  res.json({ sucesso: true, total: dados.length, dados });
});

// ---------- DELETAR ----------
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

app.delete('/dados', (req, res) => {
  salvarDados([]);
  res.json({ sucesso: true, mensagem: 'Todos removidos.' });
});

app.listen(PORT, () => {
  console.log(`🚀 API rodando na porta ${PORT}`);
});
