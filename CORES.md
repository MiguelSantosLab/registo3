# Cores do sistema

Todas as cores do projeto estão definidas como variáveis CSS em [styles.css](styles.css), no `:root`.
O modo escuro aplica-se automaticamente quando o sistema operativo está em tema escuro (`prefers-color-scheme: dark`).
Nenhuma cor está escrita diretamente no HTML ou no JavaScript.

| Variável  | Claro     | Escuro    | Uso |
|-----------|-----------|-----------|-----|
| `--paper` | `#ffffff` | `#1c1717` | Fundo da página e das páginas da área principal |
| `--grid`  | `#f6c9c9` | `#4a2c2c` | Separadores entre botões do topo (a grelha de fundo já não é desenhada) |
| `--rule`  | `#6b2a2a` | `#c98a8a` | Linhas de divisão entre caixas e entre páginas, bordas do topo e da coluna lateral, sublinhado das ligações, contorno de foco |
| `--ink`   | `#2a2222` | `#eadede` | Texto principal, títulos, botões, número da citação no cabeçalho da caixa |
| `--muted` | `#9a7474` | `#a07f7f` | Texto secundário: linha de estado, cabeçalho das caixas, contagens, botões desativados |
| `--hover` | `#fdeeee` | `#2c2020` | Fundo ao passar o rato; secção ativa na coluna lateral |
| `--flash` | `#f9d7d7` | `#4a2a2a` | Destaque de uma caixa acabada de abrir (animação); fundo de uma ligação já aberta |

## Valores CSS

```css
:root {
  --paper: #ffffff;
  --grid: #f6c9c9;
  --rule: #6b2a2a;
  --ink: #2a2222;
  --muted: #9a7474;
  --hover: #fdeeee;
  --flash: #f9d7d7;
}

@media (prefers-color-scheme: dark) {
  :root {
    --paper: #1c1717;
    --grid: #4a2c2c;
    --rule: #c98a8a;
    --ink: #eadede;
    --muted: #a07f7f;
    --hover: #2c2020;
    --flash: #4a2a2a;
  }
}
```
