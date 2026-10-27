# Report Semanal – Desenvolvimento de Indicadores

Aplicativo para montar a apresentação semanal da diretoria sobre o desenvolvimento de indicadores.

Você atualiza os dados numa tela no navegador (atividades, bloqueios, destaques, comunicações). O aplicativo monta sozinho:
- a apresentação em **HTML** e **PDF**, com capa, evolução da semana, visão geral, um Gantt por frente agrupado por sprint e os bloqueios;
- um **histórico em Excel** de todas as semanas.

Funciona direto da pasta compartilhada. Não precisa de servidor, internet nem instalação de programa: só o **Python** e o **Edge**, que já estão na máquina.

---

## 1. Antes de usar pela primeira vez

- **Python 3.8 ou superior** instalado na **sua** máquina. Cada pessoa que for usar precisa ter o seu.
  - Para conferir: abra o Prompt de Comando e digite `py --version`.
  - Se não tiver, instale pelo portal de software da empresa (marque *Add Python to PATH*) ou peça ao suporte.
- **Microsoft Edge** (ou Chrome), usado para gerar o PDF. Já vem no Windows.

Na primeira vez, o aplicativo tenta instalar sozinho a biblioteca `openpyxl`, que serve para gravar o Excel. Se a rede bloquear, tudo funciona igual e o histórico é gravado em CSV.

---

## 2. Como abrir

1. Abra a pasta compartilhada e dê **duplo clique em `iniciar.bat`**.
2. Abre uma janela preta (é o aplicativo rodando) e a tela de edição no navegador.
3. **Não feche a janela preta** enquanto estiver usando.
4. Para sair, clique em **⏻ Encerrar aplicativo** no menu à esquerda. Isso salva tudo e libera a edição para outras pessoas.

> Se o navegador não abrir sozinho, copie o endereço que aparece na janela preta (algo como `http://127.0.0.1:8765/`) e cole no navegador.

---

## 3. Uso compartilhado: uma pessoa edita por vez

Todos usam os mesmos dados, que ficam na pasta compartilhada. Para ninguém apagar o trabalho de outra pessoa, **só uma pessoa pode editar por vez**:

- Quem abre primeiro fica com a **edição**.
- Quem abrir enquanto outra pessoa edita vê uma faixa amarela, por exemplo *"🔒 Maria está editando desde 14:02"*, e entra em **modo leitura**. Nesse modo dá para navegar e ver a prévia, mas nada é salvo.
- Quando a pessoa encerrar, clique em **Verificar de novo**. A edição passa para você, já com os dados que ela salvou.
- **Assumir edição** serve só para quando alguém fechou o aplicativo sem encerrar. A edição também é liberada sozinha 2 minutos depois que o aplicativo da outra pessoa é fechado.

O topo da tela mostra quem fez a **última alteração** e quando. O histórico em Excel registra quem gerou cada semana.

> **Dica:** combinem um responsável por semana, ou horários diferentes para cada pessoa atualizar a sua frente.

---

## 4. Rotina semanal

| # | O que fazer | Onde |
|---|---|---|
| 1 | **＋ Nova semana**: a data avança 7 dias e o % atual vira "semana anterior" (é o que mostra a evolução) | botão no topo |
| 2 | Atualizar o **%** de cada atividade e, se mudou, as datas | Atividades |
| 3 | Incluir, editar ou excluir **bloqueios e dependências** | Bloqueios |
| 4 | Escrever os **destaques** e os **próximos passos** | Destaques e próximos |
| 5 | Ajustar os slides de **comunicação**, ou desmarcar "Incluir" | Comunicações |
| 6 | Conferir na prévia e clicar em **Gerar apresentação** | botão no topo |

- Tudo é salvo automaticamente enquanto você edita.
- O **status** de cada atividade é calculado pelas datas e pelo %: no prazo, atenção, atrasado, não iniciado ou concluído. Para fixar um status à mão, como "Bloqueado", escolha-o na lista.
- Na prévia, os botões **Edição / Lado a lado / Prévia** mudam o que aparece na tela.

### Uma vez por trimestre: sprints

Em **Sprints → Gerar sprints de um trimestre**. A regra usada:
- cada sprint dura 2 semanas;
- a numeração recomeça a cada trimestre;
- a Sprint 1 começa na 1ª segunda-feira do trimestre.

Se o calendário oficial for diferente, ajuste as datas na tabela.

### De vez em quando

- **Frentes**: incluir ou renomear frentes. Cada frente vira um slide.
- **Capa, logo e cores**:
  - fundo da capa (padrão, cor ou imagem do modelo da empresa);
  - textos da capa;
  - logo e tamanho do logo;
  - cores.
- **Configurações**: título e quantas sprints aparecem no Gantt.

---

## 5. Onde ficam os arquivos

```
📁 (pasta compartilhada)
├─ iniciar.bat                  ← abre o aplicativo
├─ README.md                    ← este arquivo
├─ historico.xlsx               ← histórico de todas as semanas (refeito a cada geração)
├─ saida\
│   └─ 2026\2026-10-27\
│        ├─ report_2026-10-27.pdf    ← apresentação para enviar ou projetar
│        └─ report_2026-10-27.html   ← mesma apresentação, abre no navegador
├─ dados\
│   ├─ rascunho.json            ← o que está no editor agora
│   ├─ semanas\                 ← dados de cada semana gerada (base do histórico)
│   └─ em_uso.json              ← quem está editando agora (criado e apagado sozinho)
├─ app.py, web\                 ← o aplicativo em si (não precisa mexer)
└─ config_local.exemplo.json    ← modelo para configurações especiais (ver seção 6)
```

- **Apresentações antigas**: menu **Histórico**. Lá dá para abrir o PDF, o HTML ou a pasta, ou **carregar a semana no editor** para corrigir e gerar de novo.
- **Backup**: o importante é a pasta `dados\semanas`. O Excel é sempre reconstruído a partir dela.
- **Não edite** os arquivos de `dados\` à mão, nem com o aplicativo aberto.

---

## 6. Problemas comuns

**"Não encontrei o Python"**
Instale o Python na sua máquina (seção 1) e abra o `iniciar.bat` de novo.

**Faixa amarela "fulano está editando", mas a pessoa já saiu**
Aguarde 2 minutos e clique em **Verificar de novo**. Se a pessoa confirmar que fechou, use **Assumir edição**.

**O PDF não foi gerado**
- Veja se o PDF da mesma data está aberto em outro programa. Feche-o e gere de novo.
- Algumas políticas da empresa bloqueiam o Edge de gerar PDF sozinho. Nesse caso:
  1. Abra o `.html` gerado.
  2. Use **Ctrl+P → Salvar como PDF**.
  3. Em *Mais configurações*, marque **Gráficos de plano de fundo** e escolha **Margens: nenhuma**.
- Se o Edge estiver instalado num local diferente do padrão:
  1. Copie `config_local.exemplo.json` para `config_local.json`.
  2. Ajuste o caminho do navegador nesse arquivo.

**"historico.xlsx está aberto"**
Feche o Excel (o seu, ou peça para quem estiver com ele aberto) e clique em **Gerar** de novo. Os dados da semana já ficaram salvos.

**O histórico saiu em CSV e não em Excel**
A biblioteca `openpyxl` não pôde ser instalada. Para tentar de novo, rode no Prompt de Comando:
```
py -m pip install --user openpyxl
```
Se a empresa usa proxy, peça o endereço ao suporte e acrescente `--proxy http://endereco:porta`.

**A pasta compartilhada é OneDrive ou Teams/SharePoint sincronizado**
Funciona, mas a sincronização pode levar alguns segundos ou minutos. Por isso:
- espere a sincronização terminar (ícone ✓ verde) antes de abrir o aplicativo;
- combinem quem edita em cada momento.

Uma pasta de rede (`\\servidor\...`) evita esse atraso.
