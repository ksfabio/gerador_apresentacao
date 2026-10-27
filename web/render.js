/* =====================================================================
   MOTOR DA APRESENTAÇÃO
   Recebe os dados (o mesmo conteúdo que vai para o Excel de histórico)
   e devolve o HTML completo da apresentação. É usado tanto na
   pré-visualização da interface quanto na geração do arquivo final.
   ===================================================================== */
const Report = (() => {
const DIA = 864e5;
const d = s => new Date(s + "T00:00:00Z");
const iso = t => t.toISOString().slice(0, 10);
const fmt = (x, ano) => { const t = typeof x === "string" ? d(x) : x; const s = String(t.getUTCDate()).padStart(2,"0") + "/" + String(t.getUTCMonth()+1).padStart(2,"0"); return ano ? s + "/" + t.getUTCFullYear() : s; };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const img = s => typeof s === "string" && /^data:image\//.test(s) ? s : "";

const STATUS = {
  "Concluído":    { ic:"✓", cor:"var(--ink-2)", peso:0 },
  "Não iniciado": { ic:"○", cor:"var(--neutral)", peso:1 },
  "No prazo":     { ic:"●", cor:"var(--good)", peso:2 },
  "Atenção":      { ic:"▲", cor:"var(--warning)", peso:3 },
  "Atrasado":     { ic:"◆", cor:"var(--serious)", peso:4 },
  "Bloqueado":    { ic:"■", cor:"var(--critical)", peso:5 }
};
const CRIT = { "Alta":"Bloqueado", "Média":"Atenção", "Baixa":"Não iniciado" };
const stHtml = (s, rotulo) => `<span class="st"><i style="color:${STATUS[s].cor}">${STATUS[s].ic}</i>${rotulo || s}</span>`;

/* Status automático; um status preenchido à mão sempre prevalece. */
function statusDe(a, hojeIso){
  if (a.status && STATUS[a.status]) return a.status;
  const pct = Number(a.pct) || 0;
  if (pct >= 100) return "Concluído";
  if (!a.inicio || !a.fim) return "Não iniciado";
  const hoje = d(hojeIso), ini = d(a.inicio), fim = d(a.fim);
  if (fim < hoje) return "Atrasado";
  if (ini > hoje) return "Não iniciado";
  const esperado = 100 * (hoje - ini) / (fim - ini + DIA);
  return pct < esperado - 25 ? "Atenção" : "No prazo";
}

/* Sprints de 2 semanas, numeração reiniciando a cada trimestre.
   Regra: a Sprint 1 começa na 1ª segunda-feira do trimestre; a última
   sprint termina na véspera da Sprint 1 do trimestre seguinte. */
function primeiraSegunda(ano, mes){ const t = new Date(Date.UTC(ano, mes, 1)); while (t.getUTCDay() !== 1) t.setUTCDate(t.getUTCDate() + 1); return t; }
function gerarSprintsTrimestre(ano, q){
  const ini = primeiraSegunda(ano, (q-1)*3);
  const prox = q === 4 ? primeiraSegunda(ano+1, 0) : primeiraSegunda(ano, q*3);
  const out = []; let n = 1;
  for (let t = ini; t < prox; t = new Date(t.getTime() + 14*DIA), n++){
    const fim = new Date(Math.min(t.getTime() + 13*DIA, prox.getTime() - DIA));
    out.push({ trimestre: `Q${q} ${ano}`, numero: n, inicio: iso(t), fim: iso(fim) });
  }
  return out;
}
/* Ordem dos slides: comunicações entram logo depois do slide escolhido como âncora */
function ancoras(D){
  return [["capa","Após a capa"],["evolucao","Após a evolução da semana"],["geral","Após o acompanhamento geral"],
    ...(D.frentes || []).filter(f => f.id && f.nome).map(f => ["frente:" + f.id, "Após a frente: " + f.nome]),
    ["bloqueios","No final (após os bloqueios)"]];
}
function sequencia(D){
  const coms = (D.comunicacoes || []).map((c, idx) => ({...c, idx})).filter(c => c.incluir);
  const anc = ancoras(D).map(a => a[0]), out = [];
  for (const a of anc){
    out.push(a.startsWith("frente:") ? { tipo:"frente", id:a.slice(7), titulo:(D.frentes.find(f => "frente:" + f.id === a) || {}).nome }
      : { tipo:a, titulo:{capa:"Capa",evolucao:"Evolução da semana",geral:"Acompanhamento geral",bloqueios:"Dependências e bloqueios"}[a] });
    coms.filter(c => (c.posicao || "evolucao") === a).forEach(c => out.push({ tipo:"com", idx:c.idx, titulo:c.titulo || "Comunicação geral" }));
  }
  coms.filter(c => !anc.includes(c.posicao || "evolucao")).forEach(c => out.push({ tipo:"com", idx:c.idx, titulo:c.titulo || "Comunicação geral" }));
  return out;
}
const spNome = s => `Sprint ${s.numero}`;
const spQ = s => String(s.trimestre || "").split(" ")[0];
const spCompleto = s => `${spQ(s)} · ${spNome(s)}`;
function sprintAtual(D){
  const h = d(D.config.dataReferencia);
  return (D.sprints || []).filter(s => s.inicio && s.fim).map(s => ({...s, i:d(s.inicio), f:d(s.fim)}))
    .sort((a,b) => a.i - b.i).find(s => s.i <= h && h <= s.f) || null;
}

/* Texto livre: linhas com "- " viram tópicos; **negrito**; linha em branco separa parágrafos */
function texto(t){
  const linhas = String(t || "").split(/\r?\n/); let html = "", lista = false;
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  for (const l of linhas){
    if (/^\s*[-•]\s+/.test(l)){ if (!lista){ html += "<ul>"; lista = true; } html += `<li>${inline(l.replace(/^\s*[-•]\s+/, ""))}</li>`; }
    else { if (lista){ html += "</ul>"; lista = false; } if (l.trim()) html += `<p>${inline(l)}</p>`; }
  }
  return html + (lista ? "</ul>" : "");
}

/* ---------- Cores (tema) ---------- */
const TEMAS = {
  "Marca vermelha": { primaria:"#c8102e", barra:"#3f3f3c", barraPlanejado:"#d6d4cd", hoje:"#0b0b0b" },
  "Vermelho + azul": { primaria:"#c8102e", barra:"#2a78d6", barraPlanejado:"#b8d3f4", hoje:"#0b0b0b" },
  "Azul":            { primaria:"#1f4e8c", barra:"#2a78d6", barraPlanejado:"#b8d3f4", hoje:"#d03b3b" }
};
const hexOk = h => /^#[0-9a-fA-F]{6}$/.test(h || "");
const rgb = h => [1,3,5].map(i => parseInt(h.slice(i, i+2), 16));
const hex = a => "#" + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
const mix = (h, h2, w) => { const a = rgb(h), b = rgb(h2); return hex(a.map((v, i) => v * (1 - w) + b[i] * w)); };
const lum = h => { const c = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126*c[0] + .7152*c[1] + .0722*c[2]; };
const contraste = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function paleta(cores){
  const base = TEMAS["Marca vermelha"], c = {};
  for (const k in base) c[k] = hexOk(cores && cores[k]) ? cores[k] : base[k];
  let txt = c.primaria; for (let i = 0; i < 20 && contraste(txt, "#ffffff") < 4.5; i++) txt = mix(txt, "#000000", .1);
  const sobre = contraste(c.primaria, "#ffffff") >= 3 ? "#ffffff" : "#0b0b0b";
  return { ...c, texto: txt, tint: mix(c.primaria, "#ffffff", .92), sobre, ajustado: txt !== c.primaria };
}
const cssTema = p => `:root{--accent:${p.primaria};--accent-txt:${p.texto};--on-accent:${p.sobre};--tint:${p.tint};--bar:${p.barra};--bar-rest:${p.barraPlanejado};--hoje:${p.hoje}}`;

const CSS = `
  :root{--surface:#fcfcfb;--page:#e9e8e4;--ink:#0b0b0b;--ink-2:#52514e;--ink-3:#8a8983;--line:#e4e2dc;--line-2:#d3d1ca;
    --accent:#1f4e8c;--bar:#2a78d6;--bar-rest:#b8d3f4;--tint:#eef4fc;
    --good:#0ca30c;--warning:#fab219;--serious:#ec835a;--critical:#d03b3b;--neutral:#9a9890}
  *{box-sizing:border-box}
  html,body{margin:0;background:var(--page);font-family:"Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif;color:var(--ink)}
  .deck{max-width:1280px;margin:0 auto;padding:16px}
  .frame{width:100%;aspect-ratio:16/9;margin:0 0 20px;position:relative;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.12),0 6px 18px rgba(0,0,0,.06);border-radius:4px}
  .slide{width:1280px;height:720px;background:var(--surface);position:absolute;top:0;left:0;transform-origin:0 0;transform:scale(var(--s,1));padding:36px 44px 0;display:flex;flex-direction:column}
  .hdr{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid var(--accent);padding-bottom:10px;margin-bottom:18px}
  .hdr h2{margin:0;font-size:26px;font-weight:600;letter-spacing:-.2px}
  .hdr .sub{font-size:13px;color:var(--ink-2);margin-top:3px}
  .hdr .right{text-align:right;font-size:13px;color:var(--ink-2)}
  .ftr{position:absolute;left:44px;right:44px;bottom:12px;min-height:22px;display:flex;justify-content:space-between;align-items:center;font-size:11px;color:var(--ink-3)}
  .ftr .r{display:flex;align-items:center;gap:12px}
  .ftr img{height:var(--logo-rod,20px);max-width:200px;object-fit:contain}
  .st{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink);white-space:nowrap}
  .st i{font-style:normal;font-size:12px;line-height:1}
  .pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid var(--line-2);border-radius:999px;font-size:13px;background:#fff}
  .capa{justify-content:center;padding:0 90px;background:linear-gradient(180deg,#fff,var(--surface))}
  .capa .bg{position:absolute;inset:0;background-size:cover;background-position:center}
  .capa .ov{position:absolute;inset:0;background:#000}
  .capa .cont{position:relative;z-index:1}
  .capa.claro{color:#fff}
  .capa.claro .tag{color:#fff;opacity:.85}
  .capa.claro .lead{color:rgba(255,255,255,.88)}
  .capa.claro .meta b{color:rgba(255,255,255,.7)}
  .capa.centro .cont{text-align:center}
  .capa.centro .meta{justify-content:center}
  .capa .tag{font-size:14px;letter-spacing:2px;text-transform:uppercase;color:var(--accent-txt);font-weight:600}
  .capa h1{font-size:54px;margin:14px 0 6px;font-weight:650;letter-spacing:-1px;line-height:1.05}
  .capa .lead{font-size:22px;color:var(--ink-2)}
  .capa .meta{margin-top:48px;display:flex;gap:44px;font-size:15px}
  .capa .meta b{display:block;font-size:12px;color:var(--ink-3);font-weight:500;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .capa .barra{position:absolute;left:0;top:0;bottom:0;width:14px;background:var(--accent);z-index:1}
  .capa .logo{position:absolute;max-width:45%;object-fit:contain;z-index:2}
  .capa .logo.sup-dir{top:44px;right:56px}.capa .logo.sup-esq{top:44px;left:90px}
  .capa .logo.inf-dir{bottom:44px;right:56px}.capa .logo.inf-esq{bottom:44px;left:90px}
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:22px}
  .kpi{border:1px solid var(--line);border-radius:6px;padding:14px 18px;background:#fff}
  .kpi .lb{font-size:13px;color:var(--ink-2)}
  .kpi .vl{font-size:38px;font-weight:600;letter-spacing:-.5px;margin-top:2px}
  .kpi .dt{font-size:12.5px;color:var(--ink-2)}
  .cols3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;flex:1;min-height:0;margin-bottom:var(--fb,46px)}
  .box{border:1px solid var(--line);border-radius:6px;padding:14px 18px;background:#fff;overflow:hidden}
  .box h3{margin:0 0 10px;font-size:14px;font-weight:600;color:var(--accent-txt);text-transform:uppercase;letter-spacing:.6px}
  .box ul{margin:0;padding-left:18px;font-size:14.5px;line-height:1.45}
  .box li{margin-bottom:7px}
  .box li small{color:var(--ink-3)}
  table{border-collapse:collapse;width:100%}
  th{font-size:12px;font-weight:600;color:var(--ink-2);text-align:left;padding:8px 10px;border-bottom:1.5px solid var(--line-2);text-transform:uppercase;letter-spacing:.4px}
  td{font-size:14px;padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:top}
  td.num,th.num{text-align:right;font-variant-numeric:tabular-nums}
  .prog{display:flex;align-items:center;gap:8px}
  .prog .trk{width:110px;height:8px;background:#ecebe6;border-radius:4px;overflow:hidden}
  .prog .trk span{display:block;height:100%;background:var(--bar);border-radius:4px}
  .prog b{font-weight:600;font-variant-numeric:tabular-nums;min-width:36px}
  .delta{font-size:12px;color:var(--ink-2);white-space:nowrap}
  .muted{color:var(--ink-3)}
  .gantt{position:relative;border:1px solid var(--line);border-radius:6px;background:#fff;overflow:hidden}
  .g-row{display:flex;position:relative;border-bottom:1px solid var(--line)}
  .g-row:last-child{border-bottom:0}
  .g-lbl{flex:0 0 420px;width:420px;min-width:0;overflow:hidden;display:flex;align-items:center;padding:0 12px;gap:10px;border-right:1px solid var(--line-2);background:#fff;z-index:2}
  .g-lbl .nm{flex:1 1 0;min-width:0;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .g-lbl .s,.g-lbl .p{flex-shrink:0}
  .g-tl{min-width:0;overflow:hidden}
  .g-lbl .s{flex:0 0 112px}
  .g-lbl .p{flex:0 0 38px;text-align:right;font-size:13px;font-variant-numeric:tabular-nums;color:var(--ink-2)}
  .g-tl{flex:1;position:relative}
  .g-head .g-lbl{font-size:11.5px;color:var(--ink-2);text-transform:uppercase;letter-spacing:.4px;font-weight:600;align-items:flex-end;padding-bottom:6px}
  .sp-cell{position:absolute;top:0;height:34px;border-right:1px solid var(--line-2);font-size:12px;font-weight:600;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1.15;color:var(--ink);overflow:hidden;white-space:nowrap}
  .sp-cell small{font-weight:400;color:var(--ink-3);font-size:10.5px}
  .sp-cell.cur{background:var(--accent);color:var(--on-accent)}
  .sp-cell.cur small{color:var(--on-accent);opacity:.8}
  .sp-cell.q{border-left:2px solid var(--ink-2)}
  .wk-cell{position:absolute;top:34px;height:20px;border-right:1px solid var(--line);font-size:10.5px;color:var(--ink-3);display:flex;align-items:center;justify-content:center;border-top:1px solid var(--line)}
  .col-bg{position:absolute;bottom:0;z-index:0;pointer-events:none;border-right:1px solid var(--line-2)}
  .col-bg.cur{background:var(--tint)}
  .bar{position:absolute;top:50%;height:14px;margin-top:-7px;border-radius:4px;background:var(--bar-rest);overflow:hidden;z-index:1}
  .bar .done{position:absolute;left:0;top:0;bottom:0;background:var(--bar)}
  .bar.cut-l{border-top-left-radius:0;border-bottom-left-radius:0}
  .bar.cut-r{border-top-right-radius:0;border-bottom-right-radius:0}
  .bar.blk{background:repeating-linear-gradient(45deg,#f3c9c9 0 4px,#fbeaea 4px 8px)}
  .ms{position:absolute;top:50%;width:12px;height:12px;margin:-6px 0 0 -6px;transform:rotate(45deg);background:var(--ink);z-index:1}
  .ms-lbl{position:absolute;top:50%;transform:translateY(-50%);font-size:11.5px;color:var(--ink-2);white-space:nowrap;z-index:1}
  .today{position:absolute;bottom:0;width:0;border-left:2px solid var(--hoje);z-index:3;pointer-events:none}
  .today span{position:absolute;bottom:2px;left:3px;font-size:10px;color:#fff;background:var(--hoje);padding:1px 4px;border-radius:2px;white-space:nowrap}
  .frente-meta{display:flex;gap:10px;align-items:center}
  .bottom2{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px;flex:1;min-height:0;margin-bottom:var(--fb,46px)}
  .bottom2 .box ul{font-size:13.5px}
  .legend{display:flex;gap:16px;font-size:11.5px;color:var(--ink-2);margin-top:6px;align-items:center}
  .legend .sw{display:inline-block;width:18px;height:10px;border-radius:3px;margin-right:5px;vertical-align:-1px}
  .com{display:flex;gap:28px;flex:1;min-height:0;margin-bottom:var(--fb,46px)}
  .com .txt{flex:1;font-size:19px;line-height:1.5;overflow:hidden}
  .com .txt p{margin:0 0 14px}
  .com .txt ul{margin:0 0 14px;padding-left:24px}
  .com .txt li{margin-bottom:8px}
  .com .pic{flex:0 0 46%;display:flex;align-items:center;justify-content:center;border:1px solid var(--line);border-radius:6px;background:#fff;padding:12px}
  .com .pic img{max-width:100%;max-height:100%;object-fit:contain}
  .erro{padding:40px;font-size:16px;color:var(--ink-2)}
  #tip{position:fixed;pointer-events:none;background:#1b1b1a;color:#f0efec;font-size:12.5px;padding:8px 10px;border-radius:5px;line-height:1.45;display:none;z-index:99;max-width:300px}
  @page{size:13.333in 7.5in;margin:0}
  @media print{
    html,body{background:#fff}
    .deck{padding:0;max-width:none}
    .frame{width:1280px;height:720px;aspect-ratio:auto;margin:0;box-shadow:none;border-radius:0;break-after:page}
    .slide{transform:none}
    *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  }`;

const SCRIPT = `<script>
function escala(){document.querySelectorAll(".frame").forEach(function(fr){fr.querySelector(".slide").style.setProperty("--s",fr.clientWidth/1280);});}
window.addEventListener("resize",escala);escala();
var tip=document.getElementById("tip");
document.addEventListener("mousemove",function(e){var t=e.target.closest&&e.target.closest("[data-tip]");
 if(!t){tip.style.display="none";return;}tip.innerHTML=t.getAttribute("data-tip");tip.style.display="block";
 tip.style.left=Math.min(e.clientX+14,innerWidth-310)+"px";tip.style.top=(e.clientY+14)+"px";});
<\/script>`;

function documento(titulo, corpo, tema){
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(titulo)}</title><style>${CSS}${tema || ""}</style></head><body><div class="deck">${corpo}</div><div id="tip"></div>${SCRIPT}</body></html>`;
}

function gerar(D){
  const C = D.config;
  const HOJE = d(C.dataReferencia);
  const spAtual = sprintAtual(D);
  if (!spAtual) return documento("Report", `<div class="frame"><div class="slide"><div class="erro">Nenhuma sprint cadastrada contém a data de referência <b>${fmt(HOJE, true)}</b>.<br>Cadastre as sprints do trimestre na aba <b>Sprints</b>.</div></div></div>`);

  const atividades = (D.atividades || []).filter(a => a.nome && a.inicio && (a.marco || a.fim))
    .map(a => a.marco ? {...a, fim: a.inicio} : {...a, pct: Number(a.pct) || 0, pctAnterior: a.pctAnterior === "" || a.pctAnterior == null ? null : Number(a.pctAnterior), _st: statusDe(a, C.dataReferencia)});
  const tarefas = atividades.filter(a => !a.marco);
  const bloqueios = (D.bloqueios || []).filter(b => b.descricao);
  const frentes = (D.frentes || []).filter(f => f.id && f.nome);
  const logo = img(C.logo);

  const progresso = (lista, campo) => { let p = 0, w = 0; lista.forEach(a => { const dur = (d(a.fim) - d(a.inicio))/DIA + 1; p += (a[campo] ?? a.pct) * dur; w += dur; }); return w ? Math.round(p / w) : 0; };
  const statusFrente = lista => {
    const ab = lista.filter(a => a._st !== "Concluído" && a._st !== "Não iniciado");
    if (!ab.length) return lista.length && lista.every(a => a._st === "Concluído") ? "Concluído" : "No prazo";
    return ab.reduce((m, a) => STATUS[a._st].peso > STATUS[m].peso ? a._st : m, "No prazo");
  };
  const barraProg = (pct, ant) => { const dl = pct - ant; return `<div class="prog"><div class="trk"><span style="width:${pct}%"></span></div><b>${pct}%</b><span class="delta">${dl > 0 ? "+" + dl : dl === 0 ? "±0" : dl} p.p.</span></div>`; };
  const naSprint = ts => ts.filter(a => d(a.inicio) <= spAtual.f && d(a.fim) >= spAtual.i && a._st !== "Concluído");

  // janela do Gantt
  const SP = D.sprints.filter(s => s.inicio && s.fim).map(s => ({...s, i:d(s.inicio), f:d(s.fim)})).sort((a,b) => a.i - b.i);
  const iA = SP.findIndex(s => s.inicio === spAtual.inicio);
  const janela = SP.slice(Math.max(0, iA - (Number(C.sprintsAntes) || 0)), iA + (Number(C.sprintsDepois) || 0) + 1);
  const J0 = janela[0].i, J1 = new Date(janela[janela.length-1].f.getTime() + DIA);
  const semanaDaSprint = Math.floor((HOJE - spAtual.i) / (7*DIA)) + 1;
  const totalSemanas = Math.round((spAtual.f - spAtual.i + DIA) / (7*DIA));
  const spTexto = `${spCompleto(spAtual)} · ${fmt(spAtual.i)} a ${fmt(spAtual.f)} · semana ${semanaDaSprint} de ${totalSemanas}`;

  const LR = Math.max(12, Math.min(48, Number(C.logoAlturaRodape) || 20));
  const RODAPE = `${C.titulo} · ${C.subtitulo} · ${fmt(HOJE, true)} · ${spCompleto(spAtual)}`;
  const partes = {};
  const slide = (html, cls="") => `<div class="frame"><div class="slide ${cls}" style="--logo-rod:${LR}px;--fb:${Math.max(46, LR + 26)}px">${html}${cls.includes("capa") ? "" : `<div class="ftr"><span></span><span class="r">${logo ? `<img src="${logo}" alt="">` : ""}<span>{{N}}</span></span></div>`}</div></div>`;
  const cab = (titulo, sub, direita="") => `<div class="hdr"><div><h2>${titulo}</h2>${sub ? `<div class="sub">${sub}</div>` : ""}</div><div class="right">${direita}</div></div>`;

  /* Capa */
  const K = C.capa || {};
  let fundo = "", claro = false;
  if (K.modo === "cor" && hexOk(K.cor)){ fundo = `<div class="bg" style="background:${K.cor}"></div>`; claro = contraste(K.cor, "#ffffff") >= 3; }
  if (K.modo === "imagem" && img(K.imagem)){ const ov = Math.max(0, Math.min(85, Number(K.escurecer) || 0));
    fundo = `<div class="bg" style="background-image:url('${img(K.imagem)}')"></div>${ov ? `<div class="ov" style="opacity:${ov/100}"></div>` : ""}`; claro = ov >= 35; }
  if (K.texto === "claro") claro = true; if (K.texto === "escuro") claro = false;
  const faixa = K.faixa !== false && !(K.modo === "cor" && K.cor === paleta(C.cores).primaria);
  const lc = img(C.logoCapa) || logo;
  const logoCapa = lc ? `<img class="logo ${C.logoPosicao || "sup-dir"}" src="${lc}" alt="" style="height:${Number(C.logoAlturaCapa) || 64}px">` : "";
  partes.capa = slide(`${fundo}${faixa ? `<div class="barra"></div>` : ""}${logoCapa}
    <div class="cont">${C.subtitulo ? `<div class="tag">${esc(C.subtitulo)}</div>` : ""}<h1>${esc(C.titulo)}</h1>
    ${(K.frase ?? "Evolução das frentes, planejamento por sprint e bloqueios") ? `<div class="lead">${esc(K.frase ?? "Evolução das frentes, planejamento por sprint e bloqueios")}</div>` : ""}
    <div class="meta"><div><b>Data</b>${fmt(HOJE, true)}</div><div><b>Sprint atual</b>${spTexto}</div></div></div>`, `capa ${claro ? "claro" : ""} ${K.alinhamento === "centro" ? "centro" : ""}`);

  /* Evolução da semana */
  const pg = progresso(tarefas, "pct"), pgAnt = progresso(tarefas, "pctAnterior");
  const concl = tarefas.filter(a => a._st === "Concluído").length;
  const andamento = tarefas.filter(a => ["No prazo","Atenção","Atrasado","Bloqueado"].includes(a._st)).length;
  const conclSemana = tarefas.filter(a => a.pct >= 100 && a.pctAnterior != null && a.pctAnterior < 100);
  const atencao = [
    ...bloqueios.map(b => `<b>${esc(b.descricao)}</b> <small>· ${esc(b.area)} · ${Math.max(0, Math.round((HOJE - d(b.desde))/DIA)) || 0} dias</small>`),
    ...tarefas.filter(a => a._st === "Atrasado").map(a => `<b>${esc(a.nome)}</b> <small>· atrasada desde ${fmt(a.fim)} (${a.pct}%)</small>`)
  ];
  const linhasTxt = t => String(t || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  partes.evolucao = slide(cab("Evolução da semana", spTexto) + `
    <div class="kpis">
      <div class="kpi"><div class="lb">Progresso geral</div><div class="vl">${pg}%</div><div class="dt">${pg - pgAnt >= 0 ? "+" : ""}${pg - pgAnt} p.p. na semana</div></div>
      <div class="kpi"><div class="lb">Atividades concluídas</div><div class="vl">${concl}<span style="font-size:20px;color:var(--ink-3)"> / ${tarefas.length}</span></div><div class="dt">${conclSemana.length} concluída(s) nesta semana</div></div>
      <div class="kpi"><div class="lb">Em andamento</div><div class="vl">${andamento}</div><div class="dt">${tarefas.filter(a => a._st === "Atenção" || a._st === "Atrasado").length} com atenção ou atraso</div></div>
      <div class="kpi"><div class="lb">Bloqueios ativos</div><div class="vl">${bloqueios.length}</div><div class="dt">${bloqueios.filter(b => b.criticidade === "Alta").length} de criticidade alta</div></div>
    </div>
    <div class="cols3">
      <div class="box"><h3>Destaques</h3><ul>${conclSemana.map(a => `<li>Concluído: <b>${esc(a.nome)}</b></li>`).join("")}${linhasTxt(D.semana?.destaques).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
      <div class="box"><h3>Próximos passos</h3><ul>${linhasTxt(D.semana?.proximos).map(t => `<li>${esc(t)}</li>`).join("")}</ul></div>
      <div class="box"><h3>Pontos de atenção</h3><ul>${atencao.map(t => `<li>${t}</li>`).join("") || "<li class='muted'>Nenhum</li>"}</ul></div>
    </div>`);

  /* Acompanhamento geral */
  const linhasGeral = frentes.map(f => {
    const ts = tarefas.filter(a => a.frente === f.id);
    const bl = bloqueios.filter(b => b.frente === f.id);
    const marco = atividades.filter(a => a.frente === f.id && a.marco && d(a.inicio) >= HOJE).sort((a,b) => d(a.inicio) - d(b.inicio))[0];
    return `<tr><td><b>${esc(f.nome)}</b><div class="muted" style="font-size:12.5px">${esc(f.objetivo)}</div></td>
      <td>${esc(f.responsavel)}</td><td>${stHtml(statusFrente(ts))}</td>
      <td>${barraProg(progresso(ts,"pct"), progresso(ts,"pctAnterior"))}</td>
      <td class="num">${ts.filter(a => a._st === "Concluído").length} / ${ts.length}</td>
      <td style="font-size:13px">${naSprint(ts).map(a => esc(a.nome)).join("<br>") || "<span class='muted'>—</span>"}</td>
      <td style="font-size:13px">${marco ? `<b>${fmt(marco.inicio)}</b> ${esc(marco.nome)}` : "<span class='muted'>—</span>"}</td>
      <td class="num">${bl.length || "<span class='muted'>0</span>"}</td></tr>`;
  }).join("");
  partes.geral = slide(cab("Acompanhamento geral", "Visão consolidada de todas as frentes", `Progresso geral <b>${pg}%</b>`) + `
    <table><thead><tr><th style="width:260px">Frente</th><th>Responsável</th><th>Status</th><th>Progresso / semana</th><th class="num">Ativ.</th><th>Em execução na ${spNome(spAtual)}</th><th>Próximo marco</th><th class="num">Bloq.</th></tr></thead>
    <tbody>${linhasGeral}</tbody></table>`);

  /* Frentes */
  const TLW = 1280 - 88 - 2 - 420;
  const xDe = dt => (dt - J0) / (J1 - J0) * TLW;
  const fimX = s => xDe(new Date(s.f.getTime() + DIA));
  function gantt(lista){
    const semanas = []; for (let t = J0.getTime(); t < J1.getTime(); t += 7*DIA) semanas.push(new Date(t));
    const head = `<div class="g-row g-head" style="height:54px"><div class="g-lbl"><span class="nm">Atividade</span><span class="s">Status</span><span class="p">%</span></div><div class="g-tl">
      ${janela.map((s, k) => { const w = fimX(s) - xDe(s.i); const novoQ = k > 0 && s.trimestre !== janela[k-1].trimestre;
        return `<div class="sp-cell ${s.inicio === spAtual.inicio ? "cur" : ""} ${novoQ ? "q" : ""}" style="left:${xDe(s.i)}px;width:${w}px">${w < 80 ? "S" + s.numero : spNome(s)}<small>${w < 80 ? spQ(s) : spQ(s) + " · " + fmt(s.i) + "–" + fmt(s.f)}</small></div>`; }).join("")}
      ${semanas.map(w => `<div class="wk-cell" style="left:${xDe(w)}px;width:${xDe(new Date(w.getTime()+7*DIA)) - xDe(w)}px">${fmt(w)}</div>`).join("")}
      </div></div>`;
    const ROWH = 40;
    const rows = lista.map(a => {
      const ini = d(a.inicio), fim = new Date(d(a.fim).getTime() + DIA);
      let tl = "";
      if (a.marco){
        if (ini >= J0 && ini < J1) tl = `<div class="ms" style="left:${xDe(ini)}px"></div><div class="ms-lbl" style="left:${xDe(ini)+12}px">${fmt(ini)}</div>`;
        else tl = `<div class="ms-lbl" style="${ini < J0 ? "left:6px" : "right:6px"}">${ini < J0 ? "◂ " : ""}${fmt(ini)}${ini >= J1 ? " ▸" : ""}</div>`;
      } else if (fim > J0 && ini < J1){
        const x0 = Math.max(0, xDe(ini)), x1 = Math.min(TLW, xDe(fim));
        const cls = (ini < J0 ? " cut-l" : "") + (fim > J1 ? " cut-r" : "") + (a._st === "Bloqueado" ? " blk" : "");
        const doneW = Math.max(0, Math.min(x1, xDe(ini) + (xDe(fim) - xDe(ini)) * a.pct/100) - x0);
        tl = `<div class="bar${cls}" style="left:${x0}px;width:${x1-x0}px" data-tip="<b>${esc(a.nome)}</b><br>${fmt(a.inicio)} a ${fmt(a.fim)} · ${a.pct}% concluído<br>Status: ${a._st}${a.status ? " (manual)" : ""}"><div class="done" style="width:${doneW}px;${a._st === "Bloqueado" ? "background:var(--critical)" : ""}"></div></div>`;
      } else {
        tl = `<div class="ms-lbl" style="${ini < J0 ? "left:6px" : "right:6px"}">${ini < J0 ? "◂ até " + fmt(a.fim) : "a partir de " + fmt(a.inicio) + " ▸"}</div>`;
      }
      return `<div class="g-row" style="height:${ROWH}px"><div class="g-lbl"><span class="nm" title="${esc(a.nome)}">${a.marco ? "◆ " : ""}${esc(a.nome)}</span><span class="s">${a.marco ? `<span class="st muted">Marco</span>` : stHtml(a._st)}</span><span class="p">${a.marco ? "" : a.pct + "%"}</span></div><div class="g-tl">${tl}</div></div>`;
    }).join("");
    const bgs = janela.map(s => `<div class="col-bg ${s.inicio === spAtual.inicio ? "cur" : ""}" style="left:${420 + xDe(s.i)}px;width:${fimX(s) - xDe(s.i)}px;top:54px"></div>`).join("");
    const hoje = `<div class="today" style="left:${420 + xDe(HOJE)}px;top:54px"><span>hoje ${fmt(HOJE)}</span></div>`;
    return `<div class="gantt">${bgs}${head}${rows}${hoje}</div>
      <div class="legend"><span><span class="sw" style="background:var(--bar)"></span>Realizado</span><span><span class="sw" style="background:var(--bar-rest)"></span>Planejado</span><span><span class="sw" style="background:repeating-linear-gradient(45deg,#f3c9c9 0 3px,#fbeaea 3px 6px)"></span>Bloqueado</span><span>◆ Marco</span><span><b style="color:var(--hoje)">│</b> Hoje</span><span>Coluna destacada = sprint atual</span></div>`;
  }
  partes.frente = {};
  frentes.forEach(f => partes.frente[f.id] = (() => {
    const lista = atividades.filter(a => a.frente === f.id).sort((a,b) => (a.marco - b.marco) || (d(a.inicio) - d(b.inicio)));
    const ts = lista.filter(a => !a.marco);
    const bl = bloqueios.filter(b => b.frente === f.id);
    return slide(cab(esc(f.nome), `${esc(f.objetivo)} · Responsável: ${esc(f.responsavel)}`,
        `<div class="frente-meta"><span class="pill">${stHtml(statusFrente(ts))}</span><span class="pill">${barraProg(progresso(ts,"pct"), progresso(ts,"pctAnterior"))}</span></div>`) +
      gantt(lista.slice(0, 9)) + `
      <div class="bottom2">
        <div class="box"><h3>Em execução na ${spNome(spAtual)}</h3><ul>${naSprint(ts).map(a => `<li>${esc(a.nome)} <small>· até ${fmt(a.fim)} · ${a.pct}%</small></li>`).join("") || "<li class='muted'>Nenhuma atividade</li>"}</ul></div>
        <div class="box"><h3>Bloqueios e dependências</h3><ul>${bl.map(b => `<li>${stHtml(CRIT[b.criticidade] || "Atenção", b.criticidade)} <b>${esc(b.descricao)}</b> <small>· ${esc(b.area)} · desde ${b.desde ? fmt(b.desde) : "—"}</small></li>`).join("") || "<li class='muted'>Sem bloqueios</li>"}</ul></div>
      </div>`);
  })());

  /* Bloqueios consolidados */
  const ordem = { "Alta":0, "Média":1, "Baixa":2 };
  partes.bloqueios = slide(cab("Dependências e bloqueios", "O que depende de outras áreas e o que precisamos da diretoria", `${bloqueios.length} itens ativos`) + `
    <table><thead><tr><th style="width:96px">Criticidade</th><th style="width:270px">Bloqueio / dependência</th><th>Área</th><th class="num">Desde</th><th>Impacto</th><th style="width:230px">Pedido / ação</th></tr></thead><tbody>
    ${[...bloqueios].sort((a,b) => (ordem[a.criticidade] ?? 9) - (ordem[b.criticidade] ?? 9)).map(b => {
      const f = frentes.find(x => x.id === b.frente);
      return `<tr><td>${stHtml(CRIT[b.criticidade] || "Atenção", b.criticidade)}</td>
        <td><b>${esc(b.descricao)}</b><div class="muted" style="font-size:12.5px">${esc(f ? f.nome : "")}</div></td><td>${esc(b.area)}</td>
        <td class="num">${b.desde ? fmt(b.desde) : "—"}<div class="muted" style="font-size:12px">${b.desde ? Math.max(0, Math.round((HOJE - d(b.desde))/DIA)) + " dias" : ""}</div></td>
        <td style="font-size:13px">${esc(b.impacto)}</td><td style="font-size:13px"><b>${esc(b.pedido)}</b></td></tr>`; }).join("") || `<tr><td colspan="6" class="muted">Sem bloqueios ativos</td></tr>`}
    </tbody></table>`);

  /* Comunicação geral (opcional) */
  /* Comunicações (vários slides, cada um com sua posição) */
  const comSlide = c => slide(cab(esc(c.titulo || "Comunicação geral"), esc(c.subtitulo || "")) +
    `<div class="com"><div class="txt">${texto(c.texto)}</div>${img(c.imagem) ? `<div class="pic"><img src="${img(c.imagem)}" alt=""></div>` : ""}</div>`);
  const ordemSlides = sequencia(D).map(it => it.tipo === "com" ? comSlide(D.comunicacoes[it.idx]) : it.tipo === "frente" ? partes.frente[it.id] : partes[it.tipo]);
  let n = 0;
  const corpo = ordemSlides.join("").replace(/\{\{N\}\}/g, () => ++n + 1);
  return documento(`${C.titulo} – ${fmt(HOJE, true)}`, corpo, cssTema(paleta(C.cores)));
}

return { gerar, sequencia, ancoras, paleta, TEMAS, statusDe, sprintAtual, gerarSprintsTrimestre, spCompleto, STATUS };
})();
if (typeof module !== "undefined") module.exports = Report;
