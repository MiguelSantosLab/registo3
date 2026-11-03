# Cores do sistema

Todas as cores do projeto estão definidas como variáveis CSS em [styles.css](styles.css), no `:root`.
Há um único tema (claro); não existe variante para o modo escuro do sistema operativo.
Nenhuma cor está escrita diretamente no HTML ou no JavaScript (os filtros SVG das figuras leem as cores `--cat-*` do CSS).

| Variável         | Valor     | Uso |
|------------------|-----------|-----|
| `--paper`        | `#fbfbfb` | Fundo da página e do mapa (por baixo das imagens do mapa) |
| `--caixa`        | `#1D1816` | Fundo das caixas no mapa, quando o conteúdo está visível |
| `--contorno`     | `#5B4F4B` | Contorno das caixas (as de caixas vizinhas coincidem numa só linha) |
| `--grid`         | `#0000ff` | Separadores entre botões do topo |
| `--rule`         | `#0000ff` | Borda do topo, sublinhado das ligações, contorno de foco |
| `--ink`          | `#0000ff` | Texto principal, botões do topo, número da citação no cabeçalho da caixa |
| `--muted`        | `#787878` | Texto secundário: linha de estado, zoom, cabeçalho das caixas, legendas das figuras, botões desativados |
| `--hover`        | `#0000ff` | Fundo ao passar o rato (botões do topo, ligações) |
| `--hover-texto`  | `#ffffff` | Texto ao passar o rato (botões do topo, ligações), sobre o fundo de `--hover` |
| `--nova`         | `#0000ff` | Destaque de uma caixa acabada de abrir (animação), só para caixas sem categoria; as outras piscam na cor da sua categoria (`--cat-*`) |
| `--aberta`       | `#0000ff` | Fundo das palavras ligadas cuja caixa já foi aberta |
| `--aberta-texto` | `#ffffff` | Texto das palavras ligadas cuja caixa já foi aberta |
| `--botao`        | `#F3F1F1` | Fundo do botão [EXTRACT +] ao passar o rato (o texto passa a ter a cor `--caixa`) |
| `--botao-texto`  | `#F3F1F1` | Texto do botão [EXTRACT] |
| `--cat-resource-exploitation` | `#6666FF` | Título (número e categoria) das caixas Resource Exploitation e filtro das suas figuras |
| `--cat-registry-of-power` | `#1AFFFF` | O mesmo, para Registry of Power |
| `--cat-web` | `#53FF3F` | O mesmo, para Web |
| `--cat-data-objects` | `#FFFFB1` | O mesmo, para Data Objects |

O botão [Extract] desaparece depois de clicado. As palavras ligadas já abertas ficam esbatidas (opacidade 35%), sobre as suas cores normais.

## Valores CSS

```css
:root {
  --paper: #fbfbfb;
  --caixa: #1D1816;
  --contorno: #5B4F4B;
  --grid: #0000ff;
  --rule: #0000ff;
  --ink: #0000ff;
  --muted: #787878;
  --hover: #0000ff;
  --hover-texto: #ffffff;
  --nova: #0000ff;
  --aberta: #0000ff;
  --aberta-texto: #ffffff;
  --botao: #F3F1F1;
  --botao-texto: #F3F1F1;
  --cat-resource-exploitation: #6666FF;
  --cat-registry-of-power: #1AFFFF;
  --cat-web: #53FF3F;
  --cat-data-objects: #FFFFB1;
}
```

Os filtros das figuras passam a imagem a tons de cinzento e multiplicam-na pela cor da categoria da caixa (filtros SVG `#tinta-<categoria>` no index.html).
