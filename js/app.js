// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, getDocs, collection, addDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { campi } from "./campi.js";
import { metas } from "./metas.js";

let geoJsonLayer = null;      // Controla o layer do mapa
let unsubscribeEquipamentos = null; // Controla o listener do Firebase

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

onAuthStateChanged(auth, (user) => {
  const loginRequiredMsg = document.getElementById("login-required-message");
  const formFields = document.querySelectorAll("#campus-form input, #campus-form select, #campus-form button");
  
  const isAuthenticated = user && user.providerData?.some(provider => provider.providerId === 'google.com');
  
  if (isAuthenticated) {
    // Comportamento quando LOGADO
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'block';
    userInfo.textContent = user.displayName || user.email;
    loginRequiredMsg?.classList.add("hidden");
    
    // Habilita o formulário
    formFields.forEach(field => {
      field.disabled = false;
    });
    calcularResumoNacional();
    configurarListenerEquipamentos(); // Inicia o listener do Firebase
    calcularProgresso()              // Força a atualização do mapa
      .then(aplicarCoresNoMapa)
      .catch(error => console.error("Erro ao carregar mapa:", error));
    
  } else {
    // Comportamento quando NÃO LOGADO
    loginBtn.style.display = 'block';
    logoutBtn.style.display = 'none';
    userInfo.textContent = '';
    loginRequiredMsg?.classList.remove("hidden");
    
    // Desabilita o formulário
    formFields.forEach(field => {
      field.disabled = true;
    });

    // Remove o listener se existir
    if (unsubscribeEquipamentos) {
      unsubscribeEquipamentos();
      unsubscribeEquipamentos = null;
    }
  }
});

loginBtn.onclick = () => {
  signInWithPopup(auth, provider)
    .then(() => {
      configurarListenerEquipamentos(); // Adiciona o listener após login
      calcularProgresso()
        .then(aplicarCoresNoMapa)
        .catch(error => mostrarToast("Erro ao carregar dados iniciais", "error"));
    })
    .catch(error => mostrarToast("Falha no login", "error"));
};

logoutBtn.onclick = () => {
  if (unsubscribeEquipamentos) {
    unsubscribeEquipamentos(); // Remove o listener
    unsubscribeEquipamentos = null;
  }
  if (geoJsonLayer) {
    map.removeLayer(geoJsonLayer); // Limpa o mapa
    geoJsonLayer = null;
  }
  signOut(auth); // Desloga o usuário
};
function normalizarChave(texto) {
  return texto
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, "").toUpperCase();
}

async function abrirPainel(campusKey) {
const progressoAtual = await calcularProgresso();
  const campusInfo = campi.find(c => c.id === campusKey);
if (!campusInfo) {
    mostrarToast("Campus não encontrado!", "error");
    return;
  }

  const estado = campusInfo.Estado.trim().toUpperCase();
  const progressoReal = progressoAtual[estado] || 0;

  document.getElementById("side-panel").classList.remove("hidden");
  document.getElementById("panel-title").innerText = `${campusInfo.Marca} - ${campusInfo.Campus} (${progressoReal}% concluído)`;
  document.getElementById("campus-form").setAttribute("data-campus", campusKey);
}

// Adiciona listener para o filtro de marcas
document.getElementById("marca-filter")?.addEventListener("change", async (e) => {
  const marcaSelecionada = e.target.value;
  const dados = await calcularProgressoPorMarca(marcaSelecionada);
  atualizarUIPorMarca(dados);
});

// Chama na inicialização
document.addEventListener("DOMContentLoaded", () => {
  popularFiltroMarcas();
  calcularProgressoPorMarca().then(atualizarUIPorMarca);
});

// Atualiza também quando os equipamentos mudam
function configurarListenerEquipamentos() {
  if (unsubscribeEquipamentos) unsubscribeEquipamentos();
  
  unsubscribeEquipamentos = onSnapshot(collection(db, "equipamentos"), async (snapshot) => {
    calcularResumoNacional();
    await calcularProgresso().then(aplicarCoresNoMapa);
    
    // Atualiza também o progresso por marca
    const marcaSelecionada = document.getElementById("marca-filter")?.value || "todas";
    const dados = await calcularProgressoPorMarca(marcaSelecionada);
    atualizarUIPorMarca(dados);
  });
}
// Função para calcular totais
async function calcularResumoNacional() {
  try {
    // Busca todos os equipamentos
    const snapshot = await getDocs(collection(db, "equipamentos"));
    
    // Calcula metas totais
    let totalSwitches = 0;
    let totalNobreaks = 0;
    
    Object.values(metas).forEach(campus => {
      totalSwitches += campus.switch || 0;
      totalNobreaks += campus.nobreak || 0;
    });

    // Conta instalados
    let instaladosSwitches = 0;
    let instaladosNobreaks = 0;
    
    snapshot.forEach(doc => {
      const tipo = doc.data().tipo.toLowerCase();
      if (tipo === 'switch') instaladosSwitches++;
      if (tipo === 'nobreak') instaladosNobreaks++;
    });

    // Atualiza a UI
    atualizarUIResumo({
      switches: { instalados: instaladosSwitches, total: totalSwitches },
      nobreaks: { instalados: instaladosNobreaks, total: totalNobreaks }
    });
    
  } catch (error) {
    console.error("Erro ao calcular resumo:", error);
  }
}

// Função para popular o seletor de marcas
function popularFiltroMarcas() {
  const marcaFilter = document.getElementById("marca-filter");
  if (!marcaFilter) return;

  // Limpa opções existentes (mantendo apenas "Todas")
  while (marcaFilter.options.length > 1) {
    marcaFilter.remove(1);
  }

  // Obtém todas as marcas únicas dos campi
  const marcasUnicas = [...new Set(campi.map(c => c.Marca))];
  
  marcasUnicas.forEach(marca => {
    const option = document.createElement("option");
    option.value = marca;
    option.textContent = marca;
    marcaFilter.appendChild(option);
  });
}

// Função para calcular progresso por marca
async function calcularProgressoPorMarca(marca = null) {
  const equipamentosSnapshot = await getDocs(collection(db, "equipamentos"));
  
  // Objeto para armazenar totais por marca
  const totaisPorMarca = {};
  
  // Inicializa estrutura para todas as marcas
  campi.forEach(campus => {
    const marcaKey = campus.Marca;
    totaisPorMarca[marcaKey] = {
      switches: { instalados: 0, meta: 0 },
      nobreaks: { instalados: 0, meta: 0 }
    };
  });

  // Calcula metas totais por marca
  Object.entries(metas).forEach(([campusKey, meta]) => {
    const campusInfo = campi.find(c => c.id === normalizarChave(campusKey));
    if (!campusInfo) return;
    
    const marca = campusInfo.Marca;
    totaisPorMarca[marca].switches.meta += meta.switch || 0;
    totaisPorMarca[marca].nobreaks.meta += meta.nobreak || 0;
  });

  // Conta equipamentos instalados por marca
  equipamentosSnapshot.forEach(doc => {
    const data = doc.data();
    const campusKey = normalizarChave(data.campus || "");
    const tipo = (data.tipo || "").toLowerCase();
    
    const campusInfo = campi.find(c => c.id === campusKey);
    if (!campusInfo || !tipo) return;
    
    const marca = campusInfo.Marca;
    
    if (tipo === 'switch') {
      totaisPorMarca[marca].switches.instalados++;
    } else if (tipo === 'nobreak') {
      totaisPorMarca[marca].nobreaks.instalados++;
    }
  });

  // Se filtro por marca específica, retorna apenas essa
  if (marca && marca !== "todas") {
    return { [marca]: totaisPorMarca[marca] };
  }
  
  return totaisPorMarca;
}

// Função para atualizar a UI com os dados por marca
function atualizarUIPorMarca(dados) {
  const container = document.getElementById("marca-progress-container");
  if (!container) return;

  container.innerHTML = '<h3>Progresso da Marca</h3>'; // Título fixo

  Object.entries(dados).forEach(([marca, totais]) => {
    const marcaDiv = document.createElement("div");
    marcaDiv.className = "resumo-item";
    
    const switchPercent = Math.round((totais.switches.instalados / totais.switches.meta) * 100) || 0;
    const nobreakPercent = Math.round((totais.nobreaks.instalados / totais.nobreaks.meta) * 100) || 0;
    
    marcaDiv.innerHTML = `
      <div class="resumo-header">
        <i class="fas fa-building"></i>
        <span>${marca}</span>
      </div>
      <div class="resumo-dados">
        <span>Switches:</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${switchPercent}%"></div>
        </div>
        <span>${totais.switches.instalados}/${totais.switches.meta} (${switchPercent}%)</span>
      </div>
      <div class="resumo-dados">
        <span>Nobreaks:</span>
        <div class="progress-bar">
          <div class="progress" style="width: ${nobreakPercent}%"></div>
        </div>
        <span>${totais.nobreaks.instalados}/${totais.nobreaks.meta} (${nobreakPercent}%)</span>
      </div>
    `;
    
    container.appendChild(marcaDiv);
  });
}

// Função para atualizar a interface
function atualizarUIResumo(dados) {
  // Switches
  const switchPercent = (dados.switches.instalados / dados.switches.total) * 100 || 0;
  document.getElementById('switch-progress').style.width = `${switchPercent}%`;
  document.getElementById('switch-text').textContent = 
    `${dados.switches.instalados}/${dados.switches.total} (${Math.round(switchPercent)}%)`;

  // Nobreaks
  const nobreakPercent = (dados.nobreaks.instalados / dados.nobreaks.total) * 100 || 0;
  document.getElementById('nobreak-progress').style.width = `${nobreakPercent}%`;
  document.getElementById('nobreak-text').textContent = 
    `${dados.nobreaks.instalados}/${dados.nobreaks.total} (${Math.round(nobreakPercent)}%)`;
}

window.abrirPainel = abrirPainel;

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
            data-campus="${campus.id}"
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
        abrirPainel(btn.dataset.campus);
      });
    }
  });
});

map.addLayer(markers);

document.getElementById("fechar-painel").addEventListener("click", () => {
  document.getElementById("side-panel").classList.add("hidden");
});

// Corrigir MAC ao digitar
const macInput = document.getElementById("mac_address");
if (macInput) {
  macInput.addEventListener("input", () => {
    let value = macInput.value.toUpperCase().replace(/[^A-F0-9]/g, "").substring(0, 12);
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
  const user = auth.currentUser;
  const form = e.target;
  const campusCompleto = form.getAttribute("data-campus");
  const tipo = document.getElementById("tipo").value;
  const mac = document.getElementById("mac_address").value.trim();
  const serial = document.getElementById("serial_number").value.trim();
  const status = document.getElementById("status").value;
  const dataInstalacao = document.getElementById("data").value;
  const observacoes = document.getElementById("obs").value.trim();
    const ipAddress = document.getElementById("ip_address").value.trim();
  const zabbix = document.getElementById("zabbix").value.trim();
  const netbox = document.getElementById("netbox").value.trim();

  if (ipAddress && !/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ipAddress)) {
    mostrarToast("Por favor, insira um IP válido no formato XXX.XXX.XXX.XXX", "error");
    return;
  }
  if (!user || !user.providerData || user.providerData[0].providerId !== 'google.com') {
    mostrarToast("Apenas usuários logados com Google podem cadastrar equipamentos", "error");
    return;
  }

  if (zabbix && !isValidZabbixUrl(zabbix)) {
    mostrarToast("URL do Zabbix inválida! Deve seguir o padrão: https://noc.animaeducacao.com.br/hostinventories.php?hostid=ID", "error");
    return;
  }

  if (netbox && !isValidNetboxUrl(netbox)) {
    mostrarToast("URL do Netbox inválida! Deve seguir o padrão: https://netbox.ecossistemaanima.com.br/dcim/devices/ID", "error");
    return;
  }
  // Validação do MAC Address
  if (mac.length !== 17 || !/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac)) {
    document.getElementById("mac_address").classList.add("invalid");
    mostrarToast("Por favor, insira um MAC Address válido!", "error");
    return;
  }
const verificacao = await verificarLimiteEquipamento(campusCompleto, tipo);
  if (!verificacao.valido) {
    mostrarToast(verificacao.mensagem, "error");
    return;
  }
  try {
    // Salva no Firebase com o campus no formato "MARCA|CAMPUS"
    await addDoc(collection(db, "equipamentos"), {
      campus: campusCompleto, // Ex: "FG|PIEDADE"
      tipo: tipo,
      mac_address: mac,
      serial_number: serial,
      status: status,
      data_instalacao: dataInstalacao,
      observacoes: observacoes,
      timestamp: new Date(),
      ip_address: ipAddress,
monitoramentos: {
  primario: zabbix,
  secundario: netbox
},
      usuario: user.email,
      data_cadastro: new Date()
    });
    await calcularProgresso().then(aplicarCoresNoMapa);

    mostrarToast("Equipamento salvo com sucesso!");
    form.reset();
    document.getElementById("side-panel").classList.add("hidden");
  } catch (error) {
    console.error("Erro ao salvar no Firestore:", error);
    mostrarToast("Erro ao salvar no Firestore!", "error");
  }
});

function isValidNetboxUrl(url) {
  const netboxBase = 'https://netbox.ecossistemaanima.com.br/dcim/devices/';
  return url.startsWith(netboxBase) && url.length > netboxBase.length; // Verifica se há algo após o prefixo
}

function isValidZabbixUrl(url) {
  const zabbixBase = 'https://noc.animaeducacao.com.br/hostinventories.php?hostid=';
  return (
    url.startsWith(zabbixBase) && 
    url.length > zabbixBase.length && 
    /^[0-9]+$/.test(url.split('=')[1]) // Verifica se o ID é numérico
  );
}
function getColor(percentual) {
  console.log(percentual);
  if (percentual <= 10) return '#d73027';
  if (percentual <= 25) return '#fc8d59';
  if (percentual <= 50) return '#fee08b';
  if (percentual <= 85) return '#d9ef8b';
  if (percentual <= 99) return '#91cf60';
  return '#1a9850';
}

// Função para calcular progresso e pintar os estados
async function calcularProgresso() {
  const equipamentosSnapshot = await getDocs(collection(db, "equipamentos"));
  const contagemAtual = {};

  equipamentosSnapshot.forEach((doc) => {
    const data = doc.data();
    const campusKey = normalizarChave(data.campus || "");
    const tipo = (data.tipo || "").toLowerCase();
    if (!campusKey || !tipo) return;
    
    contagemAtual[campusKey] ??= {};
    contagemAtual[campusKey][tipo] ??= 0;
    contagemAtual[campusKey][tipo]++;
  });

  const progressoPorEstado = {};
  const progressoSoma = {};
  const progressoCount = {};

  for (const campusKey in metas) {
    const metasCampus = metas[campusKey];
    const campusKeyNormalizado = normalizarChave(campusKey);
    const atuaisCampus = contagemAtual[campusKeyNormalizado] || {};

    const campusInfo = campi.find(c => c.id === campusKeyNormalizado);
    if (!campusInfo) continue;

    let totalMeta = 0;
    let totalAtual = 0;

    // Calcula para cada tipo de equipamento separadamente
    for (const tipo in metasCampus) {
      const metaTipo = metasCampus[tipo] || 0;
      const atualTipo = atuaisCampus[tipo] || 0;
      
      totalMeta += metaTipo;
      totalAtual += Math.min(atualTipo, metaTipo); // Não permite exceder a meta por tipo
    }

    const estado = campusInfo.Estado.trim().toUpperCase();
    const percentual = totalMeta === 0 ? 0 : Math.round((totalAtual / totalMeta) * 100);
    
    progressoSoma[estado] ??= 0;
    progressoCount[estado] ??= 0;
    progressoSoma[estado] += percentual;
    progressoCount[estado]++;
  }

  for (const estado in progressoSoma) {
    progressoPorEstado[estado] = Math.round(progressoSoma[estado] / progressoCount[estado]);
  }

  console.log("Progresso detalhado:", { metas, contagemAtual, progressoPorEstado });
  return progressoPorEstado;
}

async function verificarLimiteEquipamento(campus, tipoEquipamento) {
  try {
    // 1. Normaliza as chaves
    const campusKey = normalizarChave(campus);
    tipoEquipamento = tipoEquipamento.toLowerCase();
    
    // 2. Busca a meta para este tipo de equipamento no campus
    const meta = metas[campusKey]?.[tipoEquipamento] || 0;
    if (meta === 0) return { valido: true }; // Se não há meta definida, permite cadastro

    // 3. Conta equipamentos existentes deste tipo no campus
    const querySnapshot = await getDocs(
      query(
        collection(db, "equipamentos"),
        where("campus", "==", campus),
        where("tipo", "==", tipoEquipamento)
      )
    );

    const quantidadeAtual = querySnapshot.size;

    // 4. Verifica se ainda pode cadastrar
    if (quantidadeAtual >= meta) {
      return {
        valido: false,
        mensagem: `Limite de ${tipoEquipamento}s atingido para este campus (${quantidadeAtual}/${meta})`
      };
    }

    return { valido: true };

  } catch (error) {
    console.error("Erro na verificação de limites:", error);
    return {
      valido: false,
      mensagem: "Erro ao verificar limites de equipamentos"
    };
  }
}

// Aplicar cores no mapa conforme o progresso
function aplicarCoresNoMapa(progressoPorEstado) {
  fetch("data/brazil-states.geojson")
    .then(response => {
      if (!response.ok) throw new Error("Falha ao carregar GeoJSON");
      return response.json();
    })
    .then(geoData => {
      if (geoJsonLayer) map.removeLayer(geoJsonLayer);

      // Estados que possuem campi (em maiúsculas)
      const estadosComCampi = [...new Set(campi.map(c => c.Estado.trim().toUpperCase()))];

      geoJsonLayer = L.geoJSON(geoData, {
        style: (feature) => {
          const sigla = feature.properties.sigla?.trim().toUpperCase() || "ND";
          const temCampi = estadosComCampi.includes(sigla);
          const progresso = progressoPorEstado[sigla] || 0;

          return {
            fillColor: temCampi ? getColor(progresso) : "transparent",
            color: "#333",
            weight: 1,
            fillOpacity: temCampi ? 0.7 : 0,
            dashArray: temCampi ? null : "2, 5"
          };
        },
        onEachFeature: (feature, layer) => {
          const sigla = feature.properties.sigla?.trim().toUpperCase() || "ND";
          const nomeEstado = feature.properties.name || "Estado não identificado";
          const progresso = progressoPorEstado[sigla] ?? 0;

          // Só mostra popup se o estado tiver campi
          if (estadosComCampi.includes(sigla)) {
            layer.bindPopup(`
              <strong>${nomeEstado}</strong><br>
              Progresso: ${progresso}%
            `);
          }
        }
      }).addTo(map);
    })
    .catch(error => {
      console.error("Erro ao carregar mapa:", error);
      mostrarToast("Erro ao carregar mapa!", "error");
    });
}