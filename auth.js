document.addEventListener('DOMContentLoaded', () => {
    // تهيئة Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyAzYZMxqNmnLMGYnCyiJYPg2MbxZMt0co0",
        authDomain: "osama-91b95.firebaseapp.com",
        databaseURL: "https://osama-91b95-default-rtdb.firebaseio.com",
        projectId: "osama-91b95",
        storageBucket: "osama-91b95.appspot.com",
        messagingSenderId: "118875905722",
        appId: "1:118875905722:web:200bff1bd99db2c1caac83",
        measurementId: "G-LEM5PVPJZC"
    };
    
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const database = firebase.database();

    // عناصر واجهة المستخدم
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const loginBtn = document.getElementById('loginBtn');
    const signupBtn = document.getElementById('signupBtn');
    const authMessage = document.getElementById('authMessage');

    // تبديل التبويبات
    loginTab.addEventListener('click', showLoginForm);
    signupTab.addEventListener('click', showSignupForm);
    loginBtn.addEventListener('click', loginUser);
    signupBtn.addEventListener('click', signupUser);

    function showLoginForm() {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.remove('hidden');
        signupForm.classList.add('hidden');
        authMessage.textContent = '';
    }

    function showSignupForm() {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
        authMessage.textContent = '';
    }

    async function loginUser() {
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log("User logged in:", user.uid);
            
            // الحصول على دور المستخدم
            const snapshot = await database.ref('users/' + user.uid).once('value');
            const userData = snapshot.val();
            
            if (userData && userData.role === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'user.html';
            }
        } catch (error) {
            showAuthMessage(`خطأ في تسجيل الدخول: ${error.message}`, 'error');
            console.error("Login error:", error);
        }
    }

    async function signupUser() {
        const name = document.getElementById('signupName').value;
        const email = document.getElementById('signupEmail').value;
        const password = document.getElementById('signupPassword').value;
        
        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            console.log("User created:", user.uid);
            
            // تحديد الدور (إذا كان البريد هو admin@example.com يصبح مدير)
            const role = email === 'admin@example.com' ? 'admin' : 'user';
            
            // حفظ بيانات المستخدم
            await database.ref('users/' + user.uid).set({
                name: name,
                email: email,
                role: role,
                createdAt: Date.now()
            });
            
            window.location.href = role === 'admin' ? 'admin.html' : 'user.html';
        } catch (error) {
            showAuthMessage(`خطأ في إنشاء الحساب: ${error.message}`, 'error');
            console.error("Signup error:", error);
        }
    }

    function showAuthMessage(message, type) {
        authMessage.textContent = message;
        authMessage.className = `message ${type}`;
    }
});