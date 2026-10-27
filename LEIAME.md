# Report Semanal – Desenvolvimento de Indicadores

Aplicativo local para montar a apresentação semanal da diretoria. Você preenche os dados numa interface no navegador e ele gera a apresentação em **HTML** e **PDF**, além de manter um **histórico em Excel**.

Não precisa de servidor, instalação de programa ou internet. Só usa o Python e o Edge (ou Chrome) que já estão na máquina.

---

## Como usar

1. Dê **duplo clique em `iniciar.bat`**.
   - Abre uma janela preta (é o aplicativo rodando) e a interface no navegador.
   - **Não feche a janela preta** enquanto estiver usando.
2. Atualize os dados da semana. Tudo é salvo sozinho como rascunho a cada alteração.
3. Clique em **Gerar apresentação**.
4. Para sair, use **Encerrar aplicativo** no menu à esquerda, ou feche a janela preta.

### Rotina de cada semana

| Passo | Onde |
|---|---|
| Clicar em **＋ Nova semana**: avança a data em 7 dias e guarda o % atual como "semana anterior" | topo da tela |
| Atualizar o **%** das atividades e, se mudou, as datas | Atividades |
| Incluir, editar ou excluir **bloqueios** | Bloqueios |
| Escrever os **destaques** e os **próximos passos** | Destaques e próximos |
| Ajustar os slides de **comunicação** (ou desmarcar "Incluir") | Comunicações |
| **Gerar apresentação** | topo da tela |

### Uma vez por trimestre

Na seção **Sprints**, use **Gerar sprints de um trimestre**. A regra usada é:
- a Sprint 1 começa na 1ª segunda-feira do trimestre;
- cada sprint dura 2 semanas;
- a última sprint termina na véspera da Sprint 1 seguinte.

Se o calendário oficial for diferente, corrija as datas na tabela.

---

## Onde ficam os arquivos

```
ApresentacaoExecutiva\
├─ iniciar.bat              ← abre o aplicativo
├─ app.py                   ← servidor local (Python)
├─ web\                     ← interface (index.html, interface.js, render.js)
├─ dados\
│  ├─ rascunho.json         ← o que está no editor agora
│  ├─ semanas\AAAA-MM-DD.json  ← dados de cada semana gerada (fonte do histórico)
│  └─ exemplo.json          ← dados fictícios usados só na primeira vez
├─ saida\AAAA\AAAA-MM-DD\
│  ├─ report_AAAA-MM-DD.html
│  └─ report_AAAA-MM-DD.pdf
└─ historico.xlsx           ← refeito a cada geração a partir de dados\semanas
```

- **Backup:** basta copiar a pasta `dados\semanas`. O `historico.xlsx` é sempre reconstruído a partir dela.
- **Refazer uma semana antiga:** use **Histórico → Carregar no editor**, ajuste e gere de novo. A apresentação e o histórico daquela data são substituídos.
- **Começar do zero, sem os dados de exemplo:** exclua as frentes, atividades e bloqueios de exemplo pela interface. Ou apague `dados\rascunho.json` e substitua `dados\exemplo.json` pelos seus dados.

---

## Problemas comuns

**"Não encontrei o Python"**
Instale o Python 3.8 ou superior pelo portal de software da empresa e marque a opção *Add Python to PATH*. Ou peça ao suporte.

**O histórico está em CSV e não em Excel**
A biblioteca `openpyxl` não pôde ser instalada, provavelmente porque a rede bloqueou. Para tentar de novo:
1. Apague o arquivo `dados\.openpyxl_tentado`.
2. Rode o `iniciar.bat`.

Também dá para instalar manualmente:
```
py -m pip install --user openpyxl
```
Se a empresa usa proxy, peça o endereço ao suporte e use:
```
py -m pip install --user openpyxl --proxy http://endereco:porta
```

**O PDF não foi gerado**
- Confira se o PDF anterior da mesma data está aberto. Se estiver, feche e gere de novo.
- Se o Edge estiver instalado num lugar diferente do padrão:
  1. Copie `config_local.exemplo.json` para `config_local.json`.
  2. Ajuste o caminho do navegador nesse arquivo.
- Algumas políticas corporativas bloqueiam o modo "headless" do Edge. Nesse caso:
  1. Abra o `.html` gerado.
  2. Use **Ctrl+P → Salvar como PDF**.
  3. Em *Mais configurações*, marque **Gráficos de plano de fundo** e escolha **Margens: nenhuma**.

**"historico.xlsx está aberto no Excel"**
Feche o Excel e clique em **Gerar** de novo. Os dados da semana já ficaram salvos.

**A interface não abre**
O endereço aparece na janela preta, algo como `http://127.0.0.1:8765/`. Copie e cole no navegador. O aplicativo só aceita conexões da própria máquina.
