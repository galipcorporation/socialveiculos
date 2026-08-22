import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import { Link, Routes, Route, StaticRouter } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { useState, useEffect, useMemo } from "react";
const API_BASE = "/v1/public/site";
async function fetchSitePublico(host) {
  try {
    const res = await fetch(`${API_BASE}/${host}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
async function fetchEstoqueLoja(lojaSlug) {
  try {
    const res = await fetch(`/v1/marketplace/loja/${lojaSlug}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.veiculos || [];
  } catch {
    return [];
  }
}
async function enviarLead(payload) {
  try {
    const res = await fetch(`${API_BASE}/lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.ok;
  } catch {
    return false;
  }
}
function getSSGData() {
  const g = globalThis;
  return g.__SSG_DATA__ ?? null;
}
function SiteHeader({ dados }) {
  return /* @__PURE__ */ jsx("header", { className: "site-header", children: /* @__PURE__ */ jsxs("div", { className: "site-header-inner", children: [
    /* @__PURE__ */ jsx(Link, { to: "/", style: { display: "flex", alignItems: "center", gap: 10 }, children: dados.site.logo_url ? /* @__PURE__ */ jsx("img", { src: dados.site.logo_url, alt: dados.loja.nome, className: "site-header-logo" }) : /* @__PURE__ */ jsx("span", { className: "site-header-nome", children: dados.loja.nome }) }),
    /* @__PURE__ */ jsxs("nav", { className: "site-header-nav", children: [
      /* @__PURE__ */ jsx(Link, { to: "/", children: "Início" }),
      /* @__PURE__ */ jsx(Link, { to: "/estoque", children: "Estoque" }),
      dados.site.sobre_texto && /* @__PURE__ */ jsx(Link, { to: "/sobre", children: "Sobre" }),
      /* @__PURE__ */ jsx(Link, { to: "/financiamento", children: "Financiamento" }),
      /* @__PURE__ */ jsx(Link, { to: "/contato", children: "Contato" })
    ] })
  ] }) });
}
function SiteFooter({ dados }) {
  return /* @__PURE__ */ jsx("footer", { className: "site-footer", children: /* @__PURE__ */ jsxs("div", { className: "site-container", style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }, children: [
    /* @__PURE__ */ jsxs("div", { children: [
      /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: 16, color: "#fff" }, children: dados.loja.nome }),
      dados.loja.cidade && /* @__PURE__ */ jsxs("div", { style: { fontSize: 12, opacity: 0.75, marginTop: 3 }, children: [
        dados.loja.cidade,
        dados.loja.estado ? ` - ${dados.loja.estado}` : "",
        dados.loja.whatsapp && ` · WhatsApp: ${dados.loja.whatsapp}`
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { style: { fontSize: 13, opacity: 0.85, textAlign: "right" }, children: [
      "© ",
      (/* @__PURE__ */ new Date()).getFullYear(),
      " ",
      dados.loja.nome,
      ". Todos os direitos reservados."
    ] })
  ] }) });
}
function formatBRL$1(v) {
  if (v == null) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function Hero({ dados }) {
  const { site } = dados;
  const titulo = site.hero_titulo || dados.loja.nome;
  const subtitulo = site.hero_subtitulo || "Confira nosso estoque de veículos selecionados com garantia e procedência.";
  const cta = site.hero_cta || "Ver estoque";
  if (site.template === "premium") {
    return /* @__PURE__ */ jsxs(
      "section",
      {
        className: "site-hero-premium",
        style: site.banner_url ? { backgroundImage: `url(${site.banner_url})` } : void 0,
        children: [
          /* @__PURE__ */ jsx("h1", { className: "site-hero-titulo", children: titulo }),
          /* @__PURE__ */ jsx("p", { className: "site-hero-subtitulo", children: subtitulo }),
          /* @__PURE__ */ jsx(Link, { to: "/estoque", className: "site-hero-cta", children: cta })
        ]
      }
    );
  }
  if (site.template === "compacto") {
    return /* @__PURE__ */ jsx("section", { className: "site-hero-compacto", children: /* @__PURE__ */ jsxs("div", { className: "site-container", children: [
      /* @__PURE__ */ jsx("h1", { className: "site-hero-titulo", children: titulo }),
      /* @__PURE__ */ jsx("p", { className: "site-hero-subtitulo", children: subtitulo }),
      /* @__PURE__ */ jsx(Link, { to: "/estoque", className: "site-hero-cta", style: { marginTop: 16, display: "inline-block" }, children: cta })
    ] }) });
  }
  return /* @__PURE__ */ jsx("section", { className: "site-hero", children: /* @__PURE__ */ jsxs("div", { className: "site-container", children: [
    /* @__PURE__ */ jsx("h1", { className: "site-hero-titulo", children: titulo }),
    /* @__PURE__ */ jsx("p", { className: "site-hero-subtitulo", children: subtitulo }),
    /* @__PURE__ */ jsx(Link, { to: "/estoque", className: "site-hero-cta", children: cta })
  ] }) });
}
function Home({ dados }) {
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetchEstoqueLoja(dados.loja.slug).then((v) => {
      setVeiculos(v || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dados.loja.slug]);
  const destaques = veiculos.slice(0, 6);
  const telLimpo = (dados.loja.whatsapp || "").replace(/\D/g, "");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SiteHeader, { dados }),
    /* @__PURE__ */ jsx(Hero, { dados }),
    /* @__PURE__ */ jsxs("div", { className: "site-container", children: [
      /* @__PURE__ */ jsxs("section", { className: "site-section", children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24, flexWrap: "wrap", gap: 12 }, children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h2", { className: "site-section-titulo", style: { margin: 0 }, children: "Nosso Estoque" }),
            /* @__PURE__ */ jsx("p", { style: { color: "var(--site-text-dim)", fontSize: 14, margin: "4px 0 0" }, children: "Veículos inspecionados, revisados e prontos para entrega." })
          ] }),
          veiculos.length > 0 && /* @__PURE__ */ jsxs(Link, { to: "/estoque", style: { color: "var(--site-primary)", fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 4 }, children: [
            "Ver todos (",
            veiculos.length,
            ") →"
          ] })
        ] }),
        loading ? /* @__PURE__ */ jsx("p", { className: "site-empty", children: "Carregando catálogo de veículos…" }) : veiculos.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "site-empty", style: { background: "var(--site-surface)", borderRadius: "var(--site-radius)", border: "1px solid var(--site-border)", padding: 40 }, children: [
          /* @__PURE__ */ jsx("p", { style: { fontWeight: 600, fontSize: 16, marginBottom: 4 }, children: "Nenhum veículo publicado no momento." }),
          /* @__PURE__ */ jsx("p", { style: { fontSize: 13, color: "var(--site-text-dim)", margin: 0 }, children: "Novas opções estão sendo preparadas e estarão disponíveis em breve." })
        ] }) : /* @__PURE__ */ jsx("div", { className: "site-estoque-grid", children: destaques.map((v) => {
          var _a, _b;
          const foto = (_b = (_a = v.midias) == null ? void 0 : _a[0]) == null ? void 0 : _b.url;
          const msgWhats = encodeURIComponent(`Olá! Vi o anúncio do ${v.marca} ${v.modelo} ${v.ano_modelo || ""} no site e gostaria de mais informações.`);
          const linkWhats = telLimpo ? `https://wa.me/55${telLimpo}?text=${msgWhats}` : null;
          return /* @__PURE__ */ jsxs("div", { className: "site-card", children: [
            foto ? /* @__PURE__ */ jsx("img", { src: foto, alt: `${v.marca} ${v.modelo}`, className: "site-card-img" }) : /* @__PURE__ */ jsx("div", { className: "site-card-img", style: { display: "flex", alignItems: "center", justifyContent: "center", color: "var(--site-text-dim)", fontSize: 13 }, children: "Foto do Veículo" }),
            /* @__PURE__ */ jsxs("div", { className: "site-card-body", children: [
              /* @__PURE__ */ jsxs("div", { className: "site-card-titulo", children: [
                v.marca,
                " ",
                v.modelo
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "site-card-info", children: [
                v.ano_fabricacao,
                "/",
                v.ano_modelo,
                v.km != null && ` · ${v.km.toLocaleString("pt-BR")} km`,
                v.cor && ` · ${v.cor}`
              ] }),
              /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }, children: [
                /* @__PURE__ */ jsx("div", { className: "site-card-preco", children: formatBRL$1(v.preco_venda) || "Consulte" }),
                linkWhats && /* @__PURE__ */ jsx(
                  "a",
                  {
                    href: linkWhats,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    className: "site-card-btn-whats",
                    title: "Conversar no WhatsApp",
                    children: "Proposta"
                  }
                )
              ] })
            ] })
          ] }, v.id);
        }) }),
        veiculos.length > 6 && /* @__PURE__ */ jsx("div", { style: { textAlign: "center", marginTop: 16 }, children: /* @__PURE__ */ jsxs(Link, { to: "/estoque", className: "site-hero-cta", children: [
          "Ver todo o estoque (",
          veiculos.length,
          " veículos)"
        ] }) })
      ] }),
      dados.site.sobre_texto && /* @__PURE__ */ jsxs("section", { className: "site-section", children: [
        /* @__PURE__ */ jsx("h2", { className: "site-section-titulo", children: "Sobre nós" }),
        /* @__PURE__ */ jsx("p", { style: { color: "var(--site-text-dim)", lineHeight: 1.7, fontSize: 15 }, children: dados.site.sobre_texto })
      ] })
    ] }),
    /* @__PURE__ */ jsx(SiteFooter, { dados })
  ] });
}
function formatBRL(v) {
  if (v == null) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function estoqueJsonLd(veiculos) {
  return {
    "@context": "https://schema.org/",
    "@type": "ItemList",
    itemListElement: veiculos.map((v, i) => {
      var _a, _b;
      return {
        "@type": "Vehicle",
        position: i + 1,
        name: `${v.marca} ${v.modelo}${v.versao ? " " + v.versao : ""} ${v.ano_modelo}`,
        image: ((_b = (_a = v.midias) == null ? void 0 : _a[0]) == null ? void 0 : _b.url) || void 0,
        brand: { "@type": "Brand", name: v.marca },
        model: v.modelo,
        vehicleModelDate: String(v.ano_modelo),
        mileageFromOdometer: v.km != null ? { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" } : void 0,
        offers: {
          "@type": "Offer",
          priceCurrency: "BRL",
          price: v.preco_venda ?? void 0,
          availability: "https://schema.org/InStock"
        }
      };
    })
  };
}
function Estoque({ dados }) {
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");
  const [marca, setMarca] = useState("");
  const [faixaPreco, setFaixaPreco] = useState("");
  const [anoMin, setAnoMin] = useState("");
  const [ordenacao, setOrdenacao] = useState("recentes");
  useEffect(() => {
    fetchEstoqueLoja(dados.loja.slug).then((v) => {
      setVeiculos(v || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [dados.loja.slug]);
  const marcasDisponiveis = useMemo(() => {
    const set = /* @__PURE__ */ new Set();
    veiculos.forEach((v) => {
      if (v.marca) set.add(v.marca);
    });
    return Array.from(set).sort();
  }, [veiculos]);
  const veiculosFiltrados = useMemo(() => {
    return veiculos.filter((v) => {
      if (busca.trim()) {
        const t = busca.toLowerCase();
        const match = v.marca && v.marca.toLowerCase().includes(t) || v.modelo && v.modelo.toLowerCase().includes(t) || v.versao && v.versao.toLowerCase().includes(t) || v.cor && v.cor.toLowerCase().includes(t);
        if (!match) return false;
      }
      if (marca && v.marca !== marca) return false;
      if (anoMin && (v.ano_modelo || v.ano_fabricacao || 0) < Number(anoMin)) return false;
      if (faixaPreco) {
        const p = v.preco_venda || 0;
        if (faixaPreco === "ate_50k" && p > 5e4) return false;
        if (faixaPreco === "50k_100k" && (p < 5e4 || p > 1e5)) return false;
        if (faixaPreco === "100k_150k" && (p < 1e5 || p > 15e4)) return false;
        if (faixaPreco === "acima_150k" && p < 15e4) return false;
      }
      return true;
    }).sort((a, b) => {
      if (ordenacao === "menor_preco") return (a.preco_venda || 0) - (b.preco_venda || 0);
      if (ordenacao === "maior_preco") return (b.preco_venda || 0) - (a.preco_venda || 0);
      if (ordenacao === "menor_km") return (a.km || 0) - (b.km || 0);
      return (b.ano_modelo || 0) - (a.ano_modelo || 0);
    });
  }, [veiculos, busca, marca, faixaPreco, anoMin, ordenacao]);
  const limparFiltros = () => {
    setBusca("");
    setMarca("");
    setFaixaPreco("");
    setAnoMin("");
    setOrdenacao("recentes");
  };
  const temFiltroAtivo = !!busca || !!marca || !!faixaPreco || !!anoMin || ordenacao !== "recentes";
  const telLimpo = (dados.loja.whatsapp || "").replace(/\D/g, "");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    veiculos.length > 0 && /* @__PURE__ */ jsx(Helmet, { children: /* @__PURE__ */ jsx("script", { type: "application/ld+json", children: JSON.stringify(estoqueJsonLd(veiculos)) }) }),
    /* @__PURE__ */ jsx(SiteHeader, { dados }),
    /* @__PURE__ */ jsx("div", { className: "site-container", children: /* @__PURE__ */ jsxs("section", { className: "site-section", style: { borderTop: "none", paddingTop: 32 }, children: [
      /* @__PURE__ */ jsxs("div", { style: { marginBottom: 24 }, children: [
        /* @__PURE__ */ jsx("h1", { className: "site-section-titulo", style: { fontSize: 28, marginBottom: 6 }, children: "Estoque de Veículos" }),
        /* @__PURE__ */ jsxs("p", { style: { color: "var(--site-text-dim)", fontSize: 15, margin: 0 }, children: [
          "Confira todos os veículos disponíveis na ",
          dados.loja.nome,
          "."
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "site-filtros-bar", children: [
        /* @__PURE__ */ jsxs("div", { className: "site-filtro-item", style: { flex: "2 1 220px" }, children: [
          /* @__PURE__ */ jsx("label", { children: "Buscar" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              placeholder: "Ex: Onix, Compass, automático...",
              value: busca,
              onChange: (e) => setBusca(e.target.value),
              className: "site-filtro-input"
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-filtro-item", children: [
          /* @__PURE__ */ jsx("label", { children: "Marca" }),
          /* @__PURE__ */ jsxs("select", { value: marca, onChange: (e) => setMarca(e.target.value), className: "site-filtro-select", children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Todas as marcas" }),
            marcasDisponiveis.map((m) => /* @__PURE__ */ jsx("option", { value: m, children: m }, m))
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-filtro-item", children: [
          /* @__PURE__ */ jsx("label", { children: "Faixa de Preço" }),
          /* @__PURE__ */ jsxs("select", { value: faixaPreco, onChange: (e) => setFaixaPreco(e.target.value), className: "site-filtro-select", children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Qualquer valor" }),
            /* @__PURE__ */ jsx("option", { value: "ate_50k", children: "Até R$ 50.000" }),
            /* @__PURE__ */ jsx("option", { value: "50k_100k", children: "R$ 50.000 a R$ 100.000" }),
            /* @__PURE__ */ jsx("option", { value: "100k_150k", children: "R$ 100.000 a R$ 150.000" }),
            /* @__PURE__ */ jsx("option", { value: "acima_150k", children: "Acima de R$ 150.000" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-filtro-item", children: [
          /* @__PURE__ */ jsx("label", { children: "Ano Mínimo" }),
          /* @__PURE__ */ jsxs("select", { value: anoMin, onChange: (e) => setAnoMin(e.target.value), className: "site-filtro-select", children: [
            /* @__PURE__ */ jsx("option", { value: "", children: "Qualquer ano" }),
            /* @__PURE__ */ jsx("option", { value: "2024", children: "2024 ou mais novo" }),
            /* @__PURE__ */ jsx("option", { value: "2022", children: "2022 ou mais novo" }),
            /* @__PURE__ */ jsx("option", { value: "2020", children: "2020 ou mais novo" }),
            /* @__PURE__ */ jsx("option", { value: "2018", children: "2018 ou mais novo" }),
            /* @__PURE__ */ jsx("option", { value: "2015", children: "2015 ou mais novo" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-filtro-item", children: [
          /* @__PURE__ */ jsx("label", { children: "Ordenar por" }),
          /* @__PURE__ */ jsxs("select", { value: ordenacao, onChange: (e) => setOrdenacao(e.target.value), className: "site-filtro-select", children: [
            /* @__PURE__ */ jsx("option", { value: "recentes", children: "Mais recentes" }),
            /* @__PURE__ */ jsx("option", { value: "menor_preco", children: "Menor preço" }),
            /* @__PURE__ */ jsx("option", { value: "maior_preco", children: "Maior preço" }),
            /* @__PURE__ */ jsx("option", { value: "menor_km", children: "Menor quilometragem" })
          ] })
        ] }),
        temFiltroAtivo && /* @__PURE__ */ jsx("div", { style: { display: "flex", alignItems: "flex-end" }, children: /* @__PURE__ */ jsx("button", { type: "button", onClick: limparFiltros, className: "site-filtro-btn-limpar", children: "Limpar" }) })
      ] }),
      /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, fontSize: 14, color: "var(--site-text-dim)" }, children: /* @__PURE__ */ jsxs("span", { children: [
        "Mostrando ",
        /* @__PURE__ */ jsx("strong", { children: veiculosFiltrados.length }),
        " ",
        veiculosFiltrados.length === 1 ? "veículo" : "veículos"
      ] }) }),
      loading ? /* @__PURE__ */ jsx("p", { className: "site-empty", children: "Carregando catálogo de veículos…" }) : veiculosFiltrados.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "site-empty", style: { background: "var(--site-surface)", borderRadius: "var(--site-radius)", border: "1px solid var(--site-border)", padding: 48 }, children: [
        /* @__PURE__ */ jsx("p", { style: { fontWeight: 600, fontSize: 16, marginBottom: 6 }, children: "Nenhum veículo encontrado com os filtros selecionados." }),
        temFiltroAtivo && /* @__PURE__ */ jsx("button", { type: "button", onClick: limparFiltros, className: "site-hero-cta", style: { marginTop: 12, padding: "8px 18px", fontSize: 13 }, children: "Limpar Filtros" })
      ] }) : /* @__PURE__ */ jsx("div", { className: "site-estoque-grid", children: veiculosFiltrados.map((v) => {
        var _a, _b;
        const foto = (_b = (_a = v.midias) == null ? void 0 : _a[0]) == null ? void 0 : _b.url;
        const msgWhats = encodeURIComponent(`Olá! Vi o anúncio do ${v.marca} ${v.modelo} ${v.ano_modelo || ""} no site e gostaria de mais informações.`);
        const linkWhats = telLimpo ? `https://wa.me/55${telLimpo}?text=${msgWhats}` : null;
        return /* @__PURE__ */ jsxs("div", { className: "site-card", children: [
          foto ? /* @__PURE__ */ jsx("img", { src: foto, alt: `${v.marca} ${v.modelo}`, className: "site-card-img" }) : /* @__PURE__ */ jsx("div", { className: "site-card-img", style: { display: "flex", alignItems: "center", justifyContent: "center", color: "var(--site-text-dim)", fontSize: 13 }, children: "Foto do Veículo" }),
          /* @__PURE__ */ jsxs("div", { className: "site-card-body", children: [
            /* @__PURE__ */ jsxs("div", { className: "site-card-titulo", children: [
              v.marca,
              " ",
              v.modelo
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "site-card-info", children: [
              v.ano_fabricacao,
              "/",
              v.ano_modelo,
              v.km != null && ` · ${v.km.toLocaleString("pt-BR")} km`,
              v.cor && ` · ${v.cor}`
            ] }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }, children: [
              /* @__PURE__ */ jsx("div", { className: "site-card-preco", children: formatBRL(v.preco_venda) || "Consulte" }),
              linkWhats && /* @__PURE__ */ jsx(
                "a",
                {
                  href: linkWhats,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className: "site-card-btn-whats",
                  title: "Conversar no WhatsApp",
                  children: "Proposta"
                }
              )
            ] })
          ] })
        ] }, v.id);
      }) })
    ] }) }),
    /* @__PURE__ */ jsx(SiteFooter, { dados })
  ] });
}
function mascararTelefone(val) {
  const limpo = val.replace(/\D/g, "");
  if (limpo.length <= 10) {
    return limpo.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2").substring(0, 14);
  }
  return limpo.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2").substring(0, 15);
}
function validarTelefone(val) {
  const limpo = (val || "").replace(/\D/g, "");
  return limpo.length === 10 || limpo.length === 11;
}
function validarEmail(val) {
  if (!val) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
}
function Contato({ dados }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(false);
  const [erroValidacao, setErroValidacao] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setErroValidacao("");
    if (!validarTelefone(telefone)) {
      setErroValidacao("Informe um telefone válido com DDD (ex.: (11) 98765-4321).");
      return;
    }
    if (email && !validarEmail(email)) {
      setErroValidacao("Informe um e-mail válido.");
      return;
    }
    setEnviando(true);
    setErro(false);
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const ok = await enviarLead({ host, nome, telefone, email: email || void 0, mensagem: mensagem || void 0 });
    setEnviando(false);
    if (ok) {
      setEnviado(true);
      setNome("");
      setTelefone("");
      setEmail("");
      setMensagem("");
    } else {
      setErro(true);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SiteHeader, { dados }),
    /* @__PURE__ */ jsx("div", { className: "site-container", children: /* @__PURE__ */ jsxs("section", { className: "site-section", style: { borderTop: "none", maxWidth: 480 }, children: [
      /* @__PURE__ */ jsx("h2", { className: "site-section-titulo", children: "Fale conosco" }),
      enviado ? /* @__PURE__ */ jsx("p", { children: "Recebemos sua mensagem! Em breve entraremos em contato." }) : /* @__PURE__ */ jsxs("form", { onSubmit: submit, children: [
        erro && /* @__PURE__ */ jsx("p", { style: { color: "var(--site-error, #ef4444)", marginBottom: 12 }, children: "Não foi possível enviar. Tente novamente." }),
        erroValidacao && /* @__PURE__ */ jsx("p", { style: { color: "var(--site-error, #ef4444)", marginBottom: 12 }, children: erroValidacao }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Nome" }),
          /* @__PURE__ */ jsx("input", { value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2 })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Telefone / WhatsApp" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: telefone,
              onChange: (e) => setTelefone(mascararTelefone(e.target.value)),
              required: true,
              inputMode: "tel",
              placeholder: "(11) 98765-4321",
              maxLength: 15
            }
          )
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "E-mail (opcional)" }),
          /* @__PURE__ */ jsx("input", { type: "email", value: email, onChange: (e) => setEmail(e.target.value) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Mensagem (opcional)" }),
          /* @__PURE__ */ jsx("textarea", { rows: 4, value: mensagem, onChange: (e) => setMensagem(e.target.value) })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "site-form-submit", disabled: enviando, children: enviando ? "Enviando…" : "Enviar mensagem" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(SiteFooter, { dados })
  ] });
}
function Sobre({ dados }) {
  const { site, loja } = dados;
  const local = [loja.cidade, loja.estado].filter(Boolean).join(" - ");
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SiteHeader, { dados }),
    /* @__PURE__ */ jsx("div", { className: "site-container", children: /* @__PURE__ */ jsxs("section", { className: "site-section", style: { borderTop: "none" }, children: [
      /* @__PURE__ */ jsxs("h2", { className: "site-section-titulo", children: [
        "Sobre ",
        loja.nome
      ] }),
      site.sobre_texto ? /* @__PURE__ */ jsx("p", { children: site.sobre_texto }) : /* @__PURE__ */ jsx("p", { className: "site-empty", children: "Loja ainda não adicionou uma descrição." }),
      /* @__PURE__ */ jsxs("ul", { style: { marginTop: 24, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }, children: [
        local && /* @__PURE__ */ jsxs("li", { children: [
          "📍 ",
          local
        ] }),
        loja.verificada && /* @__PURE__ */ jsx("li", { children: "✅ Loja verificada" }),
        typeof loja.total_veiculos === "number" && /* @__PURE__ */ jsxs("li", { children: [
          "🚗 ",
          loja.total_veiculos,
          " veículo(s) disponível(is)"
        ] }),
        loja.whatsapp && /* @__PURE__ */ jsxs("li", { children: [
          "📞 ",
          loja.whatsapp
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(SiteFooter, { dados })
  ] });
}
function Financiamento({ dados }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(false);
  const [erroValidacao, setErroValidacao] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setErroValidacao("");
    if (!validarTelefone(telefone)) {
      setErroValidacao("Informe um telefone válido com DDD (ex.: (11) 98765-4321).");
      return;
    }
    setEnviando(true);
    setErro(false);
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    const ok = await enviarLead({
      host,
      nome,
      telefone,
      mensagem: "Interesse em financiamento — solicitado pela página Financiamento do site."
    });
    setEnviando(false);
    if (ok) {
      setEnviado(true);
      setNome("");
      setTelefone("");
    } else {
      setErro(true);
    }
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SiteHeader, { dados }),
    /* @__PURE__ */ jsx("div", { className: "site-container", children: /* @__PURE__ */ jsxs("section", { className: "site-section", style: { borderTop: "none", maxWidth: 480 }, children: [
      /* @__PURE__ */ jsx("h2", { className: "site-section-titulo", children: "Financiamento" }),
      /* @__PURE__ */ jsxs("p", { children: [
        "Deixe seus dados que a equipe da ",
        dados.loja.nome,
        " entra em contato com as condições de financiamento disponíveis."
      ] }),
      enviado ? /* @__PURE__ */ jsx("p", { style: { marginTop: 16 }, children: "Recebemos seu interesse! Em breve entraremos em contato." }) : /* @__PURE__ */ jsxs("form", { onSubmit: submit, style: { marginTop: 16 }, children: [
        erro && /* @__PURE__ */ jsx("p", { style: { color: "var(--site-error, #ef4444)", marginBottom: 12 }, children: "Não foi possível enviar. Tente novamente." }),
        erroValidacao && /* @__PURE__ */ jsx("p", { style: { color: "var(--site-error, #ef4444)", marginBottom: 12 }, children: erroValidacao }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Nome" }),
          /* @__PURE__ */ jsx("input", { value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2 })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Telefone / WhatsApp" }),
          /* @__PURE__ */ jsx(
            "input",
            {
              value: telefone,
              onChange: (e) => setTelefone(mascararTelefone(e.target.value)),
              required: true,
              inputMode: "tel",
              placeholder: "(11) 98765-4321",
              maxLength: 15
            }
          )
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "site-form-submit", disabled: enviando, children: enviando ? "Enviando…" : "Quero saber mais" })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(SiteFooter, { dados })
  ] });
}
function NaoEncontrado() {
  return /* @__PURE__ */ jsxs("div", { className: "site-empty", children: [
    /* @__PURE__ */ jsx("h1", { style: { fontSize: 24, marginBottom: 8 }, children: "Site não encontrado" }),
    /* @__PURE__ */ jsx("p", { children: "Este site não existe ou ainda não foi publicado." })
  ] });
}
function autoDealerJsonLd(dados) {
  const { site, loja } = dados;
  const local = [loja.cidade, loja.estado].filter(Boolean).join(" - ");
  return {
    "@context": "https://schema.org/",
    "@type": "AutoDealer",
    name: loja.nome,
    image: site.logo_url || site.og_image_url || void 0,
    address: local || void 0,
    telephone: loja.whatsapp || void 0,
    url: typeof window !== "undefined" ? window.location.origin : void 0
  };
}
function getHost() {
  if (typeof window !== "undefined") return window.location.hostname;
  const g = globalThis;
  return g.__SITE_HOST__ || "";
}
function App() {
  const ssg = getSSGData();
  const [dados, setDados] = useState(ssg);
  const [loading, setLoading] = useState(!ssg);
  useEffect(() => {
    if (ssg) return;
    const host = getHost();
    fetchSitePublico(host).then((res) => {
      setDados(res);
      setLoading(false);
    });
  }, [ssg]);
  useEffect(() => {
    if (dados == null ? void 0 : dados.site.cor_primaria) {
      document.documentElement.style.setProperty("--site-primary", dados.site.cor_primaria);
    }
    if (dados == null ? void 0 : dados.site.cor_secundaria) {
      document.documentElement.style.setProperty("--site-secondary", dados.site.cor_secundaria);
    }
  }, [dados]);
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "site-empty", children: "Carregando…" });
  }
  if (!dados) {
    return /* @__PURE__ */ jsx(NaoEncontrado, {});
  }
  const titulo = dados.site.seo_title || dados.loja.nome;
  const descricao = dados.site.seo_description || void 0;
  const imagem = dados.site.og_image_url || dados.site.logo_url || void 0;
  const ga4Id = /^(G|GT|AW|UA|GTM)-[A-Z0-9-]{4,20}$/.test(dados.site.ga4_id || "") ? dados.site.ga4_id : null;
  const metaPixelId = /^\d{5,20}$/.test(dados.site.meta_pixel_id || "") ? dados.site.meta_pixel_id : null;
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs(Helmet, { children: [
      /* @__PURE__ */ jsx("title", { children: titulo }),
      descricao && /* @__PURE__ */ jsx("meta", { name: "description", content: descricao }),
      dados.site.favicon_url && /* @__PURE__ */ jsx("link", { rel: "icon", href: dados.site.favicon_url }),
      /* @__PURE__ */ jsx("meta", { property: "og:type", content: "website" }),
      /* @__PURE__ */ jsx("meta", { property: "og:title", content: titulo }),
      descricao && /* @__PURE__ */ jsx("meta", { property: "og:description", content: descricao }),
      imagem && /* @__PURE__ */ jsx("meta", { property: "og:image", content: imagem }),
      /* @__PURE__ */ jsx("meta", { name: "twitter:card", content: "summary_large_image" }),
      ga4Id && /* @__PURE__ */ jsx(
        "script",
        {
          type: "text/javascript",
          dangerouslySetInnerHTML: {
            __html: `(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${ga4Id}';document.head.appendChild(s);})();window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${ga4Id}');`
          }
        }
      ),
      metaPixelId && /* @__PURE__ */ jsx(
        "script",
        {
          type: "text/javascript",
          dangerouslySetInnerHTML: {
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixelId}');fbq('track','PageView');`
          }
        }
      ),
      /* @__PURE__ */ jsx("script", { type: "application/ld+json", children: JSON.stringify(autoDealerJsonLd(dados)) })
    ] }),
    /* @__PURE__ */ jsxs(Routes, { children: [
      /* @__PURE__ */ jsx(Route, { path: "/", element: /* @__PURE__ */ jsx(Home, { dados }) }),
      /* @__PURE__ */ jsx(Route, { path: "/estoque", element: /* @__PURE__ */ jsx(Estoque, { dados }) }),
      /* @__PURE__ */ jsx(Route, { path: "/sobre", element: /* @__PURE__ */ jsx(Sobre, { dados }) }),
      /* @__PURE__ */ jsx(Route, { path: "/financiamento", element: /* @__PURE__ */ jsx(Financiamento, { dados }) }),
      /* @__PURE__ */ jsx(Route, { path: "/contato", element: /* @__PURE__ */ jsx(Contato, { dados }) }),
      /* @__PURE__ */ jsx(Route, { path: "*", element: /* @__PURE__ */ jsx(NaoEncontrado, {}) })
    ] })
  ] });
}
function render(url, host, ssgData) {
  globalThis.__SSG_DATA__ = ssgData;
  globalThis.__SITE_HOST__ = host;
  const rendered = renderToString(
    /* @__PURE__ */ jsx(HelmetProvider, { children: /* @__PURE__ */ jsx(StaticRouter, { location: url, children: /* @__PURE__ */ jsx(App, {}) }) })
  );
  delete globalThis.__SSG_DATA__;
  delete globalThis.__SITE_HOST__;
  const headTags = [];
  const html = rendered.replace(/<title[^>]*>.*?<\/title>/gis, (m) => {
    headTags.push(m);
    return "";
  }).replace(/<meta\b[^>]*\/?>(?:<\/meta>)?/gis, (m) => {
    if (/name="(description|twitter)|property="og:/i.test(m)) {
      headTags.push(m);
      return "";
    }
    return m;
  }).replace(/<link rel="icon"[^>]*\/?>/gis, (m) => {
    headTags.push(m);
    return "";
  }).replace(/<script(?:(?!<\/script>).)*?(?:googletagmanager|gtag\(|fbq\(|application\/ld\+json)(?:(?!<\/script>).)*?<\/script>/gis, (m) => {
    headTags.push(m);
    return "";
  });
  return { html, head: headTags.join("\n    ") };
}
export {
  render
};
