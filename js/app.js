// app.js atualizado
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { campi } from "./campi.js";

// Firebase config
const firebaseConfig = { /* seus dados */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const toggleBtn = document.getElementById("toggle-theme");
const toggleLegendBtn = document.getElementById("toggle-legend");
const mapLegend = document.getElementById("map-legend");
const spinner = document.getElementById("spinner");

// Autenticação
loginBtn.onclick = () => {
  signInWithPopup(auth, provider).then(result => {
    const user = result.user;
    userInfo.textContent = `Olá, ${user.displayName}`;
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline";
  });
};
logoutBtn.onclick = () => {
  signOut(auth).then(() => {
    userInfo.textContent = "";
    loginBtn.style.display = "inline";
    logoutBtn.style.display = "none";
  });
};

// Mapa
const map = L.map("map").setView([-15.8, -47.9], 4);
const tileLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; CARTO', subdomains: "abcd", maxZoom: 19 });
const tileDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; CARTO', subdomains: "abcd", maxZoom: 19 });

// Tema
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
let currentTileLayer = savedTheme === "light" ? tileLight : tileDark;
currentTileLayer.addTo(map);

toggleBtn.addEventListener("click", () => {
  const newTheme = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  map.removeLayer(currentTileLayer);
  currentTileLayer = newTheme === "light" ? tileLight : tileDark;
  currentTileLayer.addTo(map);
});

// Spinner
map.on("loading", () => { spinner.classList.remove("hidden"); });
map.on("load", () => { spinner.classList.add("hidden"); });

// Botão legenda
if (toggleLegendBtn && mapLegend) {
  toggleLegendBtn.addEventListener("click", () => {
    mapLegend.classList.toggle("legend-collapsed");
    toggleLegendBtn.classList.toggle("hide-icon");
  });
}

// Markers
campi.forEach(campus => {
  const marker = L.marker([campus.Latitude, campus.Longitude]).bindPopup(
    `<strong>${campus.Marca}</strong><br>${campus.Campus}<br>${campus.Cidade} - ${campus.Estado}<br><button class='open-panel-btn' data-marca='${campus.Marca}' data-campus='${campus.Campus}'>Atualizar status</button>`
  ).addTo(map);

  marker.on("popupopen", (e) => {
    const btn = e.popup.getElement().querySelector(".open-panel-btn");
    if (btn) {
      btn.addEventListener("click", () => abrirPainel(btn.dataset.marca, btn.dataset.campus));
    }
  });
});

// Painel lateral
function abrirPainel(marca, campus) {
  document.getElementById("side-panel").classList.remove("hidden");
  document.getElementById("panel-title").innerText = `${marca} - ${campus}`;
  document.getElementById("campus-form").setAttribute("data-campus", `${marca}|${campus}`);
}
document.getElementById("fechar-painel").onclick = () => document.getElementById("side-panel").classList.add("hidden");

// Formulário
const macInput = document.getElementById("mac_address");
if (macInput) {
  macInput.addEventListener("input", () => {
    let v = macInput.value.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 12);
    macInput.value = v.match(/.{1,2}/g)?.join(":") || "";
    if (/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(macInput.value)) macInput.classList.remove("invalid");
  });
}

document.getElementById("campus-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const mac = macInput.value;
  if (!/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac)) {
    macInput.classList.add("invalid");
    mostrarToast("Por favor, insira um MAC Address válido!", "error");
    return;
  }
  macInput.classList.remove("invalid");
  mostrarToast("Equipamento salvo com sucesso!");
});

// GeoJSON
const progressoPorEstado = { MG:0, SP:75, BA:50, PE:100, GO:10, PA:98, SC:5, RS:25, RJ:0, PB:55, RN:70 };

fetch("data/brazil-states.geojson")
  .then(res => res.json())
  .then(geoData => {
    L.geoJSON(geoData, {
      style: feature => {
        const progresso = progressoPorEstado[feature.properties.sigla || feature.properties.UF];
        return progresso != null ? { fillColor: getColor(progresso), color: "#333", weight: 1, fillOpacity: 0.7 } : { fillColor: "transparent", color: "#eee", dashArray: "2,4", weight: 0.5, fillOpacity: 0 };
      },
      onEachFeature: (feature, layer) => {
        const sigla = feature.properties.sigla || feature.properties.UF;
        const progresso = progressoPorEstado[sigla] || 0;
        layer.bindPopup(`<strong>${feature.properties.nome}</strong><br>Progresso: ${progresso}%`);
        layer.on("click", () => {
          map.fitBounds(layer.getBounds());
          layer.setStyle({ weight: 3, color: "#000", dashArray: "", fillOpacity: 0.9 });
          setTimeout(() => layer.setStyle({ weight: 1, color: "#333", dashArray: "2,4", fillOpacity: 0.7 }), 3000);
        });
      }
    }).addTo(map);
  });

function getColor(p) {
  if (p === 0) return "#d73027";
  if (p <= 25) return "#fc8d59";
  if (p <= 50) return "#fee08b";
  if (p <= 85) return "#d9ef8b";
  if (p <= 99) return "#91cf60";
  return "#1a9850";
}

// Toast
function mostrarToast(msg, tipo = "success") {
  const toast = document.getElementById("toast");
  document.getElementById("toast-message").textContent = msg;
  const icon = document.getElementById("toast-icon");
  if (tipo === "error") {
    toast.classList.add("error-toast");
    icon.textContent = "❌";
  } else {
    toast.classList.remove("error-toast");
    icon.textContent = "✔️";
  }
  toast.classList.remove("hidden");
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.classList.add("hidden"), 400);
  }, 3000);
}
