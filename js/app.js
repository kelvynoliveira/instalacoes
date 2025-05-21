// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, getDocs, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { campi } from "./campi.js";
import { metas } from "./metas.js";

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

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userInfo = document.getElementById("user-info");

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

const map = L.map("map").setView([-15.8, -47.9], 4);

const tileLight = L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19
});

const tileDark = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 19
});

const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);
let currentTileLayer = savedTheme === "light" ? tileLight : tileDark;
currentTileLayer.addTo(map);

document.getElementById("toggle-theme").addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
  const newTheme = currentTheme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", newTheme);
  localStorage.setItem("theme", newTheme);

  map.removeLayer(currentTileLayer);
  currentTileLayer = newTheme === "light" ? tileLight : tileDark;
  currentTileLayer.addTo(map);
});

const toggleLegendBtn = document.getElementById("toggle-legend");
const mapLegend = document.getElementById("map-legend");

if (toggleLegendBtn && mapLegend) {
  toggleLegendBtn.addEventListener("click", () => {
    mapLegend.classList.toggle("legend-collapsed");
    toggleLegendBtn.classList.toggle("hide-icon");
  });
}

const logos = {
  "ages": "logos/ages.jpg",
  "una": "logos/una.png",
  "unifg": "logos/unifg.png",
  "fg": "logos/fg.png",
  "fpb": "logos/fpb.png",
  "unp": "logos/unp.png",
  "uam": "logos/uam.png",
  "unifacs": "logos/unifacs.jpg",
  "ibmr": "logos/ibmr.png",
  "faseh": "logos/faseh.png",
  "unibh": "logos/unibh.png",
  "unisociesc": "logos/unisociesc.png",
  "unisul": "logos/unisul.png",
  "unr": "logos/unr.png",
  "usjt": "logos/usjt.jpg",
  "faders": "logos/fadergs.png"
};

const defaultIcon = L.icon({
  iconUrl: 'logos/anima.png',
  iconSize: [30, 30],
  iconAnchor: [15, 30],
  popupAnchor: [0, -30]
});

const markers = L.markerClusterGroup();

campi.forEach(campus => {
  const marcaKey = campus.Marca.toLowerCase();
  const icon = L.icon({
    iconUrl: logos[marcaKey] || 'logos/anima.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  const popupContent = `
    <strong>${campus.Marca}</strong><br>
    ${campus.Campus}<br>
    ${campus.Cidade} - ${campus.Estado}<br>
    <button class="open-panel-btn" 
            data-marca="${campus.Marca}" 
            data-campus="${campus.Campus}" 
            data-progresso="0">
      Atualizar status
    </button>
  `;

  const marker = L.marker([campus.Latitude, campus.Longitude], { icon })
    .bindPopup(popupContent);

  markers.addLayer(marker);

  marker.on("popupopen", (e) => {
    const popupNode = e.popup.getElement();
    const btn = popupNode.querySelector(".open-panel-btn");
    if (btn) {
      btn.addEventListener("click", () => {
        abrirPainel(btn.dataset.marca, btn.dataset.campus, btn.dataset.progresso);
      });
    }
  });
});

map.addLayer(markers);

function abrirPainel(marca, campus, progresso) {
  document.getElementById("side-panel").classList.remove("hidden");
  document.getElementById("panel-title").innerText = `${marca} - ${campus} (${progresso}% concluído)`;
  document.getElementById("campus-form").setAttribute("data-campus", `${marca}|${campus}`);
}

document.getElementById("fechar-painel").addEventListener("click", () => {
  document.getElementById("side-panel").classList.add("hidden");
});

function mostrarToast(mensagem, tipo = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = mensagem;
  toast.className = tipo === "error" ? "toast error" : "toast success";
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

document.getElementById("campus-form").addEventListener("submit", async (e) => {
  e.preventDefault();

  const form = e.target;
  const campusKey = form.getAttribute("data-campus");
  const tipo = document.getElementById("tipo").value;
  const mac = document.getElementById("mac_address").value.trim();
  const serial = document.getElementById("serial_number").value.trim();
  const status = document.getElementById("status").value;
  const dataInstalacao = document.getElementById("data").value;
  const observacoes = document.getElementById("obs").value.trim();

  if (mac.length !== 17 || !/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac)) {
    document.getElementById("mac_address").classList.add("invalid");
    mostrarToast("Por favor, insira um MAC Address válido!", "error");
    return;
  }

  try {
    await addDoc(collection(db, "equipamentos"), {
      campus: campusKey,
      tipo: tipo,
      mac_address: mac,
      serial_number: serial,
      status: status,
      data_instalacao: dataInstalacao,
      observacoes: observacoes,
      timestamp: new Date()
    });

    mostrarToast("Equipamento salvo com sucesso!");
    form.reset();
    document.getElementById("side-panel").classList.add("hidden");
  } catch (error) {
    console.error("Erro ao salvar no Firestore:", error);
    mostrarToast("Erro ao salvar no Firestore!", "error");
  }
});

function getColor(percentual) {
  if (percentual <= 10) return '#d73027';
  if (percentual <= 25) return '#fc8d59';
  if (percentual <= 50) return '#fee08b';
  if (percentual <= 85) return '#d9ef8b';
  if (percentual <= 99) return '#91cf60';
  return '#1a9850';
}

async function calcularProgresso() {
  const equipamentosSnapshot = await getDocs(collection(db, "equipamentos"));
  const contagemAtual = {};

  equipamentosSnapshot.forEach((doc) => {
    const data = doc.data();
    const [marca, campus] = (data.campus || "").split("|").map(e => e.trim());
    const tipo = data.tipo;
    if (!marca || !campus || !tipo) return;

    contagemAtual[marca] ??= {};
    contagemAtual[marca][campus] ??= {};
    contagemAtual[marca][campus][tipo] ??= 0;
    contagemAtual[marca][campus][tipo]++;
  });

  const progressoSoma = {};
  const progressoCount = {};

  for (const marca in metas) {
    for (const campus in metas[marca]) {
      const metasCampus = metas[marca][campus];
      const atuaisCampus = contagemAtual[marca]?.[campus] || {};

      let totalMeta = 0;
      let totalAtual = 0;

      for (const tipo in metasCampus) {
        const meta = metasCampus[tipo];
        const atual = atuaisCampus[tipo] || 0;
        totalMeta += meta;
        totalAtual += atual;
      }

      const campusInfo = campi.find(c => c.Marca === marca && c.Campus === campus);
      if (campusInfo) {
        const percentual = totalMeta === 0 ? 0 : Math.round((totalAtual / totalMeta) * 100);
        progressoSoma[campusInfo.Estado] ??= 0;
        progressoCount[campusInfo.Estado] ??= 0;
        progressoSoma[campusInfo.Estado] += percentual;
        progressoCount[campusInfo.Estado]++;
      }
    }
  }

  const progressoPorEstado = {};
  for (const estado in progressoSoma) {
    progressoPorEstado[estado] = Math.round(progressoSoma[estado] / progressoCount[estado]);
  }

  return progressoPorEstado;
}

calcularProgresso().then(progressoPorEstado => {
  fetch("data/brazil-states.geojson")
    .then(response => response.json())
    .then(geoData => {
      L.geoJSON(geoData, {
        style: feature => {
          const sigla = feature.properties.sigla || feature.properties.UF;
          const progresso = progressoPorEstado[sigla];

          if (progresso === undefined) {
            return {
              fillColor: "transparent",
              color: "#eee",
              dashArray: "2,4",
              weight: 0.5,
              fillOpacity: 0
            };
          }

          return {
            fillColor: getColor(progresso),
            color: "#333",
            weight: 1,
            fillOpacity: 0.7
          };
        },
        onEachFeature: (feature, layer) => {
          const sigla = feature.properties.sigla || feature.properties.UF;
          const progresso = progressoPorEstado[sigla] || 0;
          const nome = feature.properties.nome || sigla;

          const temCampus = campi.some(campus => campus.Estado === sigla);
          if (temCampus) {
            layer.bindPopup(`<strong>${nome}</strong><br>Progresso: ${progresso}%`);
          }

          layer.on('click', () => {
            map.fitBounds(layer.getBounds());
            layer.setStyle({
              weight: 3,
              color: document.documentElement.getAttribute('data-theme') === 'dark' ? '#fff' : '#000',
              dashArray: "",
              fillOpacity: 0.9
            });
            setTimeout(() => {
              layer.setStyle({ weight: 1, color: "#333", dashArray: "", fillOpacity: 0.7 });
            }, 4000);
          });
        }
      }).addTo(map);
    })
    .catch(error => console.error("Erro ao carregar GeoJSON:", error));
});
