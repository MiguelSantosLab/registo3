const CW = 55, CH = 35;
const NIVEL_MAX = 3; // nº máximo de divisões por caixa; depois disso, uma ligação abre uma página nova
const main = document.getElementById('conteudo');
const info = document.getElementById('info');
const btnDesfazer = document.getElementById('desfazer');
const btnRepor = document.getElementById('repor');
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
  itens[n] = { n, cat, html: div.innerHTML, ancoras };
  if (primeiro === null) primeiro = n;
});

let proxId = 1;
// origem: { de: id da folha de onde se abriu, ancora: índice da ligação, rotulo }
function folha(item, origem = null) {
  return { id: proxId++, item, origem, filhos: null, dir: null, pai: null };
}
function pagina(raiz) {
  return { id: proxId++, raiz };
}

// Estado: lista de páginas (cada uma com a sua árvore) + histórico; começa na primeira citação
// histórico: { interno, pagina } para divisões, { nova: pagina } para páginas abertas
function estadoNovo() {
  return { paginas: [pagina(folha(primeiro))], historico: [] };
}
let estado = estadoNovo();

let rects = new Map();       // id da folha -> {x,y,w,h,nivel,no,pagina,p} em células, relativo à página
const elementos = new Map(); // id da folha -> elemento
const paginasEl = new Map(); // id da página -> elemento

function dimensoes() {
  return { W: main.clientWidth / CW, H: main.clientHeight / CH };
}

// Decide a direção: ao longo do lado mais comprido, só se couberem pelo menos 2 células
function direcao(w, h) {
  const podeV = w >= 2, podeH = h >= 2;
  if (podeV && (w * CW >= h * CH || !podeH)) return 'v';
  if (podeH) return 'h';
  return null;
}

// nivel = profundidade na árvore da página = quantas vezes o espaço da caixa já foi dividido
const podeDividir = r => r.nivel < NIVEL_MAX && !!direcao(r.w, r.h);

function calcular(no, x, y, w, h, saida, extra, nivel = 0) {
  if (!no.filhos) { saida.set(no.id, { x, y, w, h, nivel, no, ...extra }); return; }
  const [a, b] = no.filhos;
  if (no.dir === 'v') {
    const k = w >= 2 ? Math.floor(w / 2) : w / 2;
    calcular(a, x, y, k, h, saida, extra, nivel + 1);
    calcular(b, x + k, y, w - k, h, saida, extra, nivel + 1);
  } else {
    const k = h >= 2 ? Math.floor(h / 2) : h / 2;
    calcular(a, x, y, w, k, saida, extra, nivel + 1);
    calcular(b, x, y + k, w, h - k, saida, extra, nivel + 1);
  }
}

function calcularRects() {
  const { W, H } = dimensoes();
  rects = new Map();
  estado.paginas.forEach((pg, p) => calcular(pg.raiz, 0, 0, W, H, rects, { pagina: pg, p }));
}

function criarElemento(no) {
  const it = itens[no.item];
  const el = document.createElement('section');
  el.className = 'regiao';
  el.dataset.id = no.id;
  el.innerHTML = `
    <div class="cabeca">
      <span class="num"></span><span class="cat"></span><span class="origem"></span><span class="dim"></span>
    </div>
    <div class="texto"></div>
    <div class="curto"></div>`;
  el.querySelector('.num').textContent = `[${it.n}]`;
  el.querySelector('.cat').textContent = nomeCat(it.cat);
  if (no.origem) el.querySelector('.origem').textContent = `← ${no.origem.rotulo}`;
  el.querySelector('.texto').innerHTML = it.html;
  el.querySelectorAll('.texto a[href^="#item-"]').forEach((a, i) => {
    a.dataset.ancora = i;
    if (it.ancoras[i].cit) a.classList.add('cit');
  });
  el.querySelector('.curto').textContent = it.n;
  el.setAttribute('aria-label', `Citação ${it.n}, ${nomeCat(it.cat)}`);
  return el;
}

function limpar() {
  main.innerHTML = '';
  elementos.clear();
  paginasEl.clear();
}

function desenhar(novos = new Set()) {
  calcularRects();
  const s = estado;

  // páginas: uma por ecrã, empilhadas na vertical
  const ids = new Set(s.paginas.map(pg => pg.id));
  for (const [id, el] of paginasEl) {
    if (!ids.has(id)) { el.remove(); paginasEl.delete(id); }
  }
  s.paginas.forEach((pg, p) => {
    let el = paginasEl.get(pg.id);
    if (!el) {
      el = document.createElement('div');
      el.className = 'pagina';
      paginasEl.set(pg.id, el);
      main.appendChild(el);
    }
    el.style.top = `${p * main.clientHeight}px`;
    el.style.height = `${main.clientHeight}px`;
    el.classList.toggle('seguinte', p > 0);
  });

  // remover elementos que já não são folhas
  for (const [id, el] of elementos) {
    if (!rects.has(id)) { el.remove(); elementos.delete(id); }
  }
  // ligações já abertas: "idFolha:indiceAncora"
  const abertas = new Set();
  for (const r of rects.values()) if (r.no.origem) abertas.add(`${r.no.origem.de}:${r.no.origem.ancora}`);

  for (const [id, r] of rects) {
    let el = elementos.get(id);
    if (!el) {
      el = criarElemento(r.no);
      elementos.set(id, el);
      paginasEl.get(r.pagina.id).appendChild(el);
      if (novos.has(id)) piscar(el);
    }
    el.style.left = `${r.x * CW}px`;
    el.style.top = `${r.y * CH}px`;
    el.style.width = `${r.w * CW}px`;
    el.style.height = `${r.h * CH}px`;
    el.classList.toggle('esq', r.x > 0.001);
    el.classList.toggle('cima', r.y > 0.001);
    const pode = podeDividir(r);
    const cw = Math.round(r.w * 10) / 10, ch = Math.round(r.h * 10) / 10;
    el.querySelector('.dim').textContent = `P${r.p + 1} · N${r.nivel} · ${cw}×${ch}`;
    el.querySelectorAll('.texto a[data-ancora]').forEach(a => {
      a.classList.toggle('aberto', abertas.has(`${id}:${a.dataset.ancora}`));
      a.title = pode ? '' : 'Abre numa página nova, em baixo';
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

function irPara(r) {
  const H = main.clientHeight;
  const topo = r.p * H + r.y * CH, fundo = topo + r.h * CH;
  const visivel = topo >= main.scrollTop && fundo <= main.scrollTop + H;
  if (!visivel) main.scrollTo({ top: r.p * H, behavior: reduzido ? 'auto' : 'smooth' });
}

function atualizarEstado() {
  const partes = rects.size;
  info.textContent = `${partes} ${partes === 1 ? 'caixa' : 'caixas'}`;
  btnDesfazer.disabled = estado.historico.length === 0;
  btnRepor.disabled = estado.historico.length === 0;
}

function origemDe(no, ancora) {
  const lig = itens[no.item].ancoras[ancora];
  return { alvo: lig.alvo, origem: { de: no.id, ancora, rotulo: lig.cit ? lig.texto : `“${lig.texto}”` } };
}

// Divide uma folha: ela fica na primeira metade, a nova (item ligado) na segunda
function dividir(no, r, ancora) {
  const dir = direcao(r.w, r.h);
  if (!dir || r.nivel >= NIVEL_MAX) return null;
  const s = estado;
  const { alvo, origem } = origemDe(no, ancora);
  const nova = folha(alvo, origem);
  const interno = { id: proxId++, filhos: [no, nova], dir, pai: no.pai };
  if (no.pai) {
    const i = no.pai.filhos.indexOf(no);
    no.pai.filhos[i] = interno;
  } else {
    r.pagina.raiz = interno;
  }
  no.pai = interno;
  nova.pai = interno;
  s.historico.push({ interno, pagina: r.pagina });
  return nova;
}

// Abre o item ligado numa página nova, no fim de todas as páginas
function abrirPagina(no, ancora) {
  const s = estado;
  const { alvo, origem } = origemDe(no, ancora);
  const raiz = folha(alvo, origem);
  const pg = pagina(raiz);
  s.paginas.push(pg);
  s.historico.push({ nova: pg });
  return raiz;
}

// Folha que já foi aberta a partir desta ligação (se ainda estiver visível)
function jaAberta(no, ancora) {
  for (const r of rects.values()) {
    if (r.no.origem && r.no.origem.de === no.id && r.no.origem.ancora === ancora) return r;
  }
  return null;
}

function abrir(no, ancora) {
  const existente = jaAberta(no, ancora);
  if (existente) { irPara(existente); piscar(elementos.get(existente.no.id)); return; }
  const r = rects.get(no.id);
  if (!r) return;
  if (podeDividir(r)) {
    const nova = dividir(no, r, ancora);
    desenhar(new Set([nova.id]));
    return;
  }
  const raiz = abrirPagina(no, ancora);
  desenhar(new Set([raiz.id]));
  irPara(rects.get(raiz.id));
}

function desfazer() {
  const s = estado;
  const passo = s.historico.pop();
  if (!passo) return;
  if (passo.nova) {
    s.paginas.splice(s.paginas.indexOf(passo.nova), 1);
  } else {
    const { interno, pagina: pg } = passo;
    const [ficou] = interno.filhos;
    ficou.pai = interno.pai;
    if (interno.pai) {
      const i = interno.pai.filhos.indexOf(interno);
      interno.pai.filhos[i] = ficou;
    } else {
      pg.raiz = ficou;
    }
  }
  desenhar();
}

function repor() {
  estado = estadoNovo();
  limpar();
  main.scrollTop = 0;
  desenhar();
}

main.addEventListener('click', e => {
  const a = e.target.closest('.texto a[data-ancora]');
  if (!a) return;
  e.preventDefault();
  const el = a.closest('.regiao');
  const r = rects.get(Number(el.dataset.id));
  if (r) abrir(r.no, Number(a.dataset.ancora));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') desfazer();
});

btnDesfazer.addEventListener('click', desfazer);
btnRepor.addEventListener('click', repor);

let ultimo = '';
new ResizeObserver(() => {
  const k = `${main.clientWidth}x${main.clientHeight}`;
  if (k !== ultimo) { ultimo = k; desenhar(); }
}).observe(main);

desenhar();
