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
        const usersList = document.getElementById('usersList');
        const currentUserName = document.getElementById('currentUserName');

        // متغيرات لإدارة المحادثات
        let activeUserId = null;
        const userLastMessageTime = {};
        const userUnreadCounts = {};
        const userMessages = {};
        const userDataMap = {};

        // تسجيل الخروج
        logoutBtn.addEventListener('click', () => {
            auth.signOut().then(() => {
                window.location.href = 'index.html';
            });
        });

        // إرسال الرسائل
        sendBtn.addEventListener('click', sendMessage);
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // بدء مراقبة الرسائل
        monitorMessages();

        // مراقبة جميع الرسائل وتحديث قائمة المستخدمين
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
                
                // جلب بيانات المستخدم إذا لم تكن محملة
                if (!userDataMap[otherUserId]) {
                    database.ref('users/' + otherUserId).once('value').then(userSnapshot => {
                        const userData = userSnapshot.val();
                        if (userData) {
                            userDataMap[otherUserId] = userData;
                            
                            // إذا لم يكن المستخدم مضافاً في القائمة، نضيفه
                            if (!userMessages[otherUserId]) {
                                userMessages[otherUserId] = [];
                                addUserToList(otherUserId, userData.name);
                            }
                            
                            // إضافة الرسالة إلى المستخدم
                            addMessageToUser(otherUserId, message, messageId);
                        }
                    });
                } else {
                    // إضافة الرسالة إلى المستخدم
                    addMessageToUser(otherUserId, message, messageId);
                }
                
                // زيادة العداد إذا كانت الرسالة موجهة للإدارة ولم تقرأ
                if (message.receiverId === adminUser.uid && !message.isRead) {
                    incrementUnreadCount(otherUserId);
                    database.ref('messages/' + messageId).update({ isRead: true });
                }
                
                // إذا كان المستخدم النشط هو المرسل إليه، نعرض الرسائل
                if (activeUserId === otherUserId) {
                    displayMessages(otherUserId);
                }
                
                // ترتيب قائمة المستخدمين حسب آخر رسالة
                sortUsersByLastMessage();
            });
        }

        // إضافة رسالة إلى مستخدم معين
        function addMessageToUser(userId, message, messageId) {
            if (!userMessages[userId]) {
                userMessages[userId] = [];
            }
            
            // تجنب تكرار الرسائل
            if (!userMessages[userId].some(m => m.id === messageId)) {
                userMessages[userId].push({
                    id: messageId,
                    ...message
                });
            }
        }

        // إضافة مستخدم إلى قائمة المستخدمين النشطين
        function addUserToList(userId, userName) {
            // التحقق إذا كان المستخدم مضافاً بالفعل
            if (document.querySelector(`.user-item[data-user-id="${userId}"]`)) {
                return;
            }
            
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.dataset.userId = userId;
            
            userElement.innerHTML = `
                <div class="user-info">
                    <div class="user-name">${userName}</div>
                    <div class="last-message-time" id="time-${userId}"></div>
                </div>
                <div class="unread-badge" id="unread-${userId}">0</div>
            `;
            
            // حدث النقر على المستخدم
            userElement.addEventListener('click', () => {
                switchToUser(userId, userName);
            });
            
            usersList.appendChild(userElement);
            
            // تهيئة العداد
            userUnreadCounts[userId] = 0;
            
            // تحديث وقت آخر رسالة
            updateLastMessageTime(userId);
        }

        // التبديل إلى محادثة مستخدم معين
        function switchToUser(userId, userName) {
            // إلغاء تنشيط جميع المستخدمين
            document.querySelectorAll('.user-item').forEach(item => {
                item.classList.remove('active');
            });
            
            // تنشيط المستخدم المحدد
            const userElement = document.querySelector(`.user-item[data-user-id="${userId}"]`);
            if (userElement) {
                userElement.classList.add('active');
            }
            
            activeUserId = userId;
            currentUserName.textContent = userName;
            
            // عرض رسائل هذا المستخدم
            displayMessages(userId);
            
            // تفعيل مربع الكتابة
            messageInput.disabled = false;
            sendBtn.disabled = false;
            
            // إعادة تعيين العداد غير المقروء
            resetUnreadCount(userId);
        }

        // عرض الرسائل للمستخدم النشط
        function displayMessages(userId) {
            if (!userMessages[userId] || activeUserId !== userId) return;
            
            messagesContainer.innerHTML = '';
            const messages = userMessages[userId].sort((a, b) => a.timestamp - b.timestamp);
            
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
            
            // التمرير إلى أحدث رسالة
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // زيادة عداد الرسائل غير المقروءة
        function incrementUnreadCount(userId) {
            userUnreadCounts[userId] = (userUnreadCounts[userId] || 0) + 1;
            const unreadElement = document.getElementById(`unread-${userId}`);
            if (unreadElement) {
                unreadElement.textContent = userUnreadCounts[userId];
                unreadElement.style.display = 'flex';
                
                // تأثير تنبيه للمستخدم
                const userElement = document.querySelector(`.user-item[data-user-id="${userId}"]`);
                if (userElement) {
                    userElement.classList.add('new-message');
                    setTimeout(() => {
                        userElement.classList.remove('new-message');
                    }, 1000);
                }
            }
        }

        // إعادة تعيين عداد الرسائل غير المقروءة
        function resetUnreadCount(userId) {
            userUnreadCounts[userId] = 0;
            const unreadElement = document.getElementById(`unread-${userId}`);
            if (unreadElement) {
                unreadElement.textContent = '0';
                unreadElement.style.display = 'none';
            }
        }

        // ترتيب المستخدمين حسب آخر رسالة
        function sortUsersByLastMessage() {
            const userItems = Array.from(document.querySelectorAll('.user-item'));
            
            userItems.sort((a, b) => {
                const userIdA = a.dataset.userId;
                const userIdB = b.dataset.userId;
                const timeA = userLastMessageTime[userIdA] || 0;
                const timeB = userLastMessageTime[userIdB] || 0;
                return timeB - timeA;
            });
            
            // إعادة إضافة العناصر بالترتيب الجديد
            userItems.forEach(item => {
                usersList.appendChild(item);
            });
        }

        // تحديث وقت آخر رسالة للمستخدم
        function updateLastMessageTime(userId) {
            const timeElement = document.getElementById(`time-${userId}`);
            if (timeElement && userLastMessageTime[userId]) {
                timeElement.textContent = formatTime(userLastMessageTime[userId]);
            }
        }

        // إرسال رسالة
        function sendMessage() {
            if (!activeUserId) return;
            
            const message = messageInput.value.trim();
            if (!message) return;
            
            const newMessage = {
                senderId: adminUser.uid,
                receiverId: activeUserId,
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
                    userLastMessageTime[activeUserId] = Date.now();
                    updateLastMessageTime(activeUserId);
                    
                    // إعادة ترتيب المستخدمين
                    sortUsersByLastMessage();
                });
        }

        function formatTime(timestamp) {
            const date = new Date(timestamp);
            const now = new Date();
            const diff = now - date;
            
            // إذا كانت الرسالة من اليوم
            if (diff < 24 * 60 * 60 * 1000) {
                return `${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
            } 
            // إذا كانت الرسالة من الأسبوع الحالي
            else if (diff < 7 * 24 * 60 * 60 * 1000) {
                const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                return days[date.getDay()];
            }
            // إذا كانت الرسالة أقدم من أسبوع
            else {
                return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
            }
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
                            userLastMessageTime[otherUserId] = message.timestamp;
                        }
                    });
                    
                    // جلب بيانات المستخدمين النشطين
                    const userPromises = Array.from(usersWithMessages).map(userId => {
                        return database.ref('users/' + userId).once('value').then(userSnapshot => {
                            const userData = userSnapshot.val();
                            if (userData) {
                                userDataMap[userId] = userData;
                                userMessages[userId] = [];
                                addUserToList(userId, userData.name);
                            }
                        });
                    });
                    
                    // بعد تحميل جميع بيانات المستخدمين، نرتب القائمة
                    Promise.all(userPromises).then(() => {
                        sortUsersByLastMessage();
                    });
                });
        }
    }
});
