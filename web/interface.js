/* =====================================================================
   INTERFACE DE EDIÇÃO. Salvar/Gerar chamam o servidor Python (app.py),
   que guarda os dados, grava o Excel de histórico e gera HTML + PDF.
   ===================================================================== */
let D = null, ESTADO = {};

/* ---------- comunicação com o servidor Python ---------- */
async function api(caminho, corpo){
  let r;
  try {
    r = await fetch(caminho, corpo === undefined ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) });
  } catch(e){ throw new Error("o aplicativo não está rodando. Execute o iniciar.bat novamente."); }
  const j = await r.json().catch(() => ({ erro: "resposta inválida do servidor" }));
  if (!r.ok){ const e = new Error(j.erro || ("erro " + r.status)); e.status = r.status; e.lock = j.lock; throw e; }
  return j;
}
let tSalvar, sujo = false, leitura = false;
function agendarSalvar(){ sujo = true; $("#salvo").textContent = "alterações não salvas…"; clearTimeout(tSalvar); tSalvar = setTimeout(salvar, 1500); }
async function salvar(){
  clearTimeout(tSalvar);
  try { const r = await api("/api/salvar", { dados: D }); sujo = false; $("#salvo").textContent = "rascunho salvo às " + r.hora; return true; }
  catch(e){ if (e.status === 423){ entrarLeitura(e.lock); return false; } $("#salvo").textContent = "NÃO SALVO: " + e.message; return false; }
}
window.addEventListener("beforeunload", e => { if (sujo){ e.preventDefault(); e.returnValue = ""; } });
function fecharModal(){ $("#modalBg").style.display = "none"; }
function confirmar(titulo, texto, ok = "Confirmar"){
  return new Promise(res => {
    $("#modal").innerHTML = `<h2>${titulo}</h2><p style="color:var(--ink-2);font-size:13.5px;line-height:1.5">${texto}</p><div class="acts"><button id="mNo">Cancelar</button><button class="pri" id="mSim">${ok}</button></div>`;
    $("#modalBg").style.display = "flex";
    $("#mNo").onclick = () => { fecharModal(); res(false); };
    $("#mSim").onclick = () => { fecharModal(); res(true); };
  });
}
async function abrirArquivo(alvo, data){ try { await api("/api/abrir", { alvo, data }); } catch(e){ toast("Não foi possível abrir: " + e.message); } }
const hojeIso = () => { const t = new Date(); return new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtBR = iso => iso ? iso.split("-").reverse().join("/") : "";
const STATUS_LIST = Object.keys(Report.STATUS);

function toast(msg, ms=3800){ const t = $("#toast"); t.innerHTML = msg; t.style.display = "block"; clearTimeout(t._h); t._h = setTimeout(() => t.style.display = "none", ms); }

/* ---------- pré-visualização ---------- */
let tPrev;
function atualizar(inicial){
  clearTimeout(tPrev);
  if (!inicial && D){ if (leitura) $("#salvo").textContent = "modo leitura: alterações não são salvas"; else agendarSalvar(); }
  tPrev = setTimeout(() => {
    const fr = $("#frame");
    let y = 0; try { y = fr.contentWindow.scrollY; } catch(e){}
    fr.onload = () => { try { if (alvo != null){ const f = fr.contentDocument.querySelectorAll(".frame")[alvo]; f && f.scrollIntoView(); } else fr.contentWindow.scrollTo(0, y); $("#nSlides").textContent = fr.contentDocument.querySelectorAll(".frame").length + " slides"; } catch(e){} };
    fr.srcdoc = Report.gerar(D);
    cabecalho(); contadores(); corInterface();
  }, 250);
}
function cabecalho(){
  const s = Report.sprintAtual(D);
  if (!s){ $("#chipSemana").textContent = fmtBR(D.config.dataReferencia) + " · sem sprint cadastrada"; return; }
  const sem = Math.floor((new Date(D.config.dataReferencia + "T00:00:00Z") - s.i) / 6048e5) + 1;
  const tot = Math.round((s.f - s.i + 864e5) / 6048e5);
  $("#chipSemana").textContent = `Semana de ${fmtBR(D.config.dataReferencia)} · ${Report.spCompleto(s)} · semana ${sem} de ${tot}`;
}

let alvo = null;
function irPara(n){ alvo = n; try { const f = $("#frame").contentDocument.querySelectorAll(".frame")[n]; f && f.scrollIntoView(); } catch(e){} }

/* ---------- navegação ---------- */
const SECOES = [
  ["grp","Semana atual"],
  ["atividades","Atividades"], ["bloqueios","Bloqueios"], ["semana","Destaques e próximos"], ["comunicacoes","Comunicações"],
  ["grp","Cadastros"],
  ["frentes","Frentes"], ["sprints","Sprints"], ["geral","Configurações"],
  ["grp","Aparência"],
  ["aparencia","Capa, logo e cores"],
  ["grp","Arquivo"],
  ["historico","Histórico"]
];
let secAtual = "atividades";
function montarNav(){
  $("#nav").innerHTML = SECOES.map(([k, t]) => k === "grp" ? `<div class="grp">${t}</div>` : `<a data-s="${k}" class="${k === secAtual ? "on" : ""}">${t}<span class="n" id="n-${k}"></span></a>`).join("");
  $("#nav").insertAdjacentHTML("beforeend", `<a class="sair" id="navSair">⏻ Encerrar aplicativo</a>`);
  $("#nav").querySelectorAll("a[data-s]").forEach(a => a.onclick = () => abrir(a.dataset.s));
  $("#navSair").onclick = encerrar;
  contadores();
}
function contadores(){
  const set = (k, v) => { const e = document.getElementById("n-" + k); if (e) e.textContent = v; };
  set("atividades", D.atividades.length); set("bloqueios", D.bloqueios.length); set("frentes", D.frentes.length);
  set("comunicacoes", (D.comunicacoes || []).filter(c => c.incluir).length);
}
function abrir(s){ alvo = null; secAtual = s; montarNav(); const ed = $("#editor"); ed.innerHTML = ""; ed.scrollTop = 0; RENDER[s](ed); }

/* ---------- componentes ---------- */
function campo(label, input, hint){ return `<label class="f"><span>${label}</span>${input}${hint ? `<span class="hint">${hint}</span>` : ""}</label>`; }
function bind(root){
  root.querySelectorAll("[data-k]").forEach(el => {
    const path = el.dataset.k.split(".");
    let obj = D; for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    const k = path[path.length - 1];
    if (el.type === "checkbox") el.checked = !!obj[k]; else el.value = obj[k] ?? "";
    el.addEventListener("input", () => { obj[k] = el.type === "checkbox" ? el.checked : el.type === "number" ? (el.value === "" ? "" : Number(el.value)) : el.value; atualizar(); });
  });
}
function upload(root, sel, setter, big){
  const box = root.querySelector(sel);
  const pintar = v => box.querySelector(".th").innerHTML = v ? `<img src="${v}" alt="">` : "sem imagem";
  pintar(setter());
  box.querySelector("input").onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2e6) toast("Imagem acima de 2 MB: o HTML gerado ficará pesado. Prefira PNG/JPG menores.");
    const r = new FileReader(); r.onload = () => { setter(r.result); pintar(r.result); atualizar(); }; r.readAsDataURL(f);
  };
  box.querySelector(".rm").onclick = () => { setter(""); pintar(""); box.querySelector("input").value = ""; atualizar(); };
}
const imgBox = (cls, big) => `<div class="imgbox ${big ? "big" : ""}" id="${cls}"><div class="th"></div><div><input type="file" accept="image/*"><div class="tbl-actions"><button class="ghost rm">Remover imagem</button></div></div></div>`;

/* Tabela editável genérica */
function tabela(container, { linhas, cols, novo, filtro, rowClass, depois }){
  const wrap = document.createElement("div");
  container.appendChild(wrap);
  function celula(c, r, i){
    const v = r[c.key] ?? "";
    switch (c.type){
      case "ro": return `<td class="ro" data-ro="${c.key}">${c.fn(r)}</td>`;
      case "check": return `<td style="text-align:center"><input type="checkbox" data-i="${i}" data-c="${c.key}" ${v ? "checked" : ""}></td>`;
      case "select": return `<td><select data-i="${i}" data-c="${c.key}">${c.opts().map(o => { const [val, lab] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(val)}" ${String(val) === String(v) ? "selected" : ""}>${esc(lab)}</option>`; }).join("")}</select></td>`;
      case "status": if (r.marco) return `<td class="ro">Marco</td>`; return `<td><select data-i="${i}" data-c="${c.key}" class="stsel ${v ? "manual" : ""}"><option value="">${esc("Auto: " + Report.statusDe({...r, status:""}, D.config.dataReferencia))}</option>${STATUS_LIST.map(s => `<option ${s === v ? "selected" : ""}>${s}</option>`).join("")}</select></td>`;
      default: return `<td><input type="${c.type || "text"}" ${c.type === "number" ? 'min="0" max="100" step="5"' : ""} data-i="${i}" data-c="${c.key}" value="${esc(v)}" ${c.disabled && c.disabled(r) ? "disabled" : ""} style="${c.w ? "min-width:" + c.w + "px" : ""}"></td>`;
    }
  }
  function desenhar(){
    const idx = linhas.map((r, i) => i).filter(i => !filtro || filtro(linhas[i]));
    wrap.innerHTML = `<div class="tbl-wrap"><table class="ed"><thead><tr>${cols.map(c => `<th style="${c.th || ""}">${c.label}</th>`).join("")}<th></th></tr></thead><tbody>
      ${idx.map(i => `<tr data-row="${i}" class="${rowClass ? rowClass(linhas[i]) : ""}">${cols.map(c => celula(c, linhas[i], i)).join("")}<td><button class="ghost del" data-i="${i}" title="Excluir linha">✕</button></td></tr>`).join("") || `<tr><td colspan="${cols.length + 1}" class="ro" style="padding:14px">Nenhuma linha</td></tr>`}
      </tbody></table></div>
      <div class="tbl-actions"><button class="add">＋ Adicionar linha</button></div>`;
    wrap.querySelectorAll("[data-c]").forEach(el => {
      el.addEventListener(el.tagName === "SELECT" || el.type === "checkbox" ? "change" : "input", () => {
        const i = +el.dataset.i, c = cols.find(x => x.key === el.dataset.c);
        let v = el.type === "checkbox" ? el.checked : el.value;
        if (c.type === "number") v = v === "" ? "" : Math.max(0, Math.min(100, Number(v)));
        linhas[i][c.key] = v;
        if (c.redesenhar) desenhar(); else refrescarLinha(i);
        atualizar();
      });
    });
    wrap.querySelectorAll(".del").forEach(b => b.onclick = () => { linhas.splice(+b.dataset.i, 1); desenhar(); atualizar(); });
    wrap.querySelector(".add").onclick = () => { linhas.push(novo()); desenhar(); atualizar(); const last = wrap.querySelectorAll("tbody tr"); last[last.length-1]?.querySelector("input,select")?.focus(); };
    depois && depois(wrap);
  }
  function refrescarLinha(i){
    const tr = wrap.querySelector(`tr[data-row="${i}"]`); if (!tr) return;
    const r = linhas[i];
    cols.forEach(c => {
      if (c.type === "ro") tr.querySelector(`[data-ro="${c.key}"]`).innerHTML = c.fn(r);
      if (c.type === "status" && !r.marco){ const s = tr.querySelector(`[data-c="${c.key}"]`); s.options[0].text = "Auto: " + Report.statusDe({...r, status:""}, D.config.dataReferencia); s.className = "stsel " + (r[c.key] ? "manual" : ""); }
    });
    if (rowClass) tr.className = rowClass(r);
  }
  desenhar();
  return { desenhar };
}
const optFrentes = () => D.frentes.map(f => [f.id, f.nome]);

/* ---------- seções ---------- */
const RENDER = {
  atividades(ed){
    let filtroF = "";
    ed.innerHTML = `<h1>Atividades</h1><p class="desc">Atualize o <b>%</b> e, se mudou, as datas. O status é calculado sozinho pelas datas e pelo % (aparece como “Auto: …”); escolha um valor na lista só quando quiser sobrescrever, como em “Bloqueado”. Marcos usam só a data de início.</p><div class="filtros" id="filt"></div><div id="tb"></div>`;
    const pintaFiltro = () => { $("#filt").innerHTML = [["", "Todas"], ...optFrentes()].map(([v, l]) => `<button data-v="${v}" class="${v === filtroF ? "on" : ""}">${esc(l)}</button>`).join("");
      $("#filt").querySelectorAll("button").forEach(b => b.onclick = () => { filtroF = b.dataset.v; pintaFiltro(); t.desenhar(); }); };
    const t = tabela($("#tb"), {
      linhas: D.atividades,
      filtro: r => !filtroF || r.frente === filtroF,
      novo: () => ({ frente: filtroF || D.frentes[0]?.id || "", nome: "", inicio: D.config.dataReferencia, fim: "", pct: 0, pctAnterior: "", status: "" }),
      cols: [
        { key:"frente", label:"Frente", type:"select", opts: () => D.frentes.map(f => f.id) },
        { key:"nome", label:"Atividade", w:220 },
        { key:"pct", label:"%", type:"number", th:"width:70px" },
        { key:"ant", label:"Sem. ant.", type:"ro", fn: r => r.marco ? "" : (r.pctAnterior === "" || r.pctAnterior == null ? "—" : r.pctAnterior + "%") },
        { key:"status", label:"Status", type:"status" },
        { key:"inicio", label:"Início", type:"date" },
        { key:"fim", label:"Fim", type:"date", disabled: r => r.marco },
        { key:"marco", label:"Marco", type:"check", redesenhar:true }
      ]
    });
    pintaFiltro();
  },

  bloqueios(ed){
    ed.innerHTML = `<h1>Bloqueios e dependências</h1><p class="desc">Uma lista única. “Desde” alimenta a contagem de dias em aberto; criticidade ordena o slide consolidado. Ao resolver, basta excluir a linha (fica registrado no histórico da semana anterior).</p><div id="tb"></div>`;
    tabela($("#tb"), {
      linhas: D.bloqueios,
      novo: () => ({ frente: D.frentes[0]?.id || "", descricao: "", area: "", desde: D.config.dataReferencia, impacto: "", pedido: "", criticidade: "Média" }),
      cols: [
        { key:"frente", label:"Frente", type:"select", opts: () => D.frentes.map(f => f.id) },
        { key:"descricao", label:"Bloqueio / dependência", w:220 },
        { key:"area", label:"Área", w:130 },
        { key:"desde", label:"Desde", type:"date" },
        { key:"dias", label:"Dias", type:"ro", fn: r => r.desde ? Math.max(0, Math.round((new Date(D.config.dataReferencia) - new Date(r.desde)) / 864e5)) : "—" },
        { key:"impacto", label:"Impacto", w:200 },
        { key:"pedido", label:"Pedido / ação", w:200 },
        { key:"criticidade", label:"Criticidade", type:"select", opts: () => ["Alta","Média","Baixa"] }
      ]
    });
  },

  semana(ed){
    const concl = D.atividades.filter(a => !a.marco && Number(a.pct) >= 100 && a.pctAnterior !== "" && a.pctAnterior != null && Number(a.pctAnterior) < 100);
    ed.innerHTML = `<h1>Destaques e próximos passos</h1><p class="desc">Textos livres do slide “Evolução da semana”. Uma linha por item.</p>
      <div class="card"><h3>Entram automaticamente nos destaques</h3>${concl.length ? `<ul class="auto-list">${concl.map(a => `<li>Concluído: ${esc(a.nome)}</li>`).join("")}</ul>` : `<span class="hint">Nenhuma atividade chegou a 100% nesta semana.</span>`}
        <div class="hint">Bloqueios e atividades atrasadas também entram sozinhos em “Pontos de atenção”.</div></div>
      <div class="card"><div class="grid2">
        ${campo("Destaques da semana", `<textarea rows="8" data-k="semana.destaques"></textarea>`)}
        ${campo("Próximos passos", `<textarea rows="8" data-k="semana.proximos"></textarea>`)}
      </div></div>`;
    bind(ed);
  },

  comunicacoes(ed){
    if (!D.comunicacoes) D.comunicacoes = [];
    const pintar = () => {
      const opts = Report.ancoras(D);
      const seq = Report.sequencia(D);
      ed.innerHTML = `<h1>Comunicações</h1><p class="desc">Slides livres para avisos, agenda, recados ou qualquer conteúdo da semana. Crie quantos precisar e escolha depois de qual slide cada um entra. Desmarque “Incluir” para guardar um slide sem mostrar nesta semana.</p>
        <div class="card"><h3>Ordem final da apresentação</h3>
          <ol style="margin:0;padding-left:22px;columns:2;font-size:13px;line-height:1.7">${seq.map(it => `<li style="${it.tipo === "com" ? "color:var(--accent);font-weight:600" : "color:var(--ink-2)"}">${esc(it.titulo)}</li>`).join("")}</ol></div>
        ${D.comunicacoes.map((c, i) => `
        <div class="card" style="${c.incluir ? "" : "opacity:.65"}">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
            <label style="display:flex;gap:8px;align-items:center;font-weight:600;flex:1"><input type="checkbox" data-k="comunicacoes.${i}.incluir" data-redraw> Slide de comunicação ${i + 1}</label>
            <button class="ghost" data-acao="sobe" data-i="${i}" ${i === 0 ? "disabled" : ""} title="Mover para cima">↑</button>
            <button class="ghost" data-acao="desce" data-i="${i}" ${i === D.comunicacoes.length - 1 ? "disabled" : ""} title="Mover para baixo">↓</button>
            <button class="ghost" data-acao="dup" data-i="${i}">Duplicar</button>
            <button class="ghost" data-acao="del" data-i="${i}">Excluir</button>
          </div>
          <div class="grid2">
            ${campo("Título", `<input data-k="comunicacoes.${i}.titulo" data-redraw-lazy>`)}
            ${campo("Subtítulo", `<input data-k="comunicacoes.${i}.subtitulo">`)}
            ${campo("Posição", `<select data-k="comunicacoes.${i}.posicao" data-redraw>${opts.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join("")}</select>`)}
          </div>
          <div style="margin-top:12px">${campo("Texto", `<textarea rows="7" data-k="comunicacoes.${i}.texto"></textarea>`, "Linhas começando com “- ” viram tópicos · **texto** fica em negrito · linha em branco separa blocos")}</div>
          <div style="margin-top:12px"><label class="f">Imagem (opcional): com imagem, o texto ocupa a metade esquerda</label>${imgBox("imgCom" + i, true)}</div>
        </div>`).join("")}
        <button class="pri" id="addCom">＋ Adicionar slide de comunicação</button>`;
      bind(ed);
      D.comunicacoes.forEach((c, i) => upload(ed, "#imgCom" + i, v => v === undefined ? c.imagem : (c.imagem = v), true));
      ed.querySelectorAll("[data-redraw]").forEach(el => el.addEventListener("change", () => { const y = ed.scrollTop; pintar(); ed.scrollTop = y; contadores(); }));
      ed.querySelectorAll("[data-redraw-lazy]").forEach(el => el.addEventListener("change", () => { const y = ed.scrollTop; pintar(); ed.scrollTop = y; }));
      ed.querySelectorAll("[data-acao]").forEach(b => b.onclick = () => {
        const i = +b.dataset.i, L = D.comunicacoes;
        if (b.dataset.acao === "sobe") [L[i-1], L[i]] = [L[i], L[i-1]];
        if (b.dataset.acao === "desce") [L[i+1], L[i]] = [L[i], L[i+1]];
        if (b.dataset.acao === "dup") L.splice(i + 1, 0, JSON.parse(JSON.stringify(L[i])));
        if (b.dataset.acao === "del") L.splice(i, 1);
        const y = ed.scrollTop; pintar(); ed.scrollTop = y; atualizar();
      });
      $("#addCom").onclick = () => { D.comunicacoes.push({ incluir: true, titulo: "Comunicação geral", subtitulo: "", posicao: "evolucao", texto: "", imagem: "" }); pintar(); ed.scrollTop = ed.scrollHeight; atualizar(); };
    };
    pintar();
  },

  frentes(ed){
    ed.innerHTML = `<h1>Frentes</h1><p class="desc">Cada frente vira um slide com o Gantt das suas atividades, na ordem desta lista. A sigla liga as atividades e bloqueios à frente.</p><div id="tb"></div>`;
    tabela($("#tb"), {
      linhas: D.frentes,
      novo: () => ({ id: "NOVA" + (D.frentes.length + 1), nome: "", responsavel: "", objetivo: "" }),
      cols: [
        { key:"id", label:"Sigla", w:60 },
        { key:"nome", label:"Nome", w:180 },
        { key:"responsavel", label:"Responsável", w:120 },
        { key:"objetivo", label:"Objetivo", w:280 }
      ]
    });
  },

  sprints(ed){
    const anoAtual = Number(D.config.dataReferencia.slice(0, 4));
    ed.innerHTML = `<h1>Sprints</h1><p class="desc">Calendário da empresa: sprints de 2 semanas, numeração reiniciando a cada trimestre. Cadastre uma vez por trimestre; o Gantt usa esta tabela para agrupar as semanas.</p>
      <div class="card"><h3>Gerar sprints de um trimestre</h3>
        <div style="display:flex;gap:10px;align-items:flex-end">
          ${campo("Ano", `<select id="gAno">${[anoAtual - 1, anoAtual, anoAtual + 1].map(a => `<option ${a === anoAtual ? "selected" : ""}>${a}</option>`).join("")}</select>`)}
          ${campo("Trimestre", `<select id="gQ"><option>1</option><option>2</option><option>3</option><option>4</option></select>`)}
          <button id="gBt" style="height:34px">Gerar</button>
        </div>
        <div class="hint">Regra usada: Sprint 1 começa na 1ª segunda-feira do trimestre e a última termina na véspera da Sprint 1 seguinte. Se o calendário oficial for diferente, ajuste as datas na tabela.</div></div>
      <div id="tb"></div>`;
    const ordenar = () => D.sprints.sort((a, b) => (a.inicio || "").localeCompare(b.inicio || ""));
    const atual = Report.sprintAtual(D);
    const t = tabela($("#tb"), {
      linhas: D.sprints,
      rowClass: r => atual && r.inicio === atual.inicio ? "cur" : "",
      novo: () => ({ trimestre: "", numero: "", inicio: "", fim: "" }),
      cols: [
        { key:"trimestre", label:"Trimestre", w:90 },
        { key:"numero", label:"Nº", w:50 },
        { key:"inicio", label:"Início", type:"date" },
        { key:"fim", label:"Fim", type:"date" },
        { key:"dur", label:"Duração", type:"ro", fn: r => r.inicio && r.fim ? (Math.round((new Date(r.fim) - new Date(r.inicio)) / 864e5) + 1) + " dias" : "—" },
        { key:"sit", label:"", type:"ro", fn: r => atual && r.inicio === atual.inicio ? "<b style='color:var(--accent)'>atual</b>" : "" }
      ]
    });
    const q0 = Math.floor((Number(D.config.dataReferencia.slice(5, 7)) - 1) / 3) + 2; $("#gQ").value = String(q0 > 4 ? 1 : q0);
    if (q0 > 4) $("#gAno").value = String(anoAtual + 1);
    $("#gBt").onclick = () => {
      const ano = Number($("#gAno").value), q = Number($("#gQ").value), rot = `Q${q} ${ano}`;
      const novas = Report.gerarSprintsTrimestre(ano, q);
      for (let i = D.sprints.length - 1; i >= 0; i--) if (D.sprints[i].trimestre === rot) D.sprints.splice(i, 1);
      D.sprints.push(...novas); ordenar(); t.desenhar(); atualizar();
      toast(`${novas.length} sprints geradas para ${rot}`);
    };
  },

  geral(ed){
    ed.innerHTML = `<h1>Configurações</h1><p class="desc">Dados que quase nunca mudam.</p>
      <div class="card"><div class="grid2">
        ${campo("Título da apresentação", `<input data-k="config.titulo">`)}
        ${campo("Texto acima do título (capa)", `<input data-k="config.subtitulo">`, "Deixe em branco para não mostrar")}
        ${campo("Data de referência", `<input type="date" data-k="config.dataReferencia">`, "Define a sprint atual, a linha “hoje” e os status automáticos")}
        <span></span>
        ${campo("Sprints antes da atual no Gantt", `<input type="number" min="0" max="6" data-k="config.sprintsAntes">`)}
        ${campo("Sprints depois da atual no Gantt", `<input type="number" min="0" max="6" data-k="config.sprintsDepois">`)}
      </div></div>`;
    bind(ed);
    ed.querySelector('[data-k="config.dataReferencia"]').addEventListener("change", cabecalho);
  },

  aparencia(ed){
    const C = D.config;
    if (!C.capa) C.capa = { modo:"padrao", cor:"#c8102e", imagem:"", escurecer:40, texto:"auto", alinhamento:"esquerda", faixa:true };
    const pintar = () => {
      const m = C.capa.modo;
      ed.innerHTML = `<h1>Capa, logo e cores</h1><p class="desc">Identidade visual da apresentação. As mudanças aparecem na prévia na hora.</p>
      <div class="card"><h3>Fundo da capa</h3>
        <div class="filtros" id="modos">${[["padrao","Padrão"],["cor","Cor sólida"],["imagem","Imagem / layout da empresa"]].map(([v, l]) => `<button data-v="${v}" class="${m === v ? "on" : ""}">${l}</button>`).join("")}</div>
        ${m === "cor" ? `<div class="grid2">${campo("Cor de fundo", `<div style="display:flex;gap:8px"><input type="color" id="corCapa" value="${C.capa.cor}" style="width:44px;height:34px;padding:2px"><input id="hexCapa" value="${C.capa.cor}" maxlength="7" style="width:110px;font-family:Consolas,monospace"></div>`, "O texto fica branco ou preto automaticamente, conforme a cor")}</div>` : ""}
        ${m === "imagem" ? `<div class="hint" style="margin:0 0 10px">Para usar o <b>layout padrão da empresa</b>: no PowerPoint, abra o modelo oficial, apague os textos da capa e use <i>Arquivo → Exportar → PNG</i> só desse slide. A imagem é ajustada para preencher o slide 16:9.</div>
          ${imgBox("imgCapa", true)}
          <div class="grid2" style="margin-top:12px">
            ${campo(`Escurecer a imagem: <b id="ovv">${C.capa.escurecer || 0}%</b>`, `<input type="range" min="0" max="85" step="5" data-k="config.capa.escurecer">`, "Ajuda a ler o texto sobre fotos")}
          </div>` : ""}
        <div class="grid2" style="margin-top:12px">
          ${campo("Cor do texto", `<select data-k="config.capa.texto"><option value="auto">Automática</option><option value="escuro">Escuro</option><option value="claro">Claro (branco)</option></select>`)}
          ${campo("Alinhamento do texto", `<select data-k="config.capa.alinhamento"><option value="esquerda">À esquerda</option><option value="centro">Centralizado</option></select>`)}
          ${campo("Texto acima do título", `<input data-k="config.subtitulo">`, "Deixe em branco para não mostrar")}
          ${campo("Título", `<input data-k="config.titulo">`)}
          ${campo("Frase abaixo do título", `<input data-k="config.capa.frase">`, "Deixe em branco para não mostrar")}
          <label class="f" style="justify-content:flex-end"><span style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-k="config.capa.faixa"> Mostrar faixa lateral na cor principal</span></label>
        </div></div>

      <div class="card"><h3>Logo da empresa</h3>${imgBox("imgLogo")}
        <div class="grid2" style="margin-top:14px">
          ${campo(`Tamanho na capa: <b id="lc">${C.logoAlturaCapa || 64}px</b> de altura`, `<input type="range" min="24" max="200" step="4" data-k="config.logoAlturaCapa">`)}
          ${campo("Posição na capa", `<select data-k="config.logoPosicao"><option value="sup-dir">Canto superior direito</option><option value="sup-esq">Canto superior esquerdo</option><option value="inf-dir">Canto inferior direito</option><option value="inf-esq">Canto inferior esquerdo</option></select>`)}
          ${campo(`Tamanho no rodapé dos slides: <b id="lr">${C.logoAlturaRodape || 20}px</b>`, `<input type="range" min="12" max="48" step="2" data-k="config.logoAlturaRodape">`)}
        </div>
        <div class="hint">PNG com fundo transparente fica melhor.</div>
        <div style="margin-top:16px"><label class="f"><span>Logo alternativo só para a capa (opcional): por exemplo a versão branca, para fundo colorido ou imagem</span></label>${imgBox("imgLogoCapa")}</div></div>

      <div class="card"><h3>Cores</h3>
        <div class="filtros" id="presets"></div>
        <div class="grid2" id="cores"></div>
        <div class="hint" id="avisoCor" style="margin-top:10px"></div>
        <div class="hint">Os status (verde, amarelo, laranja, vermelho) são fixos e sempre vêm com ícone + texto, para não se confundirem com a cor da marca.</div></div>`;
      bind(ed);
      upload(ed, "#imgLogo", v => v === undefined ? C.logo : (C.logo = v));
      upload(ed, "#imgLogoCapa", v => v === undefined ? C.logoCapa : (C.logoCapa = v));
      if (m === "imagem") upload(ed, "#imgCapa", v => v === undefined ? C.capa.imagem : (C.capa.imagem = v), true);
      ed.querySelectorAll("#modos button").forEach(b => b.onclick = () => { C.capa.modo = b.dataset.v; const y = ed.scrollTop; pintar(); ed.scrollTop = y; atualizar(); irPara(0); });
      const sl = (k, id) => { const e = ed.querySelector(`[data-k="${k}"]`); if (e) e.addEventListener("input", () => { ed.querySelector("#" + id).textContent = e.value + (id === "ovv" ? "%" : "px"); if (id !== "lr") irPara(0); }); };
      sl("config.logoAlturaCapa", "lc"); sl("config.logoAlturaRodape", "lr"); sl("config.capa.escurecer", "ovv");
      if (m === "cor"){ const setC = v => { C.capa.cor = v; ed.querySelector("#corCapa").value = v; ed.querySelector("#hexCapa").value = v; atualizar(); };
        ed.querySelector("#corCapa").oninput = e => setC(e.target.value);
        ed.querySelector("#hexCapa").oninput = e => { const v = e.target.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) setC(v.toLowerCase()); }; }
      pintarCores();
    };
    pintar(); irPara(0);
  },

  async historico(ed){
    ed.innerHTML = `<h1>Histórico</h1><p class="desc">Cada geração guarda os dados da semana e grava a apresentação numa pasta por data. O Excel de histórico é refeito a partir de todas as semanas salvas, então nunca duplica linhas.</p><div id="hl" class="hint">Carregando…</div>`;
    try { const e = await api("/api/estado"); ESTADO.semanas = e.semanas; } catch(err){ $("#hl").textContent = "Erro: " + err.message; return; }
    if (secAtual !== "historico") return;
    const sem = ESTADO.semanas || [];
    $("#hl").outerHTML = `
      <div class="tbl-actions" style="margin:0 0 12px"><button id="hX">Abrir ${ESTADO.xlsx ? "historico.xlsx" : "pasta historico_csv"}</button><button id="hR">Abrir pasta do aplicativo</button></div>
      <div class="tbl-wrap"><table class="ed hist"><thead><tr><th>Semana</th><th>Apresentação</th><th>Dados</th></tr></thead><tbody>
      ${sem.map(s => `<tr><td><b>${fmtBR(s.data)}</b></td>
        <td>${s.pdf ? `<button class="ghost" data-a="pdf" data-d="${s.data}">PDF</button>` : ""}${s.html ? `<button class="ghost" data-a="html" data-d="${s.data}">HTML</button>` : ""}<button class="ghost" data-a="pasta" data-d="${s.data}">Pasta</button></td>
        <td><button class="ghost" data-c="${s.data}">Carregar no editor</button></td></tr>`).join("") || `<tr><td colspan="3" class="ro" style="padding:14px">Nenhuma semana gerada ainda. Clique em “Gerar apresentação” para criar a primeira.</td></tr>`}
      </tbody></table></div>
      <div class="card" style="margin-top:16px"><h3>Estrutura do Excel de histórico</h3>
        <div class="hint" style="font-size:13px;color:var(--ink-2);line-height:1.6">Abas <b>Atividades</b>, <b>Bloqueios</b>, <b>Semana</b> e <b>Comunicações</b> têm uma linha por item por semana (coluna <b>Semana</b> no início, com o status calculado). <b>Frentes</b> e <b>Sprints</b> guardam o cadastro mais recente. Dá para filtrar no Excel ou ligar no Power BI para ver a evolução ao longo do tempo.</div></div>`;
    $("#hX").onclick = () => abrirArquivo("historico");
    $("#hR").onclick = () => abrirArquivo("raiz");
    ed.querySelectorAll("[data-a]").forEach(b => b.onclick = () => abrirArquivo(b.dataset.a, b.dataset.d));
    ed.querySelectorAll("[data-c]").forEach(b => b.onclick = async () => {
      if (!await confirmar("Carregar semana " + fmtBR(b.dataset.c) + "?", "Os dados atuais do editor serão substituídos pelos dados salvos dessa semana. Use para consultar ou para refazer a apresentação daquela data.", "Carregar")) return;
      try { const r = await api("/api/semana?data=" + b.dataset.c); D = r.dados; normalizar(); abrir("atividades"); atualizar(); toast("Semana " + fmtBR(b.dataset.c) + " carregada no editor."); }
      catch(err){ toast("Erro: " + err.message); }
    });
  }
};

/* ---------- cores ---------- */
const CAMPOS_COR = [["primaria","Cor principal (marca)","Faixa da capa, linhas dos títulos, sprint atual"],["barra","Barras: realizado","Parte já feita de cada atividade no Gantt"],["barraPlanejado","Barras: planejado","Parte ainda não feita"],["hoje","Linha “hoje”","Marcador da data de referência no Gantt"]];
function pintarCores(){
  if (!D.config.cores) D.config.cores = {...Report.TEMAS["Marca vermelha"]};
  const C = D.config.cores;
  $("#presets").innerHTML = Object.keys(Report.TEMAS).map(n => { const t = Report.TEMAS[n]; const on = Object.keys(t).every(k => (C[k] || "").toLowerCase() === t[k]);
    return `<button data-t="${esc(n)}" class="${on ? "on" : ""}"><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${t.primaria};margin-right:4px"></span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${t.barra};margin-right:6px"></span>${esc(n)}</button>`; }).join("");
  $("#presets").querySelectorAll("button").forEach(b => b.onclick = () => { D.config.cores = {...Report.TEMAS[b.dataset.t]}; pintarCores(); atualizar(); });
  $("#cores").innerHTML = CAMPOS_COR.map(([k, l, h]) => campo(l, `<div style="display:flex;gap:8px"><input type="color" data-cor="${k}" value="${C[k]}" style="width:44px;height:34px;padding:2px"><input data-hex="${k}" value="${C[k]}" maxlength="7" style="width:110px;font-family:Consolas,monospace"></div>`, h)).join("");
  const set = (k, v) => { C[k] = v; $(`[data-cor="${k}"]`).value = v; $(`[data-hex="${k}"]`).value = v; avisoCor(); atualizar(); $("#presets").querySelectorAll("button").forEach(b => b.classList.remove("on")); };
  $("#cores").querySelectorAll("[data-cor]").forEach(el => el.oninput = () => set(el.dataset.cor, el.value));
  $("#cores").querySelectorAll("[data-hex]").forEach(el => el.oninput = () => { const v = el.value.trim(); if (/^#[0-9a-fA-F]{6}$/.test(v)) set(el.dataset.hex, v.toLowerCase()); });
  avisoCor();
}
function avisoCor(){
  const p = Report.paleta(D.config.cores), el = $("#avisoCor"); if (!el) return;
  el.innerHTML = p.ajustado ? `Para os títulos ficarem legíveis em fundo branco, o texto usa um tom mais escuro da cor principal: <span style="display:inline-block;width:10px;height:10px;background:${p.texto};vertical-align:-1px"></span> <code>${p.texto}</code>` : "";
}
function corInterface(){ const p = Report.paleta(D.config.cores); const r = document.documentElement.style; r.setProperty("--accent", p.texto); r.setProperty("--tint", p.tint); }

/* ---------- ações do cabeçalho ---------- */
$("#btNova").onclick = async () => {
  const atual = D.config.dataReferencia;
  const gerada = (ESTADO.semanas || []).some(s => s.data === atual);
  const t = new Date(atual + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + 7); const nova = t.toISOString().slice(0, 10);
  const ok = await confirmar("Iniciar a semana de " + fmtBR(nova) + "?",
    (gerada ? "" : `<b>Atenção:</b> a semana de ${fmtBR(atual)} ainda não foi gerada, então ela não ficará no histórico.<br><br>`) +
    "O % atual de cada atividade vira “% semana anterior”, a data avança 7 dias e os destaques são limpos. Atividades, bloqueios, próximos passos e comunicações continuam para você atualizar.", "Iniciar nova semana");
  if (!ok) return;
  D.atividades.forEach(a => { if (!a.marco) a.pctAnterior = Number(a.pct) || 0; });
  D.config.dataReferencia = nova;
  D.semana.destaques = "";
  abrir("atividades"); atualizar();
  if (!Report.sprintAtual(D)) toast("Não há sprint cadastrada para " + fmtBR(nova) + ". Cadastre as sprints do trimestre na seção Sprints.", 7000);
};
$("#btSalvar").onclick = salvar;
$("#btGerar").onclick = async () => {
  if (!Report.sprintAtual(D)){ toast("Nenhuma sprint cadastrada contém a data " + fmtBR(D.config.dataReferencia) + ". Cadastre as sprints na seção Sprints.", 7000); return; }
  const b = $("#btGerar"); b.disabled = true; b.textContent = "Gerando…";
  try {
    const r = await api("/api/gerar", { dados: D, html: Report.gerar(D) });
    sujo = false; clearTimeout(tSalvar); ESTADO.semanas = r.semanas;
    $("#salvo").textContent = "apresentação gerada às " + new Date().toTimeString().slice(0, 5);
    const ok = (t, txt) => `<li><b>✓</b><span>${txt}</span></li>`;
    $("#modal").innerHTML = `<h2>Apresentação de ${fmtBR(r.data)} gerada</h2>
      <ul>
        ${ok("", `<code>report_${r.data}.html</code>`)}
        ${r.pdf ? ok("", `<code>report_${r.data}.pdf</code>`) : `<li><b class="warn">!</b><span>PDF não gerado</span></li>`}
        ${ok("", `Histórico atualizado (${ESTADO.xlsx ? "historico.xlsx" : "CSV"})`)}
      </ul>
      ${r.avisos.length ? `<div class="nota" style="color:#b26b00;margin-bottom:8px">${r.avisos.map(esc).join("<br>")}</div>` : ""}
      <div class="nota">Pasta: <code>${esc(r.pasta)}</code></div>
      <div class="acts">${r.pdf ? `<button id="mPdf">Abrir PDF</button>` : `<button id="mHtml">Abrir HTML</button>`}<button id="mPasta">Abrir pasta</button><button class="pri" id="mOk">Fechar</button></div>`;
    $("#modalBg").style.display = "flex";
    $("#mOk").onclick = fecharModal;
    $("#mPasta").onclick = () => abrirArquivo("pasta", r.data);
    if ($("#mPdf")) $("#mPdf").onclick = () => abrirArquivo("pdf", r.data);
    if ($("#mHtml")) $("#mHtml").onclick = () => abrirArquivo("html", r.data);
  } catch(e){ if (e.status === 423) entrarLeitura(e.lock); toast("Erro ao gerar: " + esc(e.message), 9000); }
  finally { b.disabled = false; b.textContent = "Gerar apresentação"; }
};
/* ---------- uso compartilhado: só uma pessoa edita por vez ---------- */
function entrarLeitura(lock){
  leitura = true; sujo = false; clearTimeout(tSalvar);
  if (lock) ESTADO.lock = lock;
  ESTADO.modo = "leitura";
  aplicarModo();
}
function aplicarModo(){
  leitura = ESTADO.modo === "leitura";
  ["#btGerar", "#btNova", "#btSalvar"].forEach(s => $(s).disabled = leitura);
  const b = $("#banner");
  if (!leitura){ b.classList.remove("on"); return; }
  const l = ESTADO.lock || {};
  b.innerHTML = `<span>🔒 <b>${esc(l.usuario || "Outra pessoa")}</b>${l.maquina ? " (" + esc(l.maquina) + ")" : ""} está editando a apresentação${l.desde ? " desde " + esc(l.desde) : ""}. Você está em <b>modo leitura</b>: pode navegar e ver a prévia, mas nada é salvo.</span><span class="sp"></span>
    <button id="bnTentar">Verificar de novo</button><button id="bnAssumir">Assumir edição</button>`;
  b.classList.add("on");
  $("#bnTentar").onclick = () => recarregar(false);
  $("#bnAssumir").onclick = async () => {
    if (!await confirmar("Assumir a edição?", `Use só se tiver certeza de que <b>${esc(l.usuario || "a outra pessoa")}</b> não está mais editando (por exemplo, fechou o aplicativo sem encerrar). Se ela ainda estiver editando, o que ela salvar depois disso será recusado.`, "Assumir edição")) return;
    recarregar(true);
  };
}
async function recarregar(forcar){
  try {
    ESTADO = forcar ? await api("/api/assumir", { forcar: true }) : await api("/api/estado");
    if (ESTADO.modo === "edicao"){
      leitura = false; D = ESTADO.dados; normalizar(); abrir(secAtual); atualizar(true); mostrarMeta();
      toast("Edição liberada. Os dados foram recarregados com a última versão salva.", 6000);
    } else toast("Ainda em edição por " + esc((ESTADO.lock || {}).usuario || "outra pessoa") + ".");
    aplicarModo();
  } catch(e){ toast("Erro: " + esc(e.message)); }
}
function mostrarMeta(){
  const m = ESTADO.meta;
  $("#salvo").textContent = m && m.usuario ? `última alteração: ${m.usuario}, ${fmtBR(m.quando.slice(0, 10))} ${m.quando.slice(11)}` :
    ESTADO.origem === "exemplo" ? "dados de exemplo" : "carregado";
}
async function encerrar(){
  if (!await confirmar("Encerrar o aplicativo?", leitura ? "Você está em modo leitura; nada será salvo." : "O rascunho é salvo antes e a edição fica liberada para outras pessoas. Para voltar depois, execute o iniciar.bat.", leitura ? "Encerrar" : "Salvar e encerrar")) return;
  if (!leitura) await salvar();
  try { await api("/api/encerrar", {}); } catch(e){}
  sujo = false;
  document.body.innerHTML = `<div style="padding:60px;font-family:Segoe UI,sans-serif"><h2>Aplicativo encerrado</h2><p>O rascunho foi salvo. Pode fechar esta aba.</p></div>`;
}
function modo(m){ $("#main").className = m; $("#modo").querySelectorAll("button").forEach(b => b.classList.toggle("on", b.dataset.m === m)); }
$("#modo").querySelectorAll("button").forEach(b => b.onclick = () => modo(b.dataset.m));

function normalizar(){
  D = D || {};
  D.config = D.config || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(D.config.dataReferencia || "")) D.config.dataReferencia = hojeIso();
  for (const k of ["sprints","frentes","atividades","bloqueios","comunicacoes"]) if (!Array.isArray(D[k])) D[k] = [];
  D.semana = D.semana || { destaques: "", proximos: "" };
  D.config.cores = D.config.cores || {...Report.TEMAS["Marca vermelha"]};
  if (D.config.sprintsAntes == null) D.config.sprintsAntes = 3;
  if (D.config.sprintsDepois == null) D.config.sprintsDepois = 3;
}
async function iniciar(){
  try { ESTADO = await api("/api/estado"); }
  catch(e){ document.body.innerHTML = `<div style="padding:60px;font-family:Segoe UI,sans-serif"><h2>Não foi possível conectar</h2><p>${esc(e.message)}</p></div>`; return; }
  D = ESTADO.dados; normalizar();
  montarNav(); abrir("atividades"); atualizar(true);
  mostrarMeta(); aplicarModo();
  const avisos = [];
  if (ESTADO.origem === "exemplo") avisos.push("Dados de exemplo carregados. Troque pelas suas frentes e atividades: tudo é salvo automaticamente.");
  if (!ESTADO.navegador) avisos.push("Edge/Chrome não encontrado: o PDF não será gerado automaticamente.");
  if (!ESTADO.xlsx) avisos.push("openpyxl não instalado: o histórico será gravado em CSV.");
  if (avisos.length) toast(avisos.join("<br>"), 9000);
}
iniciar();