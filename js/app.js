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
    <button onclick=\"abrirPainel('${campus.Marca}', '${campus.Campus}')\">Atualizar status</button>
  `;
  L.marker([campus.Latitude, campus.Longitude])
    .bindPopup(popupContent)
    .addTo(map);
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