// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, getDocs, collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { campi } from "./campi.js";
import { metas } from "./metas.js";

// Função para pegar a cor baseada no progresso
function getColor(percentual) {
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
    const [marca, campus] = (data.campus || "").split("|").map(e => e.trim().toUpperCase());
    const tipo = (data.tipo || "").toLowerCase();

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
      const atuaisCampus = contagemAtual[marca.toUpperCase()]?.[campus.toUpperCase()] || {};

      let totalMeta = 0;
      let totalAtual = 0;

      for (const tipo in metasCampus) {
        const meta = metasCampus[tipo];
        const atual = atuaisCampus[tipo] || 0;
        totalMeta += meta;
        totalAtual += atual;
      }

      const campusInfo = campi.find(c => 
        c.Marca.trim().toUpperCase() === marca.trim().toUpperCase() && 
        c.Campus.trim().toUpperCase() === campus.trim().toUpperCase()
      );

      if (campusInfo) {
        const estado = campusInfo.Estado.trim().toUpperCase();
        const percentual = totalMeta === 0 ? 0 : Math.round((totalAtual / totalMeta) * 100);
        progressoSoma[estado] ??= 0;
        progressoCount[estado] ??= 0;
        progressoSoma[estado] += percentual;
        progressoCount[estado]++;
      }
    }
  }

  const progressoPorEstado = {};
  for (const estado in progressoSoma) {
    progressoPorEstado[estado] = Math.round(progressoSoma[estado] / progressoCount[estado]);
  }

  return progressoPorEstado;
}

// Aplicar cores no mapa conforme o progresso
calcularProgresso().then(progressoPorEstado => {
  fetch("data/brazil-states.geojson")
    .then(response => response.json())
    .then(geoData => {
      L.geoJSON(geoData, {
        style: feature => {
          const sigla = (feature.properties.sigla || feature.properties.UF).trim().toUpperCase();
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
          const sigla = (feature.properties.sigla || feature.properties.UF).trim().toUpperCase();
          const progresso = progressoPorEstado[sigla] || 0;
          const nome = feature.properties.nome || sigla;

          const temCampus = campi.some(campus => campus.Estado.trim().toUpperCase() === sigla);
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
