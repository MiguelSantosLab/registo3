const CW = 55, CH = 35;            // célula da grelha do mapa, em px
const ZOOM_MIN = 0.12, ZOOM_MAX = 2.5;
// abaixo de 25% (na escala do topo) as caixas mostram só o número, com a imagem de fundo
const ZOOM_LONGE = ZOOM_MIN + 0.1 * (ZOOM_MAX - ZOOM_MIN);
const mapa = document.getElementById('mapa');
const mundo = document.getElementById('mundo');
const terreno = document.getElementById('terreno');
const terrenoImg = terreno.querySelector('img');
const grelha = document.getElementById('grelha');
const ctx = grelha.getContext('2d');
const info = document.getElementById('info');
const zoomInfo = document.getElementById('zoom');
const btnDesfazer = document.getElementById('desfazer');
const btnRepor = document.getElementById('repor');
const btnMais = document.getElementById('mais');
const btnMenos = document.getElementById('menos');
const btnCentrar = document.getElementById('centrar');
const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const eCitacao = txt => /^\[\d+\]$/.test(txt.trim());
const nomeCat = c => c.replace(/-/g, ' ');

// Lê os itens de #fonte: número, categoria, HTML e ligações (pela ordem em que aparecem)
const itens = {};
let primeiro = null;
document.querySelectorAll('#fonte .item').forEach(div => {
  const n = Number(div.id.replace('item-', ''));
  const cat = [...div.classList].find(c => c !== 'item' && !/^\d+$/.test(c)) || '';
  const ancoras = [...div.querySelectorAll('a[href^="#item-"]')].map(a => ({
    alvo: Number(a.getAttribute('href').replace('#item-', '')),
    texto: a.textContent.trim(),
    cit: eCitacao(a.textContent),
  }));
  const chars = [...div.querySelectorAll('p')].reduce((s, p) => s + p.textContent.length, 0);
  itens[n] = { n, cat, html: div.innerHTML, ancoras, chars, fig: !!div.querySelector('img') };
  if (primeiro === null) primeiro = n;
});

// Proporções das imagens, para que a altura de cada caixa se possa medir antes de as imagens carregarem
const proporcoes = new Map();
function carregarImagens() {
  const srcs = [...new Set([...document.querySelectorAll('#fonte img')].map(i => i.src))];
  return Promise.all(srcs.map(src => new Promise(ok => {
    const im = new Image();
    im.onload = () => { proporcoes.set(src, im.naturalWidth / im.naturalHeight); ok(); };
    im.onerror = ok;
    im.src = src;
  })));
}

// Estado: caixas pela ordem em que foram abertas (desfazer = remover a última) + histórico de esticões
// caixa: { id, item, origem, x, y, w, h } com posição e tamanho em células do mapa
// origem: { de: id da caixa de onde se abriu, ancora: índice da ligação, rotulo }
let proxId = 1;
let estado = { caixas: [], historico: [] };
const elementos = new Map(); // id da caixa -> elemento

// Imagens de fundo (vistas de longe); cada caixa nova recebe uma ao acaso, diferente da caixa de onde veio
const FUNDOS = [1, 2, 3, 4, 5, 6, 7].map(n => `images/Final%20Images/psicina${n}.jpg`);
function fundoAoAcaso(evitar) {
  const opcoes = FUNDOS.filter(f => f !== evitar);
  return opcoes[Math.floor(Math.random() * opcoes.length)];
}
// Filtro da imagem de fundo, sorteado por caixa: brilho entre 0 e 10, matiz entre -15deg e 20deg
const entre = (a, b) => a + Math.random() * (b - a);
const filtroAoAcaso = () => `brightness(${entre(1, 1.2).toFixed(2)}) hue-rotate(${entre(-15, 20).toFixed(1)}deg)`;

// Câmara: ponto no ecrã = ponto no mundo * z + (x, y)
const cam = { x: 0, y: 0, z: 1 };

function criarElemento(caixa) {
  const it = itens[caixa.item];
  const el = document.createElement('section');
  el.className = 'regiao';
  el.dataset.id = caixa.id;
  el.innerHTML = `
    <div class="cabeca">
      <span class="num"></span><span class="cat"></span><span class="origem"></span>
    </div>
    <div class="texto"></div>`;
  if (caixa.fundo) el.style.setProperty('--fundo', `url("${caixa.fundo}")`);
  if (caixa.filtro) el.style.setProperty('--filtro', caixa.filtro);
  el.querySelector('.num').textContent = `[${it.n}]`;
  el.querySelector('.cat').textContent = nomeCat(it.cat);
  if (caixa.origem) el.querySelector('.origem').textContent = `← ${caixa.origem.rotulo}`;
  const texto = el.querySelector('.texto');
  texto.innerHTML = it.html;
  // as citações [n] saem do parágrafo e passam a ser um botão + por baixo do texto
  const acoes = document.createElement('div');
  acoes.className = 'acoes';
  texto.querySelectorAll('a[href^="#item-"]').forEach((a, i) => {
    if (!it.ancoras[i].cit) { a.dataset.ancora = i; return; }
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mais';
    b.dataset.ancora = i;
    b.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10"/></svg>';
    b.setAttribute('aria-label', `Abrir a citação ${it.ancoras[i].alvo}`);
    acoes.appendChild(b);
    a.remove();
  });
  if (acoes.childElementCount) texto.appendChild(acoes);
  el.querySelectorAll('.texto img').forEach(img => {
    const r = proporcoes.get(img.src);
    if (r) img.style.aspectRatio = r;
    img.loading = 'eager';
    img.draggable = false;
  });
  el.setAttribute('aria-label', `Citação ${it.n}, ${nomeCat(it.cat)}`);
  return el;
}

// ---------- Tamanhos ----------

// Mede (fora do ecrã) quantas linhas da grelha o conteúdo precisa com uma dada largura
const medidor = document.createElement('div');
medidor.className = 'medidor';
mundo.appendChild(medidor);
const alturas = new Map(); // "item:w" -> altura mínima em células
function alturaMin(item, w) {
  const k = `${item}:${w}`;
  if (!alturas.has(k)) {
    const el = criarElemento({ id: 0, item, origem: null });
    el.style.width = `${w * CW + 1}px`;
    medidor.appendChild(el);
    alturas.set(k, Math.max(3, Math.ceil((el.offsetHeight - 1) / CH)));
    el.remove();
  }
  return alturas.get(k);
}

// Largura de referência pelo tamanho do conteúdo; à volta dela há variantes para encaixar nos recantos
function larguraBase(item) {
  const it = itens[item];
  if (it.fig) return 12;
  return it.chars < 250 ? 6 : it.chars < 600 ? 8 : 10;
}
function tamanhos(item) {
  const base = larguraBase(item);
  const out = [];
  for (let w = Math.max(W_MIN, base - 2); w <= base + 3; w++) {
    const h0 = alturaMin(item, w);
    for (let h = h0; h <= h0 + 3; h++) out.push({ w, h, h0, base });
  }
  return out;
}

// ---------- Colocação ----------

const sobrepoe = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Comprimento (px) da aresta partilhada por duas caixas encostadas
function contacto(a, b) {
  if (a.x + a.w === b.x || b.x + b.w === a.x) {
    return Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)) * CH;
  }
  if (a.y + a.h === b.y || b.y + b.h === a.y) {
    return Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * CW;
  }
  return 0;
}

// Todas as posições encostadas a p (direita, esquerda, baixo, cima) que não sobrepõem nenhuma caixa
function candidatos(p, sizes) {
  const out = [];
  for (const s of sizes) {
    const { w, h } = s;
    const sv = Math.min(2, h, p.h); // partilham pelo menos 2 células de aresta
    for (let y = p.y - h + sv; y <= p.y + p.h - sv; y++) {
      out.push({ ...s, x: p.x + p.w, y, lado: 'h' });
      out.push({ ...s, x: p.x - w, y, lado: 'h' });
    }
    const sh = Math.min(2, w, p.w);
    for (let x = p.x - w + sh; x <= p.x + p.w - sh; x++) {
      out.push({ ...s, x, y: p.y + p.h, lado: 'v' });
      out.push({ ...s, x, y: p.y - h, lado: 'v' });
    }
  }
  return out.filter(c => estado.caixas.every(b => !sobrepoe(c, b)));
}

// Espaço morto: células vazias rodeadas por caixas (buracos) ou em recantos tão estreitos
// que nenhuma caixa lá cabe (menos de W_MIN de largura ou H_MIN de altura entre duas caixas)
const W_MIN = 5, H_MIN = 3;
function espacoMorto(extra) {
  const rs = extra ? [...estado.caixas, extra] : estado.caixas;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rs) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
  }
  x0--; y0--; x1++; y1++;
  const W = x1 - x0, H = y1 - y0;
  const g = new Uint8Array(W * H);
  for (const r of rs) {
    for (let y = r.y; y < r.y + r.h; y++) g.fill(1, (y - y0) * W + r.x - x0, (y - y0) * W + r.x + r.w - x0);
  }
  // inundar a partir do canto (que está sempre fora da forma)
  const pilha = [0];
  g[0] = 2;
  while (pilha.length) {
    const i = pilha.pop(), x = i % W;
    for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
      if (j >= 0 && j < g.length && g[j] === 0) { g[j] = 2; pilha.push(j); }
    }
  }
  // recantos estreitos: troços vazios entre duas caixas, na horizontal e na vertical
  const marcar = (i0, passo, len) => {
    for (let k = 0, i = i0; k < len; k++, i += passo) if (g[i] === 2) g[i] = 3;
  };
  for (let y = 0; y < H; y++) {
    let ini = -1;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (g[i] === 1) { if (ini >= 0 && x - ini < W_MIN) marcar(y * W + ini, 1, x - ini); ini = -1; }
      else if (ini < 0 && x > 0 && g[i - 1] === 1) ini = x;
    }
  }
  for (let x = 0; x < W; x++) {
    let ini = -1;
    for (let y = 0; y < H; y++) {
      const i = y * W + x;
      if (g[i] === 1) { if (ini >= 0 && y - ini < H_MIN) marcar(ini * W + x, W, y - ini); ini = -1; }
      else if (ini < 0 && y > 0 && g[i - W] === 1) ini = y;
    }
  }
  let n = 0;
  for (const v of g) if (v === 0 || v === 3) n++;
  return n;
}

// Escolhe onde nasce a nova caixa: encostada à caixa de origem, a tocar no maior número de vizinhas,
// sem deixar buracos, perto do centro da forma, com um pouco de acaso para a forma ser sempre única
function colocar(item, pai) {
  const sizes = tamanhos(item);
  const caixas = estado.caixas;
  let area = 0, cx = 0, cy = 0;
  for (const b of caixas) {
    const a = b.w * CW * b.h * CH;
    area += a; cx += a * (b.x + b.w / 2) * CW; cy += a * (b.y + b.h / 2) * CH;
  }
  cx /= area; cy /= area;
  const escala = Math.sqrt(area);
  const centro = b => [(b.x + b.w / 2) * CW, (b.y + b.h / 2) * CH];
  const dist = (a, b) => Math.hypot(centro(a)[0] - centro(b)[0], centro(a)[1] - centro(b)[1]);

  // se a caixa de origem já estiver cercada, tenta a vizinha mais próxima que tenha espaço
  const ordem = [pai, ...caixas.filter(b => b !== pai).sort((a, b) => dist(a, pai) - dist(b, pai))];
  for (const p of ordem) {
    const cs = candidatos(p, sizes);
    if (!cs.length) continue;
    for (const c of cs) {
      let t = 0;
      for (const b of caixas) t += contacto(c, b);
      const perim = 2 * (c.w * CW + c.h * CH);
      const alinhado = c.lado === 'h'
        ? (c.y === p.y) + (c.y + c.h === p.y + p.h)
        : (c.x === p.x) + (c.x + c.w === p.x + p.w);
      const [ccx, ccy] = centro(c);
      c.nota = 8 * t / perim
        + 0.4 * alinhado
        - 0.2 * (c.h - c.h0)
        - 0.25 * Math.abs(c.w - c.base)
        - 0.8 * Math.hypot(ccx - cx, ccy - cy) / escala
        + Math.random() * 1.5;
    }
    cs.sort((a, b) => b.nota - a.nota);
    const antes = espacoMorto(null);
    const melhores = cs.slice(0, 80);
    for (const c of melhores) c.nota -= 2 * (espacoMorto(c) - antes);
    melhores.sort((a, b) => b.nota - a.nota);
    return melhores[0];
  }
  return null;
}

// Fecha o espaço morto que sobrar: estica caixas vizinhas para dentro dos recantos.
// Devolve os tamanhos anteriores das caixas esticadas (para desfazer)
function preencher() {
  const antigos = new Map();
  let morto = espacoMorto(null);
  while (morto > 0) {
    let melhor = null;
    for (const b of estado.caixas) {
      for (let k = 1; k <= 6; k++) {
        for (const r of [
          { x: b.x, y: b.y, w: b.w + k, h: b.h },
          { x: b.x - k, y: b.y, w: b.w + k, h: b.h },
          { x: b.x, y: b.y, w: b.w, h: b.h + k },
          { x: b.x, y: b.y - k, w: b.w, h: b.h + k },
        ]) {
          if (estado.caixas.some(o => o !== b && sobrepoe(r, o))) continue;
          const guardado = { x: b.x, y: b.y, w: b.w, h: b.h };
          Object.assign(b, r);
          const m = espacoMorto(null);
          Object.assign(b, guardado);
          // prefere fechar mais espaço com o menor esticão
          if (m < morto && (!melhor || m < melhor.m || (m === melhor.m && k < melhor.k))) melhor = { b, r, m, k };
        }
      }
    }
    if (!melhor) break;
    if (!antigos.has(melhor.b)) antigos.set(melhor.b, { x: melhor.b.x, y: melhor.b.y, w: melhor.b.w, h: melhor.b.h });
    Object.assign(melhor.b, melhor.r);
    morto = melhor.m;
  }
  return [...antigos];
}

// ---------- Desenho ----------

function desenhar(novos = new Set()) {
  const ids = new Set(estado.caixas.map(c => c.id));
  for (const [id, el] of elementos) {
    if (!ids.has(id)) { el.remove(); elementos.delete(id); }
  }
  // ligações já abertas: "idCaixa:indiceAncora"
  const abertas = new Set();
  for (const c of estado.caixas) if (c.origem) abertas.add(`${c.origem.de}:${c.origem.ancora}`);

  for (const c of estado.caixas) {
    let el = elementos.get(c.id);
    if (!el) {
      el = criarElemento(c);
      elementos.set(c.id, el);
      mundo.appendChild(el);
      if (novos.has(c.id)) piscar(el);
    }
    // +1 px: as bordas de caixas vizinhas ficam sobrepostas numa só linha
    el.style.left = `${c.x * CW}px`;
    el.style.top = `${c.y * CH}px`;
    el.style.width = `${c.w * CW + 1}px`;
    el.style.height = `${c.h * CH + 1}px`;
    el.querySelectorAll('.texto [data-ancora]').forEach(a => {
      a.classList.toggle('aberto', abertas.has(`${c.id}:${a.dataset.ancora}`));
    });
  }
  atualizarEstado();
}

function piscar(el) {
  el.classList.remove('nova');
  void el.offsetWidth;
  el.classList.add('nova');
  el.addEventListener('animationend', () => el.classList.remove('nova'), { once: true });
}

// A cor da grelha lê-se uma vez do CSS; lê-la a cada frame tornava o zoom mais pesado
let corGrelha = '';
function lerCorGrelha() {
  corGrelha = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
  desenharGrelha();
}

function desenharGrelha() {
  const dpr = window.devicePixelRatio || 1;
  const w = mapa.clientWidth, h = mapa.clientHeight;
  if (grelha.width !== Math.round(w * dpr) || grelha.height !== Math.round(h * dpr)) {
    grelha.width = Math.round(w * dpr);
    grelha.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let passo = 1;
  while (CW * cam.z * passo < 14) passo *= 5;
  const sx = CW * cam.z * passo, sy = CH * cam.z * passo;
  ctx.strokeStyle = corGrelha;
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ((cam.x % sx) + sx) % sx; x < w; x += sx) {
    const X = Math.round(x) + 0.5;
    ctx.moveTo(X, 0); ctx.lineTo(X, h);
  }
  for (let y = ((cam.y % sy) + sy) % sy; y < h; y += sy) {
    const Y = Math.round(y) + 0.5;
    ctx.moveTo(0, Y); ctx.lineTo(w, Y);
  }
  ctx.stroke();
}

// Enquanto a câmara se mexe, o mundo é tratado como uma imagem (will-change) para o movimento ser fluido;
// quando para, o texto volta a ser desenhado nítido à escala final
let paragem = 0;
function aplicarCamara() {
  mundo.style.transform = terreno.style.transform = `translate(${cam.x}px, ${cam.y}px) scale(${cam.z})`;
  mundo.classList.add('movendo');
  clearTimeout(paragem);
  paragem = setTimeout(() => mundo.classList.remove('movendo'), 150);
  mapa.classList.toggle('longe', cam.z < ZOOM_LONGE);
  zoomInfo.textContent = `${percentagem(cam.z)}%`;
  desenharGrelha();
}

function atualizarEstado() {
  const n = estado.caixas.length;
  info.textContent = `${n} ${n === 1 ? 'caixa' : 'caixas'}`;
  btnDesfazer.disabled = n <= 1;
  btnRepor.disabled = n <= 1;
}

// ---------- Câmara ----------

const limitar = z => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
// Escala mostrada no topo: 0% = o mais afastado possível, 250% = o mais próximo
const percentagem = z => Math.round(250 * (z - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN));

function zoomEm(sx, sy, z) {
  z = limitar(z);
  const wx = (sx - cam.x) / cam.z, wy = (sy - cam.y) / cam.z;
  cam.z = z;
  cam.x = sx - wx * z;
  cam.y = sy - wy * z;
  aplicarCamara();
}

// Zoom suave: a roda e os botões mudam o zoom-alvo; a cada frame a câmara aproxima-se dele
// (em escala logarítmica), mantendo fixo o ponto do ecrã onde o zoom foi pedido
let zoomAlvo = 1, ancora = { x: 0, y: 0 }, zoomAnim = 0, zoomT = 0;
function zoomSuave(sx, sy, z) {
  zoomAlvo = limitar(z);
  ancora = { x: sx, y: sy };
  cancelAnimationFrame(voo);
  if (reduzido) { zoomEm(sx, sy, zoomAlvo); return; }
  if (!zoomAnim) { zoomT = performance.now(); zoomAnim = requestAnimationFrame(passoZoom); }
}
function passoZoom(t) {
  const dt = Math.min(64, t - zoomT);
  zoomT = t;
  const k = 1 - Math.pow(0.78, dt / 16.7); // ~22% do caminho por frame a 60 fps
  const l0 = Math.log(cam.z), l1 = Math.log(zoomAlvo);
  const fim = Math.abs(l1 - l0) < 0.002;
  zoomEm(ancora.x, ancora.y, fim ? zoomAlvo : Math.exp(l0 + (l1 - l0) * k));
  zoomAnim = fim ? 0 : requestAnimationFrame(passoZoom);
  if (fim) voltarAoMapa();
}
// zoom relativo ao alvo em curso, para que vários passos da roda se acumulem
const zoomPor = (sx, sy, f) => zoomSuave(sx, sy, (zoomAnim ? zoomAlvo : cam.z) * f);
function pararZoom() {
  cancelAnimationFrame(zoomAnim);
  zoomAnim = 0;
}

let voo = 0;
// Enquanto o terreno se vê (de longe), a câmara não deixa o ecrã sair dele;
// devolve a câmara c presa a esses limites (ou centrada, se o terreno for mais pequeno do que o ecrã)
let terrenoRect = null; // retângulo do terreno, em px do mundo
function prender(c) {
  if (!terrenoRect || c.z >= ZOOM_LONGE) return c;
  const eixo = (v, a0, a1, tam) => {
    const lo = tam - a1 * c.z, hi = -a0 * c.z;
    return lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v));
  };
  const r = terrenoRect;
  return { z: c.z, x: eixo(c.x, r.x0, r.x1, mapa.clientWidth), y: eixo(c.y, r.y0, r.y1, mapa.clientHeight) };
}
// Se o ecrã saiu do terreno, desliza de volta até ele
function voltarAoMapa() {
  const alvo = prender(cam);
  if (Math.abs(alvo.x - cam.x) > 0.5 || Math.abs(alvo.y - cam.y) > 0.5) voarPara(alvo);
}
// Arrastar para fora do terreno custa cada vez mais (efeito elástico): d é o movimento, fora o quanto já saiu
const elastico = (d, fora) => fora * d > 0 ? d * 0.4 / (1 + Math.abs(fora) / 150) : d;

function voarPara(alvo) {
  cancelAnimationFrame(voo);
  pararZoom();
  alvo = prender(alvo);
  if (reduzido) { Object.assign(cam, alvo); aplicarCamara(); return; }
  const de = { ...cam }, t0 = performance.now(), dur = 380;
  const passo = t => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    cam.x = de.x + (alvo.x - de.x) * e;
    cam.y = de.y + (alvo.y - de.y) * e;
    cam.z = de.z + (alvo.z - de.z) * e;
    aplicarCamara();
    if (k < 1) voo = requestAnimationFrame(passo);
  };
  voo = requestAnimationFrame(passo);
}

// Câmara que mostra o retângulo (px do mundo) centrado, sem passar do zoom zMax
function camaraPara(x0, y0, x1, y1, zMax) {
  const m = 40, W = mapa.clientWidth, H = mapa.clientHeight;
  const z = limitar(Math.min(zMax, (W - 2 * m) / (x1 - x0), (H - 2 * m) / (y1 - y0)));
  return { z, x: W / 2 - (x0 + x1) / 2 * z, y: H / 2 - (y0 + y1) / 2 * z };
}

// Centra a forma toda; zMax = ZOOM_MIN deixa-a centrada mas no zoom mais afastado (0%)
function enquadrar(animar = true, zMax = 1) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of estado.caixas) {
    x0 = Math.min(x0, c.x * CW); y0 = Math.min(y0, c.y * CH);
    x1 = Math.max(x1, (c.x + c.w) * CW); y1 = Math.max(y1, (c.y + c.h) * CH);
  }
  const alvo = camaraPara(x0, y0, x1, y1, zMax);
  cancelAnimationFrame(voo);
  pararZoom();
  if (animar) voarPara(alvo); else { Object.assign(cam, prender(alvo)); aplicarCamara(); }
}

// Traz uma caixa para o ecrã se ainda não estiver toda visível
function mostrar(c) {
  const x0 = c.x * CW, y0 = c.y * CH, x1 = (c.x + c.w) * CW, y1 = (c.y + c.h) * CH;
  const m = 20;
  const visivel = x0 * cam.z + cam.x >= m && y0 * cam.z + cam.y >= m
    && x1 * cam.z + cam.x <= mapa.clientWidth - m && y1 * cam.z + cam.y <= mapa.clientHeight - m;
  if (!visivel) voarPara(camaraPara(x0, y0, x1, y1, cam.z));
}

// ---------- Abrir / desfazer ----------

function origemDe(caixa, ancora) {
  const lig = itens[caixa.item].ancoras[ancora];
  return { alvo: lig.alvo, origem: { de: caixa.id, ancora, rotulo: lig.cit ? lig.texto : `“${lig.texto}”` } };
}

function abrir(caixa, ancora) {
  const existente = estado.caixas.find(c => c.origem && c.origem.de === caixa.id && c.origem.ancora === ancora);
  if (existente) { mostrar(existente); piscar(elementos.get(existente.id)); return; }
  const { alvo, origem } = origemDe(caixa, ancora);
  const lugar = colocar(alvo, caixa);
  if (!lugar) return;
  const nova = { id: proxId++, item: alvo, origem, x: lugar.x, y: lugar.y, w: lugar.w, h: lugar.h, fundo: fundoAoAcaso(caixa.fundo), filtro: filtroAoAcaso() };
  estado.caixas.push(nova);
  estado.historico.push(preencher());
  desenhar(new Set([nova.id]));
  mostrar(nova);
}

// Remove a última caixa e devolve às outras o tamanho que tinham antes de ela chegar
function desfazer() {
  if (estado.caixas.length <= 1) return;
  estado.caixas.pop();
  for (const [b, r] of estado.historico.pop()) Object.assign(b, r);
  desenhar();
}

function estadoNovo() {
  const w = larguraBase(primeiro);
  return {
    caixas: [{ id: proxId++, item: primeiro, origem: null, x: 0, y: 0, w, h: alturaMin(primeiro, w), fundo: fundoAoAcaso(), filtro: filtroAoAcaso() }],
    historico: [], // por cada caixa aberta: [caixa, tamanho anterior] das que foram esticadas
  };
}

function repor() {
  estado = estadoNovo();
  desenhar();
  enquadrar(true, ZOOM_MIN);
}

// ---------- Interação: arrastar (botão esquerdo ou do meio), zoom, pinça ----------

const ponteiros = new Map(); // pointerId -> {x, y}
let arrasto = null;          // { x0, y0, ativo }
let suprimirClique = false;

const local = e => {
  const r = mapa.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

mapa.addEventListener('pointerdown', e => {
  if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
  cancelAnimationFrame(voo);
  pararZoom();
  ponteiros.set(e.pointerId, local(e));
  if (ponteiros.size === 1) arrasto = { ...local(e), ativo: false };
  // botão do meio: arrasta logo, sem esperar pelo limiar que distingue um clique
  if (e.button === 1 && arrasto) {
    e.preventDefault();
    arrasto.ativo = true;
    mapa.setPointerCapture(e.pointerId);
    mapa.classList.add('a-arrastar');
  }
});
// sem o auto-scroll do browser nem abrir ligações num separador novo com o botão do meio
mapa.addEventListener('mousedown', e => { if (e.button === 1) e.preventDefault(); });
mapa.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });

mapa.addEventListener('pointermove', e => {
  const ant = ponteiros.get(e.pointerId);
  if (!ant || !arrasto) return;
  const p = local(e);
  if (ponteiros.size === 1) {
    if (!arrasto.ativo && Math.hypot(p.x - arrasto.x, p.y - arrasto.y) > 4) {
      arrasto.ativo = true;
      mapa.setPointerCapture(e.pointerId);
      mapa.classList.add('a-arrastar');
    }
    if (arrasto.ativo) {
      const lim = prender(cam);
      cam.x += elastico(p.x - ant.x, cam.x - lim.x);
      cam.y += elastico(p.y - ant.y, cam.y - lim.y);
      aplicarCamara();
    }
  } else if (ponteiros.size === 2) {
    // pinça: zoom pela distância entre os dedos, arrasto pelo ponto médio
    const [outro] = [...ponteiros].filter(([id]) => id !== e.pointerId).map(([, v]) => v);
    const d0 = Math.hypot(ant.x - outro.x, ant.y - outro.y);
    const d1 = Math.hypot(p.x - outro.x, p.y - outro.y);
    const mx = (p.x + outro.x) / 2, my = (p.y + outro.y) / 2;
    cam.x += (p.x - ant.x) / 2;
    cam.y += (p.y - ant.y) / 2;
    arrasto.ativo = true;
    if (d0 > 0) zoomEm(mx, my, cam.z * d1 / d0); else aplicarCamara();
  }
  ponteiros.set(e.pointerId, p);
});

function largar(e) {
  if (!ponteiros.delete(e.pointerId)) return;
  if (ponteiros.size === 0) {
    if (arrasto && arrasto.ativo) {
      suprimirClique = true;
      setTimeout(() => { suprimirClique = false; });
    }
    arrasto = null;
    mapa.classList.remove('a-arrastar');
    voltarAoMapa();
  }
}
mapa.addEventListener('pointerup', largar);
mapa.addEventListener('pointercancel', largar);
mundo.addEventListener('dragstart', e => e.preventDefault());

mapa.addEventListener('wheel', e => {
  e.preventDefault();
  const p = local(e);
  const d = e.deltaY * (e.deltaMode === 1 ? 33 : 1);
  zoomPor(p.x, p.y, Math.exp(-d * (e.ctrlKey ? 0.01 : 0.0015)));
}, { passive: false });

mapa.addEventListener('click', e => {
  if (suprimirClique) { e.preventDefault(); suprimirClique = false; return; }
  const a = e.target.closest('.texto [data-ancora]');
  if (!a) return;
  e.preventDefault();
  const el = a.closest('.regiao');
  const c = estado.caixas.find(c => c.id === Number(el.dataset.id));
  if (c) abrir(c, Number(a.dataset.ancora));
});

const zoomCentro = k => zoomPor(mapa.clientWidth / 2, mapa.clientHeight / 2, k);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') desfazer();
  else if (e.key === '+' || e.key === '=') zoomCentro(1.25);
  else if (e.key === '-') zoomCentro(0.8);
  else if (e.key === '0') enquadrar(true, ZOOM_MIN);
});

btnDesfazer.addEventListener('click', desfazer);
btnRepor.addEventListener('click', repor);
btnMais.addEventListener('click', () => zoomCentro(1.25));
btnMenos.addEventListener('click', () => zoomCentro(0.8));
btnCentrar.addEventListener('click', () => enquadrar(true, ZOOM_MIN)); // centra a forma no zoom 0%

new ResizeObserver(() => { desenharGrelha(); voltarAoMapa(); }).observe(mapa);
lerCorGrelha();

// Terreno: map.jpg centrado na primeira caixa; no zoom mínimo é 1.6x maior do que o ecrã (há espaço para arrastar)
function colocarTerreno() {
  const r = terrenoImg.naturalWidth / terrenoImg.naturalHeight || 1;
  const c = estado.caixas[0];
  const cx = (c.x + c.w / 2) * CW, cy = (c.y + c.h / 2) * CH;
  const w = Math.max(mapa.clientWidth, mapa.clientHeight * r) / ZOOM_MIN * 1.6, h = w / r;
  terrenoRect = { x0: cx - w / 2, y0: cy - h / 2, x1: cx + w / 2, y1: cy + h / 2 };
  Object.assign(terrenoImg.style, {
    width: `${w}px`, height: `${h}px`, left: `${terrenoRect.x0}px`, top: `${terrenoRect.y0}px`,
  });
}

const terrenoPronto = new Promise(ok => {
  if (terrenoImg.complete) ok();
  else { terrenoImg.onload = ok; terrenoImg.onerror = ok; }
});

Promise.all([carregarImagens(), document.fonts.ready, terrenoPronto]).then(() => {
  estado = estadoNovo();
  colocarTerreno();
  desenhar();
  enquadrar(false, ZOOM_MIN);
});
