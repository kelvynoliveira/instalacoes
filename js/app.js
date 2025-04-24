// app.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { campi } from "./campi.js";

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
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 18
}).addTo(map);

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

document.getElementById("campus-form").addEventListener("submit", (e) => {
  e.preventDefault();

  const macField = document.getElementById("mac_address");
  const mac = macField.value;

  // Verifica se o MAC está com 17 caracteres (formato completo)
  if (mac.length !== 17 || !/^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(mac)) {
    macField.classList.add("invalid");
    alert("Por favor, insira um MAC Address válido no formato XX:XX:XX:XX:XX:XX.");
    return;
  }

  macField.classList.remove("invalid");

  // Aqui você continua com o salvamento no Firestore depois
  alert("Validação OK! Pode salvar no Firebase aqui...");
});


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

    // Remove o estilo de erro em tempo real
    if (formatted.length === 17 && /^([A-F0-9]{2}:){5}[A-F0-9]{2}$/.test(formatted)) {
      macInput.classList.remove("invalid");
    }
  });
}