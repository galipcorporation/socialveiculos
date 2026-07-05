var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { jsx, jsxs, Fragment } from "react/jsx-runtime";
import { renderToString } from "react-dom/server";
import { useNavigate, Link, useLocation, useParams, Routes, Route, StaticRouter } from "react-router-dom";
import { Helmet, HelmetProvider } from "react-helmet-async";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { X, AlertCircle, KeyRound, Mail, EyeOff, Eye, User, Phone } from "lucide-react";
const useAuthStore = create()(
  persist(
    (set) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoginModalOpen: false,
      loginModalTab: "login",
      openLoginModal: (tab = "login") => set({ isLoginModalOpen: true, loginModalTab: tab }),
      closeLoginModal: () => set({ isLoginModalOpen: false }),
      login: (token, refreshToken, user) => set({
        token,
        refreshToken,
        user,
        isAuthenticated: true,
        isLoginModalOpen: false
      }),
      logout: () => set({
        token: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false
      }),
      updateUser: (patch) => set(
        (state) => state.user ? { user: { ...state.user, ...patch } } : {}
      )
    }),
    {
      name: "sv-vitrine-auth-storage",
      // Só persistir os campos de autenticação, excluindo o estado de abertura do modal
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);
const useUIStore = create((set, get) => ({
  toasts: [],
  showToast: (message, type = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));
    setTimeout(() => get().removeToast(id), 4e3);
  },
  showError: (message, details) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type: "error", details }]
    }));
    setTimeout(() => get().removeToast(id), details ? 8e3 : 4e3);
  },
  removeToast: (id) => set((state) => ({
    toasts: state.toasts.filter((t) => t.id !== id)
  })),
  confirmState: null,
  confirm: (opts) => new Promise((resolve) => {
    set({ confirmState: { ...opts, resolve } });
  }),
  _resolveConfirm: (value) => {
    const { confirmState } = get();
    if (confirmState) {
      confirmState.resolve(value);
      set({ confirmState: null });
    }
  }
}));
const API_BASE = "/v1";
class ApiError extends Error {
  constructor(message, details) {
    super(message);
    __publicField(this, "details");
    this.name = "ApiError";
    this.details = details;
  }
}
function reportarErroServidor(data) {
  const { user } = useAuthStore.getState();
  const payload = {
    ...data,
    user_name: (user == null ? void 0 : user.nome) || void 0,
    user_email: (user == null ? void 0 : user.email) || void 0
  };
  return fetch(`${API_BASE}/admin/erros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {
  });
}
function friendlyHttpMessage(status, serverMessage) {
  if (status === 401) return "Sessão expirada. Faça login novamente.";
  if (status === 403) return "Você não tem permissão para realizar esta ação.";
  if (status === 404) return "O recurso solicitado não foi encontrado.";
  if (status === 422) return serverMessage || "Os dados enviados são inválidos.";
  if (status === 429) return "Muitas requisições. Aguarde um momento e tente de novo.";
  if (status >= 500) return "Erro no servidor. Nossa equipe já foi notificada.";
  return serverMessage || "Erro de comunicação com o servidor.";
}
let isRefreshing = false;
class ApiClient {
  constructor(baseUrl) {
    __publicField(this, "baseUrl");
    this.baseUrl = baseUrl;
  }
  async request(path, options = {}) {
    const { params, ...fetchOptions } = options;
    let url = `${this.baseUrl}${path}`;
    if (params) {
      const searchParams = new URLSearchParams(params);
      url += `?${searchParams.toString()}`;
    }
    const { token } = useAuthStore.getState();
    const headers = {
      "Content-Type": "application/json",
      ...fetchOptions.headers || {}
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(url, {
      ...fetchOptions,
      headers
    });
    if (response.status === 401 && !isRefreshing && path !== "/auth/login" && path !== "/auth/refresh") {
      const { refreshToken, user, login, logout } = useAuthStore.getState();
      if (refreshToken && user) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${this.baseUrl}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken })
          });
          if (refreshRes.ok) {
            const data = await refreshRes.json();
            login(data.access_token, data.refresh_token, user);
            isRefreshing = false;
            headers["Authorization"] = `Bearer ${data.access_token}`;
            const retryRes = await fetch(url, {
              ...fetchOptions,
              headers
            });
            if (!retryRes.ok) {
              const error = await retryRes.json().catch(() => ({}));
              throw new ApiError(friendlyHttpMessage(retryRes.status, error.error), {
                status: retryRes.status,
                path,
                timestamp: (/* @__PURE__ */ new Date()).toISOString()
              });
            }
            return retryRes.json();
          } else {
            isRefreshing = false;
            logout();
            throw new ApiError("Sessão expirada. Faça login novamente.", {
              status: 401,
              path,
              timestamp: (/* @__PURE__ */ new Date()).toISOString()
            });
          }
        } catch (err) {
          isRefreshing = false;
          logout();
          throw err;
        }
      }
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const ts = (/* @__PURE__ */ new Date()).toISOString();
      const requestId = response.headers.get("x-request-id") ?? void 0;
      if (response.status >= 500) {
        void reportarErroServidor({ path, status: response.status, timestamp: ts, requestId, origem: "vitrine" });
      }
      throw new ApiError(friendlyHttpMessage(response.status, body.error), {
        status: response.status,
        path,
        timestamp: ts,
        requestId
      });
    }
    return response.json();
  }
  get(path, params) {
    return this.request(path, { method: "GET", params });
  }
  post(path, body) {
    return this.request(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : void 0
    });
  }
  patch(path, body) {
    return this.request(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : void 0
    });
  }
  delete(path) {
    return this.request(path, { method: "DELETE" });
  }
}
const api = new ApiClient(API_BASE);
function mascararTelefone(val) {
  const limpo = val.replace(/\D/g, "");
  if (limpo.length <= 10) {
    return limpo.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2").substring(0, 14);
  }
  return limpo.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{4})$/, "$1-$2").substring(0, 15);
}
function capitalizarNome(val) {
  if (!val) return "";
  const preposicoes = ["de", "di", "do", "da", "dos", "das", "e", "del", "la", "von", "van"];
  return val.split(/(\s+)/).map((word, idx, arr) => {
    if (/^\s+$/.test(word)) return word;
    const wordLower = word.toLowerCase();
    const isLast = idx === arr.length - 1;
    if (preposicoes.includes(wordLower) && idx > 0 && !isLast) {
      return wordLower;
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join("");
}
function LoginModal() {
  const isOpen = useAuthStore((state) => state.isLoginModalOpen);
  const tab = useAuthStore((state) => state.loginModalTab);
  const setTab = useAuthStore((state) => state.openLoginModal);
  const close = useAuthStore((state) => state.closeLoginModal);
  const loginStore = useAuthStore((state) => state.login);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [telefone, setTelefone] = useState("");
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [showPasswordRegister, setShowPasswordRegister] = useState(false);
  const [mfaChallengeToken, setMfaChallengeToken] = useState(null);
  const [mfaCodigo, setMfaCodigo] = useState("");
  if (!isOpen) return null;
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!email || !senha) return;
    setLoading(true);
    setErro(null);
    try {
      const data = await api.post("/auth/login", { email, senha });
      if (data.mfa_required) {
        setMfaChallengeToken(data.mfa_challenge_token);
        return;
      }
      loginStore(data.access_token, data.refresh_token, data.user);
      close();
    } catch (err) {
      setErro(err.message || "E-mail ou senha incorretos.");
    } finally {
      setLoading(false);
    }
  };
  const handleMfaSubmit = async (e) => {
    e.preventDefault();
    if (!mfaChallengeToken || mfaCodigo.length !== 6) return;
    setLoading(true);
    setErro(null);
    try {
      const data = await api.post("/auth/mfa/verify-login", {
        mfa_challenge_token: mfaChallengeToken,
        codigo: mfaCodigo
      });
      loginStore(data.access_token, data.refresh_token, data.user);
      close();
    } catch (err) {
      setErro(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  };
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    if (!nome || !email || !senha) return;
    setLoading(true);
    setErro(null);
    try {
      await api.post("/auth/register-b2c", { nome, email, senha, telefone: telefone || void 0 });
      const data = await api.post("/auth/login", { email, senha });
      loginStore(data.access_token, data.refresh_token, data.user);
      close();
    } catch (err) {
      setErro(err.message || "Falha ao realizar cadastro. Tente outro e-mail.");
    } finally {
      setLoading(false);
    }
  };
  return /* @__PURE__ */ jsx("div", { className: "vt-modal-overlay", onClick: close, children: /* @__PURE__ */ jsxs("div", { className: "vt-modal-card", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsx("button", { className: "vt-modal-close", onClick: close, children: /* @__PURE__ */ jsx(X, { size: 20 }) }),
    /* @__PURE__ */ jsxs("div", { className: "vt-modal-header", children: [
      /* @__PURE__ */ jsx("h3", { children: "Sua jornada automotiva começa aqui" }),
      /* @__PURE__ */ jsx("p", { children: "Conecte-se para favoritar veículos, enviar propostas e conversar diretamente com as concessionárias." })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "vt-modal-tabs", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `vt-modal-tab-btn ${tab === "login" ? "active" : ""}`,
          onClick: () => {
            setErro(null);
            setSenha("");
            setShowPasswordLogin(false);
            setShowPasswordRegister(false);
            setTab("login");
          },
          disabled: loading,
          children: "Entrar"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `vt-modal-tab-btn ${tab === "register" ? "active" : ""}`,
          onClick: () => {
            setErro(null);
            setSenha("");
            setShowPasswordLogin(false);
            setShowPasswordRegister(false);
            setTab("register");
          },
          disabled: loading,
          children: "Cadastrar"
        }
      )
    ] }),
    erro && /* @__PURE__ */ jsxs("div", { className: "vt-modal-error", children: [
      /* @__PURE__ */ jsx(AlertCircle, { size: 16 }),
      /* @__PURE__ */ jsx("span", { children: erro })
    ] }),
    mfaChallengeToken ? /* @__PURE__ */ jsxs("form", { onSubmit: handleMfaSubmit, className: "vt-modal-form", children: [
      /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
        /* @__PURE__ */ jsx("label", { children: "Código do autenticador" }),
        /* @__PURE__ */ jsxs("div", { className: "vt-input-wrapper", children: [
          /* @__PURE__ */ jsx(KeyRound, { className: "vt-input-icon", size: 16 }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              inputMode: "numeric",
              placeholder: "000000",
              maxLength: 6,
              value: mfaCodigo,
              onChange: (e) => setMfaCodigo(e.target.value.replace(/\D/g, "")),
              required: true,
              autoFocus: true,
              disabled: loading
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "vt-btn vt-btn-primary vt-btn-block", disabled: loading || mfaCodigo.length !== 6, children: loading ? /* @__PURE__ */ jsx("span", { className: "spinner" }) : "Confirmar código" }),
      /* @__PURE__ */ jsx(
        "button",
        {
          type: "button",
          className: "vt-btn vt-btn-social",
          onClick: () => {
            setMfaChallengeToken(null);
            setMfaCodigo("");
            setErro(null);
          },
          disabled: loading,
          children: "Voltar"
        }
      )
    ] }) : tab === "login" ? /* @__PURE__ */ jsxs("form", { onSubmit: handleLoginSubmit, className: "vt-modal-form", children: [
      /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
        /* @__PURE__ */ jsx("label", { children: "E-mail" }),
        /* @__PURE__ */ jsxs("div", { className: "vt-input-wrapper", children: [
          /* @__PURE__ */ jsx(Mail, { className: "vt-input-icon", size: 16 }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "email",
              placeholder: "Seu e-mail",
              value: email,
              onChange: (e) => setEmail(e.target.value.replace(/\s+/g, "")),
              onKeyDown: (e) => {
                if (e.key === " ") {
                  e.preventDefault();
                }
              },
              required: true,
              disabled: loading
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
        /* @__PURE__ */ jsx("label", { children: "Senha" }),
        /* @__PURE__ */ jsxs("div", { className: "vt-input-wrapper", children: [
          /* @__PURE__ */ jsx(KeyRound, { className: "vt-input-icon", size: 16 }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: showPasswordLogin ? "text" : "password",
              className: "vt-input-password",
              placeholder: "Sua senha",
              value: senha,
              onChange: (e) => setSenha(e.target.value),
              required: true,
              disabled: loading
            }
          ),
          /* @__PURE__ */ jsx(
            "button",
            {
              type: "button",
              className: "vt-btn-toggle-password",
              onClick: () => setShowPasswordLogin(!showPasswordLogin),
              tabIndex: -1,
              children: showPasswordLogin ? /* @__PURE__ */ jsx(EyeOff, { size: 16 }) : /* @__PURE__ */ jsx(Eye, { size: 16 })
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "vt-btn vt-btn-primary vt-btn-block", disabled: loading, children: loading ? /* @__PURE__ */ jsx("span", { className: "spinner" }) : "Acessar Conta" })
    ] }) : (
      /* Formulário de Cadastro */
      /* @__PURE__ */ jsxs("form", { onSubmit: handleRegisterSubmit, className: "vt-modal-form", children: [
        /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Nome Completo" }),
          /* @__PURE__ */ jsxs("div", { className: "vt-input-wrapper", children: [
            /* @__PURE__ */ jsx(User, { className: "vt-input-icon", size: 16 }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                placeholder: "Seu nome",
                value: nome,
                onChange: (e) => setNome(capitalizarNome(e.target.value)),
                required: true,
                disabled: loading
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "E-mail" }),
          /* @__PURE__ */ jsxs("div", { className: "vt-input-wrapper", children: [
            /* @__PURE__ */ jsx(Mail, { className: "vt-input-icon", size: 16 }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "email",
                placeholder: "Seu e-mail",
                value: email,
                onChange: (e) => setEmail(e.target.value.replace(/\s+/g, "")),
                onKeyDown: (e) => {
                  if (e.key === " ") {
                    e.preventDefault();
                  }
                },
                required: true,
                disabled: loading
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Telefone (opcional)" }),
          /* @__PURE__ */ jsxs("div", { className: "vt-input-wrapper", children: [
            /* @__PURE__ */ jsx(Phone, { className: "vt-input-icon", size: 16 }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "tel",
                placeholder: "(11) 99999-9999",
                value: telefone,
                onChange: (e) => setTelefone(mascararTelefone(e.target.value)),
                disabled: loading
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
          /* @__PURE__ */ jsx("label", { children: "Senha de Acesso" }),
          /* @__PURE__ */ jsxs("div", { className: "vt-input-wrapper", children: [
            /* @__PURE__ */ jsx(KeyRound, { className: "vt-input-icon", size: 16 }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: showPasswordRegister ? "text" : "password",
                className: "vt-input-password",
                placeholder: "Mínimo 6 caracteres",
                value: senha,
                onChange: (e) => setSenha(e.target.value),
                required: true,
                minLength: 6,
                disabled: loading
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "vt-btn-toggle-password",
                onClick: () => setShowPasswordRegister(!showPasswordRegister),
                tabIndex: -1,
                children: showPasswordRegister ? /* @__PURE__ */ jsx(EyeOff, { size: 16 }) : /* @__PURE__ */ jsx(Eye, { size: 16 })
              }
            )
          ] })
        ] }),
        /* @__PURE__ */ jsx("button", { type: "submit", className: "vt-btn vt-btn-primary vt-btn-block", disabled: loading, children: loading ? /* @__PURE__ */ jsx("span", { className: "spinner" }) : "Criar minha Conta" })
      ] })
    ),
    !mfaChallengeToken && /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "vt-modal-divider", children: /* @__PURE__ */ jsx("span", { children: "ou continue com" }) }),
      /* @__PURE__ */ jsxs(
        "button",
        {
          type: "button",
          className: "vt-btn vt-btn-social",
          onClick: () => {
            window.location.href = "/v1/auth/google/login";
          },
          disabled: loading,
          children: [
            /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", width: "18", height: "18", fill: "currentColor", style: { marginRight: 8 }, children: /* @__PURE__ */ jsx("path", { d: "M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.113-5.111 4.113-3.419 0-6.202-2.783-6.202-6.202 0-3.419 2.783-6.202 6.202-6.202 1.481 0 2.836.526 3.902 1.488l3.125-3.125C18.992 2.378 15.82 1 12.016 1c-6.075 0-11 4.925-11 11s4.925 11 11 11c5.787 0 10.373-4.084 10.373-10.428 0-.687-.06-1.3-.173-1.857H12.24z" }) }),
            /* @__PURE__ */ jsx("span", { children: "Continuar com Google" })
          ]
        }
      )
    ] })
  ] }) });
}
function MfaSettingsModal({ mfaAtivo, onClose, onChange }) {
  const [etapa, setEtapa] = useState("inicial");
  const [qrCode, setQrCode] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState(null);
  const [loading, setLoading] = useState(false);
  async function iniciarEnroll() {
    setLoading(true);
    setErro(null);
    try {
      const data = await api.post("/auth/mfa/enroll", {});
      setQrCode(data.qr_code_base64);
      setEtapa("enroll");
    } catch (err) {
      setErro(err.message || "Não foi possível iniciar a ativação do MFA.");
    } finally {
      setLoading(false);
    }
  }
  async function confirmarEnroll(e) {
    e.preventDefault();
    if (codigo.length !== 6) return;
    setLoading(true);
    setErro(null);
    try {
      await api.post("/auth/mfa/confirm", { codigo });
      onChange(true);
      onClose();
    } catch (err) {
      setErro(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  }
  async function desativar(e) {
    e.preventDefault();
    if (!senha) return;
    setLoading(true);
    setErro(null);
    try {
      await api.post("/auth/mfa/disable", { senha });
      onChange(false);
      onClose();
    } catch (err) {
      setErro(err.message || "Senha incorreta.");
    } finally {
      setLoading(false);
    }
  }
  return /* @__PURE__ */ jsx("div", { className: "vt-modal-overlay", onClick: onClose, children: /* @__PURE__ */ jsxs("div", { className: "vt-modal-card", onClick: (e) => e.stopPropagation(), children: [
    /* @__PURE__ */ jsx("button", { className: "vt-modal-close", onClick: onClose, children: "×" }),
    /* @__PURE__ */ jsxs("div", { className: "vt-modal-header", children: [
      /* @__PURE__ */ jsx("h3", { children: "Verificação em duas etapas" }),
      /* @__PURE__ */ jsx("p", { children: "Adicione uma camada extra de segurança usando um app autenticador (Google Authenticator, Authy)." })
    ] }),
    erro && /* @__PURE__ */ jsx("div", { className: "vt-modal-error", children: /* @__PURE__ */ jsx("span", { children: erro }) }),
    etapa === "inicial" && !mfaAtivo && /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-primary vt-btn-block", onClick: iniciarEnroll, disabled: loading, children: loading ? "Gerando..." : "Ativar verificação em duas etapas" }),
    etapa === "inicial" && mfaAtivo && /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-outline vt-btn-block", onClick: () => setEtapa("desativar"), disabled: loading, children: "Desativar verificação em duas etapas" }),
    etapa === "enroll" && qrCode && /* @__PURE__ */ jsxs("form", { onSubmit: confirmarEnroll, className: "vt-modal-form", children: [
      /* @__PURE__ */ jsx(
        "img",
        {
          src: `data:image/png;base64,${qrCode}`,
          alt: "QR Code do autenticador",
          style: { width: 200, height: 200, alignSelf: "center", background: "#fff", padding: 8, borderRadius: 8 }
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
        /* @__PURE__ */ jsx("label", { children: "Código do autenticador" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "text",
            inputMode: "numeric",
            placeholder: "000000",
            maxLength: 6,
            value: codigo,
            onChange: (e) => setCodigo(e.target.value.replace(/\D/g, "")),
            required: true,
            autoFocus: true,
            disabled: loading
          }
        )
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "vt-btn vt-btn-primary vt-btn-block", disabled: loading || codigo.length !== 6, children: loading ? "Confirmando..." : "Confirmar e ativar" })
    ] }),
    etapa === "desativar" && /* @__PURE__ */ jsxs("form", { onSubmit: desativar, className: "vt-modal-form", children: [
      /* @__PURE__ */ jsxs("div", { className: "vt-form-group", children: [
        /* @__PURE__ */ jsx("label", { children: "Confirme sua senha" }),
        /* @__PURE__ */ jsx(
          "input",
          {
            type: "password",
            value: senha,
            onChange: (e) => setSenha(e.target.value),
            required: true,
            autoFocus: true,
            disabled: loading
          }
        )
      ] }),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "vt-btn vt-btn-primary vt-btn-block", disabled: loading || !senha, children: loading ? "Desativando..." : "Desativar" })
    ] })
  ] }) });
}
const CONTATO_WHATSAPP = "5517991110057";
const CONTATO_EMAIL = "suporte@socialveiculos.com";
function normalizarWhatsapp(numero) {
  const digitos = numero.replace(/\D/g, "");
  if (!digitos) return "";
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}
function whatsappLink(texto) {
  const base = `https://wa.me/${CONTATO_WHATSAPP}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
function whatsappLojaLink(lojaWhatsapp, texto) {
  if (!lojaWhatsapp) return null;
  const numero = normalizarWhatsapp(lojaWhatsapp);
  if (!numero) return null;
  const base = `https://wa.me/${numero}`;
  return texto ? `${base}?text=${encodeURIComponent(texto)}` : base;
}
const CarIcon$1 = () => /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [
  /* @__PURE__ */ jsx("rect", { x: "1", y: "6", width: "22", height: "10", rx: "3" }),
  /* @__PURE__ */ jsx("circle", { cx: "6", cy: "18", r: "2" }),
  /* @__PURE__ */ jsx("circle", { cx: "18", cy: "18", r: "2" }),
  /* @__PURE__ */ jsx("path", { d: "M5 6L7 2h10l2 4" })
] });
const VerifiedIcon = () => /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "currentColor", className: "vt-verified", children: [
  /* @__PURE__ */ jsx("path", { d: "M12 1l2.6 1.9 3.2-.2 1 3 2.6 1.9-1 3 1 3-2.6 1.9-1 3-3.2-.2L12 23l-2.6-1.9-3.2.2-1-3L2.6 16.5l1-3-1-3 2.6-1.9 1-3 3.2.2z" }),
  /* @__PURE__ */ jsx("path", { d: "M9.5 12.5l1.8 1.8 3.5-3.8", fill: "none", stroke: "#fff", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" })
] });
function formatCurrency(val) {
  if (val == null) return "Sob Consulta";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(val);
}
function formatKm(val) {
  if (val == null) return "—";
  return new Intl.NumberFormat("pt-BR").format(val) + " km";
}
function timeAgo(v) {
  return `${v.ano_fabricacao}/${v.ano_modelo}`;
}
function CarCard({ veiculo, onFavoritar, onConversar, onWhatsApp, onSeguir, isAuthenticated }) {
  var _a;
  const navigate = useNavigate();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [imgError, setImgError] = useState(false);
  const midias = veiculo.midias ?? [];
  const currentMidia = midias.length > 0 ? midias[currentIdx] : null;
  const prev = (e) => {
    e.stopPropagation();
    setCurrentIdx((i) => i === 0 ? midias.length - 1 : i - 1);
  };
  const next = (e) => {
    e.stopPropagation();
    setCurrentIdx((i) => i === midias.length - 1 ? 0 : i + 1);
  };
  const lojaInicial = (veiculo.loja_nome ?? veiculo.marca).slice(0, 2).toUpperCase();
  const localidade = [veiculo.loja_cidade, veiculo.loja_estado].filter(Boolean).join(", ");
  return /* @__PURE__ */ jsxs("div", { className: "vt-car-card", children: [
    /* @__PURE__ */ jsxs("div", { className: "vt-car-card-header", children: [
      /* @__PURE__ */ jsxs("div", { className: "vt-car-card-shop", style: { cursor: "pointer" }, onClick: () => navigate(`/loja/${veiculo.loja_id}`), children: [
        /* @__PURE__ */ jsx("div", { className: "vt-card-shop-ring", children: /* @__PURE__ */ jsx("div", { children: veiculo.loja_logo ? /* @__PURE__ */ jsx("img", { src: veiculo.loja_logo, alt: veiculo.loja_nome, style: { width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" } }) : lojaInicial }) }),
        /* @__PURE__ */ jsxs("div", { className: "vt-car-card-shop-info", children: [
          /* @__PURE__ */ jsxs("h4", { children: [
            veiculo.loja_nome ?? "Loja Parceira",
            veiculo.loja_verificada && /* @__PURE__ */ jsx(VerifiedIcon, {})
          ] }),
          /* @__PURE__ */ jsx("span", { children: localidade || "Brasil" })
        ] })
      ] }),
      /* @__PURE__ */ jsx(
        "button",
        {
          className: `vt-btn-seguir${veiculo.seguindo_loja ? " seguindo" : ""}`,
          onClick: () => onSeguir(veiculo.loja_id, !!veiculo.seguindo_loja),
          children: veiculo.seguindo_loja ? "Seguindo" : "Seguir"
        }
      )
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "vt-car-card-image", children: [
      currentMidia && !imgError ? currentMidia.tipo === "video" ? /* @__PURE__ */ jsx("video", { src: currentMidia.url, controls: true, muted: true, playsInline: true, style: { width: "100%", height: "100%", objectFit: "cover" } }) : /* @__PURE__ */ jsx("img", { src: currentMidia.url, alt: `${veiculo.marca} ${veiculo.modelo}`, onError: () => setImgError(true) }) : /* @__PURE__ */ jsxs("div", { className: "vt-car-card-placeholder", children: [
        /* @__PURE__ */ jsx(CarIcon$1, {}),
        /* @__PURE__ */ jsx("span", { children: "Sem foto disponível" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-car-card-badges", children: [
        /* @__PURE__ */ jsx("span", { className: "vt-badge vt-badge-destaque", children: "Destaque" }),
        ((_a = veiculo.descricao) == null ? void 0 : _a.toLowerCase().includes("troca")) && /* @__PURE__ */ jsx("span", { className: "vt-badge vt-badge-troca", children: "Aceita troca" })
      ] }),
      midias.length > 1 && /* @__PURE__ */ jsxs("span", { className: "vt-media-count", children: [
        currentIdx + 1,
        "/",
        midias.length
      ] }),
      midias.length > 1 && /* @__PURE__ */ jsxs(Fragment, { children: [
        /* @__PURE__ */ jsx("button", { className: "vt-media-arrow left", onClick: prev, children: "‹" }),
        /* @__PURE__ */ jsx("button", { className: "vt-media-arrow right", onClick: next, children: "›" })
      ] }),
      midias.length > 1 && /* @__PURE__ */ jsx("div", { className: "vt-media-dots", children: midias.map((_, i) => /* @__PURE__ */ jsx("span", { className: i === currentIdx ? "on" : "" }, i)) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "vt-car-card-actions", children: [
      /* @__PURE__ */ jsx("div", { className: "vt-car-card-social", children: /* @__PURE__ */ jsx(
        "button",
        {
          className: `vt-act${veiculo.favoritado_por_mim ? " liked" : ""}`,
          onClick: () => onFavoritar(veiculo.id, veiculo.favoritado_por_mim),
          title: veiculo.favoritado_por_mim ? "Desfavoritar" : "Favoritar",
          children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: veiculo.favoritado_por_mim ? "currentColor" : "none", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" }) })
        }
      ) }),
      /* @__PURE__ */ jsx("button", { className: "vt-act", title: "Salvar", onClick: () => onFavoritar(veiculo.id, veiculo.favoritado_por_mim), children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: veiculo.favoritado_por_mim ? "currentColor" : "none", stroke: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" }) }) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "vt-car-card-body", children: [
      veiculo.total_favoritos > 0 && /* @__PURE__ */ jsxs("div", { className: "vt-card-likes", children: [
        veiculo.total_favoritos,
        " curtidas"
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-card-caption", children: [
        /* @__PURE__ */ jsxs("span", { className: "name", children: [
          veiculo.marca,
          " ",
          veiculo.modelo
        ] }),
        veiculo.versao && ` ${veiculo.versao}`,
        " · ",
        /* @__PURE__ */ jsx("span", { className: "vt-card-price", children: formatCurrency(veiculo.preco_venda) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-car-card-specs", children: [
        /* @__PURE__ */ jsxs("div", { className: "vt-car-card-spec", children: [
          /* @__PURE__ */ jsx("label", { children: "KM" }),
          /* @__PURE__ */ jsx("span", { children: formatKm(veiculo.km) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "vt-car-card-spec", children: [
          /* @__PURE__ */ jsx("label", { children: "Ano" }),
          /* @__PURE__ */ jsx("span", { children: timeAgo(veiculo) })
        ] }),
        veiculo.cambio && /* @__PURE__ */ jsxs("div", { className: "vt-car-card-spec", children: [
          /* @__PURE__ */ jsx("label", { children: "Câmbio" }),
          /* @__PURE__ */ jsx("span", { style: { textTransform: "capitalize" }, children: veiculo.cambio })
        ] }),
        veiculo.combustivel && /* @__PURE__ */ jsxs("div", { className: "vt-car-card-spec", children: [
          /* @__PURE__ */ jsx("label", { children: "Combustível" }),
          /* @__PURE__ */ jsx("span", { style: { textTransform: "capitalize" }, children: veiculo.combustivel })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-card-cta", children: [
        veiculo.loja_whatsapp && /* @__PURE__ */ jsxs("button", { className: "vt-btn-negociar", onClick: () => onWhatsApp(veiculo), children: [
          /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "currentColor", children: /* @__PURE__ */ jsx("path", { d: "M.06 24l1.7-6.2A11.9 11.9 0 1 1 12 24a11.9 11.9 0 0 1-5.7-1.5L.06 24zM6.6 20l.4.2a9.9 9.9 0 1 0-3.4-3.4l.2.4-1 3.7 3.8-.9z" }) }),
          "WhatsApp"
        ] }),
        /* @__PURE__ */ jsxs("button", { className: "vt-btn-chat", onClick: () => onConversar(veiculo), children: [
          /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", width: "17", height: "17", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" }) }),
          "Conversar"
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "vt-card-time", children: veiculo.loja_cidade ?? "" })
    ] })
  ] });
}
const CarIcon = () => /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", style: { width: 24, height: 24 }, children: [
  /* @__PURE__ */ jsx("rect", { x: "1", y: "6", width: "22", height: "10", rx: "3" }),
  /* @__PURE__ */ jsx("circle", { cx: "6", cy: "18", r: "2" }),
  /* @__PURE__ */ jsx("circle", { cx: "18", cy: "18", r: "2" }),
  /* @__PURE__ */ jsx("path", { d: "M5 6L7 2h10l2 4" })
] });
function Feed() {
  const navigate = useNavigate();
  const { isAuthenticated, user, openLoginModal, logout, updateUser } = useAuthStore();
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("vt-theme") === "dark";
  });
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", darkMode ? "dark" : "light");
    localStorage.setItem("vt-theme", darkMode ? "dark" : "light");
  }, [darkMode]);
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState("");
  const [ordenacao, setOrdenacao] = useState("");
  const [selectedStory, setSelectedStory] = useState("");
  const [filtroRapido, setFiltroRapido] = useState("Todos");
  const [stories, setStories] = useState([]);
  const [storyAberto, setStoryAberto] = useState(null);
  const [showPerfilModal, setShowPerfilModal] = useState(false);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const avatarInputRef = useRef(null);
  const [headerAvatarError, setHeaderAvatarError] = useState(false);
  const [modalAvatarError, setModalAvatarError] = useState(false);
  const [previewAvatarError, setPreviewAvatarError] = useState(false);
  useEffect(() => {
    setHeaderAvatarError(false);
    setModalAvatarError(false);
    setPreviewAvatarError(false);
  }, [user == null ? void 0 : user.avatar_url]);
  const perPage = 12;
  const searchTimeout = useRef(void 0);
  useEffect(() => {
    if (isAuthenticated) {
      api.get("/vitrine/stories").then(setStories).catch(() => {
      });
    }
  }, []);
  const handleAvatarSelect = (e) => {
    var _a;
    const file = (_a = e.target.files) == null ? void 0 : _a[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setAvatarError("Selecione um arquivo de imagem válido.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setAvatarError("Imagem muito grande. Limite máximo: 15MB.");
      return;
    }
    setAvatarError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };
  const handleSaveAvatar = async () => {
    if (!avatarFile) return;
    setAvatarUploading(true);
    setAvatarError(null);
    try {
      const token = useAuthStore.getState().token;
      const formData = new FormData();
      formData.append("file", avatarFile);
      const res = await fetch("/v1/auth/me/avatar", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : void 0,
        body: formData
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      updateUser({ avatar_url: data.avatar_url });
      setAvatarFile(null);
      setAvatarPreview(null);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Falha ao salvar a foto.");
    } finally {
      setAvatarUploading(false);
    }
  };
  const closePerfilModal = () => {
    setShowPerfilModal(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setAvatarError(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };
  const fetchFeed = useCallback(async (currentPage, resetList = false) => {
    setLoading(true);
    try {
      const params = {
        page: String(currentPage),
        per_page: String(perPage)
      };
      if (search && isAuthenticated) params.q = search;
      if (ordenacao && isAuthenticated) params.ordenacao = ordenacao;
      if (selectedStory && isAuthenticated && !["Ofertas", "Novidades", "Destaques"].includes(selectedStory)) {
        params.carroceria = selectedStory;
      }
      const data = await api.get("/marketplace/feed", params);
      setVeiculos((prev) => {
        if (resetList || currentPage === 1) return data;
        const existingIds = new Set(prev.map((v) => v.id));
        const filteredNew = data.filter((v) => !existingIds.has(v.id));
        return [...prev, ...filteredNew];
      });
      if (data.length < perPage) {
        setHasMore(false);
      } else {
        setHasMore(true);
      }
    } catch (err) {
      console.error("Erro ao carregar feed B2C:", err);
    } finally {
      setLoading(false);
    }
  }, [search, ordenacao, selectedStory, isAuthenticated]);
  useEffect(() => {
    setPage(1);
    fetchFeed(1, true);
  }, [search, ordenacao, selectedStory, isAuthenticated, fetchFeed]);
  useEffect(() => {
    if (page > 1) {
      fetchFeed(page, false);
    }
  }, [page, fetchFeed]);
  useEffect(() => {
    let hasTriggeredLogin = false;
    const handleScroll = () => {
      if (!isAuthenticated && window.scrollY > 400 && !hasTriggeredLogin) {
        hasTriggeredLogin = true;
        openLoginModal("login");
        return;
      }
      if (isAuthenticated && hasMore && !loading) {
        const threshold = 100;
        const isNearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - threshold;
        if (isNearBottom) {
          setPage((prev) => prev + 1);
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isAuthenticated, hasMore, loading, openLoginModal]);
  const handleSearchChange = (value) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(value);
    }, 400);
  };
  const handleFavoritar = async (veiculoId, favoritado) => {
    if (!isAuthenticated) {
      openLoginModal("login");
      return;
    }
    setVeiculos((prev) => prev.map((v) => {
      if (v.id === veiculoId) {
        return {
          ...v,
          favoritado_por_mim: !favoritado,
          total_favoritos: favoritado ? Math.max(0, v.total_favoritos - 1) : v.total_favoritos + 1
        };
      }
      return v;
    }));
    try {
      if (favoritado) {
        await api.delete(`/vitrine/favoritos/${veiculoId}`);
      } else {
        await api.post("/vitrine/favoritos", { veiculo_id: veiculoId });
      }
    } catch (err) {
      console.error("Erro ao favoritar/desfavoritar:", err);
      setVeiculos((prev) => prev.map((v) => {
        if (v.id === veiculoId) {
          return {
            ...v,
            favoritado_por_mim: favoritado,
            total_favoritos: favoritado ? v.total_favoritos + 1 : Math.max(0, v.total_favoritos - 1)
          };
        }
        return v;
      }));
    }
  };
  const handleConversar = async (veiculo) => {
    if (!isAuthenticated) {
      openLoginModal("login");
      return;
    }
    try {
      const msg = `Olá, estou interessado no veículo ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_modelo}).`;
      const res = await api.post("/vitrine/conversas", {
        veiculo_id: veiculo.id,
        loja_id: veiculo.loja_id,
        mensagem: msg
      });
      navigate("/mensagens", { state: { conversaId: res.id } });
    } catch (err) {
      console.error("Erro ao iniciar conversa:", err);
    }
  };
  const handleSeguir = async (lojaId, seguindo) => {
    if (!isAuthenticated) {
      openLoginModal("login");
      return;
    }
    setVeiculos((prev) => prev.map(
      (v) => v.loja_id === lojaId ? { ...v, seguindo_loja: !seguindo } : v
    ));
    try {
      if (seguindo) {
        await api.delete(`/vitrine/lojas/${lojaId}/seguir`);
      } else {
        await api.post(`/vitrine/lojas/${lojaId}/seguir`, {});
      }
    } catch {
      setVeiculos((prev) => prev.map(
        (v) => v.loja_id === lojaId ? { ...v, seguindo_loja: seguindo } : v
      ));
    }
  };
  const handleWhatsApp = (veiculo) => {
    const text = `Olá! Vi o carro ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_fabricacao}/${veiculo.ano_modelo}) na Vitrine do Social Veículos e gostaria de mais informações.`;
    const link = whatsappLojaLink(veiculo.loja_whatsapp, text);
    if (!link) {
      useUIStore.getState().showToast("Esta loja não tem WhatsApp cadastrado. Use o chat interno.", "info");
      return;
    }
    window.open(link, "_blank");
  };
  const handleFiltroRapido = (f) => {
    if (!isAuthenticated && f !== "Todos") {
      openLoginModal("login");
      return;
    }
    setFiltroRapido(f);
    setSelectedStory("");
    setSearch("");
    if (f === "Ofertas") setOrdenacao("ofertas");
    else if (f === "Novidades") setOrdenacao("novidades");
    else setOrdenacao("");
  };
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsxs("header", { className: "vt-topbar", children: [
      /* @__PURE__ */ jsx("div", { className: "vt-topbar-brand", children: "Social Veículos" }),
      /* @__PURE__ */ jsxs("div", { className: "vt-topbar-center", children: [
        isAuthenticated && /* @__PURE__ */ jsxs("div", { className: "vt-topbar-search", children: [
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
            /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "8" }),
            /* @__PURE__ */ jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              placeholder: "Buscar carros...",
              id: "feed-search",
              onChange: (e) => handleSearchChange(e.target.value)
            }
          )
        ] }),
        /* @__PURE__ */ jsx("div", { className: "vt-filter-chips", children: ["Todos", "Ofertas", "Novidades", "Destaques"].map((f) => /* @__PURE__ */ jsx(
          "button",
          {
            className: `vt-chip-filter${filtroRapido === f ? " active" : ""}`,
            onClick: () => handleFiltroRapido(f),
            children: f
          },
          f
        )) })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-topbar-actions", children: [
        /* @__PURE__ */ jsx("button", { className: "vt-icon-btn", onClick: () => setDarkMode((d) => !d), title: darkMode ? "Tema claro" : "Tema escuro", children: darkMode ? /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
          /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "4" }),
          /* @__PURE__ */ jsx("path", { d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" })
        ] }) : /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: /* @__PURE__ */ jsx("path", { d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" }) }) }),
        isAuthenticated && user ? /* @__PURE__ */ jsx(
          "div",
          {
            className: "vt-avatar",
            style: { width: 36, height: 36, borderRadius: "50%", background: "var(--vt-primary-light)", color: "var(--vt-primary)", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, border: "1px solid var(--vt-border)", cursor: "pointer" },
            onClick: () => setShowPerfilModal(true),
            title: user.email,
            children: avatarPreview ? /* @__PURE__ */ jsx("img", { src: avatarPreview, alt: "", style: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" } }) : user.avatar_url && !headerAvatarError ? /* @__PURE__ */ jsx("img", { src: user.avatar_url, alt: user.nome, onError: () => setHeaderAvatarError(true), style: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" } }) : user.nome.slice(0, 2).toUpperCase()
          }
        ) : /* @__PURE__ */ jsxs(Fragment, { children: [
          /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-outline", onClick: () => openLoginModal("login"), children: "Entrar" }),
          /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-primary", onClick: () => openLoginModal("register"), children: "Cadastrar" })
        ] })
      ] })
    ] }),
    isAuthenticated && stories.length > 0 && /* @__PURE__ */ jsx("div", { className: "vt-stories-wrapper", children: /* @__PURE__ */ jsx("div", { className: "vt-stories", children: stories.map((story) => /* @__PURE__ */ jsxs("div", { className: "vt-story", onClick: () => setStoryAberto(story), children: [
      /* @__PURE__ */ jsx("div", { className: "vt-story-ring", children: /* @__PURE__ */ jsx("div", { className: "vt-story-avatar", children: story.loja_logo ? /* @__PURE__ */ jsx("img", { src: story.loja_logo, alt: story.loja_nome }) : /* @__PURE__ */ jsx(CarIcon, {}) }) }),
      /* @__PURE__ */ jsx("span", { children: story.loja_nome })
    ] }, story.id)) }) }),
    storyAberto && /* @__PURE__ */ jsx("div", { onClick: () => setStoryAberto(null), style: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsxs("div", { onClick: (e) => e.stopPropagation(), style: { background: "var(--vt-surface)", borderRadius: 16, width: 360, maxWidth: "95vw", overflow: "hidden", position: "relative" }, children: [
      /* @__PURE__ */ jsx("button", { onClick: () => setStoryAberto(null), style: { position: "absolute", top: 12, right: 12, background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#fff", zIndex: 2 }, children: "✕" }),
      storyAberto.midia_url ? /* @__PURE__ */ jsx("img", { src: storyAberto.midia_url, alt: "", style: { width: "100%", aspectRatio: "9/16", objectFit: "cover", maxHeight: 560 } }) : /* @__PURE__ */ jsx("div", { style: { width: "100%", aspectRatio: "9/16", maxHeight: 560, background: "var(--vt-bg)", display: "flex", alignItems: "center", justifyContent: "center" }, children: /* @__PURE__ */ jsx(CarIcon, {}) }),
      /* @__PURE__ */ jsxs("div", { style: { padding: "12px 16px 16px" }, children: [
        /* @__PURE__ */ jsx("div", { style: { fontWeight: 700, fontSize: 15 }, children: storyAberto.loja_nome }),
        storyAberto.veiculo_marca && /* @__PURE__ */ jsxs("div", { style: { fontSize: 13, color: "var(--vt-text-dim)", marginTop: 2 }, children: [
          storyAberto.veiculo_marca,
          " ",
          storyAberto.veiculo_modelo
        ] }),
        storyAberto.veiculo_preco && /* @__PURE__ */ jsx("div", { style: { fontSize: 16, fontWeight: 700, color: "var(--vt-primary)", marginTop: 4 }, children: storyAberto.veiculo_preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) }),
        storyAberto.legenda && /* @__PURE__ */ jsx("div", { style: { fontSize: 13, marginTop: 8, color: "var(--vt-text)" }, children: storyAberto.legenda })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("div", { className: "vt-feed-layout", children: /* @__PURE__ */ jsxs("main", { className: "vt-feed-main", children: [
      veiculos.length === 0 && !loading ? /* @__PURE__ */ jsxs("div", { style: { background: "var(--vt-surface)", padding: 40, borderRadius: 12, border: "1px solid var(--vt-border)", textAlign: "center" }, children: [
        /* @__PURE__ */ jsx(CarIcon, {}),
        /* @__PURE__ */ jsx("h3", { style: { marginTop: 12 }, children: "Nenhum veículo encontrado" }),
        /* @__PURE__ */ jsx("p", { style: { color: "var(--vt-text-dim)", marginTop: 4 }, children: "Tente outros filtros." })
      ] }) : veiculos.map((v) => /* @__PURE__ */ jsx(
        CarCard,
        {
          veiculo: v,
          onFavoritar: handleFavoritar,
          onConversar: handleConversar,
          onWhatsApp: handleWhatsApp,
          onSeguir: handleSeguir,
          isAuthenticated
        },
        v.id
      )),
      loading && /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: "20px 0" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) })
    ] }) }),
    /* @__PURE__ */ jsxs("footer", { className: "vt-footer", style: { paddingBottom: "80px" }, children: [
      /* @__PURE__ */ jsxs("div", { className: "vt-footer-links", children: [
        /* @__PURE__ */ jsx(Link, { to: "/sobre", children: "Sobre" }),
        /* @__PURE__ */ jsx(Link, { to: "/privacidade", children: "Privacidade" }),
        /* @__PURE__ */ jsx(Link, { to: "/termos", children: "Termos" }),
        /* @__PURE__ */ jsx(Link, { to: "/anuncie", children: "Anuncie" })
      ] }),
      /* @__PURE__ */ jsx("span", { children: "© 2026 Social Veículos" })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "vt-mobile-nav", style: {
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      height: "64px",
      background: "var(--vt-surface)",
      backdropFilter: "blur(10px)",
      borderTop: "1px solid var(--vt-border)",
      display: "flex",
      justifyContent: "space-around",
      alignItems: "center",
      zIndex: 999,
      padding: "0 10px"
    }, children: [
      /* @__PURE__ */ jsxs("div", { onClick: () => navigate("/"), style: { display: "flex", flexDirection: "column", alignItems: "center", color: "var(--vt-primary)", cursor: "pointer", fontSize: 11 }, children: [
        /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", style: { width: 20, height: 20, marginBottom: 2 }, children: [
          /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
          /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "3" })
        ] }),
        /* @__PURE__ */ jsx("span", { children: "Explorar" })
      ] }),
      /* @__PURE__ */ jsxs("div", { onClick: () => navigate("/favoritos"), style: { display: "flex", flexDirection: "column", alignItems: "center", color: "var(--vt-text-dim)", cursor: "pointer", fontSize: 11 }, children: [
        /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", style: { width: 20, height: 20, marginBottom: 2 }, children: /* @__PURE__ */ jsx("path", { d: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" }) }),
        /* @__PURE__ */ jsx("span", { children: "Favoritos" })
      ] }),
      /* @__PURE__ */ jsxs("div", { onClick: () => navigate("/mensagens"), style: { display: "flex", flexDirection: "column", alignItems: "center", color: "var(--vt-text-dim)", cursor: "pointer", fontSize: 11 }, children: [
        /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", style: { width: 20, height: 20, marginBottom: 2 }, children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" }) }),
        /* @__PURE__ */ jsx("span", { children: "Mensagens" })
      ] })
    ] }),
    showPerfilModal && user && /* @__PURE__ */ jsx("div", { className: "vt-modal-overlay", onClick: closePerfilModal, children: /* @__PURE__ */ jsxs("div", { className: "vt-modal-card", style: { maxWidth: 400, width: "min(400px, 92vw)", background: "var(--vt-surface)", border: "1px solid var(--vt-border)", color: "var(--vt-text)" }, onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "vt-modal-header", style: { borderBottom: "1px solid var(--vt-border)", paddingBottom: "12px" }, children: [
        /* @__PURE__ */ jsx("h3", { style: { margin: 0 }, children: "Minha Conta" }),
        /* @__PURE__ */ jsx("button", { className: "vt-modal-close", onClick: closePerfilModal, style: { color: "var(--vt-text)" }, children: "×" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "modal-body", style: { display: "flex", flexDirection: "column", gap: "16px", padding: "16px 0" }, children: [
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [
          /* @__PURE__ */ jsx("div", { style: {
            width: "54px",
            height: "54px",
            borderRadius: "50%",
            background: "var(--vt-primary-light)",
            color: "var(--vt-primary)",
            fontWeight: "700",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "20px",
            border: "1px solid var(--vt-border)"
          }, children: avatarPreview ? /* @__PURE__ */ jsx("img", { src: avatarPreview, alt: "Pré-visualização", style: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" } }) : user.avatar_url && !modalAvatarError ? /* @__PURE__ */ jsx(
            "img",
            {
              src: user.avatar_url,
              alt: user.nome,
              onError: () => setModalAvatarError(true),
              style: { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }
            }
          ) : user.nome.slice(0, 2).toUpperCase() }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h4", { style: { margin: 0, fontSize: "16px", fontWeight: 600 }, children: user.nome }),
            /* @__PURE__ */ jsx("span", { style: { fontSize: "12px", color: "var(--vt-text-dim)" }, children: user.email })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { style: { borderTop: "1px solid var(--vt-border)", paddingTop: "16px" }, children: [
          /* @__PURE__ */ jsx("label", { style: { display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "8px" }, children: "Foto de Perfil" }),
          /* @__PURE__ */ jsxs("div", { style: { display: "flex", alignItems: "center", gap: "12px" }, children: [
            /* @__PURE__ */ jsx("div", { style: {
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              overflow: "hidden",
              border: "2px dashed var(--vt-border-hover)",
              background: "var(--vt-bg)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 auto",
              color: "var(--vt-text-muted)",
              fontSize: "11px",
              textAlign: "center"
            }, children: avatarPreview ? /* @__PURE__ */ jsx("img", { src: avatarPreview, alt: "Pré-visualização", style: { width: "100%", height: "100%", objectFit: "cover" } }) : user.avatar_url && !previewAvatarError ? /* @__PURE__ */ jsx(
              "img",
              {
                src: user.avatar_url,
                alt: user.nome,
                onError: () => setPreviewAvatarError(true),
                style: { width: "100%", height: "100%", objectFit: "cover" }
              }
            ) : "sem foto" }),
            /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", gap: "6px" }, children: [
              /* @__PURE__ */ jsx(
                "input",
                {
                  ref: avatarInputRef,
                  type: "file",
                  accept: "image/*",
                  onChange: handleAvatarSelect,
                  style: { display: "none" },
                  id: "vt-avatar-input"
                }
              ),
              /* @__PURE__ */ jsx("label", { htmlFor: "vt-avatar-input", className: "vt-btn vt-btn-outline", style: { fontSize: "13px", cursor: "pointer" }, children: user.avatar_url || avatarPreview ? "Trocar imagem" : "Escolher imagem" }),
              /* @__PURE__ */ jsx("span", { style: { fontSize: "11px", color: "var(--vt-text-dim)" }, children: "JPG, PNG ou WEBP — até 15 MB." })
            ] })
          ] }),
          avatarError && /* @__PURE__ */ jsx("span", { style: { display: "block", marginTop: "8px", fontSize: "12px", color: "var(--vt-error)" }, children: avatarError }),
          /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "flex-end", marginTop: "12px" }, children: /* @__PURE__ */ jsx(
            "button",
            {
              className: "vt-btn vt-btn-primary",
              disabled: !avatarPreview || avatarUploading,
              onClick: handleSaveAvatar,
              style: { fontSize: "13px", opacity: !avatarPreview || avatarUploading ? 0.5 : 1, cursor: !avatarPreview || avatarUploading ? "not-allowed" : "pointer" },
              children: avatarUploading ? "Salvando…" : "Salvar foto"
            }
          ) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "modal-footer", style: { borderTop: "1px solid var(--vt-border)", paddingTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }, children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "vt-btn vt-btn-outline",
            style: { width: "100%", textAlign: "left" },
            onClick: () => {
              navigate("/minha-conta/veiculos");
              closePerfilModal();
            },
            children: "🚗 Meus Veículos"
          }
        ),
        /* @__PURE__ */ jsxs(
          "button",
          {
            className: "vt-btn vt-btn-outline",
            style: { width: "100%", textAlign: "left" },
            onClick: () => setShowMfaModal(true),
            children: [
              "🔒 Verificação em duas etapas ",
              user.mfa_ativo ? "(ativada)" : ""
            ]
          }
        ),
        /* @__PURE__ */ jsxs("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" }, children: [
          /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-outline", style: { borderColor: "var(--vt-error)", color: "var(--vt-error)" }, onClick: async () => {
            const ok = await useUIStore.getState().confirm({
              title: "Sair da conta",
              message: "Deseja realmente encerrar sua sessão?",
              confirmLabel: "Sair",
              cancelLabel: "Cancelar",
              danger: true
            });
            if (ok) {
              logout();
              closePerfilModal();
            }
          }, children: "Sair da Conta" }),
          /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-outline", onClick: closePerfilModal, children: "Fechar" })
        ] })
      ] })
    ] }) }),
    /* @__PURE__ */ jsx(LoginModal, {}),
    showMfaModal && user && /* @__PURE__ */ jsx(
      MfaSettingsModal,
      {
        mfaAtivo: !!user.mfa_ativo,
        onClose: () => setShowMfaModal(false),
        onChange: (ativo) => updateUser({ mfa_ativo: ativo })
      }
    )
  ] });
}
function Favoritos() {
  const { isAuthenticated, openLoginModal } = useAuthStore();
  const [favoritos, setFavoritos] = useState([]);
  const [loading, setLoading] = useState(true);
  const fetchFavoritos = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.get("/vitrine/favoritos");
      setFavoritos(data);
    } catch (err) {
      console.error("Erro ao carregar favoritos:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchFavoritos();
  }, [isAuthenticated]);
  const handleFavoritar = async (veiculoId, favoritado) => {
    if (!isAuthenticated) {
      openLoginModal("login");
      return;
    }
    try {
      if (favoritado) {
        await api.delete(`/vitrine/favoritos/${veiculoId}`);
        setFavoritos((prev) => prev.filter((v) => v.id !== veiculoId));
      } else {
        await api.post("/vitrine/favoritos", { veiculo_id: veiculoId });
        fetchFavoritos();
      }
    } catch (err) {
      console.error("Erro ao favoritar/desfavoritar:", err);
    }
  };
  const handleConversar = async (veiculo) => {
    if (!isAuthenticated) {
      openLoginModal("login");
      return;
    }
    try {
      const msg = `Olá, estou interessado no veículo ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_modelo}).`;
      await api.post("/vitrine/conversas", {
        veiculo_id: veiculo.id,
        loja_id: veiculo.loja_id,
        mensagem: msg
      });
      useUIStore.getState().showToast("Conversa iniciada! Vá para a aba de Mensagens para conversar.", "success");
    } catch (err) {
      console.error("Erro ao iniciar conversa:", err);
    }
  };
  const handleWhatsApp = (veiculo) => {
    const text = `Olá! Vi o carro ${veiculo.marca} ${veiculo.modelo} (${veiculo.ano_fabricacao}/${veiculo.ano_modelo}) na Vitrine do Social Veículos e gostaria de mais informações.`;
    const link = whatsappLojaLink(veiculo.loja_whatsapp, text);
    if (!link) {
      useUIStore.getState().showToast("Esta loja não tem WhatsApp cadastrado. Use o chat interno.", "info");
      return;
    }
    window.open(link, "_blank");
  };
  const handleSeguir = async (lojaId, seguindo) => {
    if (!isAuthenticated) {
      openLoginModal("login");
      return;
    }
    setFavoritos((prev) => prev.map(
      (v) => v.loja_id === lojaId ? { ...v, seguindo_loja: !seguindo } : v
    ));
    try {
      if (seguindo) {
        await api.delete(`/vitrine/lojas/${lojaId}/seguir`);
      } else {
        await api.post(`/vitrine/lojas/${lojaId}/seguir`, {});
      }
    } catch {
      setFavoritos((prev) => prev.map(
        (v) => v.loja_id === lojaId ? { ...v, seguindo_loja: seguindo } : v
      ));
    }
  };
  if (!isAuthenticated) {
    return /* @__PURE__ */ jsxs("div", { className: "vt-page", style: { padding: "40px 20px", textAlign: "center", minHeight: "80vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }, children: [
      /* @__PURE__ */ jsx("h2", { children: "Faça login para ver seus favoritos" }),
      /* @__PURE__ */ jsx("p", { style: { color: "var(--vt-text-dim)", marginBottom: 20 }, children: "Você precisa estar autenticado para salvar e gerenciar seus veículos favoritos." }),
      /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-primary", onClick: () => openLoginModal("login"), children: "Entrar / Cadastrar" }),
      /* @__PURE__ */ jsx(LoginModal, {})
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "vt-page", style: { padding: "20px 16px", minHeight: "100vh", paddingBottom: 100 }, children: [
    /* @__PURE__ */ jsxs("header", { style: { marginBottom: 24 }, children: [
      /* @__PURE__ */ jsx("h1", { style: { fontSize: 24, fontWeight: 700, color: "var(--vt-text)" }, children: "Seus Favoritos" }),
      /* @__PURE__ */ jsx("p", { style: { color: "var(--vt-text-dim)", fontSize: 14 }, children: "Os veículos que você salvou para olhar depois." })
    ] }),
    loading ? /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: "40px 0" }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : favoritos.length === 0 ? /* @__PURE__ */ jsxs("div", { className: "empty-state", style: { background: "rgba(30,41,59,0.3)", padding: 40, borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)", textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", style: { width: 48, height: 48, opacity: 0.3, marginBottom: 12 }, children: /* @__PURE__ */ jsx("path", { d: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" }) }),
      /* @__PURE__ */ jsx("h3", { children: "Nenhum veículo favoritado" }),
      /* @__PURE__ */ jsx("p", { style: { color: "var(--vt-text-dim)" }, children: "Explore o feed e clique no coração para salvar veículos aqui." })
    ] }) : /* @__PURE__ */ jsx("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 20 }, children: favoritos.map((v) => /* @__PURE__ */ jsx(
      CarCard,
      {
        veiculo: v,
        onFavoritar: handleFavoritar,
        onConversar: handleConversar,
        onWhatsApp: handleWhatsApp,
        onSeguir: handleSeguir,
        isAuthenticated
      },
      v.id
    )) }),
    /* @__PURE__ */ jsx(LoginModal, {})
  ] });
}
function wsUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${p}`;
}
function createReconnectingSocket(path, opts) {
  const heartbeatMs = opts.heartbeatMs ?? 25e3;
  const maxDelay = opts.maxReconnectDelayMs ?? 3e4;
  let ws = null;
  let closedByUser = false;
  let attempt = 0;
  let reconnectTimer = null;
  let heartbeatTimer = null;
  const stopHeartbeat = () => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };
  const startHeartbeat = () => {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "ping" }));
        } catch {
        }
      }
    }, heartbeatMs);
  };
  const scheduleReconnect = () => {
    if (closedByUser || reconnectTimer !== null) return;
    attempt += 1;
    const capped = Math.min(1e3 * 2 ** (attempt - 1), maxDelay);
    const delay = capped / 2 + Math.random() * (capped / 2);
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  };
  const connect = () => {
    if (closedByUser) return;
    let socket;
    try {
      socket = new WebSocket(wsUrl(path));
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;
    socket.onopen = () => {
      var _a, _b;
      attempt = 0;
      startHeartbeat();
      (_a = opts.onStatusChange) == null ? void 0 : _a.call(opts, true);
      (_b = opts.onOpen) == null ? void 0 : _b.call(opts);
    };
    socket.onmessage = (event) => opts.onMessage(event);
    socket.onclose = () => {
      var _a;
      stopHeartbeat();
      (_a = opts.onStatusChange) == null ? void 0 : _a.call(opts, false);
      scheduleReconnect();
    };
    socket.onerror = () => {
      try {
        socket.close();
      } catch {
      }
    };
  };
  connect();
  return {
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === "string" ? data : JSON.stringify(data));
        return true;
      }
      return false;
    },
    close: () => {
      closedByUser = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      stopHeartbeat();
      try {
        ws == null ? void 0 : ws.close();
      } catch {
      }
      ws = null;
    },
    get readyState() {
      return ws ? ws.readyState : WebSocket.CLOSED;
    }
  };
}
function formatTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = /* @__PURE__ */ new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 864e5);
  if (diffDays === 0) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "ontem";
  if (diffDays < 7) return d.toLocaleDateString("pt-BR", { weekday: "short" });
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
function initials(nome) {
  return nome.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
const SendIcon = () => /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: [
  /* @__PURE__ */ jsx("line", { x1: "22", y1: "2", x2: "11", y2: "13" }),
  /* @__PURE__ */ jsx("polygon", { points: "22 2 15 22 11 13 2 9 22 2" })
] });
function Mensagens() {
  var _a, _b;
  const { isAuthenticated, token, openLoginModal } = useAuthStore();
  const userId = (_a = useAuthStore.getState().user) == null ? void 0 : _a.id;
  const location = useLocation();
  const initialConversaId = (_b = location.state) == null ? void 0 : _b.conversaId;
  const [conversas, setConversas] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [mensagens, setMensagens] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [loadingConversas, setLoadingConversas] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fetchConversas = async () => {
    if (!isAuthenticated) {
      setLoadingConversas(false);
      return;
    }
    setLoadingConversas(true);
    try {
      const data = await api.get("/vitrine/conversas");
      setConversas(data);
      setFiltered(data);
      if (initialConversaId) {
        const target = data.find((c) => c.id === initialConversaId);
        if (target) selectConversa(target);
      }
    } catch (err) {
      console.error("Erro ao buscar conversas:", err);
    } finally {
      setLoadingConversas(false);
    }
  };
  const fetchMensagens = async (conversaId) => {
    setLoadingMsgs(true);
    try {
      const data = await api.get(`/vitrine/conversas/${conversaId}/mensagens`);
      setMensagens(data);
    } catch (err) {
      console.error("Erro ao buscar mensagens:", err);
    } finally {
      setLoadingMsgs(false);
    }
  };
  useEffect(() => {
    fetchConversas();
  }, [isAuthenticated]);
  useEffect(() => {
    var _a2;
    if (!isAuthenticated || !token || !selected) {
      (_a2 = socketRef.current) == null ? void 0 : _a2.close();
      socketRef.current = null;
      return;
    }
    const sock = createReconnectingSocket(`/v1/vitrine/chat/ws?token=${token}`, {
      onMessage: (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.conversa_id === selected.id) {
            setMensagens((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]);
          }
          fetchConversas();
        } catch {
        }
      }
    });
    socketRef.current = sock;
    return () => {
      sock.close();
      socketRef.current = null;
    };
  }, [isAuthenticated, token, selected]);
  useEffect(() => {
    var _a2;
    (_a2 = messagesEndRef.current) == null ? void 0 : _a2.scrollIntoView({ behavior: "smooth" });
  }, [mensagens]);
  const selectConversa = (c) => {
    setSelected(c);
    fetchMensagens(c.id);
    setSidebarHidden(true);
  };
  const handleSearch = (q) => {
    setSearch(q);
    const lower = q.toLowerCase();
    setFiltered(conversas.filter(
      (c) => c.loja_nome.toLowerCase().includes(lower) || (c.ultima_mensagem ?? "").toLowerCase().includes(lower) || (c.veiculo_modelo ?? "").toLowerCase().includes(lower)
    ));
  };
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  };
  const handleSend = async (e) => {
    var _a2;
    const content = newMsg.trim();
    if (!content || !selected) return;
    setNewMsg("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    if (((_a2 = socketRef.current) == null ? void 0 : _a2.readyState) === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ conversa_id: selected.id, conteudo: content }));
    } else {
      try {
        await api.post(`/vitrine/conversas/${selected.id}/mensagens`, {
          veiculo_id: selected.veiculo_id || "",
          loja_id: selected.loja_id,
          mensagem: content
        });
        fetchMensagens(selected.id);
      } catch (err) {
        console.error("Erro ao enviar mensagem:", err);
      }
    }
  };
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };
  if (!isAuthenticated) {
    return /* @__PURE__ */ jsxs("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "80vh", gap: 16, padding: 24, textAlign: "center" }, children: [
      /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", style: { width: 56, height: 56, color: "var(--vt-text-muted)", opacity: 0.4 }, children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" }) }),
      /* @__PURE__ */ jsx("h2", { style: { fontSize: 18, fontWeight: 700 }, children: "Faça login para ver suas mensagens" }),
      /* @__PURE__ */ jsx("p", { style: { color: "var(--vt-text-dim)", fontSize: 14 }, children: "Converse direto com as lojas sobre os veículos de seu interesse." }),
      /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-primary", onClick: () => openLoginModal("login"), children: "Entrar / Cadastrar" }),
      /* @__PURE__ */ jsx(LoginModal, {})
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "vt-chat-shell", children: [
    /* @__PURE__ */ jsxs("div", { className: `vt-chat-sidebar${sidebarHidden ? " hidden" : ""}`, children: [
      /* @__PURE__ */ jsxs("div", { className: "vt-chat-sidebar-head", children: [
        /* @__PURE__ */ jsx("h2", { children: "Mensagens" }),
        /* @__PURE__ */ jsxs("div", { className: "vt-chat-search", children: [
          /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
            /* @__PURE__ */ jsx("circle", { cx: "11", cy: "11", r: "8" }),
            /* @__PURE__ */ jsx("line", { x1: "21", y1: "21", x2: "16.65", y2: "16.65" })
          ] }),
          /* @__PURE__ */ jsx(
            "input",
            {
              type: "text",
              placeholder: "Buscar conversa…",
              value: search,
              onChange: (e) => handleSearch(e.target.value)
            }
          )
        ] })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "vt-conv-list", children: loadingConversas ? /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 24 }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : filtered.length === 0 ? /* @__PURE__ */ jsx("div", { style: { padding: 24, textAlign: "center", color: "var(--vt-text-dim)", fontSize: 14 }, children: search ? "Nenhuma conversa encontrada." : "Nenhuma conversa ainda." }) : filtered.map((c) => /* @__PURE__ */ jsxs(
        "div",
        {
          className: `vt-conv-item${(selected == null ? void 0 : selected.id) === c.id ? " active" : ""}`,
          onClick: () => selectConversa(c),
          children: [
            /* @__PURE__ */ jsx("div", { className: "vt-conv-avatar", children: initials(c.loja_nome) }),
            /* @__PURE__ */ jsxs("div", { className: "vt-conv-info", children: [
              /* @__PURE__ */ jsx("div", { className: "vt-conv-name", children: c.loja_nome }),
              c.veiculo_modelo && /* @__PURE__ */ jsxs("div", { className: "vt-conv-sub", children: [
                c.veiculo_marca,
                " ",
                c.veiculo_modelo
              ] }),
              /* @__PURE__ */ jsx("div", { className: "vt-conv-preview", children: c.ultima_mensagem || "Nenhuma mensagem." })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "vt-conv-meta", children: /* @__PURE__ */ jsx("span", { className: "vt-conv-time", children: formatTime(c.ultima_mensagem_data) }) })
          ]
        },
        c.id
      )) })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "vt-chat-area", children: selected ? /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { className: "vt-chat-head", children: /* @__PURE__ */ jsxs("div", { className: "vt-chat-head-left", children: [
        /* @__PURE__ */ jsx("button", { className: "vt-chat-back", onClick: () => setSidebarHidden(false), children: /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", style: { width: 22, height: 22 }, children: /* @__PURE__ */ jsx("polyline", { points: "15 18 9 12 15 6" }) }) }),
        /* @__PURE__ */ jsx("div", { className: "vt-chat-head-avatar", children: initials(selected.loja_nome) }),
        /* @__PURE__ */ jsxs("div", { className: "vt-chat-head-info", children: [
          /* @__PURE__ */ jsx("h4", { children: selected.loja_nome }),
          /* @__PURE__ */ jsx("span", { children: "Loja parceira" })
        ] })
      ] }) }),
      selected.veiculo_modelo && /* @__PURE__ */ jsxs("div", { className: "vt-chat-vehicle", children: [
        /* @__PURE__ */ jsx("div", { className: "vt-chat-vehicle-thumb", children: /* @__PURE__ */ jsx("div", { style: { width: "100%", height: "100%", background: "var(--vt-surface-hover)" } }) }),
        /* @__PURE__ */ jsxs("div", { className: "vt-chat-vehicle-info", children: [
          /* @__PURE__ */ jsxs("strong", { children: [
            selected.veiculo_marca,
            " ",
            selected.veiculo_modelo
          ] }),
          /* @__PURE__ */ jsx("span", { children: "Ver anúncio" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-chat-messages", children: [
        loadingMsgs ? /* @__PURE__ */ jsx("div", { style: { display: "flex", justifyContent: "center", padding: 20 }, children: /* @__PURE__ */ jsx("div", { className: "spinner" }) }) : mensagens.map((m, i) => {
          const isMe = m.autor_id === userId;
          const prevIsMe = i > 0 && mensagens[i - 1].autor_id === userId;
          const showDate = i === 0 || new Date(m.created_at).toDateString() !== new Date(mensagens[i - 1].created_at).toDateString();
          return /* @__PURE__ */ jsxs(React.Fragment, { children: [
            showDate && /* @__PURE__ */ jsx("div", { className: "vt-msg-date", children: new Date(m.created_at).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }) }),
            /* @__PURE__ */ jsxs("div", { className: `vt-msg-row${isMe ? " me" : " other"}`, style: { marginTop: !isMe && prevIsMe || isMe && !prevIsMe ? 8 : 0 }, children: [
              !isMe && /* @__PURE__ */ jsx("div", { className: "vt-msg-avatar", children: initials(m.autor_nome) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("div", { className: "vt-msg-bubble", children: m.conteudo }),
                /* @__PURE__ */ jsx("div", { className: "vt-msg-time", children: new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) })
              ] })
            ] })
          ] }, m.id);
        }),
        /* @__PURE__ */ jsx("div", { ref: messagesEndRef })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "vt-chat-input-bar", children: [
        /* @__PURE__ */ jsx("div", { className: "vt-chat-input-wrap", children: /* @__PURE__ */ jsx(
          "textarea",
          {
            ref: textareaRef,
            rows: 1,
            placeholder: "Mensagem…",
            value: newMsg,
            onChange: (e) => {
              setNewMsg(e.target.value);
              autoResize();
            },
            onKeyDown: handleKeyDown
          }
        ) }),
        /* @__PURE__ */ jsx("button", { className: "vt-chat-send", onClick: () => handleSend(), disabled: !newMsg.trim(), children: /* @__PURE__ */ jsx(SendIcon, {}) })
      ] })
    ] }) : /* @__PURE__ */ jsxs("div", { className: "vt-chat-empty", children: [
      /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: /* @__PURE__ */ jsx("path", { d: "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" }) }),
      /* @__PURE__ */ jsx("p", { children: "Selecione uma conversa para começar" })
    ] }) }),
    /* @__PURE__ */ jsx(LoginModal, {})
  ] });
}
const isServer = typeof window === "undefined";
function apiBase() {
  var _a;
  if (isServer) {
    const env = (_a = globalThis.process) == null ? void 0 : _a.env;
    return (env == null ? void 0 : env.PRERENDER_API_URL) || "http://localhost:8000";
  }
  return "";
}
async function ssgFetch(path) {
  try {
    const res = await fetch(`${apiBase()}/v1${path}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function fetchVeiculo(id) {
  return ssgFetch(`/vitrine/veiculos/${id}`);
}
function fetchLoja(slug) {
  return ssgFetch(`/marketplace/loja/${slug}`);
}
function formatBRL$1(value) {
  if (value == null) return "Consulte";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function carroMeta(v) {
  var _a, _b, _c, _d, _e;
  const nome = `${v.marca} ${v.modelo}${v.versao ? " " + v.versao : ""} ${v.ano_modelo}`;
  const title = `${nome} — ${formatBRL$1(v.preco_venda)} | Social Veículos`;
  const description = ((_a = v.descricao) == null ? void 0 : _a.slice(0, 160)) || `${nome}, ${v.km.toLocaleString("pt-BR")} km, ${v.cor ?? ""} — à venda na Social Veículos.`;
  const image = ((_c = (_b = v.midias) == null ? void 0 : _b.find((m) => m.tipo === "foto")) == null ? void 0 : _c.url) || ((_e = (_d = v.midias) == null ? void 0 : _d[0]) == null ? void 0 : _e.url) || "";
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "Vehicle",
    name: nome,
    image: image || void 0,
    description,
    brand: { "@type": "Brand", name: v.marca },
    model: v.modelo,
    vehicleModelDate: String(v.ano_modelo),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: v.km, unitCode: "KMT" },
    offers: {
      "@type": "Offer",
      priceCurrency: "BRL",
      price: v.preco_venda ?? void 0,
      availability: "https://schema.org/InStock"
    }
  };
  return { title, description, image, jsonLd };
}
function lojaMeta(l) {
  const local = [l.cidade, l.estado].filter(Boolean).join(" - ");
  const title = `${l.nome} — Estoque${local ? " em " + local : ""} | Social Veículos`;
  const description = `Confira ${l.total_veiculos} veículo(s) à venda na ${l.nome}${local ? ", " + local : ""}. Loja${l.verificada ? " verificada" : ""} no Social Veículos.`;
  const jsonLd = {
    "@context": "https://schema.org/",
    "@type": "AutoDealer",
    name: l.nome,
    image: l.logo_url || void 0,
    address: local || void 0,
    telephone: l.whatsapp || void 0
  };
  return { title, description, image: l.logo_url || "", jsonLd };
}
function getSSGData() {
  const g = globalThis;
  return g.__SSG_DATA__ ?? null;
}
function MidiaView({ midia, className }) {
  if (midia.tipo === "video") {
    return /* @__PURE__ */ jsx("video", { src: midia.url, className, controls: true, preload: "metadata" });
  }
  return /* @__PURE__ */ jsx("img", { src: midia.url, alt: "", className, loading: "lazy" });
}
function CarroDetalhe({ initialData }) {
  const { id } = useParams();
  const seed = initialData ?? getSSGData();
  const [veiculo, setVeiculo] = useState(seed);
  const [loading, setLoading] = useState(!seed);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (seed && seed.id === id) return;
    let alive = true;
    setLoading(true);
    fetchVeiculo(id).then((v) => {
      if (!alive) return;
      if (v) setVeiculo(v);
      else setErro(true);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "vt-detail", children: "Carregando…" });
  }
  if (erro || !veiculo) {
    return /* @__PURE__ */ jsxs("div", { className: "vt-detail", children: [
      "Veículo não encontrado ou não está mais disponível.",
      " ",
      /* @__PURE__ */ jsx(Link, { to: "/", className: "vt-detail-back", children: "Voltar ao feed" })
    ] });
  }
  const meta = carroMeta(veiculo);
  const midias = [...veiculo.midias ?? []].sort((a, b) => a.ordem - b.ordem);
  const capa = midias[0];
  const opcionais = (() => {
    try {
      return veiculo.opcionais ? JSON.parse(veiculo.opcionais) : [];
    } catch {
      return [];
    }
  })();
  const whatsappHref = whatsappLojaLink(
    veiculo.loja_whatsapp,
    `Olá! Tenho interesse no ${veiculo.marca} ${veiculo.modelo} ${veiculo.ano_modelo}.`
  );
  return /* @__PURE__ */ jsxs("div", { className: "vt-detail", children: [
    /* @__PURE__ */ jsxs(Helmet, { children: [
      /* @__PURE__ */ jsx("title", { children: meta.title }),
      /* @__PURE__ */ jsx("meta", { name: "description", content: meta.description }),
      /* @__PURE__ */ jsx("meta", { property: "og:type", content: "product" }),
      /* @__PURE__ */ jsx("meta", { property: "og:title", content: meta.title }),
      /* @__PURE__ */ jsx("meta", { property: "og:description", content: meta.description }),
      meta.image && /* @__PURE__ */ jsx("meta", { property: "og:image", content: meta.image }),
      /* @__PURE__ */ jsx("meta", { name: "twitter:card", content: "summary_large_image" }),
      /* @__PURE__ */ jsx("script", { type: "application/ld+json", children: JSON.stringify(meta.jsonLd) })
    ] }),
    /* @__PURE__ */ jsx(Link, { to: "/", className: "vt-detail-back", children: "← Voltar" }),
    /* @__PURE__ */ jsxs("div", { className: "vt-detail-grid", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        capa ? /* @__PURE__ */ jsx("div", { className: "vt-detail-media", children: /* @__PURE__ */ jsx(MidiaView, { midia: capa }) }) : /* @__PURE__ */ jsx("div", { className: "vt-detail-media-empty", children: "Sem mídia" }),
        midias.length > 1 && /* @__PURE__ */ jsx("div", { className: "vt-detail-thumbs", children: midias.slice(1, 6).map((m) => /* @__PURE__ */ jsx(MidiaView, { midia: m }, m.id)) })
      ] }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsxs("h1", { className: "vt-detail-title", children: [
          veiculo.marca,
          " ",
          veiculo.modelo
        ] }),
        veiculo.versao && /* @__PURE__ */ jsx("div", { className: "vt-detail-subtitle", children: veiculo.versao }),
        /* @__PURE__ */ jsx("div", { className: "vt-detail-price", children: formatBRL$1(veiculo.preco_venda) }),
        /* @__PURE__ */ jsxs("div", { className: "vt-detail-specs", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Ano:" }),
            " ",
            veiculo.ano_fabricacao,
            "/",
            veiculo.ano_modelo
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Km:" }),
            " ",
            veiculo.km.toLocaleString("pt-BR"),
            " km"
          ] }),
          veiculo.cambio && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Câmbio:" }),
            " ",
            veiculo.cambio
          ] }),
          veiculo.combustivel && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Combustível:" }),
            " ",
            veiculo.combustivel
          ] }),
          veiculo.cor && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Cor:" }),
            " ",
            veiculo.cor
          ] }),
          veiculo.portas != null && /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("span", { children: "Portas:" }),
            " ",
            veiculo.portas
          ] })
        ] }),
        veiculo.descricao && /* @__PURE__ */ jsxs("div", { className: "vt-detail-section", children: [
          /* @__PURE__ */ jsx("h3", { children: "Descrição" }),
          /* @__PURE__ */ jsx("p", { children: veiculo.descricao })
        ] }),
        opcionais.length > 0 && /* @__PURE__ */ jsxs("div", { className: "vt-detail-section", children: [
          /* @__PURE__ */ jsx("h3", { children: "Opcionais" }),
          /* @__PURE__ */ jsx("div", { className: "vt-detail-chips", children: opcionais.map((o) => /* @__PURE__ */ jsx("span", { className: "vt-chip", children: o }, o)) })
        ] }),
        whatsappHref && /* @__PURE__ */ jsx(
          "a",
          {
            href: whatsappHref,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "vt-btn vt-btn-primary vt-btn-block",
            style: { marginTop: "1.5rem" },
            children: "Chamar no WhatsApp"
          }
        )
      ] })
    ] })
  ] });
}
function Loja({ initialData }) {
  const { slug } = useParams();
  const seed = initialData ?? getSSGData();
  const [loja, setLoja] = useState(seed);
  const [loading, setLoading] = useState(!seed);
  const [erro, setErro] = useState(false);
  useEffect(() => {
    if (seed && seed.slug === slug) return;
    let alive = true;
    setLoading(true);
    fetchLoja(slug).then((l) => {
      if (!alive) return;
      if (l) setLoja(l);
      else setErro(true);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [slug]);
  if (loading) return /* @__PURE__ */ jsx("div", { className: "vt-detail", children: "Carregando…" });
  if (erro || !loja) {
    return /* @__PURE__ */ jsxs("div", { className: "vt-detail", children: [
      "Loja não encontrada.",
      " ",
      /* @__PURE__ */ jsx(Link, { to: "/", className: "vt-detail-back", children: "Voltar ao feed" })
    ] });
  }
  const meta = lojaMeta(loja);
  const local = [loja.cidade, loja.estado].filter(Boolean).join(" - ");
  return /* @__PURE__ */ jsxs("div", { className: "vt-detail", children: [
    /* @__PURE__ */ jsxs(Helmet, { children: [
      /* @__PURE__ */ jsx("title", { children: meta.title }),
      /* @__PURE__ */ jsx("meta", { name: "description", content: meta.description }),
      /* @__PURE__ */ jsx("meta", { property: "og:type", content: "website" }),
      /* @__PURE__ */ jsx("meta", { property: "og:title", content: meta.title }),
      /* @__PURE__ */ jsx("meta", { property: "og:description", content: meta.description }),
      meta.image && /* @__PURE__ */ jsx("meta", { property: "og:image", content: meta.image }),
      /* @__PURE__ */ jsx("script", { type: "application/ld+json", children: JSON.stringify(meta.jsonLd) })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "vt-store-header", children: [
      loja.logo_url ? /* @__PURE__ */ jsx("img", { src: loja.logo_url, alt: loja.nome, className: "vt-store-logo" }) : /* @__PURE__ */ jsx("div", { className: "vt-store-logo-fallback", children: loja.nome.slice(0, 2).toUpperCase() }),
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("h1", { className: "vt-detail-title", children: loja.nome }),
        /* @__PURE__ */ jsxs("div", { className: "vt-store-meta", children: [
          local && /* @__PURE__ */ jsx("span", { children: local }),
          loja.verificada && /* @__PURE__ */ jsx("span", { className: "vt-store-verified", children: "✓ Loja Verificada" })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs("h2", { style: { marginBottom: "1rem" }, children: [
      "Veículos em Estoque (",
      loja.total_veiculos,
      ")"
    ] }),
    loja.veiculos.length === 0 ? /* @__PURE__ */ jsx("div", { className: "vt-empty", children: "Esta loja não tem veículos publicados no momento." }) : /* @__PURE__ */ jsx("div", { className: "vt-store-grid", children: loja.veiculos.map((v) => {
      const capa = [...v.midias ?? []].sort((a, b) => a.ordem - b.ordem)[0];
      return /* @__PURE__ */ jsxs(Link, { to: `/carro/${v.id}`, className: "vt-store-item", children: [
        capa ? capa.tipo === "video" ? /* @__PURE__ */ jsx("video", { src: capa.url, preload: "metadata", muted: true }) : /* @__PURE__ */ jsx("img", { src: capa.url, alt: `${v.marca} ${v.modelo}`, loading: "lazy" }) : /* @__PURE__ */ jsx("div", { className: "vt-store-item-empty" }),
        /* @__PURE__ */ jsxs("div", { className: "vt-store-item-body", children: [
          /* @__PURE__ */ jsxs("div", { className: "vt-store-item-title", children: [
            v.marca,
            " ",
            v.modelo
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "vt-store-item-sub", children: [
            v.ano_fabricacao,
            "/",
            v.ano_modelo,
            " · ",
            v.km.toLocaleString("pt-BR"),
            " km"
          ] }),
          /* @__PURE__ */ jsx("div", { className: "vt-store-item-price", children: formatBRL$1(v.preco_venda) })
        ] })
      ] }, v.id);
    }) })
  ] });
}
const formatBRL = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const TIPO_LABEL = {
  contrato: "Contrato",
  nota_fiscal: "Nota Fiscal",
  garantia: "Garantia",
  laudo: "Laudo",
  outro: "Documento"
};
function MeusVeiculos() {
  const { isAuthenticated, openLoginModal } = useAuthStore();
  const [veiculos, setVeiculos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState(null);
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    api.get("/vitrine/meus-veiculos").then(setVeiculos).catch(() => {
    }).finally(() => setLoading(false));
  }, [isAuthenticated]);
  if (!isAuthenticated) {
    return /* @__PURE__ */ jsxs("div", { className: "vt-empty-state", children: [
      /* @__PURE__ */ jsx("p", { children: "Faça login para ver seus veículos." }),
      /* @__PURE__ */ jsx("button", { className: "vt-btn-primary", onClick: () => openLoginModal("login"), children: "Entrar" })
    ] });
  }
  if (loading) {
    return /* @__PURE__ */ jsx("div", { className: "vt-loading", children: /* @__PURE__ */ jsx("span", { className: "vt-spinner" }) });
  }
  if (!veiculos.length) {
    return /* @__PURE__ */ jsxs("div", { className: "vt-empty-state", children: [
      /* @__PURE__ */ jsx("h3", { children: "Nenhum veículo encontrado" }),
      /* @__PURE__ */ jsx("p", { children: "Quando você comprar um veículo por uma loja da plataforma, ele aparecerá aqui com os documentos da venda." })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "vt-page", children: [
    /* @__PURE__ */ jsxs("div", { className: "vt-page-header", children: [
      /* @__PURE__ */ jsx("h2", { children: "Meus Veículos" }),
      /* @__PURE__ */ jsx("p", { style: { color: "var(--vt-text-secondary)", fontSize: 14 }, children: "Veículos adquiridos em lojas da plataforma" })
    ] }),
    /* @__PURE__ */ jsx("div", { className: "vt-meus-veiculos-list", children: veiculos.map((v) => /* @__PURE__ */ jsxs("div", { className: "vt-meu-veiculo-card", children: [
      v.foto_url && /* @__PURE__ */ jsx(
        "img",
        {
          src: v.foto_url,
          alt: `${v.marca} ${v.modelo}`,
          className: "vt-meu-veiculo-foto"
        }
      ),
      /* @__PURE__ */ jsxs("div", { className: "vt-meu-veiculo-info", children: [
        /* @__PURE__ */ jsxs("div", { className: "vt-meu-veiculo-titulo", children: [
          /* @__PURE__ */ jsxs("strong", { children: [
            v.marca,
            " ",
            v.modelo
          ] }),
          /* @__PURE__ */ jsx("span", { className: "vt-meu-veiculo-ano", children: v.ano_modelo })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "vt-meu-veiculo-meta", children: [
          v.cor && /* @__PURE__ */ jsx("span", { children: v.cor }),
          v.km !== null && /* @__PURE__ */ jsxs("span", { children: [
            v.km.toLocaleString("pt-BR"),
            " km"
          ] }),
          v.placa && /* @__PURE__ */ jsx("span", { children: v.placa })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "vt-meu-veiculo-loja", children: [
          "Comprado em: ",
          v.loja_nome
        ] }),
        v.valor_fipe_atual != null && /* @__PURE__ */ jsxs("div", { className: "vt-meu-veiculo-fipe", children: [
          "Valor FIPE atual: ",
          /* @__PURE__ */ jsx("strong", { children: formatBRL(v.valor_fipe_atual) })
        ] }),
        v.documentos.length > 0 && /* @__PURE__ */ jsx(
          "button",
          {
            className: "vt-btn-ghost",
            style: { marginTop: 8, fontSize: 13 },
            onClick: () => setExpandido(expandido === v.veiculo_id ? null : v.veiculo_id),
            children: expandido === v.veiculo_id ? "▲ Ocultar" : `▼ ${v.documentos.length} documento${v.documentos.length > 1 ? "s" : ""}`
          }
        ),
        expandido === v.veiculo_id && /* @__PURE__ */ jsx("div", { className: "vt-meu-veiculo-docs", children: v.documentos.map((d) => /* @__PURE__ */ jsxs(
          "a",
          {
            href: d.url,
            target: "_blank",
            rel: "noopener noreferrer",
            className: "vt-doc-item",
            children: [
              /* @__PURE__ */ jsx("span", { className: "vt-doc-tipo", children: TIPO_LABEL[d.tipo] ?? d.tipo }),
              /* @__PURE__ */ jsx("span", { className: "vt-doc-nome", children: d.nome }),
              /* @__PURE__ */ jsx("span", { className: "vt-doc-baixar", children: "↗" })
            ]
          },
          d.id
        )) })
      ] })
    ] }, v.veiculo_id)) })
  ] });
}
function InstitucionalLayout({
  titulo,
  subtitulo,
  children
}) {
  return /* @__PURE__ */ jsxs("div", { className: "vt-institucional", children: [
    /* @__PURE__ */ jsx(Link, { to: "/", className: "vt-inst-back", children: "← Voltar ao feed" }),
    /* @__PURE__ */ jsx("h1", { children: titulo }),
    subtitulo && /* @__PURE__ */ jsx("p", { className: "vt-inst-sub", children: subtitulo }),
    children
  ] });
}
function Sobre() {
  return /* @__PURE__ */ jsxs(
    InstitucionalLayout,
    {
      titulo: "Sobre a Social Veículos",
      subtitulo: "A rede social de carros da sua região.",
      children: [
        /* @__PURE__ */ jsx("p", { children: "A Social Veículos é uma vitrine social onde você acompanha, em um feed, os veículos anunciados pelas lojas parceiras da sua cidade. Diferente de um classificado tradicional, aqui você segue lojas, favorita carros e conversa direto com quem vende — tudo em um só lugar." }),
        /* @__PURE__ */ jsx("h2", { children: "Como funciona" }),
        /* @__PURE__ */ jsxs("ul", { children: [
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Explore o feed:" }),
            " role e descubra carros anunciados perto de você."
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Favorite:" }),
            " salve os veículos que te interessam para ver depois."
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Converse:" }),
            " fale com a loja pelo chat interno ou pelo WhatsApp."
          ] })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "Para lojas" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "É lojista e quer anunciar seu estoque na vitrine e organizar suas vendas?",
          " ",
          /* @__PURE__ */ jsx(
            "a",
            {
              href: whatsappLink("Olá! Quero saber como anunciar minha loja na Social Veículos."),
              target: "_blank",
              rel: "noopener noreferrer",
              children: "Fale com a gente"
            }
          ),
          "."
        ] })
      ]
    }
  );
}
function Termos() {
  return /* @__PURE__ */ jsxs(
    InstitucionalLayout,
    {
      titulo: "Termos de Uso",
      subtitulo: "Última atualização: julho de 2026",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "vt-inst-nota", children: [
          "⚠️ Rascunho inicial. ",
          /* @__PURE__ */ jsx("strong", { children: "[REVISAR COM ADVOGADO]" }),
          " antes de considerar juridicamente definitivo. O texto descreve o funcionamento real da plataforma na data acima."
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "1. Aceitação" }),
        /* @__PURE__ */ jsx("p", { children: 'Ao criar uma conta ou utilizar a Social Veículos (a "Plataforma"), você concorda com estes Termos de Uso. Se não concordar, não utilize a Plataforma.' }),
        /* @__PURE__ */ jsx("h2", { children: "2. O que a Plataforma é" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "A Social Veículos é uma vitrine que conecta pessoas interessadas em comprar veículos às lojas anunciantes. ",
          /* @__PURE__ */ jsx("strong", { children: "Não somos parte das negociações" }),
          ": não vendemos veículos, não intermediamos pagamentos e não garantimos o estado, a procedência ou o preço dos veículos anunciados. A responsabilidade pelo anúncio e pela venda é integralmente da loja anunciante."
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "3. Sua conta" }),
        /* @__PURE__ */ jsxs("ul", { children: [
          /* @__PURE__ */ jsx("li", { children: "Você é responsável por manter a confidencialidade da sua senha." }),
          /* @__PURE__ */ jsx("li", { children: "Os dados cadastrados devem ser verdadeiros e mantidos atualizados." }),
          /* @__PURE__ */ jsx("li", { children: "Contas podem ser suspensas em caso de uso indevido, fraude ou violação destes Termos." })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "4. Uso aceitável" }),
        /* @__PURE__ */ jsx("p", { children: "É proibido usar a Plataforma para:" }),
        /* @__PURE__ */ jsxs("ul", { children: [
          /* @__PURE__ */ jsx("li", { children: "Publicar conteúdo ilícito, ofensivo, enganoso ou que viole direitos de terceiros." }),
          /* @__PURE__ */ jsx("li", { children: "Coletar dados de outros usuários ou lojas sem autorização (scraping, automações)." }),
          /* @__PURE__ */ jsx("li", { children: "Tentar comprometer a segurança ou a disponibilidade da Plataforma." })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "5. Conteúdo dos anúncios" }),
        /* @__PURE__ */ jsx("p", { children: "Os anúncios (fotos, descrições, preços, disponibilidade) são de responsabilidade das lojas. A Social Veículos pode remover conteúdo que viole estes Termos ou a lei, a qualquer momento." }),
        /* @__PURE__ */ jsx("h2", { children: "6. Limitação de responsabilidade" }),
        /* @__PURE__ */ jsxs("p", { children: [
          'A Plataforma é fornecida "no estado em que se encontra". Na máxima extensão permitida em lei, a Social Veículos não se responsabiliza por prejuízos decorrentes de negociações entre usuários e lojas. ',
          /* @__PURE__ */ jsx("strong", { children: "[REVISAR COM ADVOGADO]" })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "7. Alterações" }),
        /* @__PURE__ */ jsx("p", { children: "Podemos atualizar estes Termos. Mudanças relevantes serão comunicadas na Plataforma. O uso continuado após a atualização significa concordância com a nova versão." }),
        /* @__PURE__ */ jsx("h2", { children: "8. Contato" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Dúvidas sobre estes Termos: ",
          /* @__PURE__ */ jsx("a", { href: `mailto:${CONTATO_EMAIL}`, children: CONTATO_EMAIL }),
          "."
        ] })
      ]
    }
  );
}
function Privacidade() {
  return /* @__PURE__ */ jsxs(
    InstitucionalLayout,
    {
      titulo: "Política de Privacidade",
      subtitulo: "Última atualização: julho de 2026 · Em conformidade com a LGPD (Lei 13.709/2018)",
      children: [
        /* @__PURE__ */ jsxs("div", { className: "vt-inst-nota", children: [
          "⚠️ Rascunho inicial fiel ao que a Plataforma coleta hoje.",
          " ",
          /* @__PURE__ */ jsx("strong", { children: "[REVISAR COM ADVOGADO]" }),
          " antes de considerar juridicamente definitivo."
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "1. Quem trata seus dados" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "A Social Veículos é a controladora dos dados coletados na vitrine pública. Para exercer seus direitos ou tirar dúvidas, use o canal em ",
          /* @__PURE__ */ jsx("a", { href: `mailto:${CONTATO_EMAIL}`, children: CONTATO_EMAIL }),
          ".",
          /* @__PURE__ */ jsx("strong", { children: " [REVISAR COM ADVOGADO — razão social, CNPJ e encarregado/DPO]" })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "2. Quais dados coletamos" }),
        /* @__PURE__ */ jsxs("ul", { children: [
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Cadastro:" }),
            " nome, e-mail e telefone informados na criação da conta."
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Autenticação:" }),
            " senha (armazenada apenas como hash, nunca em texto)."
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Uso da vitrine:" }),
            " veículos favoritados e lojas que você segue."
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Mensagens:" }),
            " conteúdo das conversas iniciadas com as lojas pelo chat interno."
          ] }),
          /* @__PURE__ */ jsxs("li", { children: [
            /* @__PURE__ */ jsx("strong", { children: "Dados técnicos:" }),
            " endereço IP e registros de acesso, para segurança e auditoria."
          ] })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "3. Para que usamos" }),
        /* @__PURE__ */ jsxs("ul", { children: [
          /* @__PURE__ */ jsx("li", { children: "Permitir seu acesso e o funcionamento das funcionalidades (favoritos, chat, contato com lojas)." }),
          /* @__PURE__ */ jsx("li", { children: "Conectar você às lojas anunciantes quando você inicia uma conversa ou clica em contato." }),
          /* @__PURE__ */ jsx("li", { children: "Segurança, prevenção a fraude e cumprimento de obrigações legais." })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "4. Compartilhamento" }),
        /* @__PURE__ */ jsx("p", { children: "Quando você entra em contato com uma loja (chat interno ou WhatsApp), os dados necessários ao atendimento (como seu nome e a mensagem) são compartilhados com aquela loja. Também usamos provedores de infraestrutura (hospedagem, armazenamento de imagens e envio de e-mail) que processam dados em nosso nome. Não vendemos seus dados." }),
        /* @__PURE__ */ jsx("h2", { children: "5. Seus direitos (LGPD)" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Você pode solicitar a qualquer momento: confirmação e acesso aos seus dados, correção, anonimização, portabilidade, eliminação e revogação de consentimento. Basta escrever para",
          " ",
          /* @__PURE__ */ jsx("a", { href: `mailto:${CONTATO_EMAIL}`, children: CONTATO_EMAIL }),
          "."
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "6. Retenção e exclusão" }),
        /* @__PURE__ */ jsxs("p", { children: [
          "Mantemos seus dados enquanto sua conta existir e pelo prazo necessário ao cumprimento de obrigações legais. Você pode pedir a exclusão da conta pelo canal acima.",
          /* @__PURE__ */ jsx("strong", { children: " [REVISAR COM ADVOGADO — prazos legais de retenção]" })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "7. Segurança" }),
        /* @__PURE__ */ jsx("p", { children: "Adotamos medidas técnicas para proteger seus dados, incluindo senhas armazenadas com hash e controle de acesso. Nenhum sistema é 100% imune, mas trabalhamos para reduzir riscos." }),
        /* @__PURE__ */ jsx("h2", { children: "8. Alterações" }),
        /* @__PURE__ */ jsx("p", { children: "Esta Política pode ser atualizada. Mudanças relevantes serão comunicadas na Plataforma." })
      ]
    }
  );
}
function Anuncie() {
  const msg = "Olá! Tenho uma loja de veículos e quero anunciar meu estoque na Social Veículos.";
  return /* @__PURE__ */ jsxs(
    InstitucionalLayout,
    {
      titulo: "Anuncie sua loja",
      subtitulo: "Coloque seu estoque na frente de compradores da sua cidade.",
      children: [
        /* @__PURE__ */ jsx("p", { children: "A Social Veículos reúne, num feed social, os veículos das lojas da região. Sua loja ganha vitrine pública com SEO, chat com o comprador e uma ponte direta para o WhatsApp — além do painel de gestão de estoque, clientes e vendas." }),
        /* @__PURE__ */ jsx("h2", { children: "O que sua loja recebe" }),
        /* @__PURE__ */ jsxs("ul", { children: [
          /* @__PURE__ */ jsx("li", { children: "Vitrine pública dos seus veículos, otimizada para busca no Google." }),
          /* @__PURE__ */ jsx("li", { children: "Chat interno com compradores e integração com WhatsApp." }),
          /* @__PURE__ */ jsx("li", { children: "Painel de estoque, CRM de clientes e acompanhamento de vendas." })
        ] }),
        /* @__PURE__ */ jsx("h2", { children: "Quero anunciar" }),
        /* @__PURE__ */ jsx("p", { children: "No momento o cadastro de lojas é feito com atendimento direto da nossa equipe. Chame no WhatsApp que a gente coloca sua loja no ar:" }),
        /* @__PURE__ */ jsx("a", { className: "vt-inst-cta", href: whatsappLink(msg), target: "_blank", rel: "noopener noreferrer", children: "Falar no WhatsApp" }),
        /* @__PURE__ */ jsxs("p", { style: { marginTop: 16 }, children: [
          "Prefere e-mail? Escreva para",
          " ",
          /* @__PURE__ */ jsx("a", { href: `mailto:${CONTATO_EMAIL}`, children: CONTATO_EMAIL }),
          "."
        ] })
      ]
    }
  );
}
function GoogleCallback() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((state) => state.login);
  const [erro, setErro] = useState(null);
  const [mfaChallengeToken, setMfaChallengeToken] = useState(null);
  const [mfaCodigo, setMfaCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const erroParam = params.get("erro");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const challenge = params.get("mfa_challenge_token");
    if (erroParam) {
      setErro(
        erroParam === "conta_inativa" ? "Esta conta está inativa." : "Não foi possível concluir o login com o Google."
      );
      return;
    }
    if (challenge) {
      setMfaChallengeToken(challenge);
      return;
    }
    if (accessToken && refreshToken) {
      finalizarComToken(accessToken, refreshToken);
    } else {
      setErro("Resposta inválida do login com Google.");
    }
  }, []);
  async function finalizarComToken(accessToken, refreshToken) {
    try {
      loginStore(accessToken, refreshToken, { id: "", nome: "", email: "", papel: "cliente", ativo: true });
      const me = await api.get("/auth/me");
      loginStore(accessToken, refreshToken, me);
      navigate("/", { replace: true });
    } catch {
      setErro("Não foi possível concluir o login com o Google.");
    }
  }
  async function handleMfaSubmit(e) {
    e.preventDefault();
    if (!mfaChallengeToken || mfaCodigo.length !== 6) return;
    setLoading(true);
    setErro(null);
    try {
      const data = await api.post("/auth/mfa/verify-login", {
        mfa_challenge_token: mfaChallengeToken,
        codigo: mfaCodigo
      });
      loginStore(data.access_token, data.refresh_token, data.user);
      navigate("/", { replace: true });
    } catch (err) {
      setErro(err.message || "Código inválido.");
    } finally {
      setLoading(false);
    }
  }
  if (erro) {
    return /* @__PURE__ */ jsxs("div", { className: "vt-callback-page", children: [
      /* @__PURE__ */ jsx("p", { children: erro }),
      /* @__PURE__ */ jsx("button", { className: "vt-btn vt-btn-primary", onClick: () => navigate("/", { replace: true }), children: "Voltar ao início" })
    ] });
  }
  if (mfaChallengeToken) {
    return /* @__PURE__ */ jsx("div", { className: "vt-callback-page", children: /* @__PURE__ */ jsxs("form", { onSubmit: handleMfaSubmit, className: "vt-modal-form", children: [
      /* @__PURE__ */ jsx("label", { children: "Código do autenticador" }),
      /* @__PURE__ */ jsx(
        "input",
        {
          type: "text",
          inputMode: "numeric",
          placeholder: "000000",
          maxLength: 6,
          value: mfaCodigo,
          onChange: (e) => setMfaCodigo(e.target.value.replace(/\D/g, "")),
          required: true,
          autoFocus: true,
          disabled: loading
        }
      ),
      /* @__PURE__ */ jsx("button", { type: "submit", className: "vt-btn vt-btn-primary", disabled: loading || mfaCodigo.length !== 6, children: loading ? "Confirmando..." : "Confirmar código" })
    ] }) });
  }
  return /* @__PURE__ */ jsx("div", { className: "vt-callback-page", children: /* @__PURE__ */ jsx("p", { children: "Concluindo login com Google..." }) });
}
function UIProvider() {
  const { toasts, removeToast, confirmState, _resolveConfirm } = useUIStore();
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx("div", { className: "vt-toast-container", children: toasts.map((toast) => /* @__PURE__ */ jsxs("div", { className: `vt-toast vt-toast-${toast.type}`, children: [
      /* @__PURE__ */ jsxs("span", { className: "vt-toast-icon", children: [
        toast.type === "success" && /* @__PURE__ */ jsx("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: /* @__PURE__ */ jsx("polyline", { points: "20 6 9 17 4 12" }) }),
        toast.type === "error" && /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: [
          /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
          /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
        ] }),
        toast.type === "warning" && /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: [
          /* @__PURE__ */ jsx("path", { d: "M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" }),
          /* @__PURE__ */ jsx("line", { x1: "12", y1: "9", x2: "12", y2: "13" }),
          /* @__PURE__ */ jsx("line", { x1: "12", y1: "17", x2: "12.01", y2: "17" })
        ] }),
        toast.type === "info" && /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", children: [
          /* @__PURE__ */ jsx("circle", { cx: "12", cy: "12", r: "10" }),
          /* @__PURE__ */ jsx("line", { x1: "12", y1: "16", x2: "12", y2: "12" }),
          /* @__PURE__ */ jsx("line", { x1: "12", y1: "8", x2: "12.01", y2: "8" })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("span", { className: "vt-toast-message", children: [
        toast.message,
        toast.details && /* @__PURE__ */ jsxs("details", { className: "vt-toast-details", children: [
          /* @__PURE__ */ jsx("summary", { children: "Detalhes técnicos" }),
          /* @__PURE__ */ jsxs("ul", { children: [
            toast.details.status && /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx("b", { children: "Código:" }),
              " ",
              toast.details.status
            ] }),
            toast.details.path && /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx("b", { children: "Rota:" }),
              " ",
              toast.details.path
            ] }),
            toast.details.timestamp && /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx("b", { children: "Horário:" }),
              " ",
              new Date(toast.details.timestamp).toLocaleTimeString("pt-BR")
            ] }),
            toast.details.requestId && /* @__PURE__ */ jsxs("li", { children: [
              /* @__PURE__ */ jsx("b", { children: "ID:" }),
              " ",
              toast.details.requestId
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("button", { className: "vt-toast-close", onClick: () => removeToast(toast.id), children: /* @__PURE__ */ jsxs("svg", { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [
        /* @__PURE__ */ jsx("line", { x1: "18", y1: "6", x2: "6", y2: "18" }),
        /* @__PURE__ */ jsx("line", { x1: "6", y1: "6", x2: "18", y2: "18" })
      ] }) })
    ] }, toast.id)) }),
    confirmState && /* @__PURE__ */ jsx("div", { className: "vt-confirm-overlay", onClick: () => _resolveConfirm(false), children: /* @__PURE__ */ jsxs("div", { className: "vt-confirm-dialog", role: "alertdialog", "aria-modal": "true", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsx("p", { className: "vt-confirm-title", children: confirmState.title }),
      confirmState.message && /* @__PURE__ */ jsx("p", { className: "vt-confirm-message", children: confirmState.message }),
      /* @__PURE__ */ jsxs("div", { className: "vt-confirm-actions", children: [
        /* @__PURE__ */ jsx(
          "button",
          {
            className: "vt-btn vt-btn-outline",
            onClick: () => _resolveConfirm(false),
            autoFocus: true,
            children: confirmState.cancelLabel ?? "Cancelar"
          }
        ),
        /* @__PURE__ */ jsx(
          "button",
          {
            className: `vt-btn ${confirmState.danger ? "vt-btn-danger" : "vt-btn-primary"}`,
            onClick: () => _resolveConfirm(true),
            children: confirmState.confirmLabel ?? "Confirmar"
          }
        )
      ] })
    ] }) })
  ] });
}
function App() {
  return /* @__PURE__ */ jsxs(Fragment, { children: [
    /* @__PURE__ */ jsx(UIProvider, {}),
    /* @__PURE__ */ jsxs(Routes, { children: [
      /* @__PURE__ */ jsx(Route, { index: true, element: /* @__PURE__ */ jsx(Feed, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/favoritos", element: /* @__PURE__ */ jsx(Favoritos, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/mensagens", element: /* @__PURE__ */ jsx(Mensagens, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/carro/:id", element: /* @__PURE__ */ jsx(CarroDetalhe, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/loja/:slug", element: /* @__PURE__ */ jsx(Loja, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/minha-conta/veiculos", element: /* @__PURE__ */ jsx(MeusVeiculos, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/sobre", element: /* @__PURE__ */ jsx(Sobre, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/termos", element: /* @__PURE__ */ jsx(Termos, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/privacidade", element: /* @__PURE__ */ jsx(Privacidade, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/anuncie", element: /* @__PURE__ */ jsx(Anuncie, {}) }),
      /* @__PURE__ */ jsx(Route, { path: "/auth/google/callback", element: /* @__PURE__ */ jsx(GoogleCallback, {}) })
    ] })
  ] });
}
function render(url, ssgData) {
  globalThis.__SSG_DATA__ = ssgData;
  const rendered = renderToString(
    /* @__PURE__ */ jsx(HelmetProvider, { children: /* @__PURE__ */ jsx(StaticRouter, { location: url, children: /* @__PURE__ */ jsx(App, {}) }) })
  );
  delete globalThis.__SSG_DATA__;
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
  }).replace(/<script type="application\/ld\+json"[^>]*>.*?<\/script>/gis, (m) => {
    headTags.push(m);
    return "";
  });
  return { html, head: headTags.join("\n    ") };
}
export {
  render
};
