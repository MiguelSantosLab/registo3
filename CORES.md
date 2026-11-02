# Cores do sistema

Todas as cores do projeto estão definidas como variáveis CSS em [styles.css](styles.css), no `:root`.
Há um único tema (claro); não existe variante para o modo escuro do sistema operativo.
Nenhuma cor está escrita diretamente no HTML ou no JavaScript (o canvas lê `--grid` do CSS e o filtro SVG lê `--neon`).

| Variável         | Valor     | Uso |
|------------------|-----------|-----|
| `--paper`        | `#fbfbfb` | Fundo da página e do mapa (por baixo das imagens do mapa) |
| `--caixa`        | `#DCDCDC` | Fundo das caixas no mapa, quando o conteúdo está visível |
| `--grid`         | `#0000ff` | Separadores entre botões do topo; linhas da grelha do mapa (desenhadas no canvas, a 35% de opacidade) |
| `--rule`         | `#0000ff` | Bordas das caixas (as de caixas vizinhas coincidem numa só linha), borda do topo, sublinhado das ligações, contorno de foco |
| `--ink`          | `#0000ff` | Texto principal, botões do topo, número da citação no cabeçalho da caixa |
| `--muted`        | `#787878` | Texto secundário: linha de estado, zoom, cabeçalho das caixas, legendas das figuras, botões desativados |
| `--hover`        | `#0000ff` | Fundo ao passar o rato (botões do topo, ligações, botão +) |
| `--hover-texto`  | `#ffffff` | Texto ao passar o rato (botões do topo, ligações), sobre o fundo de `--hover` |
| `--nova`         | `#0000ff` | Destaque de uma caixa acabada de abrir (animação) |
| `--aberta`       | `#0000ff` | Fundo das palavras ligadas cuja caixa já foi aberta |
| `--aberta-texto` | `#ffffff` | Texto das palavras ligadas cuja caixa já foi aberta |
| `--botao`        | `#0000ff` | Fundo (e contorno) dos botões + |
| `--botao-texto`  | `#ffffff` | O + dentro dos botões |
| `--neon`         | `#39ff14` | Cor do filtro das figuras dentro das caixas (imagem em tons de cinzento multiplicada por esta cor; filtro SVG `#neon` no index.html) |

O botão + de uma citação já aberta e as palavras ligadas já abertas ficam esbatidos (opacidade 35%), sobre as suas cores normais.

## Valores CSS

```css
:root {
  --paper: #fbfbfb;
  --caixa: #DCDCDC;
  --grid: #0000ff;
  --rule: #0000ff;
  --ink: #0000ff;
  --muted: #787878;
  --hover: #0000ff;
  --hover-texto: #ffffff;
  --nova: #0000ff;
  --aberta: #0000ff;
  --aberta-texto: #ffffff;
  --botao: #0000ff;
  --botao-texto: #ffffff;
  --neon: #39ff14;
}
```
