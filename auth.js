import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const db = getFirestore(app);

let isLoginMode = true;

window.openAuthModal = function(login = true) {
    isLoginMode = login;
    document.getElementById('authModal').style.display = 'flex';
    updateModalUI();
}

window.closeAuthModal = function() {
    document.getElementById('authModal').style.display = 'none';
}

window.toggleAuthMode = function() {
    isLoginMode = !isLoginMode;
    updateModalUI();
}

function updateModalUI() {
    const title = document.getElementById('modalTitle');
    const btn = document.getElementById('modalActionBtn');
    const switchText = document.getElementById('modalSwitchText');
    const usernameField = document.getElementById('usernameField');

    if (isLoginMode) {
        title.innerText = "Вход в аккаунт";
        btn.innerText = "Войти";
        usernameField.style.display = "none";
        switchText.innerHTML = 'Нет аккаунта? <span onclick="toggleAuthMode()">Зарегистрироваться</span>';
    } else {
        title.innerText = "Регистрация";
        btn.innerText = "Зарегистрироваться";
        usernameField.style.display = "block";
        switchText.innerHTML = 'Уже есть аккаунт? <span onclick="toggleAuthMode()">Войти</span>';
    }
}

window.submitAuth = async function() {
    const email = document.getElementById('authEmail').value;
    const pass = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value;

    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, pass);
            alert("Успешный вход!");
        } else {
            // Проверка длины юзернейма
            if (username.length < 5) {
                alert("Ошибка: Юзернейм должен быть не менее 5 символов!");
                return;
            }
            
            const creds = await createUserWithEmailAndPassword(auth, email, pass);
            
            // Сохраняем юзернейм в базу Firestore
            await setDoc(doc(db, "users", creds.user.uid), {
                username: username,
                email: email
            });

            alert("Регистрация успешна!");
        }
        closeAuthModal();
    } catch(e) {
        alert("Ошибка: " + e.message);
    }
}

window.logout = async function() {
    await signOut(auth);
}

// Отслеживание статуса юзера
onAuthStateChanged(auth, async (user) => {
    const authPanel = document.getElementById('authPanel');
    const uploadSection = document.getElementById('uploadSection');
    const loginPrompt = document.getElementById('loginPrompt');

    if (user) {
        // Достаем ник из базы
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const username = userDoc.exists() ? userDoc.data().username : user.email;

        if(authPanel) authPanel.innerHTML = `<span>👤 <b>${username}</b></span> <button onclick="logout()">Выйти</button>`;
        if(uploadSection) uploadSection.style.display = 'block';
        if(loginPrompt) loginPrompt.style.display = 'none';
    } else {
        if(authPanel) authPanel.innerHTML = `<button class="login-btn" onclick="openAuthModal(true)">Войти / Регистрация</button>`;
        if(uploadSection) uploadSection.style.display = 'none';
        if(loginPrompt) loginPrompt.style.display = 'block';
    }
});
