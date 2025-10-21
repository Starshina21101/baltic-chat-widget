window.UPLOADCARE_PUBLIC_KEY = '0d76bab722abb5dd06ee';

const BMChat = {
    isOpen: false,
    sessionId: null,
    currentState: null,
    lastUserMessage: '', // Сохраняем последнее сообщение пользователя
    webhookUrl: 'https://auto.golubef.store/webhook/chat-bm',
    helperServiceUrl: 'https://baltic-chat-helper.starshina21101.workers.dev', // ЗАМЕНИТЬ НА URL СЕРВИСА-ПОМОЩНИКА
    
    init() {
        this.sessionId = this.generateSessionId();
        this.loadChatHistory();
        this.setupEventListeners();
        this.setupIOSFixes();
        
        // Убираем статические кнопки, если они есть
        const staticReplies = document.getElementById('bmQuickReplies');
        if (staticReplies) {
            staticReplies.remove();
        }

        console.log('Балт-Маркет Chat initialized:', this.sessionId);
    },
    
    generateSessionId() {
        return 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
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
            badge.style.display = 'none';
            
            setTimeout(() => {
                this.scrollToBottom();
            }, 100);
        }
    },
    
    async sendMessage() {
        const input = document.getElementById('bmMessageInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.lastUserMessage = message; // Сохраняем
        this.addMessage(message, 'user');
        input.value = '';
        this.autoResize(input);
        this.showTyping();
        
        const sendBtn = document.getElementById('bmSendBtn');
        sendBtn.disabled = true;
        
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.hideTyping();
            
            if (data.response) {
                this.addMessage(data.response, 'bot', data.quick_replies);
                if (data.state) {
                    this.currentState = data.state;
                } else {
                    this.currentState = null;
                }

                if (message.toLowerCase().includes('/файл')) {
                   this.showUploadButton();
                }

            } else {
                this.addMessage('Извините, произошла ошибка. Попробуйте еще раз или напишите "Оператор" для связи с менеджером.', 'bot', [
                    {title: 'Связаться с оператором', value: '/operator'},
                    {title: 'Попробовать снова', value: 'last_message'}
                ]);
            }
            
        } catch (error) {
            console.error('Error:', error);
            this.hideTyping();
            this.addMessage('Возникли временные неполадки. Пожалуйста, оставьте ваши контакты, и мы свяжемся с вами в ближайшее время.', 'bot');
            this.showFallbackForm();
        } finally {
            sendBtn.disabled = false;
        }
        
        this.saveChatHistory();
    },

    sendQuickReply(title, value) {
        if (value === 'upload_file') {
            this.addMessage(title, 'user');
            this.showUploadButton();
            return;
        }
        this.addMessage(title, 'user');
        const input = document.getElementById('bmMessageInput');
        input.value = value;
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
            badge.style.display = 'flex';
        }
    },
    
    showTyping() {
        document.getElementById('bmTypingIndicator').style.display = 'block';
        this.scrollToBottom();
    },
    
    hideTyping() {
        document.getElementById('bmTypingIndicator').style.display = 'none';
    },
    
    scrollToBottom() {
        const messages = document.getElementById('bmChatMessages');
        messages.scrollTop = messages.scrollHeight;
    },

    showFallbackForm() {
        const messagesContainer = document.getElementById('bmChatMessages');
        const fallbackForm = document.createElement('div');
        fallbackForm.className = 'bm-fallback-form';
        fallbackForm.innerHTML = `
            <input type="text" id="fallbackName" placeholder="Ваше имя">
            <input type="text" id="fallbackContact" placeholder="Телефон или Email">
            <textarea id="fallbackMessage" placeholder="Суть вашего вопроса..."></textarea>
            <button onclick="BMChat.sendFallbackData()">Отправить</button>
        `;
        messagesContainer.appendChild(fallbackForm);
        this.scrollToBottom();
        
        const regularInput = document.querySelector('.bm-chat-input');
        if(regularInput) regularInput.style.display = 'none';
    },

    async sendFallbackData() {
        const name = document.getElementById('fallbackName').value.trim();
        const contact = document.getElementById('fallbackContact').value.trim();
        const message = document.getElementById('fallbackMessage').value.trim();

        if (!name || !contact || !message) {
            alert('Пожалуйста, заполните все поля.');
            return;
        }

        const button = document.querySelector('.bm-fallback-form button');
        button.disabled = true;
        button.textContent = 'Отправка...';

        try {
            await fetch(`${this.helperServiceUrl}/api/fallback-contact`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, contact, message, sessionId: this.sessionId })
            });
            
            this.addMessage('✅ Спасибо! Ваша заявка принята. Мы скоро с вами свяжемся.', 'bot');
            const fallbackForm = document.querySelector('.bm-fallback-form');
            if (fallbackForm) fallbackForm.style.display = 'none';

        } catch (error) {
            console.error('Fallback send error:', error);
            alert('Не удалось отправить заявку. Пожалуйста, скопируйте ваши данные и свяжитесь с нами напрямую.');
            button.disabled = false;
            button.textContent = 'Отправить';
        }
    },

    async showUploadButton() {
        this.addMessage("Одну минуту, готовлю безопасную форму для загрузки...", "bot");
        
        try {
            const response = await fetch(`${this.helperServiceUrl}/api/generate-signature`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId: this.sessionId })
            });

            if (!response.ok) throw new Error('Signature generation failed');
            
            const { signature, expire } = await response.json();

            const messagesContainer = document.getElementById('bmChatMessages');
            const uploadButton = document.createElement('button');
            uploadButton.className = 'bm-upload-btn';
            uploadButton.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
                </svg>
                <span>Прикрепить файл</span>
            `;
        
            uploadButton.onclick = () => {
                const widget = uploadcare.openDialog(null, {
                    publicKey: window.UPLOADCARE_PUBLIC_KEY,
                    secureSignature: signature,
                    secureExpire: expire,
                    imagesOnly: false,
                    tabs: 'file url'
                });

                widget.onDone((fileInfo) => {
                    console.log('File uploaded:', fileInfo.cdnUrl);
                    this.addMessage(`✅ Файл принят: ${fileInfo.name}.<br>Менеджер скоро его изучит.`, 'bot');
                    
                    fetch('https://auto.golubef.store/webhook/file-upload-bm', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            sessionId: this.sessionId,
                            firstname: 'Посетитель',
                            file: fileInfo.originalUrl,
                            fileName: fileInfo.name,
                            fileSize: fileInfo.size,
                            fileMime: fileInfo.mimeType
                        })
                    }).catch(err => console.error('File upload notification failed', err));

                    this.saveChatHistory();
                });
            };

            messagesContainer.appendChild(uploadButton);
            this.scrollToBottom();

        } catch (error) {
            console.error('Upload button error:', error);
            this.addMessage('Не удалось открыть форму загрузки. Пожалуйста, попробуйте позже.', 'bot');
        }
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
            localStorage.removeItem('bm_chat_history');
        }
    },
    
    saveChatHistory() {
        const messages = document.getElementById('bmChatMessages').innerHTML;
        const chatData = {
            sessionId: this.sessionId,
            messages: messages,
            timestamp: Date.now()
        };
        
        localStorage.setItem('bm_chat_history', JSON.stringify(chatData));
    },
    
    loadChatHistory() {
        const savedData = localStorage.getItem('bm_chat_history');
        
        if (savedData) {
            try {
                const chatData = JSON.parse(savedData);
                
                if (Date.now() - chatData.timestamp > 24 * 60 * 60 * 1000) {
                    localStorage.removeItem('bm_chat_history');
                    return;
                }
                
                this.sessionId = chatData.sessionId;
                document.getElementById('bmChatMessages').innerHTML = chatData.messages;
            } catch (error) {
                localStorage.removeItem('bm_chat_history');
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    BMChat.init();
});