import { jsxs, jsx, Fragment } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import { Link, Routes, Route, StaticRouter } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import { useState, useEffect } from "react";
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
  return /* @__PURE__ */ jsxs("header", { className: "site-header", children: [
    /* @__PURE__ */ jsx(Link, { to: "/", style: { display: "flex", alignItems: "center", gap: 10 }, children: dados.site.logo_url ? /* @__PURE__ */ jsx("img", { src: dados.site.logo_url, alt: dados.loja.nome, className: "site-header-logo" }) : /* @__PURE__ */ jsx("span", { className: "site-header-nome", children: dados.loja.nome }) }),
    /* @__PURE__ */ jsxs("nav", { className: "site-header-nav", children: [
      /* @__PURE__ */ jsx(Link, { to: "/", children: "Início" }),
      /* @__PURE__ */ jsx(Link, { to: "/estoque", children: "Estoque" }),
      dados.site.sobre_texto && /* @__PURE__ */ jsx(Link, { to: "/sobre", children: "Sobre" }),
      /* @__PURE__ */ jsx(Link, { to: "/financiamento", children: "Financiamento" }),
      /* @__PURE__ */ jsx(Link, { to: "/contato", children: "Contato" })
    ] })
  ] });
}
function SiteFooter({ dados }) {
  return /* @__PURE__ */ jsxs("footer", { className: "site-footer", children: [
    "© ",
    (/* @__PURE__ */ new Date()).getFullYear(),
    " ",
    dados.loja.nome,
    ". Todos os direitos reservados."
  ] });
}
function Hero({ dados }) {
  const { site } = dados;
  const titulo = site.hero_titulo || dados.loja.nome;
  const subtitulo = site.hero_subtitulo || "Confira nosso estoque de veículos.";
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
  return /* @__PURE__ */ jsxs("section", { className: "site-hero", children: [
    /* @__PURE__ */ jsx("h1", { className: "site-hero-titulo", children: titulo }),
    /* @__PURE__ */ jsx("p", { className: "site-hero-subtitulo", children: subtitulo }),
    /* @__PURE__ */ jsx(Link, { to: "/estoque", className: "site-hero-cta", children: cta })
  ] });
}
function Home({ dados }) {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(SiteHeader, { dados }),
    /* @__PURE__ */ jsx(Hero, { dados }),
    dados.site.sobre_texto && /* @__PURE__ */ jsx("div", { className: "site-container", children: /* @__PURE__ */ jsxs("section", { className: "site-section", children: [
      /* @__PURE__ */ jsx("h2", { className: "site-section-titulo", children: "Sobre nós" }),
      /* @__PURE__ */ jsx("p", { children: dados.site.sobre_texto })
    ] }) }),
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
  useEffect(() => {
    fetchEstoqueLoja(dados.loja.slug).then((v) => {
      setVeiculos(v);
      setLoading(false);
    });
  }, [dados.loja.slug]);
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    veiculos.length > 0 && /* @__PURE__ */ jsx(Helmet, { children: /* @__PURE__ */ jsx("script", { type: "application/ld+json", children: JSON.stringify(estoqueJsonLd(veiculos)) }) }),
    /* @__PURE__ */ jsx(SiteHeader, { dados }),
    /* @__PURE__ */ jsx("div", { className: "site-container", children: /* @__PURE__ */ jsxs("section", { className: "site-section", style: { borderTop: "none" }, children: [
      /* @__PURE__ */ jsx("h2", { className: "site-section-titulo", children: "Nosso Estoque" }),
      loading ? /* @__PURE__ */ jsx("p", { className: "site-empty", children: "Carregando veículos…" }) : veiculos.length === 0 ? /* @__PURE__ */ jsx("p", { className: "site-empty", children: "Nenhum veículo disponível no momento." }) : /* @__PURE__ */ jsx("div", { className: "site-estoque-grid", children: veiculos.map((v) => {
        var _a, _b;
        return /* @__PURE__ */ jsxs("div", { className: "site-card", children: [
          ((_b = (_a = v.midias) == null ? void 0 : _a[0]) == null ? void 0 : _b.url) ? /* @__PURE__ */ jsx("img", { src: v.midias[0].url, alt: `${v.marca} ${v.modelo}`, className: "site-card-img" }) : /* @__PURE__ */ jsx("div", { className: "site-card-img" }),
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
            formatBRL(v.preco_venda) && /* @__PURE__ */ jsx("div", { className: "site-card-preco", children: formatBRL(v.preco_venda) })
          ] })
        ] }, v.id);
      }) })
    ] }) }),
    /* @__PURE__ */ jsx(SiteFooter, { dados })
  ] });
}
function Contato({ dados }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
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
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Nome" }),
          /* @__PURE__ */ jsx("input", { value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2 })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Telefone / WhatsApp" }),
          /* @__PURE__ */ jsx("input", { value: telefone, onChange: (e) => setTelefone(e.target.value), required: true, minLength: 8 })
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
  const submit = async (e) => {
    e.preventDefault();
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
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Nome" }),
          /* @__PURE__ */ jsx("input", { value: nome, onChange: (e) => setNome(e.target.value), required: true, minLength: 2 })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "site-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Telefone / WhatsApp" }),
          /* @__PURE__ */ jsx("input", { value: telefone, onChange: (e) => setTelefone(e.target.value), required: true, minLength: 8 })
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
      dados.site.ga4_id && /* @__PURE__ */ jsx(
        "script",
        {
          type: "text/javascript",
          dangerouslySetInnerHTML: {
            __html: `(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${dados.site.ga4_id}';document.head.appendChild(s);})();window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${dados.site.ga4_id}');`
          }
        }
      ),
      dados.site.meta_pixel_id && /* @__PURE__ */ jsx(
        "script",
        {
          type: "text/javascript",
          dangerouslySetInnerHTML: {
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${dados.site.meta_pixel_id}');fbq('track','PageView');`
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
