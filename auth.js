import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCPW3c853cIYr3DYljetGwc5dNfL74L_JA",
  authDomain: "valhallasmp-a0e3d.firebaseapp.com",
  projectId: "valhallasmp-a0e3d",
  storageBucket: "valhallasmp-a0e3d.firebasestorage.app",
  messagingSenderId: "368364494100",
  appId: "1:368364494100:web:9cc90b6aa8ad9af9227601"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Функции авторизации
window.register = async function() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    try {
        await createUserWithEmailAndPassword(auth, email, pass);
        alert("Регистрация успешна!");
    } catch(e) { alert("Ошибка: " + e.message); }
}

window.login = async function() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        alert("Успешный вход!");
    } catch(e) { alert("Ошибка: " + e.message); }
}

window.logout = async function() {
    await signOut(auth);
}

// Следим за статусом пользователя на любой странице
onAuthStateChanged(auth, (user) => {
    const authPanel = document.getElementById('authPanel');
    const uploadSection = document.getElementById('uploadSection');
    const loginPrompt = document.getElementById('loginPrompt');
    const authForms = document.getElementById('authForms');

    if (user) {
        if(authPanel) authPanel.innerHTML = `<span>👤 ${user.email}</span> <button onclick="logout()">Выйти</button>`;
        if(uploadSection) uploadSection.style.display = 'block';
        if(loginPrompt) loginPrompt.style.display = 'none';
        if(authForms) authForms.style.display = 'none';
    } else {
        if(authPanel) authPanel.innerHTML = `<span>Не вошел</span>`;
        if(uploadSection) uploadSection.style.display = 'none';
        if(loginPrompt) loginPrompt.style.display = 'block';
        if(authForms) authForms.style.display = 'block';
    }
});
