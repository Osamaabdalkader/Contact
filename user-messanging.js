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

    // التحقق من حالة المستخدم
    auth.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            initUserPage(user);
        }
    });

    function initUserPage(user) {
        // عناصر واجهة المستخدم
        const userName = document.getElementById('userName');
        const logoutBtn = document.getElementById('logoutBtn');
        const messagesContainer = document.getElementById('messagesContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const unreadCount = document.getElementById('unreadCount');

        // جلب بيانات المستخدم
        database.ref('users/' + user.uid).once('value')
            .then(snapshot => {
                const userData = snapshot.val();
                if (userData) userName.textContent = userData.name;
            });

        // تسجيل الخروج
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });

        // إرسال الرسائل
        sendBtn.addEventListener('click', () => sendMessage(user, messageInput.value));
        messageInput.addEventListener('keypress', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(user, messageInput.value);
            }
        });

        // استقبال الرسائل
        database.ref('messages')
            .orderByChild('timestamp')
            .on('child_added', snapshot => {
                const message = snapshot.val();
                const messageId = snapshot.key;
                
                if (message.senderId === user.uid || message.receiverId === user.uid) {
                    displayMessage(message, user.uid, messageId);
                    
                    if (message.receiverId === user.uid && !message.isRead) {
                        database.ref('messages/' + snapshot.key).update({ isRead: true });
                        updateUnreadCount(user.uid);
                    }
                }
            });

        // وظائف المساعدة
        async function sendMessage(user, content) {
            content = content.trim();
            if (!content) return;
            
            try {
                // البحث عن الإدارة
                const snapshot = await database.ref('users').orderByChild('role').equalTo('admin').once('value');
                let adminId = null;
                
                snapshot.forEach(child => {
                    adminId = child.key;
                    return true;
                });
                
                if (!adminId) throw new Error('لم يتم العثور على الإدارة');
                
                // إرسال الرسالة
                const newMessage = {
                    senderId: user.uid,
                    receiverId: adminId,
                    content: content,
                    timestamp: Date.now(),
                    isRead: false,
                    senderRole: 'user',
                    receiverRole: 'admin'
                };
                
                await database.ref('messages').push().set(newMessage);
                messageInput.value = '';
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            } catch (error) {
                console.error("Error sending message:", error);
                alert(error.message);
            }
        }

        function displayMessage(message, currentUserId, messageId) {
            const messageDiv = document.createElement('div');
            messageDiv.className = message.senderId === currentUserId ? 
                'message sent' : 'message received';
            messageDiv.dataset.messageId = messageId;
            
            messageDiv.innerHTML = `
                <div class="message-content">${message.content}</div>
                <div class="message-time">${formatTime(message.timestamp)}</div>
            `;
            
            messagesContainer.appendChild(messageDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        }

        function updateUnreadCount(userId) {
            database.ref('messages')
                .orderByChild('receiverId')
                .equalTo(userId)
                .once('value')
                .then(snapshot => {
                    let count = 0;
                    snapshot.forEach(child => {
                        if (!child.val().isRead) count++;
                    });
                    unreadCount.textContent = count;
                    unreadCount.style.display = count > 0 ? 'block' : 'none';
                });
        }
        
        // تحديث العداد عند التحميل
        updateUnreadCount(user.uid);
    }
});