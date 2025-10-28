const BMChat = {
    isOpen: false,
    sessionId: null,
    currentState: null,
    lastUserMessage: '',
    webhookUrl: 'https://auto.golubef.store/webhook/chat-bm',
    fileUploadUrl: 'https://auto.golubef.store/webhook/tilda-file-upload',
    
    init() {
        console.log('=== BMChat init started ===');
        
        // 1. КРИТИЧНО: Сначала загружаем историю (восстанавливает sessionId)
        this.loadChatHistory();
        
        // 2. Если после загрузки sessionId всё равно null - генерируем новый
        if (!this.sessionId) {
            this.sessionId = this.generateSessionId();
            console.log('Generated NEW sessionId:', this.sessionId);
            this.saveChatHistory(); // Сразу сохраняем
        } else {
            console.log('Restored sessionId from history:', this.sessionId);
        }
        
        // 3. Остальная инициализация
        this.setupEventListeners();
        this.setupIOSFixes();
        this.setupFileUpload();
        
        // Убираем статические кнопки
        const staticReplies = document.getElementById('bmQuickReplies');
        if (staticReplies) {
            staticReplies.remove();
        }
        
        console.log('=== BMChat init finished. SessionId:', this.sessionId, '===');
    },
    
    generateSessionId() {
        return 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    setupFileUpload() {
        // Находим форму загрузки файлов Тильды (если есть)
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.handleFileUpload(file);
                }
            });
        }
    },
    
    async handleFileUpload(file) {
        console.log('File upload started:', file.name);
        this.addMessage(`Загружаю файл: ${file.name}...`, 'user');
        this.showTyping();
        
        try {
            // Формируем данные для отправки (нужна настройка на стороне Тильды)
            const formData = new FormData();
            formData.append('file', file);
            formData.append('chat_id', this.sessionId);
            
            // ВАРИАНТ 1: Если Тильда сама загружает файл и возвращает URL
            // Тогда отправляем через твой File-Catcher
            const response = await fetch(this.fileUploadUrl, {
                method: 'POST',
                body: JSON.stringify({
                    userfile: 'URL_ФАЙЛА_ОТ_ТИЛЬДЫ', // Тильда должна вернуть URL
                    chat_id: this.sessionId,
                    message: `Пользователь загрузил файл: ${file.name}`
                }),
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            this.hideTyping();
            
            if (data.response) {
                this.addMessage(data.response, 'bot', data.quick_replies);
                if (data.state) this.currentState = data.state;
            } else {
                throw new Error('Нет ответа от сервера');
            }
            
        } catch (error) {
            console.error('File upload error:', error);
            this.hideTyping();
            this.addMessage('❌ Ошибка загрузки файла: ' + error.message, 'bot');
        }
    },
    
    setupIOSFixes() {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no');
        }
        
        const textarea = document.getElementById('bmMessageInput');
        if (textarea) {
            textarea.addEventListener('focus', () => {
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
            });
            
            textarea.addEventListener('blur', () => {
                document.body.style.position = '';
                document.body.style.width = '';
            });
        }
    },
    
    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.toggle();
            }
        });
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.target.classList.contains('show')) {
                    setTimeout(() => {
                        const input = document.getElementById('bmMessageInput');
                        if (input && window.innerWidth > 768) {
                            input.focus();
                        }
                    }, 300);
                }
            });
        });
        
        observer.observe(document.getElementById('bmChatWidget'), {
            attributes: true,
            attributeFilter: ['class']
        });
    },
    
    toggle() {
        const widget = document.getElementById('bmChatWidget');
        
        if (this.isOpen) {
            widget.classList.remove('show');
            setTimeout(() => {
                widget.style.display = 'none';
            }, 400);
            this.isOpen = false;
        } else {
            widget.style.display = 'flex';
            setTimeout(() => {
                widget.classList.add('show');
            }, 10);
            this.isOpen = true;
            
            const badge = document.querySelector('.bm-chat-badge');
            if (badge) badge.style.display = 'none';
            
            setTimeout(() => {
                this.scrollToBottom();
            }, 100);
        }
    },
    
    async sendMessage() {
        const input = document.getElementById('bmMessageInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.lastUserMessage = message;
        this.addMessage(message, 'user');
        input.value = '';
        this.autoResize(input);
        this.showTyping();
        
        const sendBtn = document.getElementById('bmSendBtn');
        sendBtn.disabled = true;
        
        console.log('=== Sending message ===');
        console.log('Message:', message);
        console.log('SessionId:', this.sessionId);
        console.log('State:', this.currentState);
        
        try {
            const response = await fetch(this.webhookUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId,
                    state: this.currentState,
                    firstname: 'Посетитель',
                    username: 'web_user',
                    timestamp: new Date().toISOString()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Response from server:', data);
            this.hideTyping();
            
            if (data.response) {
                this.addMessage(data.response, 'bot', data.quick_replies);
                if (data.state) {
                    this.currentState = data.state;
                } else {
                    this.currentState = null;
                }
            } else {
                throw new Error('Пустой ответ от сервера');
            }
            
        } catch (error) {
            console.error('Send message error:', error);
            this.hideTyping();
            this.addMessage('❌ ОШИБКА: ' + error.message, 'bot', [
                {title: 'Связаться с оператором', value: '/operator'},
                {title: 'Попробовать снова', value: 'last_message'}
            ]);
        } finally {
            sendBtn.disabled = false;
        }
        
        this.saveChatHistory();
    },

    sendQuickReply(title, value) {
        this.addMessage(title, 'user');
        const input = document.getElementById('bmMessageInput');
        input.value = value === 'last_message' ? this.lastUserMessage : value;
        this.sendMessage();
    },
    
    addMessage(content, sender, quickReplies = null) {
        const messagesContainer = document.getElementById('bmChatMessages');
        
        const existingReplies = messagesContainer.querySelectorAll('.bm-quick-replies, .bm-upload-btn');
        existingReplies.forEach(el => el.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `bm-message ${sender}`;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div class="bm-message-content">
                ${content.replace(/\n/g, '<br>')}
                <div class="bm-message-time">${timeStr}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);

        if (quickReplies && quickReplies.length > 0) {
            this.showQuickReplies(quickReplies);
        }

        this.scrollToBottom();
        
        if (sender === 'bot' && !this.isOpen) {
            const badge = document.querySelector('.bm-chat-badge');
            if (badge) badge.style.display = 'flex';
        }
    },
    
    showTyping() {
        const indicator = document.getElementById('bmTypingIndicator');
        if (indicator) {
            indicator.style.display = 'block';
            this.scrollToBottom();
        }
    },
    
    hideTyping() {
        const indicator = document.getElementById('bmTypingIndicator');
        if (indicator) indicator.style.display = 'none';
    },
    
    scrollToBottom() {
        const messages = document.getElementById('bmChatMessages');
        messages.scrollTop = messages.scrollHeight;
    },

    showQuickReplies(replies) {
        const messagesContainer = document.getElementById('bmChatMessages');
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'bm-quick-replies';
        
        replies.forEach(reply => {
            const button = document.createElement('button');
            button.textContent = reply.title;
            const value = reply.value === 'last_message' 
                ? (this.lastUserMessage || '') 
                : reply.value;
            button.onclick = () => this.sendQuickReply(reply.title, value);
            repliesContainer.appendChild(button);
        });
        messagesContainer.appendChild(repliesContainer);
        this.scrollToBottom();
    },
    
    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    },
    
    autoResize(textarea) {
        textarea.style.height = '20px';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    },
    
    clearChat() {
        if (confirm('Очистить историю чата?')) {
            const messagesContainer = document.getElementById('bmChatMessages');
            messagesContainer.innerHTML = `
                <div class="bm-message bot">
                    <div class="bm-message-content">
                        Чат очищен. Готов к новым задачам!
                    </div>
                </div>
            `;
            
            this.sessionId = this.generateSessionId();
            this.currentState = null;
            localStorage.removeItem('bm_chat_history');
            this.saveChatHistory();
            console.log('Chat cleared. New sessionId:', this.sessionId);
        }
    },
    
    saveChatHistory() {
        const messages = document.getElementById('bmChatMessages').innerHTML;
        const chatData = {
            sessionId: this.sessionId,
            currentState: this.currentState,
            messages: messages,
            timestamp: Date.now()
        };
        
        localStorage.setItem('bm_chat_history', JSON.stringify(chatData));
        console.log('Chat history saved. SessionId:', this.sessionId);
    },
    
    loadChatHistory() {
        const savedData = localStorage.getItem('bm_chat_history');
        
        if (savedData) {
            try {
                const chatData = JSON.parse(savedData);
                
                // Проверяем срок давности (24 часа)
                if (Date.now() - chatData.timestamp > 24 * 60 * 60 * 1000) {
                    console.log('Chat history expired, clearing...');
                    localStorage.removeItem('bm_chat_history');
                    return; // sessionId останется null, сгенерируется в init()
                }
                
                // Восстанавливаем данные
                this.sessionId = chatData.sessionId;
                this.currentState = chatData.currentState || null;
                document.getElementById('bmChatMessages').innerHTML = chatData.messages;
                console.log('Chat history restored. SessionId:', this.sessionId);
                
            } catch (error) {
                console.error('Error loading chat history:', error);
                localStorage.removeItem('bm_chat_history');
            }
        } else {
            console.log('No saved chat history found');
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    BMChat.init();
});
