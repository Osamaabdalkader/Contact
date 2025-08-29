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
        const messagesContainer = document.getElementById('messagesContainer');
        const messageInput = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendBtn');
        const chatTabs = document.getElementById('chatTabs');
        const usersList = document.getElementById('usersList');

        // متغيرات لإدارة التبويبات والمحادثات
        let activeTab = null;
        const openTabs = {};
        const userLastMessageTime = {};
        const userUnreadCounts = {};

        // تسجيل الخروج
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });

        // بدء مراقبة الرسائل
        monitorMessages();

        // إرسال الرسائل
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // مراقبة جميع الرسائل وإنشاء التبويبات تلقائياً
        function monitorMessages() {
            database.ref('messages').orderByChild('timestamp').on('child_added', snapshot => {
                const message = snapshot.val();
                const messageId = snapshot.key;
                
                // تجاهل الرسائل التي ليس لها علاقة بالإدارة
                if (message.receiverId !== adminUser.uid && message.senderId !== adminUser.uid) {
                    return;
                }
                
                // تحديد المستخدم المتحدث مع الإدارة
                const otherUserId = message.senderId === adminUser.uid ? message.receiverId : message.senderId;
                
                // تحديث وقت آخر رسالة لهذا المستخدم
                userLastMessageTime[otherUserId] = message.timestamp;
                
                // إذا لم يكن التبويب مفتوحاً، إنشاء تبويب جديد
                if (!openTabs[otherUserId]) {
                    // جلب بيانات المستخدم أولاً
                    database.ref('users/' + otherUserId).once('value').then(userSnapshot => {
                        const userData = userSnapshot.val();
                        if (userData) {
                            createChatTab(otherUserId, userData.name);
                            loadUserMessages(otherUserId);
                        }
                    });
                } else {
                    // إضافة الرسالة إلى التبويب المفتوح
                    addMessageToTab(otherUserId, message, messageId);
                }
                
                // زيادة العداد إذا كانت الرسالة موجهة للإدارة ولم تقرأ
                if (message.receiverId === adminUser.uid && !message.isRead) {
                    incrementUnreadCount(otherUserId);
                    database.ref('messages/' + messageId).update({ isRead: true });
                }
                
                // ترتيب التبويبات حسب آخر رسالة
                sortTabsByLastMessage();
                
                // تحديث قائمة المستخدمين
                updateUsersList();
            });
        }

        // إنشاء تبويب محادثة جديد
        function createChatTab(userId, userName) {
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
                messages: [],
                userId: userId
            };
            
            // تهيئة العداد
            userUnreadCounts[userId] = 0;
        }

        // تحميل الرسائل السابقة للمستخدم
        function loadUserMessages(userId) {
            if (!openTabs[userId]) return;
            
            database.ref('messages')
                .orderByChild('timestamp')
                .once('value')
                .then(snapshot => {
                    const messages = [];
                    snapshot.forEach(child => {
                        const message = child.val();
                        if ((message.senderId === adminUser.uid && message.receiverId === userId) || 
                            (message.senderId === userId && message.receiverId === adminUser.uid)) {
                            messages.push({
                                id: child.key,
                                ...message
                            });
                        }
                    });
                    
                    // حفظ الرسائل وترتيبها حسب الوقت
                    openTabs[userId].messages = messages.sort((a, b) => a.timestamp - b.timestamp);
                    
                    // إذا كان التبويب نشطاً، عرض الرسائل
                    if (activeTab === userId) {
                        displayMessages(userId);
                    }
                });
        }

        // إضافة رسالة إلى تبويب محدد
        function addMessageToTab(userId, message, messageId) {
            if (!openTabs[userId]) return;
            
            // تجنب تكرار الرسائل
            if (!openTabs[userId].messages.some(m => m.id === messageId)) {
                openTabs[userId].messages.push({
                    id: messageId,
                    ...message
                });
                
                // إذا كان التبويب نشطاً، عرض الرسائل
                if (activeTab === userId) {
                    displayMessages(userId);
                }
            }
        }

        // التبديل إلى تبويب محدد
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

        // إغلاق تبويب
        function closeTab(userId) {
            if (openTabs[userId]) {
                // إزالة التبويب
                openTabs[userId].element.remove();
                delete openTabs[userId];
                delete userUnreadCounts[userId];
                
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

        // عرض الرسائل في التبويب النشط
        function displayMessages(userId) {
            if (!openTabs[userId] || activeTab !== userId) return;
            
            messagesContainer.innerHTML = '';
            const messages = openTabs[userId].messages;
            
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

        // زيادة عداد الرسائل غير المقروءة
        function incrementUnreadCount(userId) {
            if (openTabs[userId]) {
                userUnreadCounts[userId] = (userUnreadCounts[userId] || 0) + 1;
                const unreadElement = openTabs[userId].element.querySelector('.tab-unread');
                unreadElement.textContent = userUnreadCounts[userId];
                unreadElement.style.display = 'inline-block';
                
                // تأثير تنبيه للتبويب الجديد
                openTabs[userId].element.classList.add('new-message');
                setTimeout(() => {
                    openTabs[userId].element.classList.remove('new-message');
                }, 1000);
            }
        }

        // إعادة تعيين عداد الرسائل غير المقروءة
        function resetUnreadCount(userId) {
            if (openTabs[userId]) {
                userUnreadCounts[userId] = 0;
                const unreadElement = openTabs[userId].element.querySelector('.tab-unread');
                unreadElement.textContent = '0';
                unreadElement.style.display = 'none';
            }
        }

        // ترتيب التبويبات حسب آخر رسالة
        function sortTabsByLastMessage() {
            const sortedUserIds = Object.keys(userLastMessageTime).sort((a, b) => {
                return userLastMessageTime[b] - userLastMessageTime[a];
            });
            
            // إعادة ترتيب التبويبات حسب الترتيب الجديد
            sortedUserIds.forEach(userId => {
                if (openTabs[userId]) {
                    chatTabs.appendChild(openTabs[userId].element);
                }
            });
        }

        // تحديث قائمة المستخدمين
        function updateUsersList() {
            database.ref('users').once('value').then(snapshot => {
                usersList.innerHTML = '';
                snapshot.forEach(child => {
                    const userData = child.val();
                    if (userData.role === 'user') {
                        const userElement = document.createElement('div');
                        userElement.className = 'user-item';
                        userElement.dataset.userId = child.key;
                        
                        userElement.innerHTML = `
                            <div class="user-name">${userData.name}</div>
                            <div class="user-email">${userData.email}</div>
                            <div class="user-status" id="status-${child.key}">غير نشط</div>
                        `;
                        
                        // تحديث حالة المستخدم بناءً على وجود محادثة
                        if (openTabs[child.key]) {
                            userElement.querySelector('.user-status').textContent = 'نشط الآن';
                            userElement.querySelector('.user-status').classList.add('online');
                        }
                        
                        userElement.addEventListener('click', () => {
                            if (!openTabs[child.key]) {
                                createChatTab(child.key, userData.name);
                                loadUserMessages(child.key);
                            }
                            switchToTab(child.key);
                        });
                        
                        usersList.appendChild(userElement);
                    }
                });
            });
        }

        // إرسال رسالة
        function sendMessage() {
            if (!activeTab) return;
            
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
                    
                    // تحديث وقت آخر رسالة لهذا المستخدم
                    userLastMessageTime[activeTab] = Date.now();
                    
                    // إعادة ترتيب التبويبات
                    sortTabsByLastMessage();
                });
        }

        function formatTime(timestamp) {
            const date = new Date(timestamp);
            return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        }

        // تحميل المحادثات الحالية عند البدء
        loadExistingConversations();
        
        function loadExistingConversations() {
            // جلب جميع الرسائل لمعرفة المستخدمين النشطين
            database.ref('messages').orderByChild('timestamp').once('value')
                .then(snapshot => {
                    const usersWithMessages = new Set();
                    
                    snapshot.forEach(child => {
                        const message = child.val();
                        if (message.receiverId === adminUser.uid || message.senderId === adminUser.uid) {
                            const otherUserId = message.senderId === adminUser.uid ? 
                                message.receiverId : message.senderId;
                            usersWithMessages.add(otherUserId);
                        }
                    });
                    
                    // إنشاء تبويبات للمستخدمين النشطين
                    usersWithMessages.forEach(userId => {
                        database.ref('users/' + userId).once('value').then(userSnapshot => {
                            const userData = userSnapshot.val();
                            if (userData) {
                                createChatTab(userId, userData.name);
                                loadUserMessages(userId);
                            }
                        });
                    });
                    
                    // تحديث قائمة المستخدمين
                    updateUsersList();
                });
        }
    }
});
