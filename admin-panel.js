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
            // التحقق من أن المستخدم مدير
            database.ref('users/' + user.uid).once('value')
                .then(snapshot => {
                    const userData = snapshot.val();
                    if (userData && userData.role === 'admin') {
                        initAdminPage(user);
                    } else {
                        alert('ليس لديك صلاحية الوصول إلى لوحة التحكم');
                        auth.signOut();
                    }
                });
        }
    });

    function initAdminPage(adminUser) {
        // عناصر واجهة المستخدم
        const logoutBtn = document.getElementById('logoutBtn');
        const usersList = document.getElementById('usersList');
        const searchUsers = document.getElementById('searchUsers');
        const messagesContainer = document.getElementById('messagesContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const chatTabs = document.getElementById('chatTabs');

        // متغيرات لإدارة التبويبات
        let activeTab = null;
        const openTabs = {};
        let replyingTo = null;

        // تسجيل الخروج
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });

        // تحميل المستخدمين
        database.ref('users').on('value', snapshot => {
            usersList.innerHTML = '';
            snapshot.forEach(child => {
                const userData = child.val();
                if (userData.role === 'user') {
                    const userElement = createUserElement(child.key, userData);
                    usersList.appendChild(userElement);
                }
            });
        });

        function createUserElement(userId, userData) {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.dataset.userId = userId;
            
            userElement.innerHTML = `
                <div class="user-name">${userData.name}</div>
                <div class="user-email">${userData.email}</div>
                <div class="unread-count-tab" id="unread-${userId}">0</div>
            `;
            
            userElement.addEventListener('click', () => {
                openChatTab(userId, userData.name);
            });
            
            return userElement;
        }

        function openChatTab(userId, userName) {
            // إذا كانت المحادثة مفتوحة بالفعل، انتقل إليها
            if (openTabs[userId]) {
                switchToTab(userId);
                return;
            }
            
            // إنشاء تبويب جديد
            const tab = document.createElement('div');
            tab.className = 'chat-tab';
            tab.dataset.userId = userId;
            tab.innerHTML = `
                <span class="tab-name">${userName}</span>
                <span class="tab-unread" id="tab-unread-${userId}">0</span>
                <button class="close-tab">×</button>
            `;
            
            // حدث إغلاق التبويب
            tab.querySelector('.close-tab').addEventListener('click', (e) => {
                e.stopPropagation();
                closeTab(userId);
            });
            
            // حدث اختيار التبويب
            tab.addEventListener('click', () => {
                switchToTab(userId);
            });
            
            chatTabs.appendChild(tab);
            
            // حفظ التبويب
            openTabs[userId] = {
                element: tab,
                name: userName,
                messages: []
            };
            
            // التبديل إلى التبويب الجديد
            switchToTab(userId);
            
            // تحميل الرسائل
            loadMessages(userId);
        }

        function switchToTab(userId) {
            // إلغاء تنشيط جميع التبويبات
            document.querySelectorAll('.chat-tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // تنشيط التبويب المحدد
            if (openTabs[userId]) {
                openTabs[userId].element.classList.add('active');
                activeTab = userId;
                
                // عرض رسائل هذا التبويب
                displayMessages(userId);
                
                // تفعيل مربع الكتابة
                messageInput.disabled = false;
                sendBtn.disabled = false;
                
                // إعادة تعيين العداد غير المقروء
                resetUnreadCount(userId);
            }
        }

        function closeTab(userId) {
            if (openTabs[userId]) {
                // إزالة التبويب
                openTabs[userId].element.remove();
                delete openTabs[userId];
                
                // إذا كان التبويب المغلق هو النشط
                if (activeTab === userId) {
                    const remainingTabs = Object.keys(openTabs);
                    if (remainingTabs.length > 0) {
                        // الانتقال إلى أول تبويب متبقي
                        switchToTab(remainingTabs[0]);
                    } else {
                        // لا توجد تبويبات مفتوحة
                        activeTab = null;
                        messagesContainer.innerHTML = '<div class="no-chat-selected"><p>اختر محادثة لبدء الدردشة</p></div>';
                        messageInput.disabled = true;
                        sendBtn.disabled = true;
                    }
                }
            }
        }

        function loadMessages(userId) {
            if (!openTabs[userId]) return;
            
            // مسح الرسائل القديمة
            openTabs[userId].messages = [];
            
            // استماع للرسائل الجديدة
            database.ref('messages')
                .orderByChild('timestamp')
                .on('child_added', snapshot => {
                    const message = snapshot.val();
                    const messageId = snapshot.key;
                    
                    if ((message.senderId === adminUser.uid && message.receiverId === userId) || 
                        (message.senderId === userId && message.receiverId === adminUser.uid)) {
                        
                        // تجنب تكرار الرسائل
                        if (!openTabs[userId].messages.some(m => m.id === messageId)) {
                            openTabs[userId].messages.push({
                                id: messageId,
                                ...message
                            });
                            
                            // إذا كان التبويب نشطاً، عرض الرسائل
                            if (activeTab === userId) {
                                displayMessages(userId);
                            } else {
                                // زيادة العداد غير المقروء
                                incrementUnreadCount(userId);
                            }
                            
                            // تحديث حالة القراءة إذا كانت الرسالة موجهة للإدارة
                            if (message.receiverId === adminUser.uid && !message.isRead) {
                                database.ref('messages/' + messageId).update({ isRead: true });
                            }
                        }
                    }
                });
        }

        function displayMessages(userId) {
            if (!openTabs[userId] || activeTab !== userId) return;
            
            messagesContainer.innerHTML = '';
            const messages = openTabs[userId].messages.sort((a, b) => a.timestamp - b.timestamp);
            
            messages.forEach(message => {
                const messageDiv = document.createElement('div');
                messageDiv.className = message.senderId === adminUser.uid ? 
                    'message sent' : 'message received';
                messageDiv.dataset.messageId = message.id;
                
                messageDiv.innerHTML = `
                    <div class="message-content">${message.content}</div>
                    <div class="message-time">${formatTime(message.timestamp)}</div>
                `;
                
                messagesContainer.appendChild(messageDiv);
            });
            
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        function incrementUnreadCount(userId) {
            if (openTabs[userId]) {
                const currentCount = parseInt(openTabs[userId].element.querySelector('.tab-unread').textContent || 0);
                openTabs[userId].element.querySelector('.tab-unread').textContent = currentCount + 1;
                openTabs[userId].element.querySelector('.tab-unread').style.display = 'inline-block';
            }
        }

        function resetUnreadCount(userId) {
            if (openTabs[userId]) {
                openTabs[userId].element.querySelector('.tab-unread').textContent = '0';
                openTabs[userId].element.querySelector('.tab-unread').style.display = 'none';
            }
        }

        // إرسال الرسائل
        sendBtn.addEventListener('click', () => {
            if (!activeTab) return alert('الرجاء اختيار مستخدم أولاً');
            
            const message = messageInput.value.trim();
            if (!message) return;
            
            const newMessage = {
                senderId: adminUser.uid,
                receiverId: activeTab,
                content: message,
                timestamp: Date.now(),
                isRead: false,
                senderRole: 'admin',
                receiverRole: 'user'
            };
            
            database.ref('messages').push().set(newMessage)
                .then(() => {
                    messageInput.value = '';
                    messagesContainer.scrollTop = messagesContainer.scrollHeight;
                });
        });

        // بحث في المستخدمين
        searchUsers.addEventListener('input', () => {
            const searchTerm = searchUsers.value.toLowerCase();
            document.querySelectorAll('.user-item').forEach(item => {
                const name = item.querySelector('.user-name').textContent.toLowerCase();
                const email = item.querySelector('.user-email').textContent.toLowerCase();
                if (name.includes(searchTerm) || email.includes(searchTerm)) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });

        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        }
    }
});