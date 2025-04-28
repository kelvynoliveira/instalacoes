// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { campi } from "./campi.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyCInOO9hKImhDPZeIYLY2aUKfyeAROpaMU",
  authDomain: "mapa---projeto.firebaseapp.com",
  projectId: "mapa---projeto",
  storageBucket: "mapa---projeto.firebasestorage.app",
  messagingSenderId: "511686850523",
  appId: "1:511686850523:web:19f85f47eda8dcab6d99fe"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth();
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Elementos DOM
const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");
const toggleLegendBtn = document.getElementById("toggle-legend");
const mapLegend = document.getElementById("map-legend");
const toggleBtn = document.getElementById("toggle-theme");

// Login/Logout
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
const tileLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; <a href="https://carto.com/">CARTO</a>', subdomains: "abcd", maxZoom: 19 });
const tileDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { attribution: '&copy; <a href="https://carto.com/">CARTO</a>', subdomains: "abcd", maxZoom: 19 });

const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
let currentTileLayer = savedTheme === "light" ? tileLight : tileDark;
currentTileLayer.addTo(map);

toggleBtn.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);
  map.removeLayer(currentTileLayer);
  currentTileLayer = newTheme === "light" ? tileLight : tileDark;
  currentTileLayer.addTo(map);
});

// Legenda toggle
if (toggleLegendBtn && mapLegend) {
  toggleLegendBtn.addEventListener("click", () => {
    mapLegend.classList.toggle("legend-collapsed");
    toggleLegendBtn.classList.toggle("rotate");
  });
}

// Markers campi
campi.forEach(campus => {
  const popupContent = `
    <strong>${campus.Marca}</strong><br>
    ${campus.Campus}<br>
    ${campus.Cidade} - ${campus.Estado}<br>
    <button class="open-panel-btn" data-marca="${campus.Marca}" data-campus="${campus.Campus}">Atualizar status</button>
  `;

  const marker = L.marker([campus.Latitude, campus.Longitude])
    .bindPopup(popupContent)
    .addTo(map);

  marker.on("popupopen", (e) => {
    const popupNode = e.popup.getElement();
    const btn = popupNode.querySelector(".open-panel-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        abrirPainel(btn.dataset.marca, btn.dataset.campus);
      });
    }
  });
});

function abrirPainel(marca, campus) {
  document.getElementById("side-panel").classList.remove("hidden");
  document.getElementById("panel-title").innerText = `${marca} - ${campus}`;
  document.getElementById("campus-form").setAttribute("data-campus", `${marca}|${campus}`);
}

document.getElementById("fechar-painel").addEventListener("click", () => {
  document.getElementById("side-panel").classList.add("hidden");
});

window.abrirPainel = abrirPainel;

// Formulário
const macInput = document.getElementById("mac_address");
if (macInput) {
  macInput.addEventListener("input", () => {
    let value = macInput.value.toUpperCase().replace(/[^A-F0-9]/g, "");
    value = value.substring(0, 12);

    let formatted = "";
    for (let i = 0; i < value.length; i += 2) {
      if (i > 0) formatted += ":";
      formatted += value.substring(i, i + 2);
    }
    macInput.value = formatted;

    if (formatted.length === 17 && /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(formatted)) {
      macInput.classList.remove("invalid");
    }
  });
}

document.getElementById("campus-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const macField = document.getElementById("mac_address");
  const mac = macField.value;

  if (mac.length !== 17 || !/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac)) {
    macField.classList.add("invalid");
    mostrarToast("Por favor, insira um MAC Address válido!", "error");
    return;
  }

  macField.classList.remove("invalid");
  mostrarToast("Equipamento salvo com sucesso!");
});

// GeoJSON
let geojsonLayer;
fetch("data/brazil-states.geojson")
  .then(response => response.json())
  .then(geoData => {
    geojsonLayer = L.geoJSON(geoData, {
      style: feature => {
        const progressoPorEstado = { MG:0, SP:75, BA:50, PE:100, GO:10, PA:98, SC:5, RS:25, RJ:0, PB:55, RN:70 };
        const sigla = feature.properties.sigla || feature.properties.UF;
        const progresso = progressoPorEstado[sigla];

        if (progresso === undefined) {
          return { fillColor: "transparent", color: "#eee", dashArray: "2,4", weight: 0.5, fillOpacity: 0 };
        }

        return { fillColor: getColor(progresso), color: "#333", weight: 1, fillOpacity: 0.7 };
      },
      onEachFeature: (feature, layer) => {
        const sigla = feature.properties.sigla || feature.properties.UF;
        const progresso = progressoPorEstado[sigla] || 0;
        const nome = feature.properties.nome || sigla;

        layer.bindPopup(`<strong>${nome}</strong><br>Progresso: ${progresso}%`);

        layer.on('click', () => {
          map.fitBounds(layer.getBounds());
          layer.setStyle({ weight: 3, color: "#000", dashArray: "", fillOpacity: 0.9 });
          setTimeout(() => { geojsonLayer.resetStyle(layer); }, 2000);
        });
      }
    }).addTo(map);
  })
  .catch(error => console.error("Erro ao carregar GeoJSON:", error));

function getColor(percentual) {
  if (percentual === 0) return '#d73027';
  if (percentual <= 25) return '#fc8d59';
  if (percentual <= 50) return '#fee08b';
  if (percentual <= 85) return '#d9ef8b';
  if (percentual <= 99) return '#91cf60';
  return '#1a9850';
}

function mostrarToast(mensagem, tipo = "success") {
  const toast = document.getElementById("toast");
  const toastIcon = document.getElementById("toast-icon");
  const toastMessage = document.getElementById("toast-message");

  toastMessage.textContent = mensagem;

  if (tipo === "error") {
    toast.classList.add("error-toast");
    toastIcon.textContent = "❌";
  } else {
    toast.classList.remove("error-toast");
    toastIcon.textContent = "✔️";
  }

  toast.classList.remove("hidden");
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.classList.add("hidden");
      toast.classList.remove("error-toast");
    }, 400);
  }, 3000);
}
